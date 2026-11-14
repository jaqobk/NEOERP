import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
// @ts-ignore
import { onRequest } from './server-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite = new Database(path.join(__dirname, 'neo-erp.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('temp_store = MEMORY');
sqlite.pragma('cache_size = -32000');
sqlite.pragma('mmap_size = 268435456');

const stmtCache = new Map<string, Database.Statement>();
function getPreparedStmt(sql: string): Database.Statement {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = sqlite.prepare(sql);
    if (stmtCache.size < 400) stmtCache.set(sql, stmt);
  }
  return stmt;
}

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  sqlite.exec(schemaSql);
}

// Ensure core multi-tenant tables exist on startup without seeding development credentials
function seedInitialData() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT DEFAULT 'starter',
        status TEXT DEFAULT 'active',
        maxUsers INTEGER DEFAULT 5,
        maxBranches INTEGER DEFAULT 1,
        createdAt INTEGER,
        ownerEmail TEXT,
        notes TEXT,
        trialEndsAt INTEGER,
        lastPaymentAt INTEGER,
        lastPaymentPeriod TEXT
      );
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        tenantId TEXT,
        name TEXT,
        address TEXT,
        phone TEXT,
        status TEXT DEFAULT 'Active',
        isDefault INTEGER DEFAULT 0,
        createdAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        username TEXT,
        ip TEXT,
        at INTEGER,
        ok INTEGER
      );
    `);
  } catch (err) {
    console.error('Schema init error:', err);
  }
}

seedInitialData();

// Cloudflare D1 compatible wrapper around better-sqlite3
function sanitizeParam(val: any): any {
  if (val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val !== null && typeof val === 'object' && !Buffer.isBuffer(val) && !(val instanceof Uint8Array)) {
    return JSON.stringify(val);
  }
  return val;
}

class D1PreparedStatement {
  private sql: string;
  private params: any[];

  constructor(sql: string, params: any[] = []) {
    this.sql = sql;
    this.params = params;
  }

  bind(...values: any[]) {
    return new D1PreparedStatement(this.sql, values.map(sanitizeParam));
  }

  async all() {
    const stmt = getPreparedStmt(this.sql);
    if (stmt.reader) {
      const results = stmt.all(...this.params);
      return { results: results || [], success: true, meta: { changes: 0 } };
    } else {
      const info = stmt.run(...this.params);
      return {
        results: [],
        success: true,
        meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) }
      };
    }
  }

  async first(colName?: string) {
    const stmt = getPreparedStmt(this.sql);
    if (stmt.reader) {
      const row = stmt.get(...this.params) as Record<string, any> | undefined;
      if (!row) return null;
      if (colName) return row[colName] ?? null;
      return row;
    } else {
      stmt.run(...this.params);
      return null;
    }
  }

  async run() {
    const stmt = getPreparedStmt(this.sql);
    if (stmt.reader) {
      const results = stmt.all(...this.params);
      return { results, success: true, meta: { changes: 0 } };
    } else {
      const info = stmt.run(...this.params);
      return {
        results: [],
        success: true,
        meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) }
      };
    }
  }
}

const d1Adapter = {
  prepare(sql: string) {
    return new D1PreparedStatement(sql);
  },
  async batch(statements: D1PreparedStatement[]) {
    const results: any[] = [];
    const tx = sqlite.transaction((stmts: D1PreparedStatement[]) => {
      for (const s of stmts) {
        // Execute synchronously inside transaction
        const stmt = getPreparedStmt((s as any).sql);
        const params = (s as any).params || [];
        if (stmt.reader) {
          const rows = stmt.all(...params);
          results.push({ results: rows || [], success: true, meta: { changes: 0 } });
        } else {
          const info = stmt.run(...params);
          results.push({
            results: [],
            success: true,
            meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) }
          });
        }
      }
    });
    tx(statements);
    return results;
  }
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipArchive(files: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8');
    const raw = file.data;
    const compressed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(8, 8); // Deflate
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    localParts.push(localHeader, compressed);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get('/api/download-update-zip', (_req, res) => {
    try {
      const mapping: Array<{ zipPath: string; diskCandidates: string[] }> = [
        { zipPath: 'functions/api/[[route]].js', diskCandidates: ['server-api.js'] },
        { zipPath: 'src/App.jsx', diskCandidates: ['src/App.jsx'] },
        { zipPath: 'src/App.css', diskCandidates: ['src/App.css', 'public/assets/aistudio/App_6e25a776.css'] },
        { zipPath: 'src/index.css', diskCandidates: ['src/index.css', 'public/assets/aistudio/index_b31851a4.css'] },
        { zipPath: 'src/main.jsx', diskCandidates: ['src/main.jsx', 'public/assets/aistudio/main_4b4b864d.jsx'] },
        { zipPath: 'index.html', diskCandidates: ['public/assets/aistudio/index_675264dc.html', 'index.html'] },
        { zipPath: 'schema.sql', diskCandidates: ['schema.sql'] },
        { zipPath: 'package.json', diskCandidates: ['public/assets/aistudio/package_17bcb0d4.json', 'package.json'] },
        { zipPath: 'vite.config.js', diskCandidates: ['public/assets/aistudio/vite.config_299edcf7.js'] },
        { zipPath: 'wrangler.toml', diskCandidates: ['public/assets/aistudio/wrangler_c8ad6f36.toml'] },
        { zipPath: 'README.md', diskCandidates: ['public/assets/aistudio/README_f85c8c72.md'] }
      ];

      const entries: Array<{ name: string; data: Buffer }> = [];
      for (const item of mapping) {
        const found = item.diskCandidates
          .map(rel => path.join(__dirname, rel))
          .find(full => fs.existsSync(full));
        if (found) {
          entries.push({ name: item.zipPath, data: fs.readFileSync(found) });
        }
      }

      const zipBuf = buildZipArchive(entries);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="neo-erp-cloudflare-update-${stamp}.zip"`);
      res.setHeader('Content-Length', String(zipBuf.length));
      res.status(200).send(zipBuf);
    } catch (err: any) {
      console.error('ZIP generation failed:', err);
      res.status(500).json({ error: err?.message || 'Could not generate ZIP archive' });
    }
  });

  // Parse raw body for /api routes so Web Fetch Request receives exact payload
  app.use('/api', express.raw({ type: '*/*', limit: '25mb' }));

  app.all('/api/*', async (req, res) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, String(value));
          }
        }
      }

      const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
      const bodyBuffer = hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined
      });

      const env = {
        DB: d1Adapter,
        SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME || '',
        SUPER_ADMIN_PIN: process.env.SUPER_ADMIN_PIN || '',
        JWT_SECRET: process.env.JWT_SECRET || '',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || ''
      };

      const webRes: Response = await onRequest({ request: webReq, env });

      res.status(webRes.status);
      webRes.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, val);
        }
      });

      const textBody = await webRes.text();
      res.send(textBody);
    } catch (err: any) {
      console.error('API Error:', err);
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`A40 ERP server running on http://localhost:${PORT}`);
  });
}

startServer();
