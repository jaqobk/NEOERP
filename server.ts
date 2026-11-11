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

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  sqlite.exec(schemaSql);
}

// Seed default shop, users, roles, categories, statuses, and sample inventory if empty
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
    `);

    const userCountRow = sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number } | undefined;
    if (!userCountRow || userCountRow.c === 0) {
      const now = Date.now();
      const tid = 'tenant-default';
      const branchId = 'br-default-main';

      sqlite.prepare(
        `INSERT OR IGNORE INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, ownerEmail, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(tid, 'NEO Fashion Boutique', 'business', 'active', 15, 3, now, 'admin@neofashion.co.ke', 'Default Shop');

      sqlite.prepare(
        `INSERT OR IGNORE INTO branches (id, tenantId, name, address, phone, status, isDefault, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(branchId, tid, 'Main Branch - CBD', 'Kimathi Street, Nairobi', '+254 700 000000', 'Active', 1, now);

      sqlite.prepare(
        `INSERT OR IGNORE INTO shop_profile (id, name, tagline, currency, phone, location, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(tid, 'NEO Fashion Boutique', 'Premium Apparel & Footwear', 'KSh', '+254 700 000000', 'Kimathi Street, Nairobi', tid);

      // Users (plain PINs are automatically verified and upgraded to PBKDF2 on first login by server-api.js)
      const insertUser = sqlite.prepare(
        `INSERT OR IGNORE INTO users (id, name, role, pin, phone, status, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      insertUser.run('u1', 'Main Admin', 'Admin', '1234', '+254 700 000000', 'Active', tid);
      insertUser.run('u2', 'Alice Wambui', 'Salesperson', '5678', '+254 711 222333', 'Active', tid);
      insertUser.run('u3', 'Benta Akinyi', 'Manager', '0000', '+254 733 999888', 'Active', tid);

      // Roles
      const adminPriv = JSON.stringify({
        dashboard: { view: true, create: true, update: true, delete: true, ownOnly: false },
        pos: { view: true, create: true, update: true, delete: true, ownOnly: false },
        sales: { view: true, create: true, update: true, delete: true, ownOnly: false },
        inventory: { view: true, create: true, update: true, delete: true, ownOnly: false },
        expenses: { view: true, create: true, update: true, delete: true, ownOnly: false },
        laybys: { view: true, create: true, update: true, delete: true, ownOnly: false },
        customers: { view: true, create: true, update: true, delete: true, ownOnly: false },
        suppliers: { view: true, create: true, update: true, delete: true, ownOnly: false },
        reports: { view: true, create: true, update: true, delete: true, ownOnly: false },
        reportSales: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportPurchase: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportExpense: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportHr: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportCustomer: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportInventory: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportAging: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportFinancial: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportLedger: { view: true, create: false, update: false, delete: false, ownOnly: false },
        settings: { view: true, create: true, update: true, delete: true, ownOnly: false },
        purchase: { view: true, create: true, update: true, delete: true, ownOnly: false },
        employees: { view: true, create: true, update: true, delete: true, ownOnly: false },
        payroll: { view: true, create: true, update: true, delete: true, ownOnly: false },
        hr: { view: true, create: true, update: true, delete: true, ownOnly: false }
      });
      const managerPriv = JSON.stringify({
        dashboard: { view: true, create: false, update: false, delete: false, ownOnly: false },
        pos: { view: true, create: true, update: true, delete: false, ownOnly: false },
        sales: { view: true, create: true, update: true, delete: false, ownOnly: false },
        inventory: { view: true, create: true, update: true, delete: false, ownOnly: false },
        expenses: { view: true, create: true, update: true, delete: false, ownOnly: false },
        laybys: { view: true, create: true, update: true, delete: false, ownOnly: false },
        customers: { view: true, create: true, update: true, delete: false, ownOnly: false },
        suppliers: { view: true, create: true, update: true, delete: false, ownOnly: false },
        reports: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportSales: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportPurchase: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportExpense: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportHr: { view: true, create: false, update: false, delete: false, ownOnly: false },
        reportCustomer: { view: true, create: false, update: false, delete: false, ownOnly: false },
        settings: { view: false, create: false, update: false, delete: false, ownOnly: false },
        purchase: { view: true, create: true, update: true, delete: false, ownOnly: false },
        employees: { view: true, create: true, update: true, delete: false, ownOnly: false },
        payroll: { view: true, create: true, update: true, delete: false, ownOnly: false },
        hr: { view: true, create: true, update: true, delete: false, ownOnly: false }
      });
      const salesPriv = JSON.stringify({
        dashboard: { view: false, create: false, update: false, delete: false, ownOnly: false },
        pos: { view: true, create: true, update: false, delete: false, ownOnly: true },
        sales: { view: true, create: false, update: false, delete: false, ownOnly: true },
        inventory: { view: true, create: false, update: false, delete: false, ownOnly: false },
        expenses: { view: false, create: false, update: false, delete: false, ownOnly: false },
        laybys: { view: true, create: true, update: true, delete: false, ownOnly: true },
        customers: { view: true, create: true, update: true, delete: false, ownOnly: false },
        suppliers: { view: false, create: false, update: false, delete: false, ownOnly: false },
        reports: { view: false, create: false, update: false, delete: false, ownOnly: false },
        settings: { view: false, create: false, update: false, delete: false, ownOnly: false },
        purchase: { view: false, create: false, update: false, delete: false, ownOnly: false },
        employees: { view: false, create: false, update: false, delete: false, ownOnly: false },
        payroll: { view: false, create: false, update: false, delete: false, ownOnly: false },
        hr: { view: false, create: false, update: false, delete: false, ownOnly: false }
      });

      const insertRole = sqlite.prepare(
        `INSERT OR IGNORE INTO roles (id, name, privileges, tenantId) VALUES (?, ?, ?, ?)`
      );
      insertRole.run('role-admin', 'Admin', adminPriv, tid);
      insertRole.run('role-manager', 'Manager', managerPriv, tid);
      insertRole.run('role-sales', 'Salesperson', salesPriv, tid);

      // Categories
      const insertCat = sqlite.prepare(`INSERT OR IGNORE INTO categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)`);
      insertCat.run('cat-1', 'Grade A Jackets', 'Active', tid);
      insertCat.run('cat-2', 'Denim & Jeans', 'Active', tid);
      insertCat.run('cat-3', 'Sneakers & Footwear', 'Active', tid);
      insertCat.run('cat-4', 'Dresses & Skirts', 'Active', tid);
      insertCat.run('cat-5', 'Accessories', 'Active', tid);

      // Expense Categories
      const insertExpCat = sqlite.prepare(`INSERT OR IGNORE INTO expense_categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)`);
      insertExpCat.run('ecat-1', 'Store Rent', 'Active', tid);
      insertExpCat.run('ecat-2', 'Electricity & Utilities', 'Active', tid);
      insertExpCat.run('ecat-3', 'Staff Transport', 'Active', tid);
      insertExpCat.run('ecat-4', 'Packaging & Bags', 'Active', tid);

      // Item Statuses
      const insertStatus = sqlite.prepare(`INSERT OR IGNORE INTO item_statuses (id, name, status, canSell, tenantId) VALUES (?, ?, ?, ?, ?)`);
      insertStatus.run('st-1', 'Listed', 'Active', 1, tid);
      insertStatus.run('st-2', 'Reserved', 'Active', 0, tid);
      insertStatus.run('st-3', 'Damaged', 'Active', 0, tid);
      insertStatus.run('st-4', 'Sold', 'Active', 0, tid);

      // Sample Inventory
      const insertInv = sqlite.prepare(
        `INSERT OR IGNORE INTO inventory (id, name, category, buyingPrice, price, wholesalePrice, quantity, lowStockAlert, trackInventory, status, sku, size, colour, branchId, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insertInv.run('inv-1', 'Vintage Leather Bomber Jacket', 'Grade A Jackets', 2200, 4500, 3800, 12, 3, 1, 'Listed', 'JKT-001', 'L', 'Black', branchId, tid);
      insertInv.run('inv-2', 'Slim Fit Selvedge Denim', 'Denim & Jeans', 1100, 2400, 1950, 25, 5, 1, 'Listed', 'DNM-014', '32', 'Indigo', branchId, tid);
      insertInv.run('inv-3', 'Retro Street Runner Sneakers', 'Sneakers & Footwear', 1800, 3800, 3200, 8, 3, 1, 'Listed', 'SNK-203', '42', 'White/Green', branchId, tid);
      insertInv.run('inv-4', 'Pleated Midi Silk Dress', 'Dresses & Skirts', 1500, 3200, 2700, 10, 3, 1, 'Listed', 'DRS-108', 'M', 'Emerald', branchId, tid);

      // Sample Customers
      const insertCust = sqlite.prepare(
        `INSERT OR IGNORE INTO customers (id, name, phone, location, eligibility, loyaltyPoints, priceList, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insertCust.run('cust-walkin', 'Walk-in Customer', '+254 700 000001', 'Nairobi', JSON.stringify(['Paid']), 0, 'retail', tid);
      insertCust.run('cust-2', 'Grace Njeri', '+254 722 111222', 'Westlands', JSON.stringify(['Paid', 'Credit', 'Layby']), 45, 'retail', tid);
      insertCust.run('cust-3', 'Kevin Omondi', '+254 733 444555', 'Kilimani', JSON.stringify(['Paid', 'Layby']), 20, 'wholesale', tid);

      // Sample Suppliers
      const insertSup = sqlite.prepare(
        `INSERT OR IGNORE INTO suppliers (id, name, phone, email, location, creditTermType, creditDays, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insertSup.run('sup-1', 'Gikomba Bale Imports Ltd', '+254 720 888999', 'orders@baleimports.co.ke', 'Industrial Area, Nairobi', 'Credit', 30, tid);
      insertSup.run('sup-2', 'Eastleigh Footwear Wholesale', '+254 711 555666', 'sales@eastleighfootwear.co.ke', 'Eastleigh, Nairobi', 'COD', 0, tid);
    }
  } catch (err) {
    console.error('Seed error:', err);
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
    const stmt = sqlite.prepare(this.sql);
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
    const stmt = sqlite.prepare(this.sql);
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
    const stmt = sqlite.prepare(this.sql);
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
        const stmt = sqlite.prepare((s as any).sql);
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
        SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME || 'platform',
        SUPER_ADMIN_PIN: process.env.SUPER_ADMIN_PIN || '1234',
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
