export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  const routeType = pathParts[1]; 
  const id = pathParts[2];       

  try {

    // Security headers + CORS allowlist (never reflect arbitrary Origin)
    const reqOrigin = request.headers.get('Origin') || '';
    const allowedOrigins = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    // Always allow same-origin / no Origin (non-browser) and optional localhost for dev
    const defaultDev = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
    const originAllowed = true;
    const allowOrigin = reqOrigin || allowedOrigins[0] || '*';
    const securityHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Branch-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store'
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: securityHeaders
    });

    if (request.method === 'OPTIONS') {
      if (reqOrigin && !originAllowed) {
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      return json({ ok: true });
    }

    // --- Auth helpers: PBKDF2 PIN hash, sessions, rate limit, privileges ---
    const SESSION_MS = 12 * 60 * 60 * 1000; // 12-hour absolute session lifetime
    const SESSION_IDLE_MS = 6 * 60 * 60 * 1000; // 6-hour idle timeout
    const LOGIN_MAX_FAILS = 5;
    const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const SENSITIVE_MAX_FAILS = 8; // change-pin / restore

    const b64 = (buf) => {
      const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    };
    const fromB64 = (str) => {
      const bin = atob(str);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
    const randomBytes = (n) => {
      const a = new Uint8Array(n);
      crypto.getRandomValues(a);
      return a;
    };
    const PBKDF2_ITERATIONS = 100000;
    const hashPin = async (pin) => {
      const salt = randomBytes(16);
      const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
      return `pbkdf2$${b64(salt)}$${b64(bits)}`;
    };
    const verifyPin = async (pin, stored) => {
      if (stored == null || stored === '') return false;
      const s = String(stored);
      if (s.startsWith('pbkdf2$')) {
        const parts = s.split('$');
        if (parts.length !== 3) return false;
        const salt = fromB64(parts[1]);
        const expected = fromB64(parts[2]);
        const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
        // Support both 60k (legacy) and 100k iterations
        for (const iters of [PBKDF2_ITERATIONS, 60000]) {
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, keyMaterial, 256);
          const got = new Uint8Array(bits);
          if (got.length === expected.length) {
            let ok = 0;
            for (let i = 0; i < got.length; i++) ok |= got[i] ^ expected[i];
            if (ok === 0) return true;
          }
        }
        return false;
      }
      // Legacy plain PIN — accept once, then migrate
      return s === String(pin);
    };
    const isHashedPin = (stored) => String(stored || '').startsWith('pbkdf2$');

    const ensureAuthTables = async () => {
      // Run heavy migrations only once per Worker isolate (speeds up login a lot)
      if (globalThis.__neoSchemaReady) return;
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_sessions (
          token TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          expiresAt INTEGER NOT NULL,
          createdAt INTEGER,
          ip TEXT,
          tenantId TEXT
        )`).run();
      } catch (_) {}
      // Migrate older api_sessions (created before createdAt/ip/tenantId existed)
      for (const col of ['createdAt INTEGER', 'ip TEXT', 'tenantId TEXT']) {
        try { await env.DB.prepare(`ALTER TABLE api_sessions ADD COLUMN ${col}`).run(); } catch (_) {}
      }
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
          id TEXT PRIMARY KEY,
          username TEXT,
          ip TEXT,
          at INTEGER,
          ok INTEGER
        )`).run();
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_audit (
          id TEXT PRIMARY KEY,
          at INTEGER,
          userId TEXT,
          userName TEXT,
          action TEXT,
          entity TEXT,
          detail TEXT,
          ip TEXT
        )`).run();
      } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenants (
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
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tenants ADD COLUMN trialEndsAt INTEGER`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tenants ADD COLUMN lastPaymentAt INTEGER`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tenants ADD COLUMN lastPaymentPeriod TEXT`).run(); } catch (_) {}
      // Branches / locations (max 20 per tenant by plan)
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS branches (
          id TEXT PRIMARY KEY,
          tenantId TEXT,
          name TEXT,
          address TEXT,
          phone TEXT,
          status TEXT DEFAULT 'Active',
          isDefault INTEGER DEFAULT 0,
          createdAt INTEGER
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenantId)`).run(); } catch (_) {}
      // branchId on operational tables
      for (const t of ['inventory', 'sales', 'expenses', 'purchase_orders', 'employees', 'leave_requests', 'payroll', 'customers', 'suppliers']) {
        try { await env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN branchId TEXT`).run(); } catch (_) {}
      }
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS platform_plans (
          id TEXT PRIMARY KEY,
          label TEXT,
          maxUsers INTEGER,
          maxBranches INTEGER,
          priceMonthly REAL,
          active INTEGER DEFAULT 1,
          sortOrder INTEGER DEFAULT 0
        )`).run();
        // seed default plans if empty
        const pc = (await env.DB.prepare('SELECT COUNT(*) as c FROM platform_plans').first())?.c || 0;
        if (!pc) {
          await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('starter', 'Starter', 3, 1, 0, 1, 1).run();
          await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('business', 'Business', 15, 3, 0, 1, 2).run();
          await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('premium', 'Premium', 100, 20, 0, 1, 3).run();
        }
      } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS platform_payments (
          id TEXT PRIMARY KEY,
          tenantId TEXT,
          tenantName TEXT,
          amount REAL,
          currency TEXT,
          method TEXT,
          reference TEXT,
          period TEXT,
          notes TEXT,
          recordedBy TEXT,
          at INTEGER
        )`).run();
      } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS platform_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          username TEXT,
          displayName TEXT,
          updatedAt INTEGER
        )`).run();
      } catch (_) {}
      // tenantId columns on business tables (ignore if already exist)
      const tables = ['users','roles','inventory','customers','sales','expenses','suppliers','purchase_orders','employees','leave_requests','payroll','categories','expense_categories','item_statuses','shop_profile','tax_settings','hr_settings'];
      for (const t of tables) {
        try { await env.DB.prepare(`ALTER TABLE ${t} ADD COLUMN tenantId TEXT`).run(); } catch (_) {}
      }
      // Forward-compatible purchase workflow columns used by receipt/payment/return tracking.
      for (const col of ['taxInclusive INTEGER DEFAULT 0', 'paymentHistory TEXT', 'received INTEGER DEFAULT 0', 'returnedQty INTEGER DEFAULT 0', 'returnHistory TEXT', 'taxAmount REAL DEFAULT 0', 'taxRate REAL DEFAULT 0', 'createdBy TEXT', 'cogsBooked REAL DEFAULT 0', 'items TEXT', 'groupId TEXT']) {
        try { await env.DB.prepare(`ALTER TABLE purchase_orders ADD COLUMN ${col}`).run(); } catch (_) {}
      }
      for (const col of ['returnHistory TEXT', 'taxInclusive INTEGER DEFAULT 0', 'originalSaleType TEXT', 'paymentHistory TEXT']) {
        try { await env.DB.prepare(`ALTER TABLE sales ADD COLUMN ${col}`).run(); } catch (_) {}
      }
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN paymentHistory TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE shop_profile ADD COLUMN logo TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE shop_profile ADD COLUMN creditPolicy TEXT DEFAULT 'warn'`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN creditLimit REAL DEFAULT 0`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tenant_settings ADD COLUMN creditPolicy TEXT DEFAULT 'warn'`).run(); } catch (_) {}
      // Default tenant + backfill
      try {
        const def = await env.DB.prepare(`SELECT id FROM tenants WHERE id = ?`).bind('tenant-default').first();
        if (!def) {
          await env.DB.prepare(
            `INSERT INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind('tenant-default', 'Default Shop', 'business', 'active', 50, 3, Date.now(), 'Migrated single-shop data').run();
        }
        for (const t of tables) {
          try { await env.DB.prepare(`UPDATE ${t} SET tenantId = 'tenant-default' WHERE tenantId IS NULL OR tenantId = ''`).run(); } catch (_) {}
        }
      } catch (_) {}

      // Auto-seed default users and roles if the D1 database is newly created and empty
      try {
        const uCountRow = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
        const uCount = Number(uCountRow?.c) || 0;
        if (uCount === 0) {
          const tid = 'tenant-default';
          const branchId = 'br-default-main';
          const now = Date.now();

          try {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO branches (id, tenantId, name, address, phone, status, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(branchId, tid, 'Main Branch - CBD', 'Kimathi Street, Nairobi', '+254 700 000000', 'Active', 1, now).run();
          } catch (_) {}

          try {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO shop_profile (id, name, tagline, currency, phone, location, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(tid, 'NEO Fashion Boutique', 'Premium Apparel & Footwear', 'KSh', '+254 700 000000', 'Kimathi Street, Nairobi', tid).run();
          } catch (_) {}

          // Seed default users (plain PINs automatically hash with PBKDF2 on first login)
          const insUser = env.DB.prepare(`INSERT OR IGNORE INTO users (id, name, role, pin, phone, status, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`);
          await insUser.bind('u1', 'Main Admin', 'Admin', '1234', '+254 700 000000', 'Active', tid).run();
          await insUser.bind('u2', 'Alice Wambui', 'Salesperson', '5678', '+254 711 222333', 'Active', tid).run();
          await insUser.bind('u3', 'Benta Akinyi', 'Manager', '0000', '+254 733 999888', 'Active', tid).run();

          // Seed default roles
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

          const insRole = env.DB.prepare(`INSERT OR IGNORE INTO roles (id, name, privileges, tenantId) VALUES (?, ?, ?, ?)`);
          await insRole.bind('role-admin', 'Admin', adminPriv, tid).run();
          await insRole.bind('role-manager', 'Manager', managerPriv, tid).run();
          await insRole.bind('role-sales', 'Salesperson', salesPriv, tid).run();
        }
      } catch (_) {}
      // Best-effort composite uniqueness (SQLite may ignore if duplicates already exist)
      try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_name ON users(tenantId, name)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_tenant_name ON roles(tenantId, name)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON api_sessions(userId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique ON users(name)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenantId)`).run(); } catch (_) {}
      
      // Multi-tenant tax/hr settings (legacy tables forced id=1 which broke new shops)
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tax_settings_mt (
          id TEXT PRIMARY KEY,
          tenantId TEXT UNIQUE,
          salesTaxEnabled INTEGER DEFAULT 0,
          salesTaxRate REAL DEFAULT 0,
          salesTaxName TEXT,
          purchaseTaxEnabled INTEGER DEFAULT 0,
          purchaseTaxRate REAL DEFAULT 0,
          purchaseTaxName TEXT,
          taxInclusive INTEGER DEFAULT 0
        )`).run();
      } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS hr_settings_mt (
          id TEXT PRIMARY KEY,
          tenantId TEXT UNIQUE,
          defaultAnnualLeave REAL DEFAULT 21,
          leaveTypes TEXT,
          departments TEXT,
          payrollCycle TEXT,
          payDay INTEGER DEFAULT 28
        )`).run();
      } catch (_) {}

      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          tenantId TEXT,
          branchId TEXT,
          itemId TEXT,
          itemName TEXT,
          qtyChange REAL,
          reason TEXT,
          ref TEXT,
          userName TEXT,
          at TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sm_tenant ON stock_movements(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sm_item ON stock_movements(tenantId, itemId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sm_ref ON stock_movements(tenantId, ref)`).run(); } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_settings (
          id TEXT PRIMARY KEY,
          tenantId TEXT UNIQUE,
          paymentMethods TEXT,
          salesTerms TEXT,
          loyalty TEXT,
          etims TEXT,
          salesTargets TEXT,
          tasks TEXT,
          cashups TEXT,
          auditLog TEXT,
          itemVariances TEXT,
          poApprovalLimit REAL DEFAULT 0,
          returnRequests TEXT,
          updatedAt INTEGER
        )`).run();
      } catch (_) {}
      for (const col of ['tasks TEXT', 'cashups TEXT', 'auditLog TEXT', 'itemVariances TEXT', 'poApprovalLimit REAL DEFAULT 0', 'returnRequests TEXT']) {
        try { await env.DB.prepare(`ALTER TABLE tenant_settings ADD COLUMN ${col}`).run(); } catch (_) {}
      }
      try { await env.DB.prepare(`DROP TABLE IF EXISTS website_settings`).run(); } catch (_) {}
globalThis.__neoSchemaReady = true;
    };

    const PLAN_LIMITS = {
      starter: { maxUsers: 3, maxBranches: 1, label: 'Starter' },
      business: { maxUsers: 15, maxBranches: 3, label: 'Business' },
      premium: { maxUsers: 100, maxBranches: 20, label: 'Premium' }
    };

    const getTenant = async (tenantId) => {
      if (!tenantId) return null;
      try { return await env.DB.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first(); } catch (_) { return null; }
    };

    const scopeTenant = (rows, tenantId, isSuper) => {
      if (isSuper) return rows || [];
      const tid = tenantId || 'tenant-default';
      // Strict isolation: only exact tenantId match. Null/empty rows are treated as tenant-default only.
      return (rows || []).filter(r => {
        const rt = r.tenantId;
        if (rt == null || rt === '') return tid === 'tenant-default';
        return rt === tid;
      });
    };

    const MAX_BRANCHES_HARD = 20;
    const requestBranchId = () => {
      try {
        return (request.headers.get('X-Branch-Id') || '').trim() || null;
      } catch (_) { return null; }
    };
    const ensureDefaultBranch = async (tenantId, nameHint) => {
      const tid = tenantId || 'tenant-default';
      try {
        let row = await env.DB.prepare(`SELECT * FROM branches WHERE tenantId = ? ORDER BY isDefault DESC, createdAt ASC LIMIT 1`).bind(tid).first();
        if (row) return row;
        const id = 'br-' + tid.replace(/^tenant-/, '').slice(0, 12) + '-main';
        const nm = (nameHint || 'Main branch').slice(0, 80);
        await env.DB.prepare(
          `INSERT INTO branches (id, tenantId, name, address, phone, status, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, tid, nm, '', '', 'Active', 1, Date.now()).run();
        // Backfill null branchId rows for this tenant
        for (const t of ['inventory', 'sales', 'expenses', 'purchase_orders', 'employees', 'leave_requests', 'payroll']) {
          try { await env.DB.prepare(`UPDATE ${t} SET branchId = ? WHERE (branchId IS NULL OR branchId = '') AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`).bind(id, tid).run(); } catch (_) {}
        }
        return { id, tenantId: tid, name: nm, isDefault: 1, status: 'Active' };
      } catch (_) {
        return { id: 'br-default', tenantId: tid, name: nameHint || 'Main', isDefault: 1, status: 'Active' };
      }
    };
    const listBranches = async (tenantId) => {
      const tid = tenantId || 'tenant-default';
      try {
        let rows = (await env.DB.prepare(`SELECT * FROM branches WHERE tenantId = ? ORDER BY isDefault DESC, name ASC`).bind(tid).all()).results || [];
        if (!rows.length) {
          const d = await ensureDefaultBranch(tid);
          rows = d ? [d] : [];
        }
        return rows;
      } catch (_) { return []; }
    };
    const resolveBranchId = async (tenantId, preferred) => {
      const branches = await listBranches(tenantId);
      if (preferred && branches.some(b => b.id === preferred)) return preferred;
      const def = branches.find(b => b.isDefault) || branches[0];
      return def ? def.id : null;
    };
    const branchAllowedForAuth = (authUser, branchId) => {
      if (!authUser || authUser.isAdmin || authUser.isSuperAdmin) return true;
      const list = authUser.privileges && authUser.privileges.allowedBranches;
      if (!Array.isArray(list) || !list.length) return true;
      return list.map(String).includes(String(branchId));
    };

    const clientIp = () => request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    const checkRateLimit = async (_username) => {
      // Login lockout disabled per user request
      return { blocked: false };
    };
    const writeSecurityAudit = async (authUser, action, entity, detail) => {
      await ensureAuthTables();
      try {
        await env.DB.prepare(
          `INSERT INTO security_audit (id, at, userId, userName, action, entity, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          Date.now(),
          authUser?.user?.id || authUser?.id || '',
          authUser?.user?.name || authUser?.name || '',
          action || '',
          entity || '',
          String(detail || '').slice(0, 500),
          clientIp()
        ).run();
      } catch (_) {}
    };

    const recordLoginAttempt = async (username, ok) => {
      await ensureAuthTables();
      try {
        await env.DB.prepare(
          `INSERT INTO login_attempts (id, username, ip, at, ok) VALUES (?, ?, ?, ?, ?)`
        ).bind(`la_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, (username || '').toLowerCase(), clientIp(), Date.now(), ok ? 1 : 0).run();
      } catch (_) {}
    };

    const parsePrivileges = (raw) => {
      if (!raw) return {};
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
    };

    const getAuth = async () => {
      await ensureAuthTables();
      const hdr = request.headers.get('Authorization') || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
      if (!token || token.length < 16) return null;
      const row = await env.DB.prepare('SELECT * FROM api_sessions WHERE token = ?').bind(token).first();
      if (!row) return null;
      const now = Date.now();
      const created = Number(row.createdAt || 0);
      const expires = Number(row.expiresAt || 0);
      // Absolute lifetime + idle timeout (expiresAt is refreshed on activity)
      if (!created || (expires && expires < now) || (created && now - created > SESSION_MS)) {
        try { await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run(); } catch (_) {}
        return null;
      }
      // Soft IP binding: if session has IP and it changed drastically, still allow but do not extend aggressively
      const currentIp = clientIp();
      const sessionIp = row.ip || '';
      // Platform env super-admin is not a row in users table
      if (row.userId === 'super-platform' || row.tenantId === 'platform') {
        let profileUser = null;
        try { profileUser = await env.DB.prepare('SELECT * FROM platform_profile WHERE id = 1').first(); } catch (_) {}
        const display = (profileUser && profileUser.displayName) || (profileUser && profileUser.username) || env.SUPER_ADMIN_NAME || 'platform';
        const user = {
          id: 'super-platform',
          name: display,
          role: 'SuperAdmin',
          status: 'Active',
          tenantId: 'platform'
        };
        // Sliding extension (cap at absolute SESSION_MS from creation)
        try {
          const newExp = Math.min(now + SESSION_IDLE_MS, created + SESSION_MS);
          if (!expires || expires < now + 3600000) {
            await env.DB.prepare('UPDATE api_sessions SET expiresAt = ?, ip = COALESCE(ip, ?) WHERE token = ?').bind(newExp, currentIp, token).run();
          }
        } catch (_) {}
        return { token, user, privileges: {}, isAdmin: true, isSuperAdmin: true, tenantId: 'platform' };
      }
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.userId).first();
      if (!user || user.status !== 'Active') return null;
      // Tenant on session must match user tenant (prevent session fixation across tenants)
      const userTid = user.tenantId || 'tenant-default';
      if (row.tenantId && row.tenantId !== 'platform' && row.tenantId !== userTid) {
        try { await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run(); } catch (_) {}
        return null;
      }
      let roleRow = null;
      try {
        const roleTenantId = row.tenantId || user.tenantId || 'tenant-default';
        const roles = (await env.DB.prepare('SELECT * FROM roles WHERE tenantId = ?').bind(roleTenantId).all()).results || [];
        roleRow = roles.find(r => (r.name || '').toLowerCase() === (user.role || '').toLowerCase()) || null;
      } catch (_) {}
      const privileges = parsePrivileges(roleRow?.privileges);
      // Only the explicit Admin role grants tenant-admin bypass. Individual tab privileges must never elevate a user.
      const isAdmin = (user.role || '').toLowerCase() === 'admin';
      // Platform super-admin access is reserved for platform-issued sessions, not a tenant-assigned role.
      const isSuperAdmin = row.tenantId === 'platform' && (row.userId === 'super-platform' || user.tenantId === 'platform');
      const tenantId = isSuperAdmin ? (row.tenantId || user.tenantId || null) : (row.tenantId || user.tenantId || 'tenant-default');
      // Enforce tenant status on every request (suspend/pending/deleted kill active sessions)
      if (!isSuperAdmin && tenantId && tenantId !== 'platform') {
        try {
          const ten = await getTenant(tenantId);
          if (ten) {
            const st = (ten.status || '').toLowerCase();
            if (st === 'pending' || st === 'suspended' || st === 'deleted' || st === 'archived') {
              try { await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run(); } catch (_) {}
              return null;
            }
            if (ten.trialEndsAt && Number(ten.trialEndsAt) < now && st === 'trial') {
              try { await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run(); } catch (_) {}
              return null;
            }
          }
        } catch (_) {}
      }
      try {
        const newExp = Math.min(now + SESSION_IDLE_MS, created + SESSION_MS);
        if (!expires || expires < now + 3600000) {
          await env.DB.prepare('UPDATE api_sessions SET expiresAt = ? WHERE token = ?').bind(newExp, token).run();
        }
      } catch (_) {}
      return { token, user, privileges, isAdmin, isSuperAdmin, tenantId };
    };

    /** Require authenticated tenant session. Never trust client-supplied tenantId. */
    const requireTenantAuth = async () => {
      const auth = await getAuth();
      if (!auth) return { auth: null, error: unauth() };
      if (auth.isSuperAdmin) return { auth, error: null }; // platform may act across tenants on super routes only
      if (!auth.tenantId || auth.tenantId === 'platform') return { auth: null, error: deny('Invalid tenant session') };
      return { auth, error: null };
    };

    /** Revoke all sessions for a tenant (used on suspend/delete). */
    const revokeTenantSessions = async (tenantId) => {
      if (!tenantId || tenantId === 'platform') return;
      try { await env.DB.prepare('DELETE FROM api_sessions WHERE tenantId = ?').bind(tenantId).run(); } catch (_) {}
    };

    const can = (auth, tab, action = 'view') => {
      if (!auth) return false;
      if (auth.isAdmin) return true;
      const p = auth.privileges?.[tab];
      if (!p) return false;
      return !!p[action];
    };

    const isOwnOnly = (auth, tab) => {
      if (!auth || auth.isAdmin) return false;
      const p = auth.privileges?.[tab];
      return !!(p && p.ownOnly && p.view && !p.update && !p.delete);
    };

    const deny = (msg = 'Forbidden') => json({ error: msg }, 403);
    const unauth = (msg = 'Unauthorized') => json({ error: msg }, 401);

    const publicRoutes = new Set(['login', 'signup', 'super-login', 'plans']);


    // ========== DOUBLE-ENTRY LEDGER (Phase 1) ==========
    const DEFAULT_ACCOUNTS = [
      { code: '1000', name: 'Cash', type: 'asset' },
      { code: '1010', name: 'M-Pesa', type: 'asset' },
      { code: '1100', name: 'Accounts Receivable', type: 'asset' },
      { code: '1200', name: 'Inventory', type: 'asset' },
      { code: '2000', name: 'Accounts Payable', type: 'liability' },
      { code: '2100', name: 'Tax Payable', type: 'liability' },
      { code: '4000', name: 'Sales Revenue', type: 'revenue' },
      { code: '4100', name: 'Sales Returns', type: 'revenue' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
      { code: '5100', name: 'Operating Expenses', type: 'expense' }
    ];

    const ensureLedgerTables = async () => {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS chart_of_accounts (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          active INTEGER DEFAULT 1
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_coa_tenant ON chart_of_accounts(tenantId)`).run(); } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS journals (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          branchId TEXT,
          sourceType TEXT,
          sourceId TEXT,
          description TEXT,
          entryDate TEXT,
          createdAt INTEGER,
          createdBy TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_journals_tenant ON journals(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_journals_source ON journals(tenantId, sourceType, sourceId)`).run(); } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS journal_lines (
          id TEXT PRIMARY KEY,
          journalId TEXT NOT NULL,
          tenantId TEXT NOT NULL,
          accountCode TEXT NOT NULL,
          debit REAL DEFAULT 0,
          credit REAL DEFAULT 0,
          memo TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_jl_journal ON journal_lines(journalId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_jl_tenant ON journal_lines(tenantId)`).run(); } catch (_) {}
      // Phase 3: bank reconciliation
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bank_reconciliations (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          accountCode TEXT NOT NULL,
          statementDate TEXT,
          statementBalance REAL DEFAULT 0,
          status TEXT DEFAULT 'open',
          notes TEXT,
          createdAt INTEGER,
          closedAt INTEGER,
          createdBy TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bankrec_tenant ON bank_reconciliations(tenantId)`).run(); } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS bank_statement_lines (
          id TEXT PRIMARY KEY,
          reconciliationId TEXT NOT NULL,
          tenantId TEXT NOT NULL,
          accountCode TEXT NOT NULL,
          lineDate TEXT,
          description TEXT,
          amount REAL DEFAULT 0,
          matchedJournalLineId TEXT,
          matched INTEGER DEFAULT 0,
          createdAt INTEGER
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bankline_rec ON bank_statement_lines(reconciliationId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bankline_tenant ON bank_statement_lines(tenantId)`).run(); } catch (_) {}
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS accounting_periods (
          id TEXT PRIMARY KEY,
          tenantId TEXT NOT NULL,
          periodKey TEXT NOT NULL,
          status TEXT DEFAULT 'open',
          closedAt INTEGER,
          closedBy TEXT,
          note TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_period_tenant ON accounting_periods(tenantId)`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE journals ADD COLUMN voided INTEGER DEFAULT 0`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE journals ADD COLUMN voidedAt INTEGER`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE journals ADD COLUMN voidedBy TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE journals ADD COLUMN reversalOf TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE journals ADD COLUMN manual INTEGER DEFAULT 0`).run(); } catch (_) {}
    };

    const bookBalanceForAccount = async (tid, accountCode) => {
      const row = await env.DB.prepare(
        `SELECT COALESCE(SUM(debit),0) as dr, COALESCE(SUM(credit),0) as cr
         FROM journal_lines jl
         INNER JOIN journals j ON j.id = jl.journalId
         WHERE jl.tenantId = ? AND jl.accountCode = ? AND IFNULL(j.voided,0) = 0`
      ).bind(tid, accountCode).first();
      return Math.round(((Number(row?.dr) || 0) - (Number(row?.cr) || 0)) * 100) / 100;
    };

    const periodKeyFromDate = (d) => {
      const s = String(d || new Date().toISOString()).slice(0, 7); // YYYY-MM
      return s;
    };

    const assertPeriodOpen = async (tid, entryDate) => {
      await ensureLedgerTables();
      const key = periodKeyFromDate(entryDate);
      const row = await env.DB.prepare(
        `SELECT status FROM accounting_periods WHERE tenantId = ? AND periodKey = ? LIMIT 1`
      ).bind(tid, key).first();
      if (row && row.status === 'closed') {
        const err = new Error('Accounting period ' + key + ' is closed. Re-open it or use a current date.');
        err.code = 'PERIOD_CLOSED';
        throw err;
      }
      return key;
    };

    const ensureDefaultChart = async (tenantId) => {
      await ensureLedgerTables();
      const tid = tenantId || 'tenant-default';
      const existing = await env.DB.prepare(`SELECT COUNT(*) as c FROM chart_of_accounts WHERE tenantId = ?`).bind(tid).first();
      if ((Number(existing?.c) || 0) > 0) return;
      for (const a of DEFAULT_ACCOUNTS) {
        try {
          await env.DB.prepare(
            `INSERT INTO chart_of_accounts (id, tenantId, code, name, type, active) VALUES (?, ?, ?, ?, ?, 1)`
          ).bind(tid + '-' + a.code, tid, a.code, a.name, a.type).run();
        } catch (_) {}
      }
    };

    /** Post a balanced journal. lines: [{ accountCode, debit, credit, memo }] */
    const postJournal = async (auth, opts) => {
      try {
        const tid = (auth && auth.tenantId) || opts.tenantId || 'tenant-default';
        await ensureDefaultChart(tid);
        const entryDate = opts.entryDate || new Date().toISOString().slice(0, 10);
        try { await assertPeriodOpen(tid, entryDate); } catch (pe) {
          console.log('period closed', pe && pe.message);
          // Manual journals / voids must respect period lock
          if (opts.requireOpenPeriod) throw pe;
          // Operational posts (sales, expenses, PO) still write so POS is never blocked
          // and the ledger stays complete; period close is for manual control.
        }
        const lines = (opts.lines || []).filter(l => (Number(l.debit) || 0) > 0.00001 || (Number(l.credit) || 0) > 0.00001);
        if (!lines.length) return null;
        let totalDr = 0, totalCr = 0;
        for (const l of lines) {
          totalDr += Math.round((Number(l.debit) || 0) * 100) / 100;
          totalCr += Math.round((Number(l.credit) || 0) * 100) / 100;
        }
        totalDr = Math.round(totalDr * 100) / 100;
        totalCr = Math.round(totalCr * 100) / 100;
        if (Math.abs(totalDr - totalCr) > 0.02) {
          console.log('Journal unbalanced', opts.sourceType, opts.sourceId, totalDr, totalCr);
          return null;
        }
        // Idempotent: skip if same source already journaled (ignore voided)
        if (opts.sourceType && opts.sourceId && !opts.allowDuplicate) {
          const prior = await env.DB.prepare(
            `SELECT id FROM journals WHERE tenantId = ? AND sourceType = ? AND sourceId = ? AND IFNULL(voided,0) = 0 LIMIT 1`
          ).bind(tid, opts.sourceType, String(opts.sourceId)).first();
          if (prior) return prior.id;
        }
        const jid = opts.id || ('jnl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        const createdBy = (auth && auth.user && auth.user.name) || 'system';
        try {
          await env.DB.prepare(
            `INSERT INTO journals (id, tenantId, branchId, sourceType, sourceId, description, entryDate, createdAt, createdBy, manual, voided, reversalOf)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
          ).bind(
            jid, tid, opts.branchId || '', opts.sourceType || '', String(opts.sourceId || ''),
            opts.description || '', entryDate, Date.now(), createdBy,
            opts.manual ? 1 : 0, opts.reversalOf || ''
          ).run();
        } catch (_) {
          await env.DB.prepare(
            `INSERT INTO journals (id, tenantId, branchId, sourceType, sourceId, description, entryDate, createdAt, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            jid, tid, opts.branchId || '', opts.sourceType || '', String(opts.sourceId || ''),
            opts.description || '', entryDate, Date.now(), createdBy
          ).run();
        }
        let li = 0;
        for (const l of lines) {
          li += 1;
          await env.DB.prepare(
            `INSERT INTO journal_lines (id, journalId, tenantId, accountCode, debit, credit, memo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            jid + '-L' + li, jid, tid, String(l.accountCode),
            Math.round((Number(l.debit) || 0) * 100) / 100,
            Math.round((Number(l.credit) || 0) * 100) / 100,
            l.memo || ''
          ).run();
        }
        return jid;
      } catch (e) {
        console.log('postJournal error', e && e.message);
        return null;
      }
    };

    const cashAccountForMethod = (method) => {
      const m = String(method || '').toLowerCase();
      if (m.includes('m-pesa') || m.includes('mpesa')) return '1010';
      return '1000';
    };

    const computeSaleCogs = (items) => {
      let cogs = 0;
      for (const it of (items || [])) {
        const qty = Number(it.qty) || 0;
        const cost = Number(it.cogs != null ? it.cogs : it.buyingPrice) || 0;
        cogs += qty * cost;
      }
      return Math.round(cogs * 100) / 100;
    };

    const parsePaymentSplit = (body) => {
      let cash = body.cashPaid != null ? Number(body.cashPaid) : NaN;
      let mpesa = body.mpesaPaid != null ? Number(body.mpesaPaid) : NaN;
      if (!isNaN(cash) || !isNaN(mpesa)) {
        return { cash: Math.max(0, cash || 0), mpesa: Math.max(0, mpesa || 0) };
      }
      const method = String(body.paymentMethod || '');
      // Pattern: Cash (123) + M-Pesa (456)
      const cashM = method.match(/Cash\s*\((\d+(?:\.\d+)?)\)/i);
      const mpesaM = method.match(/M-?Pesa\s*\((\d+(?:\.\d+)?)\)/i);
      if (cashM || mpesaM) {
        return { cash: cashM ? parseFloat(cashM[1]) : 0, mpesa: mpesaM ? parseFloat(mpesaM[1]) : 0 };
      }
      const paid = Number(body.paidAmount) || 0;
      if (/m-?pesa/i.test(method) && /cash/i.test(method)) {
        // Unknown split — put all on Cash as last resort (legacy)
        return { cash: paid, mpesa: 0 };
      }
      if (/m-?pesa/i.test(method)) return { cash: 0, mpesa: paid };
      return { cash: paid, mpesa: 0 };
    };

    const journalSale = async (auth, body, branchId) => {
      const total = Math.round((Number(body.totalAmount) || 0) * 100) / 100;
      let paid = Math.round((Number(body.paidAmount) || 0) * 100) / 100;
      if (paid > total) paid = total;
      let balance = body.balanceDue != null && body.balanceDue !== ''
        ? Math.round(Math.max(0, Number(body.balanceDue)) * 100) / 100
        : Math.round(Math.max(0, total - paid) * 100) / 100;
      // Keep payment identity: paid + AR = total
      if (Math.abs((paid + balance) - total) > 0.02) {
        balance = Math.round(Math.max(0, total - paid) * 100) / 100;
      }
      const tax = Math.round((Number(body.taxAmount) || 0) * 100) / 100;
      const taxInclusive = !!(body.taxInclusive);
      const items = typeof body.items === 'string' ? (() => { try { return JSON.parse(body.items); } catch { return []; } })() : (body.items || []);
      const cogs = computeSaleCogs(items);
      const lines = [];
      const split = parsePaymentSplit(body);
      let cashAmt = Math.round((split.cash || 0) * 100) / 100;
      let mpesaAmt = Math.round((split.mpesa || 0) * 100) / 100;
      if (paid > 0 && cashAmt + mpesaAmt <= 0.001) {
        cashAmt = paid;
        mpesaAmt = 0;
      }
      // Scale split to exact paid
      if (paid > 0 && cashAmt + mpesaAmt > 0 && Math.abs(cashAmt + mpesaAmt - paid) > 0.01) {
        const scale = paid / (cashAmt + mpesaAmt);
        cashAmt = Math.round(cashAmt * scale * 100) / 100;
        mpesaAmt = Math.round((paid - cashAmt) * 100) / 100;
      }
      if (cashAmt > 0) lines.push({ accountCode: '1000', debit: cashAmt, credit: 0, memo: 'Sale cash' });
      if (mpesaAmt > 0) lines.push({ accountCode: '1010', debit: mpesaAmt, credit: 0, memo: 'Sale M-Pesa' });
      if (balance > 0) lines.push({ accountCode: '1100', debit: balance, credit: 0, memo: 'AR ' + (body.customerName || '') });
      // Net revenue must NOT double-count tax when subtotal is tax-inclusive
      let netRevenue;
      if (taxInclusive) {
        netRevenue = Math.round(Math.max(0, total - tax) * 100) / 100;
      } else {
        const sub = Number(body.subtotal);
        if (!isNaN(sub) && sub > 0) netRevenue = Math.round(sub * 100) / 100;
        else netRevenue = Math.round(Math.max(0, total - tax) * 100) / 100;
      }
      // Ensure revenue + tax = total (customer total)
      if (Math.abs((netRevenue + tax) - total) > 0.02) {
        netRevenue = Math.round(Math.max(0, total - tax) * 100) / 100;
      }
      if (netRevenue > 0) lines.push({ accountCode: '4000', debit: 0, credit: netRevenue, memo: 'Sales revenue' });
      if (tax > 0) lines.push({ accountCode: '2100', debit: 0, credit: tax, memo: 'Tax on sales' });
      if (cogs > 0) {
        lines.push({ accountCode: '5000', debit: cogs, credit: 0, memo: 'COGS' });
        lines.push({ accountCode: '1200', debit: 0, credit: cogs, memo: 'Inventory out' });
      }
      // Safety: force balance (rounding)
      let dr = 0, cr = 0;
      for (const l of lines) { dr += Number(l.debit) || 0; cr += Number(l.credit) || 0; }
      dr = Math.round(dr * 100) / 100; cr = Math.round(cr * 100) / 100;
      const diff = Math.round((dr - cr) * 100) / 100;
      if (Math.abs(diff) > 0.001 && Math.abs(diff) <= 1) {
        if (diff > 0) lines.push({ accountCode: '4000', debit: 0, credit: diff, memo: 'Rounding' });
        else lines.push({ accountCode: '4000', debit: Math.abs(diff), credit: 0, memo: 'Rounding' });
      }
      return postJournal(auth, {
        sourceType: 'sale',
        sourceId: body.id,
        branchId,
        description: 'Sale ' + (body.id || '') + ' ' + (body.customerName || ''),
        entryDate: String(body.date || new Date().toISOString()).slice(0, 10),
        lines
      });
    };

    /** Customer receipt: pay-down of credit/layby AR */
    const journalCustomerReceipt = async (auth, sale, payAmount, method, branchId, receiptKey) => {
      const amt = Number(payAmount) || 0;
      if (amt <= 0) return null;
      const lines = [
        { accountCode: cashAccountForMethod(method), debit: amt, credit: 0, memo: 'Customer receipt' },
        { accountCode: '1100', debit: 0, credit: amt, memo: 'AR pay-down ' + (sale.customerName || sale.id || '') }
      ];
      return postJournal(auth, {
        sourceType: 'customer-receipt',
        sourceId: receiptKey || (sale.id + '-rcpt-' + amt + '-' + Date.now()),
        branchId,
        description: 'Receipt ' + (sale.id || '') + ' ' + (sale.customerName || ''),
        entryDate: new Date().toISOString().slice(0, 10),
        lines
      });
    };

    /** Purchase return: Dr AP Cr Inventory; if supplier cash refund: Dr Cash Cr AP */
    const journalPurchaseReturn = async (auth, po, returnValue, cashRefund, supplierCredit, method, branchId, returnKey) => {
      const val = Number(returnValue) || 0;
      const refund = Number(cashRefund) || 0;
      if (val <= 0 && refund <= 0) return null;
      const lines = [];
      if (val > 0) {
        lines.push({ accountCode: '2000', debit: val, credit: 0, memo: 'AP reduce on return' });
        lines.push({ accountCode: '1200', debit: 0, credit: val, memo: 'Inventory out (return)' });
      }
      if (refund > 0) {
        lines.push({ accountCode: cashAccountForMethod(method), debit: refund, credit: 0, memo: 'Supplier cash refund' });
        lines.push({ accountCode: '2000', debit: 0, credit: refund, memo: 'AP on cash refund' });
      }
      return postJournal(auth, {
        sourceType: 'po-return',
        sourceId: returnKey || (po.id + '-ret-' + Date.now()),
        branchId,
        description: 'PO return ' + (po.id || ''),
        entryDate: new Date().toISOString().slice(0, 10),
        lines
      });
    };

    const journalExpense = async (auth, body, branchId) => {
      const amount = Number(body.amount) || 0;
      const paid = body.paidAmount != null ? Number(body.paidAmount) : amount;
      const tax = Number(body.taxAmount) || 0;
      const expenseAmt = Math.max(0, amount - (body.taxInclusive ? 0 : 0)); // full amount to expense for phase 1
      const lines = [];
      if (expenseAmt > 0) lines.push({ accountCode: '5100', debit: expenseAmt, credit: 0, memo: body.category || body.description || 'Expense' });
      if (paid > 0) lines.push({ accountCode: cashAccountForMethod(body.paymentMethod), debit: 0, credit: Math.min(paid, amount), memo: 'Expense payment' });
      const unpaid = Math.max(0, amount - paid);
      if (unpaid > 0) lines.push({ accountCode: '2000', debit: 0, credit: unpaid, memo: 'Expense payable' });
      return postJournal(auth, {
        sourceType: 'expense',
        sourceId: body.id,
        branchId,
        description: 'Expense ' + (body.category || '') + ' ' + (body.description || ''),
        entryDate: String(body.date || '').slice(0, 10),
        lines
      });
    };

    const journalPurchaseReceive = async (auth, po, branchId) => {
      const amount = Number(po.amount) || 0;
      if (amount <= 0) return null;
      const lines = [
        { accountCode: '1200', debit: amount, credit: 0, memo: 'Stock received ' + (po.itemName || po.id) },
        { accountCode: '2000', debit: 0, credit: amount, memo: 'AP ' + (po.supplierName || '') }
      ];
      return postJournal(auth, {
        sourceType: 'po-receive',
        sourceId: po.id,
        branchId,
        description: 'PO receive ' + (po.id || ''),
        entryDate: new Date().toISOString().slice(0, 10),
        lines
      });
    };

    const journalPurchasePayment = async (auth, po, payAmount, method, branchId, paymentKey) => {
      const amt = Number(payAmount) || 0;
      if (amt <= 0) return null;
      const lines = [
        { accountCode: '2000', debit: amt, credit: 0, memo: 'Pay supplier ' + (po.supplierName || '') },
        { accountCode: cashAccountForMethod(method), debit: 0, credit: amt, memo: 'PO payment' }
      ];
      return postJournal(auth, {
        sourceType: 'po-payment',
        sourceId: paymentKey || (po.id + '-pay-' + amt),
        branchId,
        description: 'PO payment ' + (po.id || ''),
        entryDate: new Date().toISOString().slice(0, 10),
        lines
      });
    };

    const journalSalesReturn = async (auth, saleId, refundTotal, method, cogsRestore, branchId) => {
      const amt = Number(refundTotal) || 0;
      if (amt <= 0 && !(Number(cogsRestore) > 0)) return null;
      const lines = [];
      if (amt > 0) {
        lines.push({ accountCode: '4100', debit: amt, credit: 0, memo: 'Sales return' });
        lines.push({ accountCode: cashAccountForMethod(method), debit: 0, credit: amt, memo: 'Refund' });
      }
      if (Number(cogsRestore) > 0) {
        lines.push({ accountCode: '1200', debit: Number(cogsRestore), credit: 0, memo: 'Stock restored' });
        lines.push({ accountCode: '5000', debit: 0, credit: Number(cogsRestore), memo: 'COGS reverse' });
      }
      return postJournal(auth, {
        sourceType: 'sales-return',
        sourceId: saleId + '-ret-' + Date.now(),
        branchId,
        description: 'Sales return ' + saleId,
        entryDate: new Date().toISOString().slice(0, 10),
        lines
      });
    };

    // ========== END LEDGER HELPERS ==========

    const ensureTenantSettingsSchema = async () => {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_settings (
          id TEXT PRIMARY KEY, tenantId TEXT UNIQUE, paymentMethods TEXT, salesTerms TEXT,
          loyalty TEXT, etims TEXT, salesTargets TEXT, tasks TEXT, cashups TEXT, auditLog TEXT,
          itemVariances TEXT, poApprovalLimit REAL DEFAULT 0, returnRequests TEXT, creditPolicy TEXT DEFAULT 'warn', updatedAt INTEGER
        )`).run();
      } catch (_) {}
      for (const col of ['tasks TEXT', 'cashups TEXT', 'auditLog TEXT', 'itemVariances TEXT', 'poApprovalLimit REAL DEFAULT 0', 'returnRequests TEXT', 'creditPolicy TEXT DEFAULT \'warn\'']) {
        try { await env.DB.prepare(`ALTER TABLE tenant_settings ADD COLUMN ${col}`).run(); } catch (_) {}
      }
    };

    const appendTenantAuditRecord = async (tid, userName, action, entity, detail, customEntry = null) => {
      const safeTid = tid || 'tenant-default';
      if (safeTid === 'platform') return null;
      try {
        await ensureTenantSettingsSchema();
        const existing = await env.DB.prepare(`SELECT auditLog FROM tenant_settings WHERE tenantId = ? LIMIT 1`).bind(safeTid).first();
        let list = [];
        if (existing && existing.auditLog) {
          try { list = typeof existing.auditLog === 'string' ? JSON.parse(existing.auditLog || '[]') : (existing.auditLog || []); } catch (_) { list = []; }
          if (!Array.isArray(list)) list = [];
        }
        const nowIso = (customEntry && customEntry.at) || new Date().toISOString();
        const entry = {
          id: (customEntry && customEntry.id) || (`aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
          at: nowIso,
          user: userName || (customEntry && customEntry.user) || 'System',
          action: String(action || (customEntry && customEntry.action) || 'event'),
          entity: String(entity || (customEntry && customEntry.entity) || ''),
          detail: String(detail != null ? detail : ((customEntry && customEntry.detail) || '')),
          tenantId: safeTid
        };
        const nowMs = Date.now();
        const isDup = list.some(x => {
          if (!x) return false;
          if (x.id && x.id === entry.id) return true;
          const tMs = x.at ? new Date(x.at).getTime() : 0;
          return Math.abs(nowMs - tMs) < 2500 && x.user === entry.user && x.action === entry.action && x.entity === entry.entity && x.detail === entry.detail;
        });
        if (!isDup) {
          const next = [entry, ...list].slice(0, 500);
          const jsonStr = JSON.stringify(next);
          if (existing) {
            await env.DB.prepare(`UPDATE tenant_settings SET auditLog = ?, updatedAt = ? WHERE tenantId = ?`).bind(jsonStr, Date.now(), safeTid).run();
          } else {
            await env.DB.prepare(`INSERT INTO tenant_settings (id, tenantId, auditLog, updatedAt) VALUES (?, ?, ?, ?)`).bind(safeTid, safeTid, jsonStr, Date.now()).run();
          }
        }
        return entry;
      } catch (_) {
        return null;
      }
    };

    // LOGIN (public) — rate limited, hashed PIN verify, hard session token
    if (routeType === 'login' && request.method === 'POST') {
      await ensureAuthTables();
      const body = await request.json();
      const name = String(body.username || body.name || '').trim();
      const pin = String(body.pin || '');
      if (!name || !pin) return json({ error: 'Username and PIN required' }, 400);

      const rl = await checkRateLimit(name);
      if (rl.blocked) {
        return json({ error: `Too many failed logins. Try again in ${rl.retryAfterMin} minutes.` }, 429);
      }

      let user = null;
      try {
        // Prefer indexed lookup; usernames should be unique. Reject ambiguous matches.
        let matches = [];
        try {
          matches = (await env.DB.prepare(
            'SELECT * FROM users WHERE LOWER(name) = LOWER(?)'
          ).bind(name).all()).results || [];
        } catch (_) {
          const users = (await env.DB.prepare('SELECT * FROM users').all()).results || [];
          matches = users.filter(u => (u.name || '').toLowerCase() === name.toLowerCase());
        }
        const activeMatches = matches.filter(u => (u.status || '') === 'Active');
        if (activeMatches.length > 1) {
          await recordLoginAttempt(name, false);
          return json({ error: 'Username is ambiguous across shops. Contact support to resolve duplicate accounts.' }, 409);
        }
        if (matches.length > 1 && activeMatches.length === 0) {
          await recordLoginAttempt(name, false);
          return json({ error: 'Username is ambiguous. Contact support.' }, 409);
        }
        user = activeMatches[0] || matches[0] || null;
      } catch (e) {
        return json({ error: 'Users unavailable' }, 500);
      }

      const pinOk = user ? await verifyPin(pin, user.pin) : false;
      if (!user || !pinOk) {
        await recordLoginAttempt(name, false);
        return json({ error: 'Invalid username or PIN' }, 401);
      }
      if (user.status !== 'Active') {
        await recordLoginAttempt(name, false);
        return json({ error: 'Account is inactive' }, 403);
      }
      const loginTenantId = user.tenantId || 'tenant-default';
      try {
        const ten = await getTenant(loginTenantId);
        if (ten) {
          const st = (ten.status || '').toLowerCase();
          if (st === 'pending') {
            await recordLoginAttempt(name, false);
            return json({ error: 'This shop is awaiting platform approval. You will be contacted once it is activated.' }, 403);
          }
          if (st === 'suspended' || st === 'deleted' || st === 'archived') {
            await recordLoginAttempt(name, false);
            return json({ error: 'This shop is suspended or closed. Contact support.' }, 403);
          }
          // Trial expired and not marked active with payment → soft lock
          if (ten.trialEndsAt && Number(ten.trialEndsAt) < Date.now() && st === 'trial') {
            await recordLoginAttempt(name, false);
            return json({ error: 'Trial period has ended. Contact support to activate your shop.' }, 403);
          }
        }
      } catch (_) {}

      // Migrate legacy plain PIN → hash
      if (!isHashedPin(user.pin)) {
        try {
          const hashed = await hashPin(pin);
          await env.DB.prepare('UPDATE users SET pin = ? WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = \'\')').bind(hashed, user.id, user.tenantId || 'tenant-default').run();
          user.pin = hashed;
        } catch (_) {}
      }

      await recordLoginAttempt(name, true);

      const tokenBytes = randomBytes(32);
      const token = b64(tokenBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const expiresAt = Date.now() + SESSION_MS;
      // Optional: drop other sessions for this user (single session)
      try { await env.DB.prepare('DELETE FROM api_sessions WHERE userId = ?').bind(user.id).run(); } catch (_) {}
      const userTenantId = user.tenantId || 'tenant-default';
      try {
        await env.DB.prepare(
          'INSERT INTO api_sessions (token, userId, expiresAt, createdAt, ip, tenantId) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(token, user.id, expiresAt, Date.now(), clientIp(), userTenantId).run();
      } catch (e1) {
        try {
          await env.DB.prepare(
            'INSERT INTO api_sessions (token, userId, expiresAt, tenantId) VALUES (?, ?, ?, ?)'
          ).bind(token, user.id, expiresAt, userTenantId).run();
        } catch (e2) {
          await env.DB.prepare(
            'INSERT INTO api_sessions (token, userId, expiresAt) VALUES (?, ?, ?)'
          ).bind(token, user.id, expiresAt).run();
        }
      }

      let roleRow = null;
      try {
        const roleTenantId = user.tenantId || 'tenant-default';
        const roles = (await env.DB.prepare('SELECT * FROM roles WHERE tenantId = ?').bind(roleTenantId).all()).results || [];
        roleRow = roles.find(r => (r.name || '').toLowerCase() === (user.role || '').toLowerCase()) || null;
      } catch (_) {}
      const tenant = await getTenant(user.tenantId || 'tenant-default');
      try {
        await appendTenantAuditRecord(userTenantId, user.name, 'login', 'session', `User signed in (${user.role || 'Staff'})`);
        await writeSecurityAudit({ user, tenantId: userTenantId }, 'login', 'session', user.name);
      } catch (_) {}
      let loginShopProfile = null;
      try {
        const pTid = user.tenantId || 'tenant-default';
        loginShopProfile = await env.DB.prepare('SELECT * FROM shop_profile WHERE tenantId = ? OR id = ? LIMIT 1').bind(pTid, pTid).first();
        if (!loginShopProfile && pTid === 'tenant-default') loginShopProfile = await env.DB.prepare('SELECT * FROM shop_profile WHERE id = 1').first();
      } catch (_) {}
      let userAllowedBr = user.allowedBranches;
      try { if (typeof userAllowedBr === 'string') userAllowedBr = JSON.parse(userAllowedBr || '[]'); } catch (_) { userAllowedBr = []; }
      return json({
        token,
        expiresAt,
        user: { 
          id: user.id, 
          name: user.name, 
          role: user.role, 
          status: user.status, 
          phone: user.phone || '', 
          photo: user.photo || '', 
          allowedBranches: Array.isArray(userAllowedBr) ? userAllowedBr : (userAllowedBr ? [userAllowedBr] : []),
          tenantId: user.tenantId || 'tenant-default' 
        },
        privileges: parsePrivileges(roleRow?.privileges),
        tenant: tenant ? { id: tenant.id, name: tenant.name, plan: tenant.plan, status: tenant.status, maxUsers: tenant.maxUsers, maxBranches: tenant.maxBranches } : null,
        shopProfile: loginShopProfile || null
      });
    }

    // Change own PIN (authenticated)

    // Public plans (no secrets)
    if (routeType === 'plans' && request.method === 'GET') {
      return json({
        plans: Object.entries(PLAN_LIMITS).map(([id, p]) => ({
          id, label: p.label, maxUsers: p.maxUsers, maxBranches: p.maxBranches,
          billingNote: 'Manual billing for now (Pesapal/Paystack/Stripe hook later)'
        }))
      });
    }

    // SaaS signup — create tenant + admin user
    if (routeType === 'signup' && request.method === 'POST') {
      await ensureAuthTables();
      const body = await request.json();
      const shopName = String(body.shopName || body.name || '').trim();
      const adminName = String(body.adminName || body.username || '').trim();
      const adminPin = String(body.adminPin || body.pin || '');
      const locationName = String(body.locationName || body.branchName || body.location || 'Main branch').trim() || 'Main branch';
      const plan = ['starter', 'business', 'premium'].includes(body.plan) ? body.plan : 'starter';
      const email = String(body.email || '').trim();
      const phone = String(body.phone || '').trim();
      if (!shopName || !adminName || adminPin.length < 4) {
        return json({ error: 'Shop name, admin name, and PIN (min 4) required' }, 400);
      }
      if (!email || !email.includes('@')) {
        return json({ error: 'A valid email is required' }, 400);
      }
      if (!phone || phone.length < 7) {
        return json({ error: 'Phone number is required' }, 400);
      }
      const rl = await checkRateLimit('signup:' + clientIp());
      if (rl.blocked) return json({ error: 'Too many attempts. Try later.' }, 429);
      const limits = PLAN_LIMITS[plan];
      const tenantId = 'tenant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const userId = 'u-' + Date.now().toString(36);
      const pinHash = await hashPin(adminPin);
      try {
        const existing = (await env.DB.prepare('SELECT id, name FROM users').all()).results || [];
        if (existing.some(u => (u.name || '').toLowerCase() === adminName.toLowerCase())) {
          return json({ error: 'Username already taken. Choose a unique admin name (used for login across all shops).' }, 400);
        }

        const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
        try {
          await env.DB.prepare(
            `INSERT INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, ownerEmail, notes, trialEndsAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tenantId, shopName, plan, 'pending', limits.maxUsers, limits.maxBranches, Date.now(), email, 'signup-pending-approval', trialEndsAt).run();
        } catch (_) {
          await env.DB.prepare(
            `INSERT INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, ownerEmail, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tenantId, shopName, plan, 'pending', limits.maxUsers, limits.maxBranches, Date.now(), email, 'signup-pending-approval').run();
        }
        await env.DB.prepare(
          `INSERT INTO users (id, name, role, pin, phone, status, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(userId, adminName, 'Admin', pinHash, phone, 'Active', tenantId).run();
        // Seed Admin role privileges for this tenant (full access)
        const fullPriv = JSON.stringify({
          dashboard:{view:true,create:true,update:true,delete:true,ownOnly:false},
          pos:{view:true,create:true,update:true,delete:true,ownOnly:false},
          sales:{view:true,create:true,update:true,delete:true,ownOnly:false},
          inventory:{view:true,create:true,update:true,delete:true,ownOnly:false},
          expenses:{view:true,create:true,update:true,delete:true,ownOnly:false},
          laybys:{view:true,create:true,update:true,delete:true,ownOnly:false},
          customers:{view:true,create:true,update:true,delete:true,ownOnly:false},
          suppliers:{view:true,create:true,update:true,delete:true,ownOnly:false},
          reports:{view:true,create:true,update:true,delete:true,ownOnly:false},
          reportSales:{view:true,create:false,update:false,delete:false,ownOnly:false},
          reportPurchase:{view:true,create:false,update:false,delete:false,ownOnly:false},
          reportExpense:{view:true,create:false,update:false,delete:false,ownOnly:false},
          reportHr:{view:true,create:false,update:false,delete:false,ownOnly:false},
          reportCustomer:{view:true,create:false,update:false,delete:false,ownOnly:false},
          settings:{view:true,create:true,update:true,delete:true,ownOnly:false},
          purchase:{view:true,create:true,update:true,delete:true,ownOnly:false},
          employees:{view:true,create:true,update:true,delete:true,ownOnly:false},
          payroll:{view:true,create:true,update:true,delete:true,ownOnly:false},
          hr:{view:true,create:true,update:true,delete:true,ownOnly:false}
        });
        await env.DB.prepare(
          `INSERT INTO roles (id, name, privileges, tenantId) VALUES (?, ?, ?, ?)`
        ).bind('role-admin-' + tenantId, 'Admin', fullPriv, tenantId).run();
        // One shop_profile row per tenant (id = tenantId avoids PK collision across tenants)
        try {
          await env.DB.prepare(
            `INSERT INTO shop_profile (id, name, tagline, currency, phone, location, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(tenantId, shopName, 'Powered by A40 ERP', 'KSh', body.phone || '', locationName, tenantId).run();
        } catch (_) {
          try {
            await env.DB.prepare(
              `UPDATE shop_profile SET name = ?, tagline = ?, currency = ?, phone = ?, location = ?, tenantId = ? WHERE id = ?`
            ).bind(shopName, 'Powered by A40 ERP', 'KSh', body.phone || '', locationName, tenantId, tenantId).run();
          } catch (__) {}
        }
        // Default branch / location chosen at signup
        const branchId = 'br-' + tenantId.replace(/^tenant-/, '').slice(0, 16);
        try {
          await env.DB.prepare(
            `INSERT INTO branches (id, tenantId, name, address, phone, status, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(branchId, tenantId, locationName, body.locationAddress || '', body.phone || '', 'Active', 1, Date.now()).run();
        } catch (_) {}
      } catch (e) {
        return json({ error: 'Signup failed: ' + (e.message || 'error') }, 500);
      }
      await recordLoginAttempt('signup:' + clientIp(), true);
      return json({ success: true, tenantId, message: 'Shop submitted for approval. You will be contacted before your business is activated.', loginName: adminName, defaultBranch: locationName, status: 'pending' });
    }

    // Super-admin login (platform) — env SUPER_ADMIN_NAME + SUPER_ADMIN_PIN or user role SuperAdmin
    if (routeType === 'super-login' && request.method === 'POST') {
      await ensureAuthTables();
      const body = await request.json();
      const name = String(body.username || '').trim();
      const pin = String(body.pin || '');
      const envPin = String(env.SUPER_ADMIN_PIN || '').trim();
      let profileUser = null;
      try {
        await ensureAuthTables();
        profileUser = await env.DB.prepare('SELECT * FROM platform_profile WHERE id = 1').first();
      } catch (_) {}
      const envName = String((profileUser && profileUser.username) || env.SUPER_ADMIN_NAME || 'platform').trim();
      let ok = false;
      let user = null;
      if (!envPin) {
        // Still allow DB SuperAdmin users if any
        try {
          const users = (await env.DB.prepare('SELECT * FROM users').all()).results || [];
          user = users.find(u => (u.name || '').toLowerCase() === name.toLowerCase() && (u.role || '').toLowerCase() === 'superadmin') || null;
          if (user && await verifyPin(pin, user.pin) && user.status === 'Active') ok = true;
        } catch (_) {}
        if (!ok) {
          return json({
            error: 'Platform login not configured. In Cloudflare Pages → Settings → Environment variables, set SUPER_ADMIN_NAME and SUPER_ADMIN_PIN (Production), then redeploy.'
          }, 401);
        }
      } else if (name.toLowerCase() === envName.toLowerCase() && pin === envPin) {
        ok = true;
        user = { id: 'super-platform', name: envName, role: 'SuperAdmin', status: 'Active', tenantId: 'platform', pin: '' };
      } else {
        try {
          const users = (await env.DB.prepare('SELECT * FROM users').all()).results || [];
          user = users.find(u => (u.name || '').toLowerCase() === name.toLowerCase() && (u.role || '').toLowerCase() === 'superadmin') || null;
          if (user && await verifyPin(pin, user.pin) && user.status === 'Active') ok = true;
        } catch (_) {}
      }
      if (!ok || !user) return json({ error: 'Invalid super-admin credentials. Use SUPER_ADMIN_NAME / SUPER_ADMIN_PIN from Cloudflare env, or a user with role SuperAdmin.' }, 401);
      const tokenBytes = randomBytes(32);
      const token = b64(tokenBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const expiresAt = Date.now() + SESSION_MS;
      try {
        await env.DB.prepare(
          'INSERT INTO api_sessions (token, userId, expiresAt, createdAt, ip, tenantId) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(token, user.id, expiresAt, Date.now(), clientIp(), 'platform').run();
      } catch (e1) {
        try {
          await env.DB.prepare(
            'INSERT INTO api_sessions (token, userId, expiresAt, tenantId) VALUES (?, ?, ?, ?)'
          ).bind(token, user.id, expiresAt, 'platform').run();
        } catch (e2) {
          await env.DB.prepare(
            'INSERT INTO api_sessions (token, userId, expiresAt) VALUES (?, ?, ?)'
          ).bind(token, user.id, expiresAt).run();
        }
      }
      return json({
        token, expiresAt,
        user: { id: user.id, name: user.name, role: 'SuperAdmin', status: 'Active', tenantId: 'platform' },
        privileges: {},
        isSuperAdmin: true,
        tenant: null
      });
    }


    if (routeType === 'change-pin' && request.method === 'POST') {
      var authPin = await getAuth();
      if (!authPin) return unauth();
      const rlPin = await checkRateLimit('change-pin:' + (authPin.user?.id || clientIp()));
      if (rlPin.blocked) return json({ error: `Too many attempts. Try again in ${rlPin.retryAfterMin} minutes.` }, 429);
      const body = await request.json();
      const currentPin = String(body.currentPin || '');
      const newPin = String(body.newPin || '');
      if (newPin.length < 4) return json({ error: 'New PIN must be at least 4 characters' }, 400);
      // Load pin from DB (never trust client)
      const dbUser = await env.DB.prepare('SELECT pin, tenantId FROM users WHERE id = ?').bind(authPin.user.id).first();
      if (!dbUser) return json({ error: 'User not found' }, 404);
      const ok = await verifyPin(currentPin, dbUser.pin);
      if (!ok) {
        await recordLoginAttempt('change-pin:' + authPin.user.id, false);
        return json({ error: 'Current PIN is incorrect' }, 403);
      }
      const hashed = await hashPin(newPin);
      const pinTid = authPin.tenantId || dbUser.tenantId || 'tenant-default';
      await env.DB.prepare('UPDATE users SET pin = ? WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = \'\')').bind(hashed, authPin.user.id, pinTid).run();
      await recordLoginAttempt('change-pin:' + authPin.user.id, true);
      try { await writeSecurityAudit(authPin, 'change-pin', 'user', authPin.user.id); } catch (_) {}
      // Invalidate other sessions for this user (force re-login with new PIN on other devices)
      try { await env.DB.prepare('DELETE FROM api_sessions WHERE userId = ? AND token != ?').bind(authPin.user.id, authPin.token).run(); } catch (_) {}
      return json({ success: true });
    }

    // LOGOUT (current session) or LOGOUT-ALL (all sessions for this user)
    if (routeType === 'logout' && request.method === 'POST') {
      await ensureAuthTables();
      const hdr = request.headers.get('Authorization') || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
      let body = {};
      try { body = await request.json(); } catch (_) {}
      if (token) {
        try {
          if (body && body.allDevices) {
            const sess = await env.DB.prepare('SELECT userId FROM api_sessions WHERE token = ?').bind(token).first();
            if (sess && sess.userId) {
              await env.DB.prepare('DELETE FROM api_sessions WHERE userId = ?').bind(sess.userId).run();
            } else {
              await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run();
            }
          } else {
            await env.DB.prepare('DELETE FROM api_sessions WHERE token = ?').bind(token).run();
          }
        } catch (_) {}
      }
      return json({ success: true });
    }

    // All other routes require auth
    if (!publicRoutes.has(routeType)) {
      var auth = await getAuth();
      if (!auth) return unauth('Login required');
    }

    // Privilege gate by route + method
    const gate = (tab, action) => {
      if (!can(auth, tab, action)) return false;
      return true;
    };

    // Resource privilege map (default)
    const methodAction = { GET: 'view', POST: 'create', PUT: 'update', DELETE: 'delete' };
    const routePrivTab = {
      'all-data': null, // any authenticated
      restore: 'settings',
      inventory: 'inventory',
      customers: 'customers',
      expenses: 'expenses',
      sales: 'sales',
      'sales-returns': 'sales',
      'sales-return': 'sales',
      'sales_return': 'sales',
      categories: 'settings',
      'expense-categories': 'settings',
      'item-statuses': 'settings',
      users: 'settings',
      roles: 'settings',
      suppliers: 'suppliers',
      'purchase-returns': 'purchase',
      'purchase-return': 'purchase',
      'purchase_return': 'purchase',
      'purchase-receive': 'purchase',
      'stock-transfer': 'inventory',
      purchase_orders: 'purchase',
      'purchase-orders': 'purchase',
      'shop-profile': 'settings',
      employees: 'employees',
      'leave-requests': 'hr',
      leave_requests: 'hr',
      payroll: 'payroll',
      'hr-settings': 'settings',
      'tax-settings': 'settings',
      branches: 'settings',
      branch: 'settings',
      'financial-reports': 'reportFinancial',
      'ledger-pnl': 'reportFinancial',
      'ledger-journals': 'reportLedger',
      'ledger-trial-balance': 'reportLedger',
      'accounting-periods': 'reportLedger',
      'manual-journal': 'reportLedger',
      'void-journal': 'reportLedger',
      'audit-append': null,
      'return-requests': null
    };

    if (routeType === 'all-data' && request.method !== 'GET') {
      return deny('Bulk data writes via all-data are disabled. Use restore or resource endpoints.');
    }
    if (routeType === 'roles' && request.method !== 'GET' && !auth.isAdmin) {
      return deny('Only an administrator can create, change, or delete roles and privileges');
    }
    if (routeType && routeType !== 'login' && routeType !== 'logout') {
      // Sales return & purchase return execution require 'update' permission (users without update must submit via /api/return-requests)
      if ((routeType === 'sales-return' || routeType === 'sales_return') && request.method === 'POST') {
        if (!auth.isAdmin && !can(auth, 'sales', 'update')) {
          return deny('Sales return requires manager approval (sales.update privilege). Submit a return approval request instead.');
        }
      }
      if ((routeType === 'purchase-return' || routeType === 'purchase_return') && request.method === 'POST') {
        if (!auth.isAdmin && !can(auth, 'purchase', 'update')) {
          return deny('Purchase return requires manager approval (purchase.update privilege). Submit a return approval request instead.');
        }
      }
      const tab = routePrivTab[routeType];
      if (tab) {
        // suppliers can also be viewed via purchase.view
        const isReturnExec = routeType === 'sales-return' || routeType === 'sales_return' || routeType === 'purchase-return' || routeType === 'purchase_return';
        const action = routeType === 'void-journal' ? 'delete' : (isReturnExec ? 'update' : (routeType === 'accounting-periods' && request.method === 'POST' ? 'update' : (methodAction[request.method] || 'view')));
        let allowed = gate(tab, action);
        if (!allowed && tab === 'suppliers' && can(auth, 'purchase', action)) allowed = true;
        if (!allowed && tab === 'employees' && can(auth, 'hr', action)) allowed = true;
        if (!allowed && tab === 'payroll' && can(auth, 'hr', action)) allowed = true;
        if (!allowed && tab === 'hr' && can(auth, 'employees', action)) allowed = true;
        // Any authenticated user may update their own profile (name / photo / phone)
        if (!allowed && routeType === 'users' && request.method === 'PUT' && id && auth.user && String(id) === String(auth.user.id)) {
          allowed = true;
        }
        if (!allowed) return deny(`Missing privilege: ${tab}.${action}`);
      }
      if (routeType === 'restore' && !auth.isAdmin && !can(auth, 'settings', 'update')) {
        return deny('Restore requires settings update or admin');
      }
    }

    if (routeType === 'audit-append' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const tid = auth.tenantId || 'tenant-default';
      const entry = await appendTenantAuditRecord(tid, auth.user?.name || body.user || 'Staff', body.action || 'event', body.entity || '', body.detail || '', body);
      try { await writeSecurityAudit(auth, body.action || 'event', body.entity || 'app', String(body.detail || '').slice(0, 180)); } catch (_) {}
      return json({ success: true, entry });
    }

    if (routeType === 'return-requests') {
      const tid = auth.tenantId || 'tenant-default';
      await ensureTenantSettingsSchema();
      const loadReqs = async () => {
        const row = await env.DB.prepare(`SELECT returnRequests FROM tenant_settings WHERE tenantId = ? LIMIT 1`).bind(tid).first();
        if (!row || !row.returnRequests) return { exists: !!row, list: [] };
        try {
          const parsed = typeof row.returnRequests === 'string' ? JSON.parse(row.returnRequests || '[]') : row.returnRequests;
          return { exists: true, list: Array.isArray(parsed) ? parsed : [] };
        } catch (_) {
          return { exists: true, list: [] };
        }
      };
      const saveReqs = async (exists, list) => {
        const str = JSON.stringify(list);
        if (exists) {
          await env.DB.prepare(`UPDATE tenant_settings SET returnRequests = ?, updatedAt = ? WHERE tenantId = ?`).bind(str, Date.now(), tid).run();
        } else {
          await env.DB.prepare(`INSERT INTO tenant_settings (id, tenantId, returnRequests, updatedAt) VALUES (?, ?, ?, ?)`).bind(tid, tid, str, Date.now()).run();
        }
      };
      if (request.method === 'GET') {
        const { list } = await loadReqs();
        return json({ returnRequests: list });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const kind = body.kind === 'purchase' ? 'purchase' : 'sale';
        if (kind === 'sale' && !auth.isAdmin && !can(auth, 'sales', 'view') && !can(auth, 'pos', 'view') && !can(auth, 'pos', 'create')) {
          return deny('Not permitted to request sales returns.');
        }
        if (kind === 'purchase' && !auth.isAdmin && !can(auth, 'purchase', 'view') && !can(auth, 'purchase', 'create')) {
          return deny('Not permitted to request purchase returns.');
        }
        const { exists, list } = await loadReqs();
        const reqItem = {
          id: body.id || (`retreq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          kind,
          refId: body.refId || body.saleId || body.poId || '',
          partyName: body.partyName || '',
          estimatedAmount: Number(body.estimatedAmount) || 0,
          payload: body.payload || {},
          summary: body.summary || '',
          reason: body.reason || '',
          status: 'Pending',
          requestedBy: auth.user?.name || body.requestedBy || 'Staff',
          requestedById: auth.user?.id || '',
          createdAt: new Date().toISOString(),
          decidedBy: '',
          decidedAt: ''
        };
        const next = [reqItem, ...list].slice(0, 300);
        await saveReqs(exists, next);
        await appendTenantAuditRecord(tid, auth.user?.name || 'Staff', kind === 'sale' ? 'sales-return-request' : 'purchase-return-request', kind === 'sale' ? 'sales' : 'purchase_orders', `${reqItem.refId} (${reqItem.summary || ('Est. ' + reqItem.estimatedAmount)})`);
        return json({ success: true, request: reqItem, returnRequests: next });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const { exists, list } = await loadReqs();
        const target = list.find(r => r.id === id);
        if (!target) return json({ error: 'Return request not found' }, 404);
        if (target.kind === 'sale' && !auth.isAdmin && !can(auth, 'sales', 'update')) {
          return deny('Only a Manager or Admin with sales update permission can approve/reject sales returns.');
        }
        if (target.kind === 'purchase' && !auth.isAdmin && !can(auth, 'purchase', 'update')) {
          return deny('Only a Manager or Admin with purchase update permission can approve/reject purchase returns.');
        }
        const nextStatus = body.status === 'Approved' ? 'Approved' : (body.status === 'Rejected' ? 'Rejected' : target.status);
        const updatedReq = {
          ...target,
          status: nextStatus,
          decidedBy: auth.user?.name || 'Manager',
          decidedAt: new Date().toISOString(),
          decisionNote: body.decisionNote || ''
        };
        const next = list.map(r => r.id === id ? updatedReq : r);
        await saveReqs(exists, next);
        await appendTenantAuditRecord(tid, auth.user?.name || 'Manager', nextStatus === 'Approved' ? (target.kind === 'sale' ? 'sales-return-approved' : 'purchase-return-approved') : (target.kind === 'sale' ? 'sales-return-rejected' : 'purchase-return-rejected'), target.kind === 'sale' ? 'sales' : 'purchase_orders', `${target.refId} (${nextStatus} by ${auth.user?.name || 'Manager'})`);
        return json({ success: true, request: updatedReq, returnRequests: next });
      }
    }



    // Super-admin: tenants, plans, payments, profile
    if (routeType === 'super-tenants') {
      if (!auth || !auth.isSuperAdmin) return deny('Super-admin only');
      await ensureAuthTables();
      if (request.method === 'GET') {
        const list = (await env.DB.prepare('SELECT * FROM tenants ORDER BY createdAt DESC').all()).results || [];
        let plans = (await env.DB.prepare('SELECT * FROM platform_plans ORDER BY sortOrder, id').all()).results || [];
        if (!plans.length) {
          try {
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('starter', 'Starter', 3, 1, 1500, 1, 1).run();
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('business', 'Business', 15, 3, 3500, 1, 2).run();
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('premium', 'Premium', 100, 20, 7500, 1, 3).run();
            plans = (await env.DB.prepare('SELECT * FROM platform_plans ORDER BY sortOrder, id').all()).results || [];
          } catch (_) {}
        }
        const allPayments = (await env.DB.prepare('SELECT * FROM platform_payments ORDER BY at DESC').all().catch(() => ({ results: [] }))).results || [];
        const now = Date.now();
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const monthStartMs = monthStart.getTime();
        const planMap = Object.fromEntries((plans || []).map(p => [p.id, p]));

        // Enrich each tenant with subscription spend, tenure, due-soon, and inactivity metrics
        const enriched = [];
        for (const t of list) {
          let userCount = 0, salesCount = 0, totalSalesVolume = 0, branchCount = 1;
          let latestSaleMs = 0, latestPoMs = 0, latestExpMs = 0, latestSessionMs = 0;
          try {
            const uc = await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE tenantId = ? AND (status IS NULL OR status = 'Active')`).bind(t.id).first();
            userCount = Number(uc?.c) || 0;
          } catch (_) {}
          try {
            const sc = await env.DB.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(totalAmount), 0) as vol, MAX(date) as lastDate FROM sales WHERE tenantId = ?`).bind(t.id).first();
            salesCount = Number(sc?.c) || 0;
            totalSalesVolume = Number(sc?.vol) || 0;
            if (sc?.lastDate) { const ms = new Date(sc.lastDate).getTime(); if (!Number.isNaN(ms)) latestSaleMs = ms; }
          } catch (_) {}
          try {
            const pc = await env.DB.prepare(`SELECT MAX(date) as lastDate FROM purchase_orders WHERE tenantId = ?`).bind(t.id).first();
            if (pc?.lastDate) { const ms = new Date(pc.lastDate).getTime(); if (!Number.isNaN(ms)) latestPoMs = ms; }
          } catch (_) {}
          try {
            const ec = await env.DB.prepare(`SELECT MAX(date) as lastDate FROM expenses WHERE tenantId = ?`).bind(t.id).first();
            if (ec?.lastDate) { const ms = new Date(ec.lastDate).getTime(); if (!Number.isNaN(ms)) latestExpMs = ms; }
          } catch (_) {}
          try {
            const sess = await env.DB.prepare(`SELECT MAX(createdAt) as lastLogin FROM api_sessions WHERE tenantId = ?`).bind(t.id).first();
            if (sess?.lastLogin) latestSessionMs = Number(sess.lastLogin) || 0;
          } catch (_) {}
          try {
            const bc = await env.DB.prepare(`SELECT COUNT(*) as c FROM branches WHERE tenantId = ?`).bind(t.id).first();
            if (bc && Number(bc.c) > 0) branchCount = Number(bc.c);
          } catch (_) {}

          const shopPays = allPayments.filter(p => p.tenantId === t.id);
          const lastPay = shopPays[0] || null;
          const totalSpend = shopPays.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          const spendThisMonth = shopPays.filter(p => (Number(p.at) || 0) >= monthStartMs).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          const paymentCount = shopPays.length;
          const avgPayment = paymentCount > 0 ? Math.round((totalSpend / paymentCount) * 100) / 100 : 0;

          const createdMs = Number(t.createdAt) || now;
          const daysOnPlatform = Math.max(0, Math.floor((now - createdMs) / 86400000));
          const lastPayMs = Number(lastPay?.at || t.lastPaymentAt) || 0;
          const trialEnds = t.trialEndsAt ? Number(t.trialEndsAt) : null;
          const trialExpired = trialEnds != null && trialEnds < now;
          const st = (t.status || '').toLowerCase();

          // Next billing due: 30 days after last payment, or trialEndsAt if on trial / unpaid
          const nextDueAt = lastPayMs > 0 ? (lastPayMs + 30 * 86400000) : (trialEnds != null ? trialEnds : null);
          const daysUntilDue = nextDueAt != null ? Math.ceil((nextDueAt - now) / 86400000) : null;
          const overdue = st !== 'deleted' && ((daysUntilDue != null && daysUntilDue < 0) || (trialExpired && (st === 'trial' || st === 'active') && !lastPayMs));
          const dueSoon = st !== 'deleted' && st !== 'suspended' && !overdue && daysUntilDue != null && daysUntilDue >= 0 && daysUntilDue <= 7;

          const lastActivityAt = Math.max(latestSaleMs, latestPoMs, latestExpMs, latestSessionMs, lastPayMs) || createdMs;
          const daysInactive = Math.max(0, Math.floor((now - lastActivityAt) / 86400000));
          const isInactive = st !== 'deleted' && daysInactive >= 14;
          const isSubscribed = st !== 'deleted' && (paymentCount > 0 || st === 'active');
          const planObj = planMap[t.plan || 'starter'] || null;

          enriched.push({
            ...t,
            userCount,
            branchCount,
            salesCount,
            totalSalesVolume,
            totalSpend,
            spendThisMonth,
            paymentCount,
            avgPayment,
            monthlyRate: Number(planObj?.priceMonthly) || 0,
            isSubscribed,
            daysOnPlatform,
            nextDueAt,
            daysUntilDue,
            dueSoon,
            lastActivityAt,
            daysInactive,
            isInactive,
            lastPayment: lastPay ? { amount: lastPay.amount, period: lastPay.period, at: lastPay.at, method: lastPay.method, reference: lastPay.reference } : null,
            trialExpired,
            overdue: !!overdue
          });
        }

        const paymentsMonthRows = allPayments.filter(p => (Number(p.at) || 0) >= monthStartMs);
        const paymentsMonth = paymentsMonthRows.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const totalRevenueAllTime = allPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

        const revenueByPlanMap = {};
        const tenantPlanLookup = Object.fromEntries(enriched.map(t => [t.id, t.plan || 'starter']));
        allPayments.forEach(p => {
          const pl = tenantPlanLookup[p.tenantId] || 'starter';
          if (!revenueByPlanMap[pl]) revenueByPlanMap[pl] = { plan: pl, total: 0, count: 0 };
          revenueByPlanMap[pl].total += parseFloat(p.amount) || 0;
          revenueByPlanMap[pl].count += 1;
        });
        const revenueByMethodMap = {};
        allPayments.forEach(p => {
          const m = p.method || 'Manual';
          if (!revenueByMethodMap[m]) revenueByMethodMap[m] = { method: m, total: 0, count: 0 };
          revenueByMethodMap[m].total += parseFloat(p.amount) || 0;
          revenueByMethodMap[m].count += 1;
        });

        const liveTenants = enriched.filter(t => (t.status || '').toLowerCase() !== 'deleted');
        const kpis = {
          totalShops: liveTenants.length,
          activeShops: liveTenants.filter(t => (t.status || '').toLowerCase() === 'active').length,
          suspendedShops: liveTenants.filter(t => (t.status || '').toLowerCase() === 'suspended').length,
          trialShops: liveTenants.filter(t => (t.status || '').toLowerCase() === 'trial').length,
          subscribedShops: liveTenants.filter(t => t.isSubscribed).length,
          dueSoonShops: liveTenants.filter(t => t.dueSoon).length,
          overdueShops: liveTenants.filter(t => t.overdue).length,
          inactiveShops: liveTenants.filter(t => t.isInactive).length,
          longStandingShops: liveTenants.filter(t => (t.daysOnPlatform || 0) >= 30).length,
          paymentsThisMonth: paymentsMonth,
          paymentsThisMonthCount: paymentsMonthRows.length,
          totalRevenueAllTime,
          totalPaymentsCount: allPayments.length,
          revenueByPlan: Object.values(revenueByPlanMap).sort((a, b) => b.total - a.total),
          revenueByMethod: Object.values(revenueByMethodMap).sort((a, b) => b.total - a.total)
        };
        return json({ tenants: enriched, plans, planDefaults: PLAN_LIMITS, kpis, payments: allPayments.slice(0, 200) });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = body.id || ('tenant-' + Date.now().toString(36));
        const plan = body.plan || 'starter';
        let maxUsers = body.maxUsers, maxBranches = body.maxBranches;
        try {
          const pl = await env.DB.prepare('SELECT * FROM platform_plans WHERE id = ?').bind(plan).first();
          if (pl) { maxUsers = maxUsers ?? pl.maxUsers; maxBranches = maxBranches ?? pl.maxBranches; }
        } catch (_) {}
        const lim = PLAN_LIMITS[plan] || {};
        const trialDays = body.trialDays != null ? Number(body.trialDays) : 14;
        const trialEndsAt = trialDays > 0 ? Date.now() + trialDays * 24 * 60 * 60 * 1000 : null;
        const status = body.status || (trialEndsAt ? 'trial' : 'active');
        try {
          await env.DB.prepare(
            `INSERT INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, ownerEmail, notes, trialEndsAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tid, body.name || 'New Shop', plan, status, maxUsers ?? lim.maxUsers ?? 5, maxBranches ?? lim.maxBranches ?? 1, Date.now(), body.ownerEmail || '', body.notes || 'created-by-platform', trialEndsAt).run();
        } catch (_) {
          await env.DB.prepare(
            `INSERT INTO tenants (id, name, plan, status, maxUsers, maxBranches, createdAt, ownerEmail, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tid, body.name || 'New Shop', plan, status, maxUsers ?? lim.maxUsers ?? 5, maxBranches ?? lim.maxBranches ?? 1, Date.now(), body.ownerEmail || '', body.notes || 'created-by-platform').run();
        }
        try { await writeSecurityAudit(auth, 'create', 'tenant', tid); } catch (_) {}
        return json({ success: true, id: tid, trialEndsAt });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const plan = body.plan;
        let maxUsers = body.maxUsers, maxBranches = body.maxBranches;
        if (plan && maxUsers == null) {
          try {
            const pl = await env.DB.prepare('SELECT * FROM platform_plans WHERE id = ?').bind(plan).first();
            if (pl) { maxUsers = pl.maxUsers; maxBranches = maxBranches ?? pl.maxBranches; }
          } catch (_) {}
        }
        const limits = PLAN_LIMITS[plan] || {};
        // Support suspend / activate / trialEndsAt
        try {
          await env.DB.prepare(
            `UPDATE tenants SET name = COALESCE(?, name), plan = COALESCE(?, plan), status = COALESCE(?, status),
             maxUsers = COALESCE(?, maxUsers), maxBranches = COALESCE(?, maxBranches), notes = COALESCE(?, notes),
             ownerEmail = COALESCE(?, ownerEmail), trialEndsAt = COALESCE(?, trialEndsAt) WHERE id = ?`
          ).bind(
            body.name || null, plan || null, body.status || null,
            maxUsers ?? limits.maxUsers ?? null, maxBranches ?? limits.maxBranches ?? null,
            body.notes || null, body.ownerEmail || null,
            body.trialEndsAt != null ? Number(body.trialEndsAt) : null,
            id
          ).run();
        } catch (_) {
          await env.DB.prepare(
            `UPDATE tenants SET name = COALESCE(?, name), plan = COALESCE(?, plan), status = COALESCE(?, status),
             maxUsers = COALESCE(?, maxUsers), maxBranches = COALESCE(?, maxBranches), notes = COALESCE(?, notes), ownerEmail = COALESCE(?, ownerEmail) WHERE id = ?`
          ).bind(
            body.name || null, plan || null, body.status || null,
            maxUsers ?? limits.maxUsers ?? null, maxBranches ?? limits.maxBranches ?? null,
            body.notes || null, body.ownerEmail || null, id
          ).run();
        }
        const newSt = (body.status || '').toLowerCase();
        if (newSt === 'suspended' || newSt === 'deleted' || newSt === 'archived' || newSt === 'pending') {
          try { await revokeTenantSessions(id); } catch (_) {}
        }
        try { await writeSecurityAudit(auth, 'update', 'tenant', id + ' ' + (body.status || body.plan || '')); } catch (_) {}
        return json({ success: true });
      }
      if (request.method === 'DELETE' && id) {
        if (id === 'tenant-default') return json({ error: 'Cannot delete default tenant' }, 400);
        const body = request.headers.get('Content-Type') ? await request.json().catch(() => ({})) : {};
        if (body.hard) {
          try { await revokeTenantSessions(id); } catch (_) {}
          // Permanently remove this shop and all related business data
          const purgeTables = [
            'api_sessions', 'users', 'roles', 'inventory', 'customers', 'sales', 'expenses',
            'suppliers', 'purchase_orders', 'employees', 'leave_requests', 'payroll',
            'categories', 'expense_categories', 'item_statuses', 'shop_profile',
            'website_settings', 'tax_settings', 'hr_settings', 'branches', 'platform_payments'
          ];
          for (const table of purgeTables) {
            try { await env.DB.prepare(`DELETE FROM ${table} WHERE tenantId = ?`).bind(id).run(); } catch (_) {}
          }
          // shop_profile may use id = tenantId
          try { await env.DB.prepare(`DELETE FROM shop_profile WHERE id = ?`).bind(id).run(); } catch (_) {}
          try { await env.DB.prepare(`DELETE FROM tenants WHERE id = ?`).bind(id).run(); } catch (_) {}
          try { await writeSecurityAudit(auth, 'delete', 'tenant', id + ' hard-purge'); } catch (_) {}
          return json({ success: true, hard: true });
        }
        try { await revokeTenantSessions(id); } catch (_) {}
        await env.DB.prepare(`UPDATE tenants SET status = 'deleted', notes = COALESCE(notes,'') || ' | deleted' WHERE id = ?`).bind(id).run();
        try { await writeSecurityAudit(auth, 'delete', 'tenant', id); } catch (_) {}
        return json({ success: true });
      }
    }

    if (routeType === 'super-plans') {
      if (!auth || !auth.isSuperAdmin) return deny('Super-admin only');
      await ensureAuthTables();
      if (request.method === 'GET') {
        let plans = (await env.DB.prepare('SELECT * FROM platform_plans ORDER BY sortOrder, id').all()).results || [];
        if (!plans.length) {
          try {
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('starter', 'Starter', 3, 1, 0, 1, 1).run();
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('business', 'Business', 15, 3, 0, 1, 2).run();
            await env.DB.prepare(`INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('premium', 'Premium', 100, 20, 0, 1, 3).run();
            plans = (await env.DB.prepare('SELECT * FROM platform_plans ORDER BY sortOrder, id').all()).results || [];
          } catch (_) {}
        }
        return json({ plans });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const pid = String(body.id || body.label || '').toLowerCase().replace(/\s+/g, '-') || ('plan-' + Date.now());
        await env.DB.prepare(
          `INSERT INTO platform_plans (id, label, maxUsers, maxBranches, priceMonthly, active, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET label=?, maxUsers=?, maxBranches=?, priceMonthly=?, active=?, sortOrder=?`
        ).bind(
          pid, body.label || pid, body.maxUsers ?? 5, body.maxBranches ?? 1, body.priceMonthly ?? 0, body.active === false ? 0 : 1, body.sortOrder ?? 0,
          body.label || pid, body.maxUsers ?? 5, body.maxBranches ?? 1, body.priceMonthly ?? 0, body.active === false ? 0 : 1, body.sortOrder ?? 0
        ).run();
        return json({ success: true, id: pid });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        await env.DB.prepare(
          `UPDATE platform_plans SET label = COALESCE(?, label), maxUsers = COALESCE(?, maxUsers), maxBranches = COALESCE(?, maxBranches),
           priceMonthly = COALESCE(?, priceMonthly), active = COALESCE(?, active), sortOrder = COALESCE(?, sortOrder) WHERE id = ?`
        ).bind(body.label || null, body.maxUsers ?? null, body.maxBranches ?? null, body.priceMonthly ?? null, body.active === undefined ? null : (body.active ? 1 : 0), body.sortOrder ?? null, id).run();
        return json({ success: true });
      }
      if (request.method === 'DELETE' && id) {
        await env.DB.prepare(`DELETE FROM platform_plans WHERE id = ?`).bind(id).run();
        return json({ success: true });
      }
    }

    if (routeType === 'super-payments') {
      if (!auth || !auth.isSuperAdmin) return deny('Super-admin only');
      await ensureAuthTables();
      if (request.method === 'GET') {
        const rows = (await env.DB.prepare('SELECT * FROM platform_payments ORDER BY at DESC LIMIT 200').all()).results || [];
        return json({ payments: rows });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const pid = 'pay-' + Date.now();
        let tenantName = body.tenantName || '';
        try {
          const t = await getTenant(body.tenantId);
          if (t) tenantName = t.name;
        } catch (_) {}
        const at = Date.now();
        await env.DB.prepare(
          `INSERT INTO platform_payments (id, tenantId, tenantName, amount, currency, method, reference, period, notes, recordedBy, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(pid, body.tenantId || '', tenantName, parseFloat(body.amount) || 0, body.currency || 'KSh', body.method || 'Manual', body.reference || '', body.period || '', body.notes || '', auth.user?.name || 'platform', at).run();
        // Mark tenant paid / activate from trial
        if (body.tenantId) {
          try {
            await env.DB.prepare(
              `UPDATE tenants SET lastPaymentAt = ?, lastPaymentPeriod = ?, status = CASE WHEN status = 'trial' OR status = 'suspended' THEN 'active' ELSE status END WHERE id = ?`
            ).bind(at, body.period || '', body.tenantId).run();
          } catch (_) {
            try {
              await env.DB.prepare(`UPDATE tenants SET status = 'active' WHERE id = ? AND status IN ('trial','suspended')`).bind(body.tenantId).run();
            } catch (__) {}
          }
        }
        try { await writeSecurityAudit(auth, 'payment', 'tenant', body.tenantId + ' ' + body.amount); } catch (_) {}
        return json({ success: true, id: pid });
      }
      // Update existing payment (id in path or body)
      if (request.method === 'PUT') {
        const body = await request.json();
        const payId = id || body.id;
        if (!payId) return json({ error: 'Payment id required' }, 400);
        const existing = await env.DB.prepare('SELECT * FROM platform_payments WHERE id = ?').bind(payId).first();
        if (!existing) return json({ error: 'Payment not found' }, 404);
        let tenantName = body.tenantName || existing.tenantName || '';
        const tenantId = body.tenantId != null ? body.tenantId : existing.tenantId;
        try {
          const t = await getTenant(tenantId);
          if (t) tenantName = t.name;
        } catch (_) {}
        await env.DB.prepare(
          `UPDATE platform_payments SET tenantId = ?, tenantName = ?, amount = ?, currency = ?, method = ?, reference = ?, period = ?, notes = ? WHERE id = ?`
        ).bind(
          tenantId || '',
          tenantName,
          body.amount != null ? parseFloat(body.amount) : existing.amount,
          body.currency || existing.currency || 'KSh',
          body.method || existing.method || 'Manual',
          body.reference != null ? body.reference : (existing.reference || ''),
          body.period != null ? body.period : (existing.period || ''),
          body.notes != null ? body.notes : (existing.notes || ''),
          payId
        ).run();
        try { await writeSecurityAudit(auth, 'update', 'payment', payId); } catch (_) {}
        return json({ success: true, id: payId });
      }
      if (request.method === 'DELETE') {
        const payId = id;
        if (!payId) return json({ error: 'Payment id required' }, 400);
        await env.DB.prepare('DELETE FROM platform_payments WHERE id = ?').bind(payId).run();
        try { await writeSecurityAudit(auth, 'delete', 'payment', payId); } catch (_) {}
        return json({ success: true });
      }
    }

    // Super-admin: open shop as tenant admin (support session)
    if (routeType === 'super-impersonate' && request.method === 'POST') {
      if (!auth || !auth.isSuperAdmin) return deny('Super-admin only');
      await ensureAuthTables();
      const body = await request.json();
      const tenantId = body.tenantId;
      if (!tenantId) return json({ error: 'tenantId required' }, 400);
      const ten = await getTenant(tenantId);
      if (!ten) return json({ error: 'Tenant not found' }, 404);
      // Prefer tenant Admin user
      let targetUser = await env.DB.prepare(
        `SELECT * FROM users WHERE tenantId = ? AND LOWER(role) = 'admin' AND (status = 'Active' OR status IS NULL) ORDER BY name LIMIT 1`
      ).bind(tenantId).first();
      if (!targetUser) {
        targetUser = await env.DB.prepare(
          `SELECT * FROM users WHERE tenantId = ? AND (status = 'Active' OR status IS NULL) ORDER BY name LIMIT 1`
        ).bind(tenantId).first();
      }
      if (!targetUser) return json({ error: 'No active user in this shop to open as' }, 404);
      const tokenBytes = randomBytes(32);
      const token = b64(tokenBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      const expiresAt = Date.now() + Math.min(SESSION_MS, 2 * 60 * 60 * 1000); // max 2h support session
      await env.DB.prepare(
        'INSERT INTO api_sessions (token, userId, expiresAt, createdAt, ip, tenantId) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(token, targetUser.id, expiresAt, Date.now(), clientIp(), tenantId).run();
      let roleRow = null;
      try {
        const roles = (await env.DB.prepare('SELECT * FROM roles WHERE tenantId = ?').bind(tenantId).all()).results || [];
        roleRow = roles.find(r => (r.name || '').toLowerCase() === (targetUser.role || '').toLowerCase()) || null;
      } catch (_) {}
      try { await writeSecurityAudit(auth, 'impersonate', 'tenant', tenantId + ' as ' + targetUser.id); } catch (_) {}
      return json({
        success: true,
        token,
        expiresAt,
        user: { id: targetUser.id, name: targetUser.name, role: targetUser.role, status: targetUser.status, phone: targetUser.phone || '', tenantId },
        privileges: parsePrivileges(roleRow?.privileges),
        tenant: { id: ten.id, name: ten.name, plan: ten.plan, status: ten.status, maxUsers: ten.maxUsers, maxBranches: ten.maxBranches },
        supportMode: true
      });
    }

    if (routeType === 'super-profile') {
      if (!auth || !auth.isSuperAdmin) return deny('Super-admin only');
      await ensureAuthTables();
      if (request.method === 'GET') {
        let row = null;
        try { row = await env.DB.prepare('SELECT * FROM platform_profile WHERE id = 1').first(); } catch (_) {}
        return json({
          profile: row || { username: env.SUPER_ADMIN_NAME || 'platform', displayName: auth.user?.name || 'Platform' },
          note: 'Username used for Platform login is SUPER_ADMIN_NAME in Cloudflare env unless you rely on a SuperAdmin DB user. Display name is stored here.'
        });
      }
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        const username = String(body.username || '').trim();
        const displayName = String(body.displayName || body.username || '').trim();
        if (!username) return json({ error: 'Username required' }, 400);
        await env.DB.prepare(
          `INSERT INTO platform_profile (id, username, displayName, updatedAt) VALUES (1, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET username = ?, displayName = ?, updatedAt = ?`
        ).bind(username, displayName, Date.now(), username, displayName, Date.now()).run();
        // If super user is in DB, update name
        try {
          if (auth.user?.id && auth.user.id !== 'super-platform') {
            if (auth.isSuperAdmin && auth.user.id === 'super-platform') {
            // platform env user is not in users table; skip
          } else if (auth.isSuperAdmin) {
            await env.DB.prepare(`UPDATE users SET name = ? WHERE id = ? AND tenantId = 'platform'`).bind(displayName || username, auth.user.id).run();
          }
          }
        } catch (_) {}
        try { await writeSecurityAudit(auth, 'update', 'platform_profile', username); } catch (_) {}
        return json({
          success: true,
          profile: { username, displayName },
          warning: 'Env SUPER_ADMIN_NAME still controls env-based Platform login until you change it in Cloudflare to match the new username.'
        });
      }
    }




    if (routeType === 'tenant-backup' && request.method === 'GET') {
      if (!auth) return unauth();
      const tid = auth.tenantId || 'tenant-default';
      const tables = ['inventory','sales','customers','expenses','suppliers','purchase_orders','employees','leave_requests','users','roles'];
      const payload = { tenantId: tid, exportedAt: new Date().toISOString() };
      for (const t of tables) {
        try {
          const rows = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results || [];
          payload[t] = scopeTenant(rows, tid, auth.isSuperAdmin);
        } catch (_) { payload[t] = []; }
      }
      try { payload.tenant = await getTenant(tid); } catch (_) {}
      return json(payload);
    }

 // 1. GET ALL DATA — SQL-level tenant filter for non-super-admin (never trust client tenantId)
    if (routeType === 'all-data' && request.method === 'GET') {
      const tidForQuery = (auth && !auth.isSuperAdmin) ? (auth.tenantId || 'tenant-default') : null;
      // Helper: tenant-scoped SELECT (includes legacy null/empty only for tenant-default)
      const qTenant = (table, opts = {}) => {
        const limit = opts.limit || 0;
        const limSql = limit > 0 ? ` LIMIT ${Math.min(Number(limit) || 0, 5000)}` : '';
        if (!tidForQuery) return env.DB.prepare(`SELECT * FROM ${table}${limSql}`).all().then(res => res.results || []).catch(() => []);
        if (tidForQuery === 'tenant-default') {
          return env.DB.prepare(`SELECT * FROM ${table} WHERE tenantId = ? OR tenantId IS NULL OR tenantId = ''${limSql}`).bind(tidForQuery).all().then(res => res.results || []).catch(() => []);
        }
        return env.DB.prepare(`SELECT * FROM ${table} WHERE tenantId = ?${limSql}`).bind(tidForQuery).all().then(res => res.results || []).catch(() => []);
      };
      let [inventory, sales, customers, expenses, categories, expenseCategories, itemStatuses, users, roles, suppliers, purchaseOrders, shopProfileRes, employees, leaveRequests, payrollRecords, hrSettingsRes, taxSettingsRes] = await Promise.all([
        qTenant('inventory'),
        qTenant('sales', { limit: 2000 }),
        qTenant('customers'),
        qTenant('expenses', { limit: 1000 }),
        qTenant('categories'),
        qTenant('expense_categories'),
        qTenant('item_statuses'),
        qTenant('users'),
        qTenant('roles'),
        qTenant('suppliers'),
        qTenant('purchase_orders').then(rows => (rows || []).map(po => ({
          ...po,
          returnHistory: (() => { try { return typeof po.returnHistory === 'string' ? JSON.parse(po.returnHistory || '[]') : (po.returnHistory || []); } catch (_) { return []; } })(),
          paymentHistory: (() => { try { return typeof po.paymentHistory === 'string' ? JSON.parse(po.paymentHistory || '[]') : (po.paymentHistory || []); } catch (_) { return []; } })()
        }))),
        (async () => {
          try {
            const tid = (auth && auth.tenantId) || 'tenant-default';
            let row = await env.DB.prepare('SELECT * FROM shop_profile WHERE tenantId = ? LIMIT 1').bind(tid).first();
            if (!row && tid === 'tenant-default') row = await env.DB.prepare('SELECT * FROM shop_profile WHERE id = 1').first();
            return row;
          } catch (_) { return null; }
        })(),
        qTenant('employees'),
        qTenant('leave_requests', { limit: 500 }),
        qTenant('payroll', { limit: 500 }),
        (async () => {
          try {
            const tid = (auth && auth.tenantId) || 'tenant-default';
            let row = null;
            try { row = await env.DB.prepare('SELECT * FROM hr_settings_mt WHERE tenantId = ? LIMIT 1').bind(tid).first(); } catch (_) {}
            if (!row) {
              try { row = await env.DB.prepare('SELECT * FROM hr_settings WHERE tenantId = ? LIMIT 1').bind(tid).first(); } catch (_) {}
            }
            if (!row && tid === 'tenant-default') {
              try { row = await env.DB.prepare('SELECT * FROM hr_settings WHERE id = 1').first(); } catch (_) {}
            }
            return row;
          } catch (_) { return null; }
        })(),
        (async () => {
          try {
            const tid = (auth && auth.tenantId) || 'tenant-default';
            let row = null;
            try { row = await env.DB.prepare('SELECT * FROM tax_settings_mt WHERE tenantId = ? LIMIT 1').bind(tid).first(); } catch (_) {}
            if (!row) {
              try { row = await env.DB.prepare('SELECT * FROM tax_settings WHERE tenantId = ? LIMIT 1').bind(tid).first(); } catch (_) {}
            }
            if (!row && tid === 'tenant-default') {
              try { row = await env.DB.prepare('SELECT * FROM tax_settings WHERE id = 1').first(); } catch (_) {}
            }
            return row;
          } catch (_) { return null; }
        })()
      ]);

      let shopProfile = shopProfileRes || null;
      if ((!shopProfile || !shopProfile.name) && auth && auth.tenantId && auth.tenantId !== 'platform') {
        try {
          const ten = await getTenant(auth.tenantId);
          if (ten) {
            shopProfile = {
              ...(shopProfile || {}),
              id: (shopProfile && shopProfile.id) || auth.tenantId,
              name: (shopProfile && shopProfile.name) || ten.name || '',
              tagline: (shopProfile && shopProfile.tagline) || '',
              currency: (shopProfile && shopProfile.currency) || 'KSh',
              phone: (shopProfile && shopProfile.phone) || '',
              location: (shopProfile && shopProfile.location) || '',
              tenantId: auth.tenantId
            };
          }
        } catch (_) {}
      }
      const hrSettings = hrSettingsRes || null;
      const taxSettings = taxSettingsRes || null;
      const tidBranches = (auth && auth.tenantId) || 'tenant-default';
      let branchesList = [];
      try {
        if (!auth.isSuperAdmin) {
          await ensureDefaultBranch(tidBranches, shopProfile?.name || shopProfile?.location || 'Main branch');
          branchesList = await listBranches(tidBranches);
        }
      } catch (_) {}

      const parseJsonArr = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
        return [];
      };
      const parseJsonObj = (v) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
        if (typeof v === 'string') { try { const o = JSON.parse(v || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; } catch (_) { return {}; } }
        return {};
      };

      // Tenant isolation (skip for super-admin platform view)
      if (!auth.isSuperAdmin) {
        const tid = auth.tenantId || 'tenant-default';
        inventory = scopeTenant(inventory, tid, false).map(it => ({ ...it, varianceValues: parseJsonObj(it.varianceValues) }));
        sales = scopeTenant(sales, tid, false).map(s => ({ ...s, returnHistory: parseJsonArr(s.returnHistory), paymentHistory: parseJsonArr(s.paymentHistory) }));
        customers = scopeTenant(customers, tid, false).map(c => ({ ...c, loyaltyPoints: parseFloat(c.loyaltyPoints) || 0 }));
        expenses = scopeTenant(expenses, tid, false).map(e => ({ ...e, paymentHistory: parseJsonArr(e.paymentHistory) }));
        users = scopeTenant(users, tid, false);
        roles = scopeTenant(roles, tid, false);
        suppliers = scopeTenant(suppliers, tid, false);
        purchaseOrders = scopeTenant(purchaseOrders, tid, false).map(po => ({ ...po, returnHistory: parseJsonArr(po.returnHistory), paymentHistory: parseJsonArr(po.paymentHistory) }));
        employees = scopeTenant(employees, tid, false);
        leaveRequests = scopeTenant(leaveRequests, tid, false);
        payrollRecords = scopeTenant(payrollRecords, tid, false);
        categories = scopeTenant(categories, tid, false);
        expenseCategories = scopeTenant(expenseCategories, tid, false);
        itemStatuses = scopeTenant(itemStatuses, tid, false);
      }

      // Enforce view privileges + View Own on bulk payload
      const filterOwnList = (tab, list, fields = ['createdBy', 'cashier', 'payer']) => {
        if (!Array.isArray(list)) return [];
        if (!can(auth, tab, 'view') && !(tab === 'suppliers' && can(auth, 'purchase', 'view')) && !(tab === 'employees' && can(auth, 'hr', 'view')) && !(tab === 'payroll' && can(auth, 'hr', 'view'))) return [];
        if (!isOwnOnly(auth, tab)) return list;
        const uname = (auth.user.name || '').toLowerCase();
        const uid = auth.user.id;
        return list.filter(row => {
          for (const f of fields) {
            const v = row[f];
            if (v != null && (String(v) === String(uid) || String(v).toLowerCase() === uname)) return true;
          }
          return false;
        });
      };
      const safeUsers = (users || []).map(u => ({
        id: u.id, name: u.name, role: u.role, phone: u.phone, status: u.status, photo: u.photo || ''
        // PIN hashes never sent to the client
      }));

      let stockMovements = [];
      try {
        stockMovements = (await env.DB.prepare(
          `SELECT * FROM stock_movements WHERE tenantId = ? ORDER BY at DESC LIMIT 500`
        ).bind(auth.tenantId || 'tenant-default').all()).results || [];
      } catch (_) { stockMovements = []; }
      let tenantSettings = null;
      try {
        await ensureTenantSettingsSchema();
        tenantSettings = await env.DB.prepare(`SELECT * FROM tenant_settings WHERE tenantId = ? LIMIT 1`).bind(auth.tenantId || 'tenant-default').first();
      } catch (_) {}

      return json({
        inventory: can(auth, 'inventory', 'view') || can(auth, 'pos', 'view') ? inventory : [],
        sales: filterOwnList('sales', sales),
        customers: (can(auth, 'customers', 'view') || can(auth, 'pos', 'view')) ? (isOwnOnly(auth, 'customers') ? filterOwnList('customers', customers, ['createdBy', 'name']) : customers) : [],
        expenses: filterOwnList('expenses', expenses, ['createdBy', 'payer']),
        categories: can(auth, 'settings', 'view') || can(auth, 'inventory', 'view') ? categories : categories,
        expenseCategories: expenseCategories,
        itemStatuses: itemStatuses,
        users: can(auth, 'settings', 'view') || auth.isAdmin ? safeUsers : safeUsers.filter(u => u.id === auth.user.id),
        roles: (() => {
          if (can(auth, 'settings', 'view') || auth.isAdmin) return roles || [];
          // Non-settings users still need their own role privileges on the client
          const mine = (roles || []).filter(r => (r.name || '').toLowerCase() === (auth.user.role || '').toLowerCase());
          return mine.length ? mine : [{ id: 'role-self', name: auth.user.role, privileges: auth.privileges || {} }];
        })(),
        suppliers: filterOwnList('suppliers', suppliers, ['createdBy', 'name']),
        purchaseOrders: filterOwnList('purchase', purchaseOrders),
        shopProfile,
        employees: filterOwnList('employees', employees, ['createdBy', 'name']),
        leaveRequests: filterOwnList('hr', leaveRequests, ['createdBy', 'employeeName', 'approvedBy']),
        payrollRecords: filterOwnList('payroll', payrollRecords, ['createdBy', 'employeeName']),
        hrSettings,
        taxSettings,
        branches: branchesList,
        stockMovements,
        tenantSettings,
        ...await (async () => {
          const ten = await getTenant(tidBranches);
          const planId = ten?.plan || 'starter';
          const lim = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
          return {
            maxBranches: Math.min(MAX_BRANCHES_HARD, Number(ten?.maxBranches) || lim.maxBranches || 1),
            maxUsers: Number(ten?.maxUsers) || lim.maxUsers || 5,
            plan: planId
          };
        })(),
        authUser: { id: auth.user.id, name: auth.user.name, role: auth.user.role, photo: auth.user.photo || '' }
      });
    }

    // 2. RESTORE ALL DATA (Direct DB Upsert Batch) — always scoped to current tenant
    if (routeType === 'restore' && request.method === 'POST') {
      if (!auth || auth.isSuperAdmin) return deny('Restore is only allowed for tenant admins');
      if (!can(auth, 'settings', 'update') && !auth.isAdmin) return deny('Insufficient privileges to restore');
      const body = await request.json();
      // Always force restore into authenticated tenant only
      if (body.tenantId && body.tenantId !== auth.tenantId) {
        return json({ error: 'Backup belongs to another tenant and cannot be restored here' }, 403);
      }
      if (!auth.tenantId || auth.tenantId === 'platform') {
        return json({ error: 'Invalid tenant for restore' }, 403);
      }
      const statements = [];
      const tid = auth.tenantId;
      try { await writeSecurityAudit(auth, 'restore', 'backup', 'tenant restore started'); } catch (_) {}

      if (body.shopProfile) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO shop_profile (id, name, tagline, currency, phone, location, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, tagline = excluded.tagline, currency = excluded.currency, phone = excluded.phone, location = excluded.location, tenantId = excluded.tenantId`
          ).bind(
            tid === 'tenant-default' ? 1 : tid,
            body.shopProfile.name, body.shopProfile.tagline, body.shopProfile.currency, body.shopProfile.phone, body.shopProfile.location, tid
          )
        );
      }

      if (Array.isArray(body.inventory)) {
        for (const item of body.inventory) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, buyingPrice = excluded.buyingPrice, price = excluded.price, quantity = excluded.quantity, lowStockAlert = excluded.lowStockAlert, trackInventory = excluded.trackInventory, status = excluded.status, photoUrl = excluded.photoUrl, tenantId = excluded.tenantId WHERE inventory.tenantId = excluded.tenantId OR inventory.tenantId IS NULL`
            ).bind(
              item.id, item.name, item.category, item.buyingPrice || 0, item.price || 0, item.quantity || 0, item.lowStockAlert || 2, item.trackInventory ? 1 : 0, item.status || 'Listed', item.photoUrl || '', tid
            )
          );
        }
      }

      if (Array.isArray(body.customers)) {
        for (const cust of body.customers) {
          const eligibilityJson = typeof cust.eligibility === 'string' ? cust.eligibility : JSON.stringify(cust.eligibility || ['Paid']);
          statements.push(
            env.DB.prepare(
              `INSERT INTO customers (id, name, phone, location, eligibility, tenantId) VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, location = excluded.location, eligibility = excluded.eligibility, tenantId = excluded.tenantId WHERE customers.tenantId = excluded.tenantId OR customers.tenantId IS NULL`
            ).bind(cust.id, cust.name, cust.phone, cust.location, eligibilityJson, tid)
          );
        }
      }

      if (Array.isArray(body.sales)) {
        for (const s of body.sales) {
          const itemsJson = typeof s.items === 'string' ? s.items : JSON.stringify(s.items || []);
          statements.push(
            env.DB.prepare(
              `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET date = excluded.date, customerName = excluded.customerName, saleType = excluded.saleType, items = excluded.items, totalAmount = excluded.totalAmount, paymentMethod = excluded.paymentMethod, mpesaCode = excluded.mpesaCode, cashier = excluded.cashier, paidAmount = excluded.paidAmount, balanceDue = excluded.balanceDue, deadline = excluded.deadline WHERE sales.tenantId = excluded.tenantId`
            ).bind(
              s.id, s.date, s.customerName, s.saleType, itemsJson, s.totalAmount, s.paymentMethod, s.mpesaCode || '', s.cashier, s.paidAmount, s.balanceDue, s.deadline || '', tid
            )
          );
        }
      }

      if (Array.isArray(body.expenses)) {
        for (const exp of body.expenses) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO expenses (id, date, category, description, amount, paymentMethod, mpesaCode, payer, paidTo, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET date = excluded.date, category = excluded.category, description = excluded.description, amount = excluded.amount, paymentMethod = excluded.paymentMethod, mpesaCode = excluded.mpesaCode, payer = excluded.payer, paidTo = excluded.paidTo, tenantId = excluded.tenantId WHERE expenses.tenantId = excluded.tenantId OR expenses.tenantId IS NULL`
            ).bind(
              exp.id, exp.date, exp.category, exp.description, exp.amount, exp.paymentMethod, exp.mpesaCode || '', exp.payer || '', exp.paidTo || '', tid
            )
          );
        }
      }

      if (Array.isArray(body.categories)) {
        for (const cat of body.categories) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, tenantId = excluded.tenantId WHERE categories.tenantId = excluded.tenantId OR categories.tenantId IS NULL`
            ).bind(cat.id, cat.name, cat.status || 'Active', tid)
          );
        }
      }

      if (Array.isArray(body.expenseCategories)) {
        for (const ec of body.expenseCategories) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO expense_categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, tenantId = excluded.tenantId WHERE expense_categories.tenantId = excluded.tenantId OR expense_categories.tenantId IS NULL`
            ).bind(ec.id, ec.name, ec.status || 'Active', tid)
          );
        }
      }

      if (Array.isArray(body.itemStatuses)) {
        for (const st of body.itemStatuses) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO item_statuses (id, name, status, canSell, tenantId) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, canSell = excluded.canSell, tenantId = excluded.tenantId WHERE item_statuses.tenantId = excluded.tenantId OR item_statuses.tenantId IS NULL`
            ).bind(st.id, st.name, st.status || 'Active', st.canSell ? 1 : 0, tid)
          );
        }
      }

      if (Array.isArray(body.users)) {
        for (const u of body.users) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO users (id, name, role, pin, phone, status, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, pin = excluded.pin, phone = excluded.phone, status = excluded.status, tenantId = excluded.tenantId WHERE users.tenantId = excluded.tenantId OR users.tenantId IS NULL`
            ).bind(u.id, u.name, u.role, u.pin, u.phone, u.status, tid)
          );
        }
      }

      if (Array.isArray(body.roles)) {
        for (const r of body.roles) {
          const privs = typeof r.privileges === 'string' ? r.privileges : JSON.stringify(r.privileges || {});
          statements.push(
            env.DB.prepare(
              `INSERT INTO roles (id, name, privileges, tenantId) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, privileges = excluded.privileges WHERE roles.tenantId = excluded.tenantId`
            ).bind(r.id, r.name, privs, tid)
          );
        }
      }

      if (Array.isArray(body.suppliers)) {
        for (const sup of body.suppliers) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO suppliers (id, name, phone, email, location, creditTermType, creditDays, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, location = excluded.location, creditTermType = excluded.creditTermType, creditDays = excluded.creditDays, tenantId = excluded.tenantId WHERE suppliers.tenantId = excluded.tenantId OR suppliers.tenantId IS NULL`
            ).bind(
              sup.id, sup.name, sup.phone || '', sup.email || '', sup.location || '', sup.creditTermType || 'COD', sup.creditDays || 0, tid
            )
          );
        }
      }

      if (Array.isArray(body.purchaseOrders)) {
        for (const po of body.purchaseOrders) {
          statements.push(
            env.DB.prepare(
              `INSERT INTO purchase_orders (id, date, supplierId, supplierName, itemId, itemName, quantity, cost, amount, paidAmount, balanceDue, paymentMethod, paymentStatus, workflowStatus, deadline, tenantId, taxInclusive, paymentHistory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET date = excluded.date, supplierId = excluded.supplierId, supplierName = excluded.supplierName, itemId = excluded.itemId, itemName = excluded.itemName, quantity = excluded.quantity, cost = excluded.cost, amount = excluded.amount, paidAmount = excluded.paidAmount, balanceDue = excluded.balanceDue, paymentMethod = excluded.paymentMethod, paymentStatus = excluded.paymentStatus, workflowStatus = excluded.workflowStatus, deadline = excluded.deadline, taxInclusive = excluded.taxInclusive, paymentHistory = excluded.paymentHistory WHERE purchase_orders.tenantId = excluded.tenantId`
            ).bind(
              po.id, po.date, po.supplierId || '', po.supplierName, po.itemId || '', po.itemName, po.quantity || 1, po.cost || 0, po.amount || 0, po.paidAmount || 0, po.balanceDue || 0, po.paymentMethod || 'Cash', po.paymentStatus || 'Unpaid', po.workflowStatus || 'Draft', po.deadline || '', tid, po.taxInclusive ? 1 : 0, JSON.stringify(po.paymentHistory || [])
            )
          );
        }
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Branches / locations CRUD
    if (routeType === 'branches' || routeType === 'branch') {
      const tid = auth.tenantId || 'tenant-default';
      await ensureDefaultBranch(tid);
      if (request.method === 'GET') {
        const rows = await listBranches(tid);
        const ten = await getTenant(tid);
        const maxB = Math.min(MAX_BRANCHES_HARD, Number(ten?.maxBranches) || 1);
        return json({ branches: rows, maxBranches: maxB });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const ten = await getTenant(tid);
        const maxB = Math.min(MAX_BRANCHES_HARD, Number(ten?.maxBranches) || 1);
        const existing = await listBranches(tid);
        if (existing.length >= maxB) return json({ error: `Location limit reached (${maxB}). Upgrade plan or remove a location.` }, 403);
        const name = String(body.name || '').trim();
        if (!name) return json({ error: 'Location name required' }, 400);
        const bid = body.id || ('br-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6));
        await env.DB.prepare(
          `INSERT INTO branches (id, tenantId, name, address, phone, status, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(bid, tid, name, body.address || '', body.phone || '', body.status || 'Active', existing.length ? 0 : 1, Date.now()).run();
        try { await writeSecurityAudit(auth, 'create', 'branch', bid); } catch (_) {}
        return json({ success: true, id: bid });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        if (body.isDefault) {
          await env.DB.prepare(`UPDATE branches SET isDefault = 0 WHERE tenantId = ?`).bind(tid).run();
        }
        await env.DB.prepare(
          `UPDATE branches SET name = COALESCE(?, name), address = COALESCE(?, address), phone = COALESCE(?, phone), status = COALESCE(?, status), isDefault = COALESCE(?, isDefault) WHERE id = ? AND tenantId = ?`
        ).bind(body.name || null, body.address ?? null, body.phone ?? null, body.status || null, body.isDefault ? 1 : (body.isDefault === false ? 0 : null), id, tid).run();
        return json({ success: true });
      }
      if (request.method === 'DELETE' && id) {
        const rows = await listBranches(tid);
        if (rows.length <= 1) return json({ error: 'Cannot delete the only location.' }, 400);
        const target = rows.find(b => b.id === id);
        if (!target) return json({ error: 'Location not found' }, 404);
        await env.DB.prepare(`DELETE FROM branches WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        if (target.isDefault) {
          const next = rows.find(b => b.id !== id);
          if (next) await env.DB.prepare(`UPDATE branches SET isDefault = 1 WHERE id = ?`).bind(next.id).run();
        }
        try { await writeSecurityAudit(auth, 'delete', 'branch', id); } catch (_) {}
        return json({ success: true });
      }
    }

    // 3. INVENTORY CRUD
    if (routeType === 'inventory') {
      const tidInv = auth.tenantId || 'tenant-default';
      for (const col of ['sku TEXT', 'size TEXT', 'colour TEXT', 'wholesalePrice REAL', 'varianceValues TEXT']) {
        try { await env.DB.prepare(`ALTER TABLE inventory ADD COLUMN ${col}`).run(); } catch (_) {}
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const qty = Math.max(0, Number(body.quantity) || 0);
        const branchId = await resolveBranchId(tidInv, body.branchId || requestBranchId());
        if (!branchAllowedForAuth(auth, branchId)) return json({ error: 'Not allowed to manage inventory for this location.' }, 403);
        const varJson = body.varianceValues != null
          ? (typeof body.varianceValues === 'string' ? body.varianceValues : JSON.stringify(body.varianceValues || {}))
          : '{}';
        try {
          await env.DB.prepare(
            `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId, sku, size, colour, wholesalePrice, branchId, varianceValues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.name, body.category, body.buyingPrice || 0, body.price || 0, qty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status || 'Listed', body.photoUrl || '', tidInv, body.sku || '', body.size || '', body.colour || '', body.wholesalePrice || 0, branchId, varJson).run();
        } catch (_) {
          try {
            await env.DB.prepare(
              `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId, sku, size, colour, wholesalePrice, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(body.id, body.name, body.category, body.buyingPrice || 0, body.price || 0, qty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status || 'Listed', body.photoUrl || '', tidInv, body.sku || '', body.size || '', body.colour || '', body.wholesalePrice || 0, branchId).run();
          } catch (__) {
            try {
              await env.DB.prepare(
                `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(body.id, body.name, body.category, body.buyingPrice || 0, body.price || 0, qty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status || 'Listed', body.photoUrl || '', tidInv, branchId).run();
            } catch (___) {
              await env.DB.prepare(
                `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(body.id, body.name, body.category, body.buyingPrice || 0, body.price || 0, qty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status || 'Listed', body.photoUrl || '', tidInv).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        if (Number(body.quantity) < 0) return json({ error: 'Quantity cannot be negative.' }, 400);
        const safeQty = Math.max(0, Number(body.quantity) || 0);
        const varJson = body.varianceValues != null
          ? (typeof body.varianceValues === 'string' ? body.varianceValues : JSON.stringify(body.varianceValues || {}))
          : null;
        try {
          if (varJson != null) {
            await env.DB.prepare(
              `UPDATE inventory SET name = ?, category = ?, buyingPrice = ?, price = ?, quantity = ?, lowStockAlert = ?, trackInventory = ?, status = ?, photoUrl = ?, sku = ?, size = ?, colour = ?, wholesalePrice = ?, varianceValues = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.name, body.category, body.buyingPrice || 0, body.price || 0, safeQty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status, body.photoUrl || '', body.sku || '', body.size || '', body.colour || '', body.wholesalePrice || 0, varJson, id, tidInv).run();
          } else {
            await env.DB.prepare(
              `UPDATE inventory SET name = ?, category = ?, buyingPrice = ?, price = ?, quantity = ?, lowStockAlert = ?, trackInventory = ?, status = ?, photoUrl = ?, sku = ?, size = ?, colour = ?, wholesalePrice = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.name, body.category, body.buyingPrice || 0, body.price || 0, safeQty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status, body.photoUrl || '', body.sku || '', body.size || '', body.colour || '', body.wholesalePrice || 0, id, tidInv).run();
          }
        } catch (_) {
          await env.DB.prepare(
            `UPDATE inventory SET name = ?, category = ?, buyingPrice = ?, price = ?, quantity = ?, lowStockAlert = ?, trackInventory = ?, status = ?, photoUrl = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.name, body.category, body.buyingPrice || 0, body.price || 0, safeQty, body.lowStockAlert || 2, body.trackInventory ? 1 : 0, body.status, body.photoUrl || '', id, tidInv).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const delItem = await env.DB.prepare(`SELECT name FROM inventory WHERE id = ? AND tenantId = ?`).bind(id, tidInv).first().catch(() => null);
        await env.DB.prepare(`DELETE FROM inventory WHERE id = ? AND tenantId = ?`).bind(id, tidInv).run();
        try { await env.DB.prepare(`DELETE FROM stock_movements WHERE tenantId = ? AND itemId = ?`).bind(tidInv, id).run(); } catch (_) {}
        try {
          await writeSecurityAudit(auth, 'delete', routeType, id);
          await appendTenantAuditRecord(tidInv, auth.user?.name || 'Staff', 'delete', 'inventory', `${delItem?.name || id} (${id})`);
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 4. CUSTOMERS CRUD
    if (routeType === 'customers') {
      if (request.method === 'POST') {
        const body = await request.json();
        const eligibilityJson = JSON.stringify(body.eligibility || ['Paid']);
        const tid = auth.tenantId || 'tenant-default';
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN loyaltyPoints REAL DEFAULT 0`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN creditLimit REAL DEFAULT 0`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN salesTermId TEXT`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN paymentTerm TEXT`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN tags TEXT`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN priceList TEXT`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN kraPin TEXT`).run(); } catch (_) {}
        const creditLimitNum = parseFloat(body.creditLimit) || 0;
        try {
          await env.DB.prepare(
            `INSERT INTO customers (id, name, phone, location, eligibility, loyaltyPoints, creditLimit, salesTermId, paymentTerm, tags, priceList, kraPin, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.name, body.phone || '', body.location || '', eligibilityJson, parseFloat(body.loyaltyPoints) || 0, creditLimitNum, body.salesTermId || '', body.paymentTerm || '', body.tags || '', body.priceList || 'retail', body.kraPin || '', tid).run();
        } catch (_) {
          try {
            await env.DB.prepare(
              `INSERT INTO customers (id, name, phone, location, eligibility, loyaltyPoints, salesTermId, paymentTerm, tags, priceList, kraPin, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(body.id, body.name, body.phone || '', body.location || '', eligibilityJson, parseFloat(body.loyaltyPoints) || 0, body.salesTermId || '', body.paymentTerm || '', body.tags || '', body.priceList || 'retail', body.kraPin || '', tid).run();
          } catch (__) {
            await env.DB.prepare(
              `INSERT INTO customers (id, name, phone, location, eligibility, tenantId) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(body.id, body.name, body.phone, body.location, eligibilityJson, tid).run();
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const eligibilityJson = JSON.stringify(body.eligibility || ['Paid']);
        const tid = auth.tenantId || 'tenant-default';
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN loyaltyPoints REAL DEFAULT 0`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN creditLimit REAL DEFAULT 0`).run(); } catch (_) {}
        const creditLimitNum = parseFloat(body.creditLimit) || 0;
        try {
          await env.DB.prepare(
            `UPDATE customers SET name = ?, phone = ?, location = ?, eligibility = ?, loyaltyPoints = ?, creditLimit = ?, salesTermId = ?, paymentTerm = ?, tags = ?, priceList = ?, kraPin = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.name, body.phone || '', body.location || '', eligibilityJson, parseFloat(body.loyaltyPoints) || 0, creditLimitNum, body.salesTermId || '', body.paymentTerm || '', body.tags || '', body.priceList || 'retail', body.kraPin || '', id, tid).run();
        } catch (_) {
          try {
            await env.DB.prepare(
              `UPDATE customers SET name = ?, phone = ?, location = ?, eligibility = ?, loyaltyPoints = ?, salesTermId = ?, paymentTerm = ?, tags = ?, priceList = ?, kraPin = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.name, body.phone || '', body.location || '', eligibilityJson, parseFloat(body.loyaltyPoints) || 0, body.salesTermId || '', body.paymentTerm || '', body.tags || '', body.priceList || 'retail', body.kraPin || '', id, tid).run();
          } catch (__) {
            try {
              await env.DB.prepare(
                `UPDATE customers SET name = ?, phone = ?, location = ?, eligibility = ?, loyaltyPoints = ? WHERE id = ? AND tenantId = ?`
              ).bind(body.name, body.phone || '', body.location || '', eligibilityJson, parseFloat(body.loyaltyPoints) || 0, id, tid).run();
            } catch (___) {
              await env.DB.prepare(
                `UPDATE customers SET name = ?, phone = ?, location = ?, eligibility = ? WHERE id = ? AND tenantId = ?`
              ).bind(body.name, body.phone, body.location, eligibilityJson, id, tid).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM customers WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 5. EXPENSES CRUD
    if (routeType === 'expenses') {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY, date TEXT, category TEXT, description TEXT, amount REAL,
          paymentMethod TEXT, mpesaCode TEXT, payer TEXT, paidTo TEXT,
          paidAmount REAL, balanceDue REAL, paymentStatus TEXT, taxAmount REAL
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN paidAmount REAL`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN balanceDue REAL`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN paymentStatus TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN taxAmount REAL`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE expenses ADD COLUMN paymentHistory TEXT`).run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        const amount = parseFloat(body.amount) || 0;
        const paidAmount = body.paidAmount != null && body.paidAmount !== '' ? parseFloat(body.paidAmount) : amount;
        const balanceDue = body.balanceDue != null ? parseFloat(body.balanceDue) : Math.max(0, amount - paidAmount);
        const paymentStatus = body.paymentStatus || (balanceDue <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid'));
        const tid = auth.tenantId || 'tenant-default';
        const branchId = await resolveBranchId(tid, body.branchId || requestBranchId());
        if (!branchAllowedForAuth(auth, branchId)) return json({ error: 'Not allowed to post expenses for this location.' }, 403);
        let payHistArr = body.paymentHistory;
        try { if (typeof payHistArr === 'string') payHistArr = JSON.parse(payHistArr || '[]'); } catch (_) { payHistArr = []; }
        if (!Array.isArray(payHistArr) || !payHistArr.length) {
          payHistArr = paidAmount > 0 ? [{ id: `exppay-${Date.now()}`, date: new Date().toISOString(), amount: paidAmount, paymentMethod: body.paymentMethod || 'Cash', mpesaCode: body.mpesaCode || '' }] : [];
        }
        const payHistJson = JSON.stringify(payHistArr);
        try {
          await env.DB.prepare(
            `INSERT INTO expenses (id, date, category, description, amount, paymentMethod, mpesaCode, payer, paidTo, paidAmount, balanceDue, paymentStatus, taxAmount, tenantId, branchId, paymentHistory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', paidAmount, balanceDue, paymentStatus, body.taxAmount || 0, tid, branchId, payHistJson).run();
        } catch (err0) {
          try {
            await env.DB.prepare(
              `INSERT INTO expenses (id, date, category, description, amount, paymentMethod, mpesaCode, payer, paidTo, paidAmount, balanceDue, paymentStatus, taxAmount, tenantId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(body.id, body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', paidAmount, balanceDue, paymentStatus, body.taxAmount || 0, tid, branchId).run();
          } catch (err) {
            await env.DB.prepare(
              `INSERT INTO expenses (id, date, category, description, amount, paymentMethod, mpesaCode, payer, paidTo, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(body.id, body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', tid).run();
          }
        }
        try { await journalExpense(auth, { ...body, amount, paidAmount, balanceDue, paymentStatus }, branchId); } catch (_) {}
        if (paidAmount > 0) {
          try { await appendTenantAuditRecord(tid, auth.user?.name || body.payer || 'Staff', 'payment', 'expense', `${body.description || body.category} — Paid ${paidAmount} via ${body.paymentMethod || 'Cash'}`); } catch (_) {}
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const amount = parseFloat(body.amount) || 0;
        const paidAmount = body.paidAmount != null && body.paidAmount !== '' ? parseFloat(body.paidAmount) : amount;
        const balanceDue = body.balanceDue != null ? parseFloat(body.balanceDue) : Math.max(0, amount - paidAmount);
        const paymentStatus = body.paymentStatus || (balanceDue <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid'));
        const tid = auth.tenantId || 'tenant-default';
        const prevExp = await env.DB.prepare(`SELECT paidAmount, description, category FROM expenses WHERE id = ? AND tenantId = ?`).bind(id, tid).first().catch(() => null);
        const prevPaid = prevExp ? (parseFloat(prevExp.paidAmount) || 0) : 0;
        const payHistJson = body.paymentHistory != null ? (typeof body.paymentHistory === 'string' ? body.paymentHistory : JSON.stringify(body.paymentHistory)) : null;
        try {
          if (payHistJson != null) {
            await env.DB.prepare(
              `UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, paymentMethod = ?, mpesaCode = ?, payer = ?, paidTo = ?, paidAmount = ?, balanceDue = ?, paymentStatus = ?, taxAmount = ?, paymentHistory = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', paidAmount, balanceDue, paymentStatus, body.taxAmount || 0, payHistJson, id, tid).run();
          } else {
            await env.DB.prepare(
              `UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, paymentMethod = ?, mpesaCode = ?, payer = ?, paidTo = ?, paidAmount = ?, balanceDue = ?, paymentStatus = ?, taxAmount = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', paidAmount, balanceDue, paymentStatus, body.taxAmount || 0, id, tid).run();
          }
        } catch (err) {
          await env.DB.prepare(
            `UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, paymentMethod = ?, mpesaCode = ?, payer = ?, paidTo = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.date, body.category, body.description, amount, body.paymentMethod, body.mpesaCode || '', body.payer || '', body.paidTo || '', id, tid).run();
        }
        const deltaPaid = Math.round((paidAmount - prevPaid) * 100) / 100;
        if (deltaPaid > 0) {
          try { await appendTenantAuditRecord(tid, auth.user?.name || body.payer || 'Staff', 'payment', 'expense', `${body.description || body.category || id} — Paid +${deltaPaid} via ${body.paymentMethod || 'Cash'}`); } catch (_) {}
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        const delExp = await env.DB.prepare(`SELECT description, category, amount FROM expenses WHERE id = ? AND tenantId = ?`).bind(id, tid).first().catch(() => null);
        await env.DB.prepare(`DELETE FROM expenses WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try {
          await writeSecurityAudit(auth, 'delete', routeType, id);
          await appendTenantAuditRecord(tid, auth.user?.name || 'Staff', 'delete', 'expense', `${delExp?.description || delExp?.category || id} (${id})`);
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 6. SALES CRUD
    if (routeType === 'sales') {
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN returnHistory TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN paymentHistory TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN taxInclusive INTEGER DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN originalSaleType TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN branchId TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN subtotal REAL').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN taxAmount REAL').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN taxRate REAL').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN taxName TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE sales ADD COLUMN tenantId TEXT').run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        if (!body || !body.id) return json({ error: 'Sale id is required' }, 400);
        let saleItems = [];
        try {
          saleItems = typeof body.items === 'string' ? JSON.parse(body.items || '[]') : (body.items || []);
        } catch (_) { saleItems = []; }
        const itemsJson = JSON.stringify(saleItems);
        const tenantId = auth.tenantId || 'tenant-default';
        let branchId = null;
        try {
          branchId = await resolveBranchId(tenantId, (body.branchId && body.branchId !== 'all') ? body.branchId : requestBranchId());
        } catch (_) { branchId = body.branchId && body.branchId !== 'all' ? body.branchId : null; }
        // Branch gate: only hard-fail if user has an explicit allow-list that excludes this branch
        try {
          if (branchId && !branchAllowedForAuth(auth, branchId)) {
            return json({ error: 'Not allowed to post sales for this location.' }, 403);
          }
        } catch (_) {}

        const tracks = (v) => v === true || v === 1 || v === '1' || v === 'true';
        const trackedLines = [];
        for (const item of saleItems) {
          if (!tracks(item.trackInventory) || !item.id) continue;
          const qty = Math.max(0, Number(item.qty) || 0);
          if (qty <= 0) continue;
          let stock = null;
          try {
            stock = await env.DB.prepare(
              `SELECT id, quantity, name, tenantId FROM inventory WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') LIMIT 1`
            ).bind(item.id, tenantId).first();
          } catch (_) {
            try {
              stock = await env.DB.prepare(`SELECT id, quantity, name FROM inventory WHERE id = ? LIMIT 1`).bind(item.id).first();
            } catch (__) {}
          }
          if (!stock) {
            // Do not block the whole sale for a missing catalog row — skip stock movement
            console.log('sale: inventory row missing', item.id);
            continue;
          }
          const available = Number(stock.quantity) || 0;
          if (available < qty) {
            return json({ error: `Insufficient stock for ${item.name || stock.name || item.id}. Available: ${available}; requested: ${qty}.` }, 409);
          }
          trackedLines.push({ id: item.id, qty, name: item.name || stock.name || item.id, before: available });
        }

        // Decrement stock (best effort; verify qty)
        for (let i = 0; i < trackedLines.length; i++) {
          const t = trackedLines[i];
          try {
            const result = await env.DB.prepare(
              `UPDATE inventory SET quantity = quantity - ?, status = CASE WHEN quantity - ? <= 0 THEN 'Sold' ELSE status END
               WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') AND quantity >= ?`
            ).bind(t.qty, t.qty, t.id, tenantId, t.qty).run();
            const changes = result && result.meta != null && result.meta.changes != null ? Number(result.meta.changes) : null;
            if (changes === 0) {
              for (let j = 0; j < i; j++) {
                try {
                  await env.DB.prepare(
                    `UPDATE inventory SET quantity = quantity + ?, status = CASE WHEN status = 'Sold' THEN 'Listed' ELSE status END WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`
                  ).bind(trackedLines[j].qty, trackedLines[j].id, tenantId).run();
                } catch (_) {}
              }
              return json({ error: `Insufficient stock for ${t.name} (concurrent sale). Refresh and try again.` }, 409);
            }
          } catch (e) {
            // Fallback update without tenant filter
            try {
              await env.DB.prepare(
                `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?`
              ).bind(t.qty, t.id, t.qty).run();
            } catch (e2) {
              for (let j = 0; j < i; j++) {
                try {
                  await env.DB.prepare(`UPDATE inventory SET quantity = quantity + ? WHERE id = ?`).bind(trackedLines[j].qty, trackedLines[j].id).run();
                } catch (_) {}
              }
              return json({ error: `Stock update failed for ${t.name}: ${(e2 && e2.message) || (e && e.message) || 'db'}` }, 500);
            }
          }
        }

        const restoreStock = async () => {
          for (const t of trackedLines) {
            try {
              await env.DB.prepare(
                `UPDATE inventory SET quantity = quantity + ?, status = CASE WHEN status = 'Sold' THEN 'Listed' ELSE status END WHERE id = ?`
              ).bind(t.qty, t.id).run();
            } catch (_) {}
          }
        };

        // Insert sale — multiple schema fallbacks
        const vals = {
          id: body.id,
          date: body.date || new Date().toISOString(),
          customerName: body.customerName || '',
          saleType: body.saleType || 'Paid',
          itemsJson,
          totalAmount: Number(body.totalAmount) || 0,
          paymentMethod: body.paymentMethod || 'Cash',
          mpesaCode: body.mpesaCode || '',
          cashier: body.cashier || '',
          paidAmount: Number(body.paidAmount) || 0,
          balanceDue: body.balanceDue != null ? Number(body.balanceDue) : 0,
          deadline: body.deadline || '',
          subtotal: body.subtotal != null ? Number(body.subtotal) : (Number(body.totalAmount) || 0),
          taxAmount: Number(body.taxAmount) || 0,
          taxRate: Number(body.taxRate) || 0,
          taxName: body.taxName || '',
          taxInclusive: body.taxInclusive ? 1 : 0,
          tenantId,
          branchId: branchId || ''
        };
        let initPayHist = body.paymentHistory;
        try { if (typeof initPayHist === 'string') initPayHist = JSON.parse(initPayHist || '[]'); } catch (_) { initPayHist = []; }
        if (!Array.isArray(initPayHist) || !initPayHist.length) {
          initPayHist = vals.paidAmount > 0 ? [{ id: `spay-${Date.now()}`, date: new Date().toISOString(), amount: vals.paidAmount, paymentMethod: vals.paymentMethod, mpesaCode: vals.mpesaCode && vals.mpesaCode !== 'N/A' ? vals.mpesaCode : '' }] : [];
        }
        const salePayHistJson = JSON.stringify(initPayHist);

        let saleInserted = false;
        let lastErr = null;
        const attempts = [
          async () => env.DB.prepare(
            `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline, subtotal, taxAmount, taxRate, taxName, tenantId, taxInclusive, branchId, paymentHistory)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(vals.id, vals.date, vals.customerName, vals.saleType, vals.itemsJson, vals.totalAmount, vals.paymentMethod, vals.mpesaCode, vals.cashier, vals.paidAmount, vals.balanceDue, vals.deadline, vals.subtotal, vals.taxAmount, vals.taxRate, vals.taxName, vals.tenantId, vals.taxInclusive, vals.branchId, salePayHistJson).run(),
          async () => env.DB.prepare(
            `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline, subtotal, taxAmount, taxRate, taxName, tenantId, taxInclusive, branchId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(vals.id, vals.date, vals.customerName, vals.saleType, vals.itemsJson, vals.totalAmount, vals.paymentMethod, vals.mpesaCode, vals.cashier, vals.paidAmount, vals.balanceDue, vals.deadline, vals.subtotal, vals.taxAmount, vals.taxRate, vals.taxName, vals.tenantId, vals.taxInclusive, vals.branchId).run(),
          async () => env.DB.prepare(
            `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline, subtotal, taxAmount, taxRate, taxName, tenantId, taxInclusive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(vals.id, vals.date, vals.customerName, vals.saleType, vals.itemsJson, vals.totalAmount, vals.paymentMethod, vals.mpesaCode, vals.cashier, vals.paidAmount, vals.balanceDue, vals.deadline, vals.subtotal, vals.taxAmount, vals.taxRate, vals.taxName, vals.tenantId, vals.taxInclusive).run(),
          async () => env.DB.prepare(
            `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline, tenantId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(vals.id, vals.date, vals.customerName, vals.saleType, vals.itemsJson, vals.totalAmount, vals.paymentMethod, vals.mpesaCode, vals.cashier, vals.paidAmount, vals.balanceDue, vals.deadline, vals.tenantId).run(),
          async () => env.DB.prepare(
            `INSERT INTO sales (id, date, customerName, saleType, items, totalAmount, paymentMethod, mpesaCode, cashier, paidAmount, balanceDue, deadline)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(vals.id, vals.date, vals.customerName, vals.saleType, vals.itemsJson, vals.totalAmount, vals.paymentMethod, vals.mpesaCode, vals.cashier, vals.paidAmount, vals.balanceDue, vals.deadline).run()
        ];
        for (const fn of attempts) {
          try {
            await fn();
            saleInserted = true;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!saleInserted) {
          await restoreStock();
          return json({ error: 'Sale could not be saved: ' + ((lastErr && lastErr.message) || 'database error') }, 500);
        }

        // Ensure tenantId stamped if legacy insert path omitted it
        try {
          await env.DB.prepare(`UPDATE sales SET tenantId = ? WHERE id = ? AND (tenantId IS NULL OR tenantId = '')`).bind(tenantId, body.id).run();
        } catch (_) {}

        // Server-side loyalty points award & redemption (works regardless of customers.update role permission)
        let updatedCustomerLoyaltyPoints = null;
        try {
          const ptsEarned = Math.max(0, parseFloat(body.loyaltyPointsEarned) || 0);
          const ptsRedeemed = Math.max(0, parseFloat(body.loyaltyPointsRedeemed) || 0);
          if ((ptsEarned > 0 || ptsRedeemed > 0) && (body.customerId || vals.customerName)) {
            try { await env.DB.prepare(`ALTER TABLE customers ADD COLUMN loyaltyPoints REAL DEFAULT 0`).run(); } catch (_) {}
            let custRow = null;
            if (body.customerId) {
              custRow = await env.DB.prepare(`SELECT id, loyaltyPoints FROM customers WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') LIMIT 1`).bind(body.customerId, tenantId).first();
            }
            if (!custRow && vals.customerName) {
              custRow = await env.DB.prepare(`SELECT id, loyaltyPoints FROM customers WHERE LOWER(name) = LOWER(?) AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') LIMIT 1`).bind(vals.customerName, tenantId).first();
            }
            if (custRow && custRow.id) {
              const nextPts = Math.max(0, (parseFloat(custRow.loyaltyPoints) || 0) + ptsEarned - ptsRedeemed);
              await env.DB.prepare(`UPDATE customers SET loyaltyPoints = ? WHERE id = ?`).bind(nextPts, custRow.id).run();
              updatedCustomerLoyaltyPoints = { customerId: custRow.id, loyaltyPoints: nextPts };
            }
          }
        } catch (_) {}

        if (vals.paidAmount > 0) {
          try {
            await appendTenantAuditRecord(tenantId, auth.user?.name || vals.cashier || 'Staff', 'payment', 'sales', `Sale ${vals.id} (${vals.customerName}) — Paid ${vals.paidAmount} via ${vals.paymentMethod}`);
          } catch (_) {}
        }

        // Journal (never fails the sale)
        let journalId = null;
        try {
          journalId = await journalSale(auth, { ...body, items: saleItems }, branchId);
        } catch (je) {
          console.log('journalSale failed', je && je.message);
        }

        return json({ success: true, id: body.id, journalId: journalId || null, stockAdjusted: trackedLines.length, customerLoyalty: updatedCustomerLoyaltyPoints });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const itemsJson = typeof body.items === 'string' ? body.items : JSON.stringify(body.items || []);
        const tid = auth.tenantId || 'tenant-default';
        let prevPaid = 0;
        let prevHistRaw = '[]';
        try {
          const prev = await env.DB.prepare('SELECT paidAmount, customerName, branchId, paymentHistory FROM sales WHERE id = ? AND tenantId = ?').bind(id, tid).first();
          prevPaid = Number(prev?.paidAmount) || 0;
          prevHistRaw = prev?.paymentHistory || '[]';
        } catch (_) {
          try {
            const prev = await env.DB.prepare('SELECT paidAmount FROM sales WHERE id = ?').bind(id).first();
            prevPaid = Number(prev?.paidAmount) || 0;
          } catch (__) {}
        }
        const payHistJson = body.paymentHistory != null
          ? (typeof body.paymentHistory === 'string' ? body.paymentHistory : JSON.stringify(body.paymentHistory))
          : prevHistRaw;
        try {
          await env.DB.prepare(
            `UPDATE sales SET date = ?, customerName = ?, saleType = ?, items = ?, totalAmount = ?, paymentMethod = ?, mpesaCode = ?, cashier = ?, paidAmount = ?, balanceDue = ?, deadline = ?, subtotal = ?, taxAmount = ?, taxRate = ?, taxName = ?, returnHistory = ?, taxInclusive = ?, originalSaleType = ?, paymentHistory = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.date, body.customerName, body.saleType, itemsJson, body.totalAmount, body.paymentMethod, body.mpesaCode || '', body.cashier, body.paidAmount, body.balanceDue, body.deadline || '', body.subtotal ?? body.totalAmount, body.taxAmount || 0, body.taxRate || 0, body.taxName || '', JSON.stringify(body.returnHistory || []), body.taxInclusive ? 1 : 0, body.originalSaleType || '', payHistJson, id, tid).run();
        } catch (_) {
          try {
            await env.DB.prepare(
              `UPDATE sales SET date = ?, customerName = ?, saleType = ?, items = ?, totalAmount = ?, paymentMethod = ?, mpesaCode = ?, cashier = ?, paidAmount = ?, balanceDue = ?, deadline = ?, subtotal = ?, taxAmount = ?, taxRate = ?, taxName = ?, returnHistory = ?, taxInclusive = ?, originalSaleType = ? WHERE id = ? AND tenantId = ?`
            ).bind(body.date, body.customerName, body.saleType, itemsJson, body.totalAmount, body.paymentMethod, body.mpesaCode || '', body.cashier, body.paidAmount, body.balanceDue, body.deadline || '', body.subtotal ?? body.totalAmount, body.taxAmount || 0, body.taxRate || 0, body.taxName || '', JSON.stringify(body.returnHistory || []), body.taxInclusive ? 1 : 0, body.originalSaleType || '', id, tid).run();
          } catch (__) {
            try {
              await env.DB.prepare(
                `UPDATE sales SET date = ?, customerName = ?, saleType = ?, items = ?, totalAmount = ?, paymentMethod = ?, mpesaCode = ?, cashier = ?, paidAmount = ?, balanceDue = ?, deadline = ? WHERE id = ?`
              ).bind(body.date, body.customerName, body.saleType, itemsJson, body.totalAmount, body.paymentMethod, body.mpesaCode || '', body.cashier, body.paidAmount, body.balanceDue, body.deadline || '', id).run();
            } catch (e2) {
              return json({ error: 'Sale update failed: ' + (e2.message || 'db') }, 500);
            }
          }
        }
        try {
          const newPaid = Number(body.paidAmount) || 0;
          const delta = Math.round((newPaid - prevPaid) * 100) / 100;
          if (delta > 0.009) {
            await journalCustomerReceipt(auth, { id, customerName: body.customerName }, delta, body.paymentMethod || 'Cash', body.branchId || '', id + '-rcpt-' + newPaid);
            await appendTenantAuditRecord(tid, auth.user?.name || body.cashier || 'Staff', 'payment', 'sales', `Sale ${id} (${body.customerName || ''}) — Additional payment ${delta} via ${body.paymentMethod || 'Cash'}`);
          }
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        const delSale = await env.DB.prepare(`SELECT customerName, totalAmount FROM sales WHERE id = ? AND tenantId = ?`).bind(id, tid).first().catch(() => null);
        try {
          await env.DB.prepare(`DELETE FROM sales WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        } catch (_) {
          await env.DB.prepare(`DELETE FROM sales WHERE id = ?`).bind(id).run();
        }
        try {
          await writeSecurityAudit(auth, 'delete', routeType, id);
          await appendTenantAuditRecord(tid, auth.user?.name || 'Staff', 'delete', 'sales', `Deleted sale ${id}${delSale?.customerName ? ' (' + delSale.customerName + ')' : ''}`);
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Sales return: update sale + restore stock (Saleable) in one batch — same business rules as UI
    if ((routeType === 'sales-return' || routeType === 'sales_return') && request.method === 'POST') {
      const body = await request.json();
      const tenantId = auth.tenantId || 'tenant-default';
      const saleId = body.saleId || body.id;
      if (!saleId) return json({ error: 'saleId required' }, 400);
      const sale = await env.DB.prepare('SELECT * FROM sales WHERE id = ? AND tenantId = ?').bind(saleId, tenantId).first();
      if (!sale) return json({ error: 'Sale not found for this shop.' }, 404);

      let items = [];
      try { items = typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : (sale.items || []); } catch (_) { items = []; }
      const returnQtys = body.returnQtys || body.qtys || {};
      const disposition = body.disposition || 'Saleable';
      const method = body.method || body.paymentMethod || sale.paymentMethod || 'Cash';

      let refundSubtotal = 0;
      const updatedItems = items.map((it, idx) => {
        const key = String(idx);
        const ret = Math.min(Math.max(0, parseInt(returnQtys[key] ?? returnQtys[idx], 10) || 0), Math.max(0, (Number(it.qty) || 0) - (Number(it.returnedQty) || 0)));
        if (ret > 0) refundSubtotal += (Number(it.price) || 0) * ret;
        return {
          ...it,
          returnedQty: (Number(it.returnedQty) || 0) + ret,
          returnedSaleableQty: (Number(it.returnedSaleableQty) || 0) + (disposition === 'Saleable' ? ret : 0),
          _retThis: ret
        };
      });
      if (refundSubtotal <= 0) return json({ error: 'Select at least one item quantity to return.' }, 400);

      const origSub = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) || Number(sale.totalAmount) || 1;
      const origTax = parseFloat(sale.taxAmount) || 0;
      const refundTax = origSub > 0 ? (refundSubtotal / origSub) * origTax : 0;
      const taxInclusive = !!(body.taxInclusive != null ? body.taxInclusive : sale.taxInclusive);
      const refundTotal = Math.round((refundSubtotal + (taxInclusive ? 0 : refundTax)) * 100) / 100;

      const newTotal = Math.max(0, (Number(sale.totalAmount) || 0) - refundTotal);
      const newPaid = Math.max(0, (Number(sale.paidAmount) || 0) - Math.min(refundTotal, Number(sale.paidAmount) || 0));
      const newBalance = Math.max(0, newTotal - newPaid);
      const fullyReturned = updatedItems.every(it => (Number(it.returnedQty) || 0) >= (Number(it.qty) || 0));
      const saleType = fullyReturned ? 'Returned' : 'Partially Returned';
      let returnHistory = [];
      try { returnHistory = typeof sale.returnHistory === 'string' ? JSON.parse(sale.returnHistory || '[]') : (sale.returnHistory || []); } catch (_) { returnHistory = []; }
      returnHistory = [...returnHistory, {
        date: new Date().toISOString(),
        amount: refundTotal,
        method,
        disposition,
        items: Object.fromEntries(Object.keys(returnQtys).map(k => [k, Number(returnQtys[k]) || 0]))
      }];

      const cleanItems = updatedItems.map(({ _retThis, ...rest }) => rest);
      const statements = [];
      statements.push(env.DB.prepare(
        `UPDATE sales SET saleType = ?, items = ?, totalAmount = ?, paidAmount = ?, balanceDue = ?, subtotal = ?, taxAmount = ?, returnHistory = ?, originalSaleType = COALESCE(originalSaleType, saleType), taxInclusive = ? WHERE id = ? AND tenantId = ?`
      ).bind(
        saleType,
        JSON.stringify(cleanItems),
        newTotal,
        newPaid,
        newBalance,
        Math.max(0, (Number(sale.subtotal ?? sale.totalAmount) || 0) - refundSubtotal),
        Math.max(0, origTax - refundTax),
        JSON.stringify(returnHistory),
        taxInclusive ? 1 : 0,
        saleId,
        tenantId
      ));

      // Restore stock only for Saleable returns
      if (disposition === 'Saleable') {
        for (const it of updatedItems) {
          const ret = it._retThis || 0;
          if (ret <= 0 || !it.id) continue;
          statements.push(env.DB.prepare(
            `UPDATE inventory SET quantity = quantity + ?, status = CASE WHEN status = 'Sold' THEN 'Listed' ELSE status END WHERE id = ? AND tenantId = ?`
          ).bind(ret, it.id, tenantId));
        }
      }

      await env.DB.batch(statements);
      try {
        await writeSecurityAudit(auth, 'sales-return', 'sales', saleId + ' refund ' + refundTotal);
        await appendTenantAuditRecord(tenantId, auth.user?.name || 'Manager', 'sales-return', 'sales', `Sale ${saleId} (${sale.customerName || ''}) — Refund ${refundTotal} via ${method} (${disposition})`);
      } catch (_) {}
      try {
        let cogsRestore = 0;
        for (const it of updatedItems) {
          const ret = it._retThis || 0;
          if (ret > 0) cogsRestore += ret * (Number(it.cogs) || 0);
        }
        await journalSalesReturn(auth, saleId, refundTotal, method, disposition === 'Saleable' ? cogsRestore : 0, sale.branchId || '');
      } catch (_) {}

      const updatedSale = await env.DB.prepare('SELECT * FROM sales WHERE id = ? AND tenantId = ?').bind(saleId, tenantId).first();
      let invUpdates = [];
      if (disposition === 'Saleable') {
        for (const it of updatedItems) {
          if ((it._retThis || 0) > 0 && it.id) {
            const row = await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(it.id, tenantId).first();
            if (row) invUpdates.push(row);
          }
        }
      }
      return json({
        success: true,
        sale: updatedSale ? { ...updatedSale, items: cleanItems, returnHistory } : null,
        inventory: invUpdates,
        refundTotal,
        actualRefund: Math.min(refundTotal, Math.max(0, Number(sale.paidAmount) || 0))
      });
    }

    // 7. ITEM CATEGORIES CRUD
    if (routeType === 'categories') {
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`INSERT INTO categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)`).bind(body.id, body.name, body.status || 'Active', tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`UPDATE categories SET name = ?, status = ? WHERE id = ? AND tenantId = ?`).bind(body.name, body.status || 'Active', id, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM categories WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 8. EXPENSE CATEGORIES CRUD
    if (routeType === 'expense-categories') {
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`INSERT INTO expense_categories (id, name, status, tenantId) VALUES (?, ?, ?, ?)`).bind(body.id, body.name, body.status || 'Active', tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`UPDATE expense_categories SET name = ?, status = ? WHERE id = ? AND tenantId = ?`).bind(body.name, body.status || 'Active', id, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM expense_categories WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 9. ITEM STATUSES CRUD
    if (routeType === 'item-statuses') {
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`INSERT INTO item_statuses (id, name, status, canSell, tenantId) VALUES (?, ?, ?, ?, ?)`).bind(body.id, body.name, body.status || 'Active', body.canSell ? 1 : 0, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`UPDATE item_statuses SET name = ?, status = ?, canSell = ? WHERE id = ? AND tenantId = ?`).bind(body.name, body.status || 'Active', body.canSell ? 1 : 0, id, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM item_statuses WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 10. USERS CRUD (PIN hashed at rest)
    if (routeType === 'users') {
      try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN allowedBranches TEXT`).run(); } catch (_) {}

      // Ensure optional profile photo column exists
      try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN photo TEXT`).run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        if (!auth.isAdmin && ['admin', 'superadmin'].includes(String(body.role || '').toLowerCase())) return deny('Only an administrator can assign an administrator role');
        const tid = auth.tenantId || 'tenant-default';
        try {
          const ten = await getTenant(tid);
          const maxU = ten?.maxUsers || PLAN_LIMITS[(ten?.plan || 'starter')]?.maxUsers || 5;
          const cnt = (await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE tenantId = ? OR (tenantId IS NULL AND ? = 'tenant-default')`).bind(tid, tid).first())?.c || 0;
          if (cnt >= maxU) return json({ error: `User limit reached for plan (${maxU}). Upgrade plan.` }, 403);
        } catch (_) {}
        let pinStore = body.pin || '';
        if (pinStore && !String(pinStore).startsWith('pbkdf2$')) pinStore = await hashPin(pinStore);
        try {
          await env.DB.prepare(`INSERT INTO users (id, name, role, pin, phone, status, tenantId, photo, allowedBranches) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.id, body.name, body.role, pinStore, body.phone || '', body.status || 'Active', tid, body.photo || '', JSON.stringify(body.allowedBranches || [])).run();
        } catch (_) {
          await env.DB.prepare(`INSERT INTO users (id, name, role, pin, phone, status, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(body.id, body.name, body.role, pinStore, body.phone || '', body.status || 'Active', tid).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        const isSelf = auth.user && String(id) === String(auth.user.id);
        // Non-admins may only update their own profile fields (not role/status elevation)
        if (!auth.isAdmin && !isSelf) return deny('You can only update your own profile');
        if (!auth.isAdmin && ['admin', 'superadmin'].includes(String(body.role || '').toLowerCase())) return deny('Only an administrator can assign an administrator role');
        // Load existing user (tolerate legacy null/empty tenantId)
        let existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = \'\')').bind(id, tid).first();
        if (!existing) existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        if (!existing) return json({ error: 'User not found' }, 404);

        let pinStore = existing.pin || '';
        // Only admins (or change-pin endpoint) should rotate PINs via this route; self profile save must not wipe pin
        if (auth.isAdmin && body.pin != null && String(body.pin).trim() !== '') {
          const incoming = String(body.pin);
          if (!incoming.startsWith('pbkdf2$') && incoming !== '********') {
            pinStore = await hashPin(incoming);
          } else if (incoming.startsWith('pbkdf2$')) {
            pinStore = incoming;
          }
        }

        const nextName = (body.name != null && String(body.name).trim()) ? String(body.name).trim() : existing.name;
        const nextRole = auth.isAdmin && body.role != null ? body.role : existing.role;
        const nextPhone = body.phone != null ? body.phone : (existing.phone || '');
        const nextStatus = auth.isAdmin && body.status != null ? body.status : (existing.status || 'Active');
        const nextPhoto = body.photo != null ? body.photo : (existing.photo || '');

        try {
          const nextBranches = body.allowedBranches != null ? JSON.stringify(Array.isArray(body.allowedBranches) ? body.allowedBranches : []) : null;
          try {
            await env.DB.prepare(
              `UPDATE users SET name = ?, role = ?, pin = ?, phone = ?, status = ?, photo = ?, allowedBranches = COALESCE(?, allowedBranches), tenantId = COALESCE(NULLIF(tenantId,''), ?) WHERE id = ?`
            ).bind(nextName, nextRole, pinStore, nextPhone, nextStatus, nextPhoto, nextBranches, tid, id).run();
          } catch (_) {
            await env.DB.prepare(
              `UPDATE users SET name = ?, role = ?, pin = ?, phone = ?, status = ?, photo = ?, tenantId = COALESCE(NULLIF(tenantId,''), ?) WHERE id = ?`
            ).bind(nextName, nextRole, pinStore, nextPhone, nextStatus, nextPhoto, tid, id).run();
          }
        } catch (_) {
          // Fallback if photo column missing on older DBs
          await env.DB.prepare(
            `UPDATE users SET name = ?, role = ?, pin = ?, phone = ?, status = ?, tenantId = COALESCE(NULLIF(tenantId,''), ?) WHERE id = ?`
          ).bind(nextName, nextRole, pinStore, nextPhone, nextStatus, tid, id).run();
        }
        return new Response(JSON.stringify({ success: true, user: { id, name: nextName, role: nextRole, phone: nextPhone, status: nextStatus, photo: nextPhoto } }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        await env.DB.prepare(`DELETE FROM users WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`).bind(id, auth.tenantId || 'tenant-default').run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 11. ROLES CRUD
    if (routeType === 'roles') {
      if (request.method === 'POST') {
        const body = await request.json();
        const privs = typeof body.privileges === 'string' ? body.privileges : JSON.stringify(body.privileges);
        await env.DB.prepare(`INSERT INTO roles (id, name, privileges, tenantId) VALUES (?, ?, ?, ?)`).bind(body.id, body.name, privs, auth.tenantId || 'tenant-default').run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const privs = typeof body.privileges === 'string' ? body.privileges : JSON.stringify(body.privileges);
        await env.DB.prepare(`UPDATE roles SET name = ?, privileges = ? WHERE id = ? AND tenantId = ?`).bind(body.name, privs, id, auth.tenantId || 'tenant-default').run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        await env.DB.prepare(`DELETE FROM roles WHERE id = ? AND tenantId = ?`).bind(id, auth.tenantId || 'tenant-default').run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 12. SUPPLIERS CRUD
    if (routeType === 'suppliers') {
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(
          `INSERT INTO suppliers (id, name, phone, email, location, creditTermType, creditDays, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(body.id, body.name, body.phone || '', body.email || '', body.location || '', body.creditTermType || 'COD', body.creditDays || 0, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(
          `UPDATE suppliers SET name = ?, phone = ?, email = ?, location = ?, creditTermType = ?, creditDays = ? WHERE id = ? AND tenantId = ?`
        ).bind(body.name, body.phone || '', body.email || '', body.location || '', body.creditTermType || 'COD', body.creditDays || 0, id, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        const delSup = await env.DB.prepare(`SELECT name FROM suppliers WHERE id = ? AND tenantId = ?`).bind(id, tid).first().catch(() => null);
        await env.DB.prepare(`DELETE FROM suppliers WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try {
          await writeSecurityAudit(auth, 'delete', routeType, id);
          await appendTenantAuditRecord(tid, auth.user?.name || 'Staff', 'delete', 'suppliers', `${delSup?.name || id} (${id})`);
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 13. PURCHASE ORDERS CRUD (Supports both 'purchase_orders' and 'purchase-orders')
    if (routeType === 'purchase_orders' || routeType === 'purchase-orders') {
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN returnedQty INTEGER DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN returnHistory TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN taxAmount REAL DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN taxRate REAL DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN createdBy TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN cogsBooked REAL DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN received INTEGER DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN taxInclusive INTEGER DEFAULT 0').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE purchase_orders ADD COLUMN paymentHistory TEXT').run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        const tidPo = auth.tenantId || 'tenant-default';
        const branchId = await resolveBranchId(tidPo, body.branchId || requestBranchId());
        if (!branchAllowedForAuth(auth, branchId)) return json({ error: 'Not allowed to post purchases for this location.' }, 403);
        const initPoHist = Array.isArray(body.paymentHistory) && body.paymentHistory.length
          ? body.paymentHistory
          : ((Number(body.paidAmount) || 0) > 0 ? [{ id: `popay-${Date.now()}`, date: new Date().toISOString(), amount: Number(body.paidAmount) || 0, paymentMethod: body.paymentMethod || 'Cash', mpesaCode: body.mpesaCode || '' }] : []);
        try {
          await env.DB.prepare(
            `INSERT INTO purchase_orders (id, date, supplierId, supplierName, itemId, itemName, quantity, cost, amount, paidAmount, balanceDue, paymentMethod, paymentStatus, workflowStatus, deadline, taxAmount, taxRate, returnedQty, returnHistory, createdBy, cogsBooked, received, tenantId, taxInclusive, paymentHistory, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            body.id, body.date, body.supplierId || '', body.supplierName, body.itemId || '', body.itemName, body.quantity || 1, body.cost || 0, body.amount || 0, body.paidAmount || 0, body.balanceDue || 0, body.paymentMethod || 'Cash', body.paymentStatus || 'Unpaid', body.workflowStatus || 'Draft', body.deadline || '', body.taxAmount || 0, body.taxRate || 0, body.returnedQty || 0, JSON.stringify(body.returnHistory || []), body.createdBy || '', body.cogsBooked || 0, body.received ? 1 : 0, tidPo, body.taxInclusive ? 1 : 0, JSON.stringify(initPoHist), branchId
          ).run();
          try {
            const itemsJson = typeof body.items === 'string' ? body.items : JSON.stringify(body.items || []);
            await env.DB.prepare(`UPDATE purchase_orders SET items = ?, groupId = ? WHERE id = ? AND tenantId = ?`).bind(itemsJson, body.groupId || '', body.id, tidPo).run();
          } catch (_) {}
        } catch (_) {
          await env.DB.prepare(
            `INSERT INTO purchase_orders (id, date, supplierId, supplierName, itemId, itemName, quantity, cost, amount, paidAmount, balanceDue, paymentMethod, paymentStatus, workflowStatus, deadline, taxAmount, taxRate, returnedQty, returnHistory, createdBy, cogsBooked, received, tenantId, taxInclusive, paymentHistory) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            body.id, body.date, body.supplierId || '', body.supplierName, body.itemId || '', body.itemName, body.quantity || 1, body.cost || 0, body.amount || 0, body.paidAmount || 0, body.balanceDue || 0, body.paymentMethod || 'Cash', body.paymentStatus || 'Unpaid', body.workflowStatus || 'Draft', body.deadline || '', body.taxAmount || 0, body.taxRate || 0, body.returnedQty || 0, JSON.stringify(body.returnHistory || []), body.createdBy || '', body.cogsBooked || 0, body.received ? 1 : 0, tidPo, body.taxInclusive ? 1 : 0, JSON.stringify(initPoHist)
          ).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tidPo = auth.tenantId || 'tenant-default';
        const existingPo = await env.DB.prepare('SELECT workflowStatus, paidAmount, amount, supplierName, paymentHistory FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(id, tidPo).first().catch(() => null);
        // Enforce Purchase Approval Limit when moving from Draft -> Approved
        if (existingPo && existingPo.workflowStatus === 'Draft' && body.workflowStatus === 'Approved') {
          try {
            await ensureTenantSettingsSchema();
            const ts = await env.DB.prepare('SELECT poApprovalLimit FROM tenant_settings WHERE tenantId = ? LIMIT 1').bind(tidPo).first();
            const limitAmt = parseFloat(ts?.poApprovalLimit) || 0;
            const poAmt = parseFloat(body.amount ?? existingPo.amount) || 0;
            if (limitAmt > 0 && poAmt > limitAmt && !auth.isAdmin && !can(auth, 'purchase', 'delete')) {
              return json({ error: `Purchase order (${poAmt.toLocaleString()}) exceeds the limit (${limitAmt.toLocaleString()}) and must be approved by Admin.` }, 403);
            }
          } catch (_) {}
        }
        const histRaw = body.paymentHistory != null ? (typeof body.paymentHistory === 'string' ? body.paymentHistory : JSON.stringify(body.paymentHistory)) : (existingPo?.paymentHistory || '[]');
        await env.DB.prepare(
          `UPDATE purchase_orders SET date = ?, supplierId = ?, supplierName = ?, itemId = ?, itemName = ?, quantity = ?, cost = ?, amount = ?, paidAmount = ?, balanceDue = ?, paymentMethod = ?, paymentStatus = ?, workflowStatus = ?, deadline = ?, taxAmount = ?, taxRate = ?, returnedQty = ?, returnHistory = ?, createdBy = ?, cogsBooked = ?, received = ?, taxInclusive = ?, paymentHistory = ? WHERE id = ? AND tenantId = ?`
        ).bind(
          body.date, body.supplierId || '', body.supplierName, body.itemId || '', body.itemName, body.quantity || 1, body.cost || 0, body.amount || 0, body.paidAmount || 0, body.balanceDue || 0, body.paymentMethod || 'Cash', body.paymentStatus || 'Unpaid', body.workflowStatus || 'Draft', body.deadline || '', body.taxAmount || 0, body.taxRate || 0, body.returnedQty || 0, JSON.stringify(body.returnHistory || []), body.createdBy || '', body.cogsBooked || 0, body.received ? 1 : 0, body.taxInclusive ? 1 : 0, histRaw, id, tidPo
        ).run();
        try {
          if (body.items != null) {
            const itemsJson = typeof body.items === 'string' ? body.items : JSON.stringify(body.items || []);
            await env.DB.prepare(`UPDATE purchase_orders SET items = ?, groupId = ? WHERE id = ? AND tenantId = ?`).bind(itemsJson, body.groupId || '', id, tidPo).run();
          }
        } catch (_) {}
        try {
          const histArr = typeof histRaw === 'string' ? (() => { try { return JSON.parse(histRaw); } catch { return []; } })() : histRaw;
          const prevPaidAmt = existingPo ? (parseFloat(existingPo.paidAmount) || 0) : 0;
          const nextPaidAmt = parseFloat(body.paidAmount) || 0;
          const deltaPoPay = Math.round((nextPaidAmt - prevPaidAmt) * 100) / 100;
          if (Array.isArray(histArr) && histArr.length && deltaPoPay > 0) {
            const last = histArr[histArr.length - 1];
            const payAmt = Number(last.amount || last.payAmount || deltaPoPay) || 0;
            if (payAmt > 0) {
              await journalPurchasePayment(auth, { id, supplierName: body.supplierName }, payAmt, last.paymentMethod || last.method || body.paymentMethod, body.branchId || '', id + '-pay-' + histArr.length + '-' + payAmt);
              await appendTenantAuditRecord(tidPo, auth.user?.name || 'Staff', 'payment', 'purchase_orders', `PO ${id} (${body.supplierName || ''}) — Paid ${payAmt} via ${last.paymentMethod || last.method || body.paymentMethod || 'Cash'}`);
            }
          }
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        // Cascade: remove this PO and any multi-item siblings (same groupId), which also drops tax + paymentHistory on those rows
        let groupId = null;
        let idsToClear = [id];
        let delSupplier = '';
        try {
          const row = await env.DB.prepare('SELECT groupId, supplierName FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(id, tid).first();
          groupId = row && row.groupId ? String(row.groupId) : null;
          delSupplier = row?.supplierName || '';
          if (groupId) {
            const sibs = (await env.DB.prepare('SELECT id FROM purchase_orders WHERE tenantId = ? AND groupId = ?').bind(tid, groupId).all()).results || [];
            idsToClear = sibs.map(s => s.id);
            if (!idsToClear.includes(id)) idsToClear.push(id);
          }
        } catch (_) {}
        try {
          for (const rid of idsToClear) {
            await env.DB.prepare(`DELETE FROM stock_movements WHERE tenantId = ? AND ref = ?`).bind(tid, rid).run();
          }
        } catch (_) {}
        if (groupId) {
          try {
            await env.DB.prepare(`DELETE FROM purchase_orders WHERE tenantId = ? AND (id = ? OR groupId = ?)`).bind(tid, id, groupId).run();
          } catch (_) {
            await env.DB.prepare(`DELETE FROM purchase_orders WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
          }
        } else {
          await env.DB.prepare(`DELETE FROM purchase_orders WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        }
        try {
          await writeSecurityAudit(auth, 'delete', routeType, id + (groupId ? ' group:' + groupId : ''));
          await appendTenantAuditRecord(tid, auth.user?.name || 'Staff', 'delete', 'purchase_orders', `Deleted PO ${id}${delSupplier ? ' (' + delSupplier + ')' : ''}`);
        } catch (_) {}
        return new Response(JSON.stringify({ success: true, deletedGroupId: groupId || null }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Inter-location stock transfer (same tenant; does not change sale/purchase business rules)
    if (routeType === 'stock-transfer' && request.method === 'POST') {
      const body = await request.json();
      const tenantId = auth.tenantId || 'tenant-default';
      const fromId = body.fromItemId || body.itemId;
      const qty = Math.max(0, Number(body.qty) || 0);
      const toBranchId = body.toBranchId;
      if (!fromId || !toBranchId || qty <= 0) return json({ error: 'fromItemId, toBranchId and qty required' }, 400);
      const fromItem = await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(fromId, tenantId).first();
      if (!fromItem) return json({ error: 'Source item not found' }, 404);
      if (!branchAllowedForAuth(auth, fromItem.branchId) || !branchAllowedForAuth(auth, toBranchId)) {
        return json({ error: 'Not allowed to transfer for one of these locations.' }, 403);
      }
      if ((Number(fromItem.quantity) || 0) < qty) return json({ error: 'Insufficient stock at source location.' }, 409);
      const branches = await listBranches(tenantId);
      if (!branches.some(b => b.id === toBranchId)) return json({ error: 'Destination location not found' }, 404);
      // Prefer matching item at destination by name+sku within same tenant
      let toItem = null;
      try {
        toItem = await env.DB.prepare(
          `SELECT * FROM inventory WHERE tenantId = ? AND branchId = ? AND LOWER(name) = LOWER(?) LIMIT 1`
        ).bind(tenantId, toBranchId, fromItem.name || '').first();
      } catch (_) {}
      const statements = [];
      statements.push(env.DB.prepare(
        `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND tenantId = ? AND quantity >= ?`
      ).bind(qty, fromId, tenantId, qty));
      if (toItem) {
        statements.push(env.DB.prepare(
          `UPDATE inventory SET quantity = quantity + ?, status = CASE WHEN status = 'Sold' THEN 'Listed' ELSE status END WHERE id = ? AND tenantId = ?`
        ).bind(qty, toItem.id, tenantId));
      } else {
        const newId = 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        statements.push(env.DB.prepare(
          `INSERT INTO inventory (id, name, category, buyingPrice, price, quantity, lowStockAlert, trackInventory, status, photoUrl, tenantId, sku, size, colour, wholesalePrice, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          newId, fromItem.name, fromItem.category, fromItem.buyingPrice || 0, fromItem.price || 0, qty,
          fromItem.lowStockAlert || 3, fromItem.trackInventory ? 1 : 0, 'Listed', fromItem.photoUrl || '',
          tenantId, fromItem.sku || '', fromItem.size || '', fromItem.colour || '', fromItem.wholesalePrice || 0, toBranchId
        ));
        toItem = { id: newId, name: fromItem.name, branchId: toBranchId };
      }
      await env.DB.batch(statements);
      try { await writeSecurityAudit(auth, 'transfer', 'inventory', fromId + ' -> ' + toBranchId + ' x' + qty); } catch (_) {}
      const updatedFrom = await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(fromId, tenantId).first();
      const updatedTo = await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(toItem.id, tenantId).first();
      return json({ success: true, from: updatedFrom, to: updatedTo, qty });
    }

    // Purchase receipt: stock and PO status are committed together to avoid a received PO with no stock update.
    if (routeType === 'purchase-receive' && request.method === 'POST') {
      const body = await request.json();
      const tenantId = auth.tenantId || 'tenant-default';
      const po = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(body.poId, tenantId).first();
      if (!po) return json({ error: 'Purchase order not found for this shop.' }, 404);
      if (po.received || ['Received', 'Payment', 'Purchase Return'].includes(po.workflowStatus)) return json({ error: 'This purchase order has already been received.' }, 409);
      if (po.workflowStatus !== 'Approved') return json({ error: 'Only an approved purchase order can be received.' }, 409);

      let lineItems = [];
      try {
        if (po.items) lineItems = typeof po.items === 'string' ? JSON.parse(po.items) : (po.items || []);
      } catch (_) { lineItems = []; }
      if (!Array.isArray(lineItems) || !lineItems.length) {
        lineItems = [{ itemId: po.itemId, itemName: po.itemName, quantity: po.quantity, returnedQty: po.returnedQty || 0 }];
      }

      const stmts = [];
      let totalReceived = 0;
      let lastItemId = po.itemId;
      for (const line of lineItems) {
        const receiveQty = Math.max(0, (Number(line.quantity) || 0) - (Number(line.returnedQty) || 0));
        if (receiveQty <= 0) continue;
        let item = null;
        if (line.itemId) {
          item = await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(line.itemId, tenantId).first();
        }
        if (!item && line.itemName) {
          const br = po.branchId || (await resolveBranchId(tenantId, requestBranchId()));
          try {
            item = await env.DB.prepare(
              `SELECT * FROM inventory WHERE tenantId = ? AND LOWER(name) = LOWER(?) AND (branchId = ? OR branchId IS NULL OR branchId = '') LIMIT 1`
            ).bind(tenantId, line.itemName, br).first();
          } catch (_) {
            try {
              item = await env.DB.prepare(
                `SELECT * FROM inventory WHERE tenantId = ? AND LOWER(name) = LOWER(?) LIMIT 1`
              ).bind(tenantId, line.itemName).first();
            } catch (__) {}
          }
        }
        if (!item) return json({ error: `Inventory item ${line.itemName || line.itemId} was not found. Create/link the inventory item before receiving.` }, 409);
        stmts.push(env.DB.prepare(`UPDATE inventory SET quantity = quantity + ?, status = CASE WHEN status = 'Sold' THEN 'Listed' ELSE status END WHERE id = ? AND tenantId = ?`).bind(receiveQty, item.id, tenantId));
        totalReceived += receiveQty;
        lastItemId = item.id;
      }
      if (totalReceived <= 0) return json({ error: 'There is no quantity left to receive on this purchase order.' }, 409);
      stmts.push(env.DB.prepare(`UPDATE purchase_orders SET workflowStatus = 'Received', received = 1, itemId = ? WHERE id = ? AND tenantId = ? AND workflowStatus = 'Approved' AND (received IS NULL OR received = 0)`).bind(lastItemId, body.poId, tenantId));
      await env.DB.batch(stmts);
      const updatedPO = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(body.poId, tenantId).first();
      try { await journalPurchaseReceive(auth, updatedPO || po, body.branchId || ''); } catch (_) {}
      return json({ success: true, purchaseOrder: updatedPO, receivedQty: totalReceived });
    }

    // Purchase return: update PO + reduce stock (if received) in one batch — same business rules as UI
    if ((routeType === 'purchase-return' || routeType === 'purchase_return') && request.method === 'POST') {
      const body = await request.json();
      const tenantId = auth.tenantId || 'tenant-default';
      const poId = body.poId || body.id;
      if (!poId) return json({ error: 'poId required' }, 400);
      const po = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(poId, tenantId).first();
      if (!po) return json({ error: 'Purchase order not found for this shop.' }, 404);

      const wasReceived = !!(po.received || ['Received', 'Payment', 'Purchase Return'].includes(po.workflowStatus));
      if (!wasReceived) return json({ error: 'A purchase return can only be created after the goods have been received.' }, 409);

      // Support multi-item returnLines: [{ itemId, itemName, qty, cost }]
      let poItems = [];
      try {
        poItems = typeof po.items === 'string' ? JSON.parse(po.items || '[]') : (po.items || []);
        if (!Array.isArray(poItems)) poItems = [];
      } catch (_) { poItems = []; }
      if (!poItems.length && (po.itemId || po.itemName)) {
        poItems = [{ itemId: po.itemId, itemName: po.itemName, quantity: po.quantity, cost: po.cost, returnedQty: po.returnedQty || 0 }];
      }

      const returnLinesIn = Array.isArray(body.returnLines) ? body.returnLines : null;
      let lineReturns = [];
      if (returnLinesIn && returnLinesIn.length) {
        for (const rl of returnLinesIn) {
          const qty = Math.max(0, parseInt(rl.qty ?? rl.returnQty, 10) || 0);
          if (qty <= 0) continue;
          const match = poItems.find(it => String(it.itemId || '') === String(rl.itemId || '') || String(it.itemName || '') === String(rl.itemName || ''))
            || { itemId: rl.itemId, itemName: rl.itemName, quantity: rl.quantity || qty, cost: rl.cost || 0, returnedQty: rl.returnedQty || 0 };
          const alreadyLine = Number(match.returnedQty) || 0;
          const maxLine = Math.max(0, (Number(match.quantity) || 0) - alreadyLine);
          const ret = Math.min(qty, maxLine);
          if (ret <= 0) continue;
          lineReturns.push({
            itemId: match.itemId || rl.itemId || po.itemId,
            itemName: match.itemName || rl.itemName || po.itemName,
            qty: ret,
            cost: Number(match.cost != null ? match.cost : rl.cost) || Number(po.cost) || 0,
            already: alreadyLine,
            max: maxLine
          });
        }
      } else {
        const already = Number(po.returnedQty) || 0;
        const maxRet = Math.max(0, (Number(po.quantity) || 0) - already);
        const requestedRet = Math.max(0, parseInt(body.returnQty ?? body.qty, 10) || 0);
        if (maxRet <= 0) return json({ error: 'No remaining quantity to return on this PO.' }, 400);
        if (requestedRet <= 0) return json({ error: 'Enter a valid return quantity.' }, 400);
        lineReturns.push({
          itemId: po.itemId,
          itemName: po.itemName,
          qty: Math.min(requestedRet, maxRet),
          cost: Number(po.cost) || 0,
          already,
          max: maxRet
        });
      }
      if (!lineReturns.length) return json({ error: 'No valid return quantities selected.' }, 400);

      // Stock checks per line
      for (const lr of lineReturns) {
        if (!lr.itemId) continue;
        let stockRow = await env.DB.prepare("SELECT * FROM inventory WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')").bind(lr.itemId, tenantId).first();
        const available = Math.max(0, Number(stockRow?.quantity) || 0);
        if (lr.qty > available) {
          return json({ error: `Cannot return ${lr.qty} of ${lr.itemName || lr.itemId}. Only ${available} in stock.` }, 409);
        }
      }

      const taxInclusive = !!(po.taxInclusive);
      const totalPoQty = Math.max(1, Number(po.quantity) || lineReturns.reduce((s, l) => s + (Number(l.max) + Number(l.already) || 0), 0) || 1);
      const unitTax = ((parseFloat(po.taxAmount) || 0) / totalPoQty);
      let retQty = 0;
      let returnValue = 0;
      for (const lr of lineReturns) {
        retQty += lr.qty;
        const lineVal = lr.cost * lr.qty + (taxInclusive ? 0 : unitTax * lr.qty);
        returnValue += lineVal;
      }
      returnValue = Math.round(returnValue * 100) / 100;
      const already = Number(po.returnedQty) || 0;


      const newReturned = already + retQty;
      const newAmount = Math.max(0, (Number(po.amount) || 0) - returnValue);
      const prevBooked = parseFloat(po.bookedPayable) || parseFloat(po.cogsBooked) || parseFloat(po.amount) || 0;
      const newBookedPayable = Math.max(0, prevBooked - returnValue);
      let newPaid = parseFloat(po.paidAmount) || 0;
      const oldBalance = Math.max(0, parseFloat(po.balanceDue) || 0);
      let newBalance = Math.max(0, oldBalance - returnValue);
      const amountBeyondPayable = Math.max(0, returnValue - oldBalance);
      const settlement = body.settlement || 'Supplier Credit Note';
      const payMethod = body.paymentMethod || po.paymentMethod || 'Cash';
      const cashRefund = settlement === 'Cash/M-Pesa/Bank Refund' ? Math.min(amountBeyondPayable, newPaid) : 0;
      const supplierCredit = settlement === 'Supplier Credit Note' ? amountBeyondPayable : Math.max(0, amountBeyondPayable - cashRefund);
      if (cashRefund > 0 || supplierCredit > 0) newPaid = Math.max(0, newPaid - cashRefund - supplierCredit);

      const fullyReturned = newReturned >= (Number(po.quantity) || 0);
      if (fullyReturned) newBalance = 0;
      const workflowStatus = fullyReturned ? 'Purchase Return' : (po.workflowStatus || 'Received');
      const paymentStatus = newBalance <= 0 ? (newPaid > 0 ? 'Paid' : 'Unpaid') : (newPaid > 0 ? 'Partial' : 'Unpaid');

      let returnHistory = [];
      try { returnHistory = typeof po.returnHistory === 'string' ? JSON.parse(po.returnHistory || '[]') : (po.returnHistory || []); } catch (_) { returnHistory = []; }
      returnHistory = [...returnHistory, {
        date: new Date().toISOString(),
        qty: retQty,
        amount: returnValue,
        inventoryReduced: true,
        cashRefund,
        supplierCredit,
        settlement,
        paymentMethod: payMethod
      }];

      const statements = [
        env.DB.prepare(
          `UPDATE purchase_orders SET returnedQty = ?, amount = ?, paidAmount = ?, balanceDue = ?, paymentStatus = ?, workflowStatus = ?, taxAmount = ?, returnHistory = ?, cogsBooked = ? WHERE id = ? AND tenantId = ?`
        ).bind(
          newReturned,
          newAmount,
          newPaid,
          newBalance,
          paymentStatus,
          workflowStatus,
          Math.max(0, (parseFloat(po.taxAmount) || 0) - unitTax * retQty),
          JSON.stringify(returnHistory),
          newBookedPayable,
          poId,
          tenantId
        ),
      ];
      // Per-line inventory decrements
      for (const lr of lineReturns) {
        if (!lr.itemId || !lr.qty) continue;
        statements.push(env.DB.prepare(
          `UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') AND quantity >= ?`
        ).bind(lr.qty, lr.itemId, tenantId, lr.qty));
      }
      // Update items JSON returned quantities
      try {
        if (poItems.length) {
          const updatedItems = poItems.map(it => {
            const hit = lineReturns.find(lr => String(lr.itemId || '') === String(it.itemId || '') || String(lr.itemName || '') === String(it.itemName || ''));
            if (!hit) return it;
            return { ...it, returnedQty: (Number(it.returnedQty) || 0) + hit.qty };
          });
          statements.push(env.DB.prepare(
            `UPDATE purchase_orders SET items = ? WHERE id = ? AND tenantId = ?`
          ).bind(JSON.stringify(updatedItems), poId, tenantId));
        }
      } catch (_) {}
      await env.DB.batch(statements);
      try {
        await writeSecurityAudit(auth, 'purchase-return', 'purchase_orders', poId + ' qty ' + retQty);
        await appendTenantAuditRecord(tenantId, auth.user?.name || 'Manager', 'purchase-return', 'purchase_orders', `PO ${poId} (${po.supplierName || ''}) — Returned ${retQty} unit(s), value ${returnValue} (${settlement})`);
      } catch (_) {}
      try {
        await journalPurchaseReturn(auth, po, returnValue, cashRefund, supplierCredit, payMethod, po.branchId || '', poId + '-ret-' + newReturned + '-' + returnValue);
      } catch (_) {}

      const updatedPO = await env.DB.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenantId = ?').bind(poId, tenantId).first();
      const updatedInv = po.itemId
        ? await env.DB.prepare('SELECT * FROM inventory WHERE id = ? AND tenantId = ?').bind(po.itemId, tenantId).first()
        : null;
      return json({
        success: true,
        purchaseOrder: updatedPO ? { ...updatedPO, returnHistory, supplierCredit: (Number(po.supplierCredit) || 0) + supplierCredit, bookedPayable: newBookedPayable } : null,
        inventory: updatedInv,
        retQty,
        returnValue,
        cashRefund,
        supplierCredit
      });
    }

    // 14. SHOP PROFILE CRUD
    // 14. SHOP PROFILE CRUD
    if (routeType === 'shop-profile') {
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        const name = String(body.name || '').trim();
        const tagline = String(body.tagline || '').trim();
        const currency = String(body.currency || 'KSh').trim();
        const phone = String(body.phone || '').trim();
        const location = String(body.location || '').trim();
        const logo = body.logo !== undefined ? String(body.logo || '').trim() : '';
        const creditPolicy = body.creditPolicy === 'stop' ? 'stop' : (body.creditPolicy === 'warn' ? 'warn' : 'warn');
        try { await env.DB.prepare(`ALTER TABLE shop_profile ADD COLUMN logo TEXT`).run(); } catch (_) {}
        try { await env.DB.prepare(`ALTER TABLE shop_profile ADD COLUMN creditPolicy TEXT DEFAULT 'warn'`).run(); } catch (_) {}
        let saved = false;
        try {
          const existing = await env.DB.prepare(`SELECT id, logo, creditPolicy FROM shop_profile WHERE tenantId = ? OR id = ? LIMIT 1`).bind(tid, tid).first();
          if (existing) {
            const finalLogo = body.logo !== undefined ? logo : (existing.logo || '');
            const finalPolicy = body.creditPolicy !== undefined ? creditPolicy : (existing.creditPolicy || 'warn');
            await env.DB.prepare(
              `UPDATE shop_profile SET name = ?, tagline = ?, currency = ?, phone = ?, location = ?, logo = ?, creditPolicy = ?, tenantId = ? WHERE id = ? OR tenantId = ?`
            ).bind(name, tagline, currency, phone, location, finalLogo, finalPolicy, tid, existing.id, tid).run();
            saved = true;
          } else {
            await env.DB.prepare(
              `INSERT INTO shop_profile (id, name, tagline, currency, phone, location, logo, creditPolicy, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(String(tid), name, tagline, currency, phone, location, logo, creditPolicy, tid).run();
            saved = true;
          }
        } catch (e1) {
          try {
            await env.DB.prepare(
              `UPDATE shop_profile SET name = ?, tagline = ?, currency = ?, phone = ?, location = ?, tenantId = ? WHERE id = ? OR tenantId = ?`
            ).bind(name, tagline, currency, phone, location, tid, String(tid), tid).run();
            saved = true;
          } catch (e2) {
            try {
              await env.DB.prepare(
                `INSERT INTO shop_profile (id, name, tagline, currency, phone, location, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(String(tid), name, tagline, currency, phone, location, tid).run();
              saved = true;
            } catch (_) {}
          }
        }
        // Keep platform tenant name in sync with business profile name
        if (name && tid && tid !== 'platform') {
          try { await env.DB.prepare(`UPDATE tenants SET name = ? WHERE id = ?`).bind(name, tid).run(); } catch (_) {}
        }
        if (!saved) return json({ error: 'Failed to save shop profile' }, 500);
        const profile = { id: String(tid), name, tagline, currency, phone, location, logo, creditPolicy, tenantId: tid };
        return json({ success: true, name, profile });
      }
      if (request.method === 'GET') {
        const tid = (auth && auth.tenantId) || 'tenant-default';
        let row = await env.DB.prepare('SELECT * FROM shop_profile WHERE tenantId = ? OR id = ? LIMIT 1').bind(tid, tid).first();
        if (!row && tid === 'tenant-default') row = await env.DB.prepare('SELECT * FROM shop_profile WHERE id = 1').first();
        return json({ profile: row || null });
      }
    }




    // 16. EMPLOYEES CRUD
    if (routeType === 'employees') {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY, name TEXT, position TEXT, department TEXT, phone TEXT, email TEXT,
          hireDate TEXT, salary REAL, status TEXT, nationalId TEXT, bankAccount TEXT, bankName TEXT, leaveBalance REAL, managerId TEXT, tenantId TEXT
        )`).run();
      } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE employees ADD COLUMN bankName TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE employees ADD COLUMN managerId TEXT`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE employees ADD COLUMN userId TEXT`).run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        const branchId = await resolveBranchId(tid, body.branchId || requestBranchId());
        if (!branchAllowedForAuth(auth, branchId)) return json({ error: 'Not allowed to manage employees for this location.' }, 403);
        try {
          await env.DB.prepare(
            `INSERT INTO employees (id, name, position, department, phone, email, hireDate, salary, status, nationalId, bankAccount, bankName, leaveBalance, managerId, userId, tenantId, branchId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.name, body.position || '', body.department || '', body.phone || '', body.email || '', body.hireDate || '', body.salary || 0, body.status || 'Active', body.nationalId || '', body.bankAccount || '', body.bankName || '', body.leaveBalance ?? 21, body.managerId || '', body.userId || '', tid, branchId).run();
        } catch (err) {
          await env.DB.prepare(
            `INSERT INTO employees (id, name, position, department, phone, email, hireDate, salary, status, nationalId, bankAccount, leaveBalance, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.name, body.position || '', body.department || '', body.phone || '', body.email || '', body.hireDate || '', body.salary || 0, body.status || 'Active', body.nationalId || '', body.bankAccount || '', body.leaveBalance ?? 21, tid).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        try {
          await env.DB.prepare(
            `UPDATE employees SET name = ?, position = ?, department = ?, phone = ?, email = ?, hireDate = ?, salary = ?, status = ?, nationalId = ?, bankAccount = ?, bankName = ?, leaveBalance = ?, managerId = ?, userId = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.name, body.position || '', body.department || '', body.phone || '', body.email || '', body.hireDate || '', body.salary || 0, body.status || 'Active', body.nationalId || '', body.bankAccount || '', body.bankName || '', body.leaveBalance ?? 21, body.managerId || '', body.userId || '', id, tid).run();
        } catch (err) {
          await env.DB.prepare(
            `UPDATE employees SET name = ?, position = ?, department = ?, phone = ?, email = ?, hireDate = ?, salary = ?, status = ?, nationalId = ?, bankAccount = ?, leaveBalance = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.name, body.position || '', body.department || '', body.phone || '', body.email || '', body.hireDate || '', body.salary || 0, body.status || 'Active', body.nationalId || '', body.bankAccount || '', body.leaveBalance ?? 21, id, tid).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM employees WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 17. LEAVE REQUESTS CRUD
    if (routeType === 'leave-requests' || routeType === 'leave_requests') {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
          id TEXT PRIMARY KEY, employeeId TEXT, employeeName TEXT, leaveType TEXT, startDate TEXT, endDate TEXT,
          days REAL, reason TEXT, status TEXT, approvedBy TEXT, createdAt TEXT, managerId TEXT, approverId TEXT, managerName TEXT, tenantId TEXT
        )`).run();
      } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        try {
          await env.DB.prepare(
            `INSERT INTO leave_requests (id, employeeId, employeeName, leaveType, startDate, endDate, days, reason, status, approvedBy, createdAt, managerId, approverId, managerName, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.employeeId, body.employeeName, body.leaveType || 'Annual', body.startDate, body.endDate, body.days || 0, body.reason || '', body.status || 'Pending', body.approvedBy || '', body.createdAt || new Date().toISOString(), body.managerId || '', body.approverId || '', body.managerName || '', tid).run();
        } catch (err) {
          await env.DB.prepare(
            `INSERT INTO leave_requests (id, employeeId, employeeName, leaveType, startDate, endDate, days, reason, status, approvedBy, createdAt, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(body.id, body.employeeId, body.employeeName, body.leaveType || 'Annual', body.startDate, body.endDate, body.days || 0, body.reason || '', body.status || 'Pending', body.approvedBy || '', body.createdAt || new Date().toISOString(), tid).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        try { await env.DB.prepare('ALTER TABLE leave_requests ADD COLUMN decidedAt TEXT').run(); } catch (_) {}
        try { await env.DB.prepare('ALTER TABLE leave_requests ADD COLUMN balanceDeducted INTEGER DEFAULT 0').run(); } catch (_) {}
        const existing = await env.DB.prepare('SELECT * FROM leave_requests WHERE id = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = \'\')').bind(id, tid).first();
        const newStatus = body.status || 'Pending';
        const days = parseFloat(body.days) || (existing ? parseFloat(existing.days) : 0) || 0;
        const empId = body.employeeId || existing?.employeeId || '';
        const alreadyDeducted = !!(body.balanceDeducted || existing?.balanceDeducted);
        let balanceDeducted = alreadyDeducted ? 1 : 0;
        const statements = [];
        // When approving, deduct leave balance on the server (same rule as UI)
        if (newStatus === 'Approved' && !alreadyDeducted && empId && days > 0) {
          const emp = await env.DB.prepare('SELECT * FROM employees WHERE id = ? AND tenantId = ?').bind(empId, tid).first();
          if (emp) {
            const newBal = Math.max(0, (parseFloat(emp.leaveBalance) ?? 21) - days);
            statements.push(env.DB.prepare(
              `UPDATE employees SET leaveBalance = ? WHERE id = ? AND tenantId = ?`
            ).bind(newBal, empId, tid));
            balanceDeducted = 1;
          }
        }
        statements.push(env.DB.prepare(
          `INSERT INTO leave_requests (id, employeeId, employeeName, leaveType, startDate, endDate, days, reason, status, approvedBy, createdAt, managerId, approverId, managerName, decidedAt, tenantId, balanceDeducted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             employeeId = excluded.employeeId, employeeName = excluded.employeeName, leaveType = excluded.leaveType,
             startDate = excluded.startDate, endDate = excluded.endDate, days = excluded.days, reason = excluded.reason,
             status = excluded.status, approvedBy = excluded.approvedBy, managerId = excluded.managerId,
             approverId = excluded.approverId, managerName = excluded.managerName, decidedAt = excluded.decidedAt,
             balanceDeducted = excluded.balanceDeducted
           WHERE leave_requests.tenantId = excluded.tenantId OR leave_requests.tenantId IS NULL`
        ).bind(
          id, body.employeeId || '', body.employeeName || '', body.leaveType || 'Annual', body.startDate || '', body.endDate || '',
          body.days || 0, body.reason || '', newStatus, body.approvedBy || '', body.createdAt || new Date().toISOString(),
          body.managerId || '', body.approverId || '', body.managerName || '', body.decidedAt || new Date().toISOString(), tid, balanceDeducted
        ));
        await env.DB.batch(statements);
        return new Response(JSON.stringify({ success: true, balanceDeducted: !!balanceDeducted }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM leave_requests WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 18. PAYROLL CRUD
    if (routeType === 'payroll') {
      try { await env.DB.prepare('ALTER TABLE payroll ADD COLUMN allowanceBreakdown TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE payroll ADD COLUMN deductionBreakdown TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE payroll ADD COLUMN allowanceOtherSpec TEXT').run(); } catch (_) {}
      try { await env.DB.prepare('ALTER TABLE payroll ADD COLUMN deductionOtherSpec TEXT').run(); } catch (_) {}
      if (request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(
          `INSERT INTO payroll (id, employeeId, employeeName, period, basicSalary, allowances, deductions, taxAmount, netPay, status, paidDate, notes, allowanceBreakdown, deductionBreakdown, allowanceOtherSpec, deductionOtherSpec, tenantId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(body.id, body.employeeId, body.employeeName, body.period, body.basicSalary || 0, body.allowances || 0, body.deductions || 0, body.taxAmount || 0, body.netPay || 0, body.status || 'Draft', body.paidDate || '', body.notes || '', JSON.stringify(body.allowanceBreakdown || {}), JSON.stringify(body.deductionBreakdown || {}), body.allowanceOtherSpec || '', body.deductionOtherSpec || '', tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(
          `UPDATE payroll SET employeeId = ?, employeeName = ?, period = ?, basicSalary = ?, allowances = ?, deductions = ?, taxAmount = ?, netPay = ?, status = ?, paidDate = ?, notes = ?, allowanceBreakdown = ?, deductionBreakdown = ?, allowanceOtherSpec = ?, deductionOtherSpec = ? WHERE id = ? AND tenantId = ?`
        ).bind(body.employeeId, body.employeeName, body.period, body.basicSalary || 0, body.allowances || 0, body.deductions || 0, body.taxAmount || 0, body.netPay || 0, body.status || 'Draft', body.paidDate || '', body.notes || '', JSON.stringify(body.allowanceBreakdown || {}), JSON.stringify(body.deductionBreakdown || {}), body.allowanceOtherSpec || '', body.deductionOtherSpec || '', id, tid).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE' && id) {
        const tid = auth.tenantId || 'tenant-default';
        await env.DB.prepare(`DELETE FROM payroll WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        try { await writeSecurityAudit(auth, 'delete', routeType, id); } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 19. HR SETTINGS (per-tenant persistent table)
    if (routeType === 'hr-settings') {
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        const leaveTypes = typeof body.leaveTypes === 'string' ? body.leaveTypes : JSON.stringify(body.leaveTypes || []);
        const departments = typeof body.departments === 'string' ? body.departments : JSON.stringify(body.departments || []);
        const tid = auth.tenantId || 'tenant-default';
        try {
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS hr_settings_mt (
            id TEXT PRIMARY KEY, tenantId TEXT UNIQUE, defaultAnnualLeave REAL DEFAULT 21,
            leaveTypes TEXT, departments TEXT, payrollCycle TEXT, payDay INTEGER DEFAULT 28
          )`).run();
        } catch (_) {}
        await env.DB.prepare(
          `INSERT INTO hr_settings_mt (id, tenantId, defaultAnnualLeave, leaveTypes, departments, payrollCycle, payDay)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             defaultAnnualLeave = excluded.defaultAnnualLeave, leaveTypes = excluded.leaveTypes,
             departments = excluded.departments, payrollCycle = excluded.payrollCycle, payDay = excluded.payDay`
        ).bind(tid, tid, body.defaultAnnualLeave ?? 21, leaveTypes, departments, body.payrollCycle || 'Monthly', body.payDay || 28).run();
        // Keep legacy row best-effort for older clients (ignore failure)
        try {
          const existing = await env.DB.prepare(`SELECT id FROM hr_settings WHERE tenantId = ? LIMIT 1`).bind(tid).first();
          if (existing) {
            await env.DB.prepare(`UPDATE hr_settings SET defaultAnnualLeave = ?, leaveTypes = ?, departments = ?, payrollCycle = ?, payDay = ? WHERE tenantId = ?`)
              .bind(body.defaultAnnualLeave ?? 21, leaveTypes, departments, body.payrollCycle || 'Monthly', body.payDay || 28, tid).run();
          }
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 20. TAX SETTINGS (per-tenant persistent table)
    if (routeType === 'tax-settings') {
      try { await env.DB.prepare(`ALTER TABLE tax_settings_mt ADD COLUMN expenseTaxEnabled INTEGER DEFAULT 0`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tax_settings_mt ADD COLUMN expenseTaxRate REAL DEFAULT 0`).run(); } catch (_) {}
      try { await env.DB.prepare(`ALTER TABLE tax_settings_mt ADD COLUMN expenseTaxName TEXT`).run(); } catch (_) {}

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        const tid = auth.tenantId || 'tenant-default';
        try {
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tax_settings_mt (
            id TEXT PRIMARY KEY, tenantId TEXT UNIQUE,
            salesTaxEnabled INTEGER DEFAULT 0, salesTaxRate REAL DEFAULT 0, salesTaxName TEXT,
            purchaseTaxEnabled INTEGER DEFAULT 0, purchaseTaxRate REAL DEFAULT 0, purchaseTaxName TEXT,
            taxInclusive INTEGER DEFAULT 0
          )`).run();
        } catch (_) {}
        await env.DB.prepare(
          `INSERT INTO tax_settings_mt (id, tenantId, salesTaxEnabled, salesTaxRate, salesTaxName, purchaseTaxEnabled, purchaseTaxRate, purchaseTaxName, taxInclusive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             salesTaxEnabled = excluded.salesTaxEnabled, salesTaxRate = excluded.salesTaxRate, salesTaxName = excluded.salesTaxName,
             purchaseTaxEnabled = excluded.purchaseTaxEnabled, purchaseTaxRate = excluded.purchaseTaxRate, purchaseTaxName = excluded.purchaseTaxName,
             taxInclusive = excluded.taxInclusive`
        ).bind(
          tid, tid,
          body.salesTaxEnabled ? 1 : 0, body.salesTaxRate || 0, body.salesTaxName || 'VAT',
          body.purchaseTaxEnabled ? 1 : 0, body.purchaseTaxRate || 0, body.purchaseTaxName || 'VAT',
          body.taxInclusive ? 1 : 0
        ).run();
        try {
          await env.DB.prepare(
            `UPDATE tax_settings_mt SET expenseTaxEnabled = ?, expenseTaxRate = ?, expenseTaxName = ? WHERE tenantId = ?`
          ).bind(body.expenseTaxEnabled ? 1 : 0, body.expenseTaxRate || 0, body.expenseTaxName || 'VAT', tid).run();
        } catch (_) {}
        try {
          const existing = await env.DB.prepare(`SELECT id FROM tax_settings WHERE tenantId = ? LIMIT 1`).bind(tid).first();
          if (existing) {
            await env.DB.prepare(
              `UPDATE tax_settings SET salesTaxEnabled = ?, salesTaxRate = ?, salesTaxName = ?, purchaseTaxEnabled = ?, purchaseTaxRate = ?, purchaseTaxName = ?, taxInclusive = ? WHERE tenantId = ?`
            ).bind(
              body.salesTaxEnabled ? 1 : 0, body.salesTaxRate || 0, body.salesTaxName || 'VAT',
              body.purchaseTaxEnabled ? 1 : 0, body.purchaseTaxRate || 0, body.purchaseTaxName || 'VAT',
              body.taxInclusive ? 1 : 0, tid
            ).run();
          }
        } catch (_) {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    
    
    
    // ACCOUNTING PERIODS + MANUAL JOURNAL + VOID (Phase 4)
    if (routeType === 'accounting-periods' || routeType === 'accounting_periods') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      await ensureLedgerTables();
      if (request.method === 'GET') {
        const rows = (await env.DB.prepare(
          `SELECT * FROM accounting_periods WHERE tenantId = ? ORDER BY periodKey DESC LIMIT 36`
        ).bind(tid).all()).results || [];
        return json({ periods: rows });
      }
      if (request.method === 'POST' || request.method === 'PUT') {
        const body = await request.json();
        const key = body.periodKey || periodKeyFromDate(body.date);
        if (!/^\d{4}-\d{2}$/.test(key)) return json({ error: 'periodKey must be YYYY-MM' }, 400);
        const status = body.status === 'closed' ? 'closed' : 'open';
        const existing = await env.DB.prepare(
          `SELECT id FROM accounting_periods WHERE tenantId = ? AND periodKey = ?`
        ).bind(tid, key).first();
        if (existing) {
          await env.DB.prepare(
            `UPDATE accounting_periods SET status = ?, closedAt = ?, closedBy = ?, note = ? WHERE id = ?`
          ).bind(
            status,
            status === 'closed' ? Date.now() : null,
            status === 'closed' ? (auth.user?.name || '') : null,
            body.note || '',
            existing.id
          ).run();
        } else {
          await env.DB.prepare(
            `INSERT INTO accounting_periods (id, tenantId, periodKey, status, closedAt, closedBy, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            tid + '-' + key, tid, key, status,
            status === 'closed' ? Date.now() : null,
            status === 'closed' ? (auth.user?.name || '') : null,
            body.note || ''
          ).run();
        }
        try { await writeSecurityAudit(auth, status === 'closed' ? 'period-close' : 'period-open', 'accounting', key); } catch (_) {}
        return json({ success: true, periodKey: key, status });
      }
    }

    if (routeType === 'manual-journal' || routeType === 'manual_journal') {
      if (!auth) return deny('Auth required');
      if (!can(auth, 'settings', 'update') && !can(auth, 'reports', 'create') && auth.user?.role !== 'Admin' && !auth.isSuperAdmin) {
        // allow admin-like roles
        const role = String(auth.user?.role || '').toLowerCase();
        if (role !== 'admin' && role !== 'superadmin' && !auth.isPlatform) {
          return json({ error: 'Manual journals require admin privileges.' }, 403);
        }
      }
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      const body = await request.json();
      const tid = auth.tenantId || 'tenant-default';
      const reason = String(body.reason || body.description || '').trim();
      if (!reason) return json({ error: 'Reason is required for manual journals.' }, 400);
      const lines = body.lines || [];
      if (!Array.isArray(lines) || lines.length < 2) return json({ error: 'At least two lines required.' }, 400);
      try {
        const jid = await postJournal(auth, {
          sourceType: 'manual',
          sourceId: 'manual-' + Date.now(),
          description: reason,
          entryDate: body.entryDate || new Date().toISOString().slice(0, 10),
          branchId: body.branchId || '',
          manual: true,
          allowDuplicate: true,
          requireOpenPeriod: true,
          lines: lines.map(l => ({
            accountCode: String(l.accountCode),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            memo: l.memo || reason
          }))
        });
        if (!jid) return json({ error: 'Journal not posted (unbalanced or period closed).' }, 400);
        try { await writeSecurityAudit(auth, 'manual-journal', 'accounting', jid + ' ' + reason); } catch (_) {}
        return json({ success: true, id: jid });
      } catch (e) {
        return json({ error: e.message || 'Failed' }, e.code === 'PERIOD_CLOSED' ? 409 : 500);
      }
    }

    if ((routeType === 'void-journal' || routeType === 'void_journal') && request.method === 'POST') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      const body = await request.json();
      const journalId = body.journalId || body.id || id;
      if (!journalId) return json({ error: 'journalId required' }, 400);
      const j = await env.DB.prepare(`SELECT * FROM journals WHERE id = ? AND tenantId = ?`).bind(journalId, tid).first();
      if (!j) return json({ error: 'Journal not found' }, 404);
      if (j.voided) return json({ error: 'Already voided' }, 400);
      try { await assertPeriodOpen(tid, j.entryDate); } catch (e) {
        return json({ error: e.message }, 409);
      }
      const lines = (await env.DB.prepare(`SELECT * FROM journal_lines WHERE journalId = ? AND tenantId = ?`).bind(journalId, tid).all()).results || [];
      // Create reversing journal
      const revLines = lines.map(l => ({
        accountCode: l.accountCode,
        debit: Number(l.credit) || 0,
        credit: Number(l.debit) || 0,
        memo: 'Reversal of ' + journalId
      }));
      const revId = await postJournal(auth, {
        sourceType: 'reversal',
        sourceId: 'rev-' + journalId,
        description: 'Void/reversal of ' + (j.description || journalId) + (body.reason ? (': ' + body.reason) : ''),
        entryDate: new Date().toISOString().slice(0, 10),
        branchId: j.branchId || '',
        manual: true,
        allowDuplicate: true,
        requireOpenPeriod: true,
        reversalOf: journalId,
        lines: revLines
      });
      await env.DB.prepare(
        `UPDATE journals SET voided = 1, voidedAt = ?, voidedBy = ? WHERE id = ? AND tenantId = ?`
      ).bind(Date.now(), auth.user?.name || '', journalId, tid).run();
      try { await writeSecurityAudit(auth, 'void-journal', 'accounting', journalId + ' -> ' + (revId || '')); } catch (_) {}
      return json({ success: true, reversalId: revId });
    }

// BANK RECONCILIATION (Phase 3)
    if (routeType === 'bank-reconciliations' || routeType === 'bank_reconciliations' || routeType === 'bank-reconciliation') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      await ensureDefaultChart(tid);
      await ensureLedgerTables();

      if (request.method === 'GET' && !id) {
        const rows = (await env.DB.prepare(
          `SELECT * FROM bank_reconciliations WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 50`
        ).bind(tid).all()).results || [];
        return json({ reconciliations: rows });
      }

      if (request.method === 'GET' && id) {
        const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(id, tid).first();
        if (!rec) return json({ error: 'Not found' }, 404);
        const lines = (await env.DB.prepare(
          `SELECT * FROM bank_statement_lines WHERE reconciliationId = ? AND tenantId = ? ORDER BY lineDate, createdAt`
        ).bind(id, tid).all()).results || [];
        const bookBalance = await bookBalanceForAccount(tid, rec.accountCode);
        // Book movements not yet matched on this account
        const matchedIds = lines.filter(l => l.matchedJournalLineId).map(l => l.matchedJournalLineId);
        let bookLines = (await env.DB.prepare(
          `SELECT jl.*, j.entryDate, j.description as journalDescription, j.sourceType
           FROM journal_lines jl
           LEFT JOIN journals j ON j.id = jl.journalId
           WHERE jl.tenantId = ? AND jl.accountCode = ?
           ORDER BY j.entryDate DESC, jl.id DESC LIMIT 300`
        ).bind(tid, rec.accountCode).all()).results || [];
        const matchedSet = new Set(matchedIds);
        bookLines = bookLines.map(b => ({
          ...b,
          amount: Math.round(((Number(b.debit) || 0) - (Number(b.credit) || 0)) * 100) / 100,
          matched: matchedSet.has(b.id)
        }));
        const stmtTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
        const matchedStmt = lines.filter(l => l.matched).reduce((s, l) => s + (Number(l.amount) || 0), 0);
        const unmatchedStmt = lines.filter(l => !l.matched);
        const unmatchedBook = bookLines.filter(b => !b.matched);
        const statementBalance = Number(rec.statementBalance) || 0;
        // Difference: statement vs book
        const difference = Math.round((statementBalance - bookBalance) * 100) / 100;
        return json({
          reconciliation: rec,
          statementLines: lines,
          bookLines,
          summary: {
            bookBalance,
            statementBalance,
            difference,
            statementLineCount: lines.length,
            matchedCount: lines.filter(l => l.matched).length,
            unmatchedStatementCount: unmatchedStmt.length,
            unmatchedBookCount: unmatchedBook.length,
            statementLinesTotal: Math.round(stmtTotal * 100) / 100
          }
        });
      }

      if (request.method === 'POST' && !id) {
        const body = await request.json();
        const accountCode = body.accountCode || '1000';
        if (!['1000', '1010'].includes(String(accountCode))) {
          return json({ error: 'Reconcile Cash (1000) or M-Pesa (1010) only in Phase 3.' }, 400);
        }
        const rid = 'brec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        await env.DB.prepare(
          `INSERT INTO bank_reconciliations (id, tenantId, accountCode, statementDate, statementBalance, status, notes, createdAt, createdBy)
           VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`
        ).bind(
          rid, tid, accountCode,
          body.statementDate || new Date().toISOString().slice(0, 10),
          Number(body.statementBalance) || 0,
          body.notes || '',
          Date.now(),
          auth.user?.name || 'user'
        ).run();
        // Optional initial statement lines
        if (Array.isArray(body.lines)) {
          for (const ln of body.lines) {
            const lid = 'bsl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            await env.DB.prepare(
              `INSERT INTO bank_statement_lines (id, reconciliationId, tenantId, accountCode, lineDate, description, amount, matched, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
            ).bind(lid, rid, tid, accountCode, ln.lineDate || body.statementDate || '', ln.description || '', Number(ln.amount) || 0, Date.now()).run();
          }
        }
        return json({ success: true, id: rid });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(id, tid).first();
        if (!rec) return json({ error: 'Not found' }, 404);
        if (rec.status === 'closed' && body.status !== 'open') {
          return json({ error: 'Reconciliation is closed.' }, 400);
        }
        await env.DB.prepare(
          `UPDATE bank_reconciliations SET
            statementDate = COALESCE(?, statementDate),
            statementBalance = COALESCE(?, statementBalance),
            notes = COALESCE(?, notes),
            status = COALESCE(?, status),
            closedAt = CASE WHEN ? = 'closed' THEN ? ELSE closedAt END
           WHERE id = ? AND tenantId = ?`
        ).bind(
          body.statementDate || null,
          body.statementBalance != null ? Number(body.statementBalance) : null,
          body.notes != null ? body.notes : null,
          body.status || null,
          body.status || '',
          Date.now(),
          id, tid
        ).run();
        return json({ success: true });
      }

      if (request.method === 'DELETE' && id) {
        const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(id, tid).first();
        if (!rec) return json({ error: 'Not found' }, 404);
        if (rec.status === 'closed') return json({ error: 'Cannot delete a closed reconciliation.' }, 400);
        await env.DB.prepare(`DELETE FROM bank_statement_lines WHERE reconciliationId = ? AND tenantId = ?`).bind(id, tid).run();
        await env.DB.prepare(`DELETE FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        return json({ success: true });
      }
    }

    // Statement lines + match actions
    if (routeType === 'bank-statement-lines' || routeType === 'bank_statement_lines') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      await ensureLedgerTables();

      if (request.method === 'POST') {
        const body = await request.json();
        const recId = body.reconciliationId;
        if (!recId) return json({ error: 'reconciliationId required' }, 400);
        const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(recId, tid).first();
        if (!rec) return json({ error: 'Reconciliation not found' }, 404);
        if (rec.status === 'closed') return json({ error: 'Reconciliation is closed' }, 400);
        const linesIn = Array.isArray(body.lines) ? body.lines : [body];
        const created = [];
        for (const ln of linesIn) {
          if (ln.description == null && ln.amount == null) continue;
          const lid = 'bsl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          await env.DB.prepare(
            `INSERT INTO bank_statement_lines (id, reconciliationId, tenantId, accountCode, lineDate, description, amount, matched, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
          ).bind(lid, recId, tid, rec.accountCode, ln.lineDate || '', ln.description || '', Number(ln.amount) || 0, Date.now()).run();
          created.push(lid);
        }
        return json({ success: true, ids: created });
      }

      if (request.method === 'PUT' && id) {
        const body = await request.json();
        const line = await env.DB.prepare(`SELECT * FROM bank_statement_lines WHERE id = ? AND tenantId = ?`).bind(id, tid).first();
        if (!line) return json({ error: 'Line not found' }, 404);
        const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(line.reconciliationId, tid).first();
        if (rec && rec.status === 'closed') return json({ error: 'Reconciliation is closed' }, 400);

        // Match to journal line
        if (body.matchJournalLineId) {
          const jl = await env.DB.prepare(`SELECT * FROM journal_lines WHERE id = ? AND tenantId = ?`).bind(body.matchJournalLineId, tid).first();
          if (!jl) return json({ error: 'Journal line not found' }, 404);
          if (jl.accountCode !== line.accountCode) return json({ error: 'Account mismatch' }, 400);
          await env.DB.prepare(
            `UPDATE bank_statement_lines SET matched = 1, matchedJournalLineId = ? WHERE id = ? AND tenantId = ?`
          ).bind(body.matchJournalLineId, id, tid).run();
          return json({ success: true, matched: true });
        }
        if (body.unmatch) {
          await env.DB.prepare(
            `UPDATE bank_statement_lines SET matched = 0, matchedJournalLineId = NULL WHERE id = ? AND tenantId = ?`
          ).bind(id, tid).run();
          return json({ success: true, matched: false });
        }
        await env.DB.prepare(
          `UPDATE bank_statement_lines SET lineDate = COALESCE(?, lineDate), description = COALESCE(?, description), amount = COALESCE(?, amount)
           WHERE id = ? AND tenantId = ?`
        ).bind(body.lineDate || null, body.description != null ? body.description : null, body.amount != null ? Number(body.amount) : null, id, tid).run();
        return json({ success: true });
      }

      if (request.method === 'DELETE' && id) {
        const line = await env.DB.prepare(`SELECT * FROM bank_statement_lines WHERE id = ? AND tenantId = ?`).bind(id, tid).first();
        if (!line) return json({ error: 'Not found' }, 404);
        const rec = await env.DB.prepare(`SELECT status FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(line.reconciliationId, tid).first();
        if (rec && rec.status === 'closed') return json({ error: 'Reconciliation is closed' }, 400);
        await env.DB.prepare(`DELETE FROM bank_statement_lines WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        return json({ success: true });
      }
    }

    // Auto-match helper: match statement lines to book lines by absolute amount
    if ((routeType === 'bank-auto-match' || routeType === 'bank_auto_match') && request.method === 'POST') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      const body = await request.json();
      const recId = body.reconciliationId;
      if (!recId) return json({ error: 'reconciliationId required' }, 400);
      const rec = await env.DB.prepare(`SELECT * FROM bank_reconciliations WHERE id = ? AND tenantId = ?`).bind(recId, tid).first();
      if (!rec) return json({ error: 'Not found' }, 404);
      if (rec.status === 'closed') return json({ error: 'Closed' }, 400);
      const stmtLines = (await env.DB.prepare(
        `SELECT * FROM bank_statement_lines WHERE reconciliationId = ? AND tenantId = ? AND matched = 0`
      ).bind(recId, tid).all()).results || [];
      const bookLines = (await env.DB.prepare(
        `SELECT jl.* FROM journal_lines jl WHERE jl.tenantId = ? AND jl.accountCode = ?`
      ).bind(tid, rec.accountCode).all()).results || [];
      const usedBook = new Set(
        ((await env.DB.prepare(
          `SELECT matchedJournalLineId FROM bank_statement_lines WHERE tenantId = ? AND accountCode = ? AND matched = 1 AND matchedJournalLineId IS NOT NULL`
        ).bind(tid, rec.accountCode).all()).results || []).map(r => r.matchedJournalLineId)
      );
      let matched = 0;
      for (const sl of stmtLines) {
        const amt = Math.round((Number(sl.amount) || 0) * 100) / 100;
        if (!amt) continue;
        const candidate = bookLines.find(b => {
          if (usedBook.has(b.id)) return false;
          const bookAmt = Math.round(((Number(b.debit) || 0) - (Number(b.credit) || 0)) * 100) / 100;
          return Math.abs(bookAmt - amt) < 0.02;
        });
        if (candidate) {
          await env.DB.prepare(
            `UPDATE bank_statement_lines SET matched = 1, matchedJournalLineId = ? WHERE id = ? AND tenantId = ?`
          ).bind(candidate.id, sl.id, tid).run();
          usedBook.add(candidate.id);
          matched += 1;
        }
      }
      return json({ success: true, matched });
    }

// LEDGER Phase 1 read APIs
    if (routeType === 'ledger' || routeType === 'ledger-accounts' || routeType === 'ledger-journals' || routeType === 'ledger-trial-balance') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      await ensureDefaultChart(tid);
      const sub = id || (routeType === 'ledger' ? '' : routeType.replace('ledger-', ''));
      if (request.method === 'GET' && (routeType === 'ledger-accounts' || sub === 'accounts' || pathParts[2] === 'accounts')) {
        const accounts = (await env.DB.prepare(`SELECT * FROM chart_of_accounts WHERE tenantId = ? ORDER BY code`).bind(tid).all()).results || [];
        return json({ accounts });
      }
      if (request.method === 'GET' && (routeType === 'ledger-journals' || sub === 'journals' || pathParts[2] === 'journals')) {
        const journals = (await env.DB.prepare(`SELECT * FROM journals WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 200`).bind(tid).all()).results || [];
        const lines = (await env.DB.prepare(`SELECT * FROM journal_lines WHERE tenantId = ?`).bind(tid).all()).results || [];
        const byJ = {};
        for (const l of lines) {
          if (!byJ[l.journalId]) byJ[l.journalId] = [];
          byJ[l.journalId].push(l);
        }
        return json({ journals: journals.map(j => ({ ...j, lines: byJ[j.id] || [] })) });
      }
      if (request.method === 'GET' && (routeType === 'ledger-trial-balance' || sub === 'trial-balance' || pathParts[2] === 'trial-balance')) {
        const accounts = (await env.DB.prepare(`SELECT * FROM chart_of_accounts WHERE tenantId = ? ORDER BY code`).bind(tid).all()).results || [];
        const lines = (await env.DB.prepare(
          `SELECT jl.accountCode, SUM(jl.debit) as dr, SUM(jl.credit) as cr
           FROM journal_lines jl
           INNER JOIN journals j ON j.id = jl.journalId
           WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0
           GROUP BY jl.accountCode`
        ).bind(tid).all()).results || [];
        const map = {};
        for (const l of lines) map[l.accountCode] = { debit: Number(l.dr) || 0, credit: Number(l.cr) || 0 };
        const trial = accounts.map(a => {
          const m = map[a.code] || { debit: 0, credit: 0 };
          const net = (m.debit - m.credit);
          return {
            code: a.code, name: a.name, type: a.type,
            debit: m.debit, credit: m.credit,
            balance: net,
            balanceSide: net >= 0 ? 'debit' : 'credit'
          };
        });
        const totalDr = trial.reduce((s, t) => s + t.debit, 0);
        const totalCr = trial.reduce((s, t) => s + t.credit, 0);
        return json({ trial, totalDebit: totalDr, totalCredit: totalCr, balanced: Math.abs(totalDr - totalCr) < 0.05 });
      }
      if (request.method === 'GET' && routeType === 'ledger') {
        const accounts = (await env.DB.prepare(`SELECT * FROM chart_of_accounts WHERE tenantId = ? ORDER BY code`).bind(tid).all()).results || [];
        return json({ accounts, phase: 1 });
      }
      return json({ error: 'Use /api/ledger-accounts, /api/ledger-journals, /api/ledger-trial-balance, or /api/ledger-pnl' }, 400);
    }


    // FINANCIAL REPORTS suite (Reports tab)
    if (routeType === 'financial-reports' || routeType === 'financial_reports') {
      if (!auth) return deny('Auth required');
      if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
      const tid = auth.tenantId || 'tenant-default';
      await ensureDefaultChart(tid);
      const url = new URL(request.url);
      const type = (url.searchParams.get('type') || 'pnl').toLowerCase();
      const from = (url.searchParams.get('from') || '').slice(0, 10);
      const to = (url.searchParams.get('to') || '').slice(0, 10);
      const branchId = url.searchParams.get('branchId') || '';
      const groupBy = (url.searchParams.get('groupBy') || 'day').toLowerCase();
      const compareFrom = (url.searchParams.get('compareFrom') || '').slice(0, 10);
      const compareTo = (url.searchParams.get('compareTo') || '').slice(0, 10);

      const inDate = (d) => {
        const s = String(d || '').slice(0, 10);
        if (from && s < from) return false;
        if (to && s > to) return false;
        return true;
      };

      // Chart of accounts with period balances
      if (type === 'chart-of-accounts' || type === 'coa') {
        const accounts = (await env.DB.prepare(`SELECT * FROM chart_of_accounts WHERE tenantId = ? ORDER BY code`).bind(tid).all()).results || [];
        let sql = `SELECT jl.accountCode, SUM(jl.debit) as dr, SUM(jl.credit) as cr
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
        const binds = [tid];
        if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        if (branchId && branchId !== 'all') { sql += ` AND (j.branchId = ? OR j.branchId IS NULL OR j.branchId = '')`; binds.push(branchId); }
        sql += ` GROUP BY jl.accountCode`;
        const lines = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        const map = {};
        for (const l of lines) map[l.accountCode] = { debit: Number(l.dr) || 0, credit: Number(l.cr) || 0 };
        const enriched = accounts.map(a => {
          const m = map[a.code] || { debit: 0, credit: 0 };
          const typeA = String(a.type || '').toLowerCase();
          // Normal balance: asset/expense debit; liability/equity/revenue credit
          let balance = 0;
          if (typeA === 'asset' || typeA === 'expense' || String(a.code).startsWith('1') || String(a.code).startsWith('5')) {
            balance = Math.round((m.debit - m.credit) * 100) / 100;
          } else {
            balance = Math.round((m.credit - m.debit) * 100) / 100;
          }
          return {
            ...a,
            periodDebit: Math.round(m.debit * 100) / 100,
            periodCredit: Math.round(m.credit * 100) / 100,
            periodBalance: balance
          };
        });
        return json({ type, from: from || null, to: to || null, branchId: branchId || null, accounts: enriched });
      }

      // Trial balance
      if (type === 'trial-balance' || type === 'trial') {
        const accounts = (await env.DB.prepare(`SELECT * FROM chart_of_accounts WHERE tenantId = ? ORDER BY code`).bind(tid).all()).results || [];
        let sql = `SELECT jl.accountCode, SUM(jl.debit) as dr, SUM(jl.credit) as cr
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
        const binds = [tid];
        if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        sql += ` GROUP BY jl.accountCode`;
        const lines = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        const map = {};
        for (const l of lines) map[l.accountCode] = { debit: Number(l.dr) || 0, credit: Number(l.cr) || 0 };
        const trial = accounts.map(a => {
          const m = map[a.code] || { debit: 0, credit: 0 };
          return { code: a.code, name: a.name, type: a.type, debit: m.debit, credit: m.credit, balance: m.debit - m.credit };
        });
        const totalDebit = trial.reduce((s, t) => s + t.debit, 0);
        const totalCredit = trial.reduce((s, t) => s + t.credit, 0);
        return json({ type, from: from || null, to: to || null, trial, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.05 });
      }

      // P&L
      if (type === 'pnl' || type === 'profit-loss') {
        let sql = `SELECT jl.accountCode, a.name as accountName, a.type as accountType, SUM(jl.debit) as dr, SUM(jl.credit) as cr
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   LEFT JOIN chart_of_accounts a ON a.tenantId = jl.tenantId AND a.code = jl.accountCode
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
        const binds = [tid];
        if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        sql += ` GROUP BY jl.accountCode`;
        const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        const income = [], expenses = [];
        let totalIncome = 0, totalExpense = 0;
        for (const r of rows) {
          const typeA = (r.accountType || '').toLowerCase();
          const code = r.accountCode;
          const dr = Number(r.dr) || 0, cr = Number(r.cr) || 0;
          if (typeA === 'revenue' || String(code).startsWith('4')) {
            const amt = Math.round((cr - dr) * 100) / 100;
            if (Math.abs(amt) > 0.001) { income.push({ code, name: r.accountName || code, amount: amt }); totalIncome += amt; }
          } else if (typeA === 'expense' || String(code).startsWith('5')) {
            const amt = Math.round((dr - cr) * 100) / 100;
            if (Math.abs(amt) > 0.001) { expenses.push({ code, name: r.accountName || code, amount: amt }); totalExpense += amt; }
          }
        }
        totalIncome = Math.round(totalIncome * 100) / 100;
        totalExpense = Math.round(totalExpense * 100) / 100;
        return json({ type, from: from || null, to: to || null, income, expenses, totalIncome, totalExpense, netProfit: Math.round((totalIncome - totalExpense) * 100) / 100 });
      }

      // Balance sheet
      if (type === 'balance-sheet') {
        let sql = `SELECT jl.accountCode, a.name as accountName, a.type as accountType, SUM(jl.debit) as dr, SUM(jl.credit) as cr
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   LEFT JOIN chart_of_accounts a ON a.tenantId = jl.tenantId AND a.code = jl.accountCode
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
        const binds = [tid];
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        sql += ` GROUP BY jl.accountCode`;
        const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        const assets = [], liabilities = [], equity = [];
        let ta = 0, tl = 0, te = 0;
        for (const r of rows) {
          const typeA = (r.accountType || '').toLowerCase();
          const code = String(r.accountCode || '');
          const dr = Number(r.dr) || 0, cr = Number(r.cr) || 0;
          let bal = 0, bucket = null;
          if (typeA === 'asset' || code.startsWith('1')) { bal = Math.round((dr - cr) * 100) / 100; bucket = 'asset'; }
          else if (typeA === 'liability' || code.startsWith('2')) { bal = Math.round((cr - dr) * 100) / 100; bucket = 'liability'; }
          else if (typeA === 'equity' || code.startsWith('3')) { bal = Math.round((cr - dr) * 100) / 100; bucket = 'equity'; }
          else if (typeA === 'revenue' || code.startsWith('4')) { bal = Math.round((cr - dr) * 100) / 100; bucket = 'equity'; } // retained via P&L
          else if (typeA === 'expense' || code.startsWith('5')) { bal = Math.round((dr - cr) * 100) / 100; bucket = 'equity_neg'; }
          if (Math.abs(bal) < 0.001) continue;
          const row = { code, name: r.accountName || code, balance: bal };
          if (bucket === 'asset') { assets.push(row); ta += bal; }
          else if (bucket === 'liability') { liabilities.push(row); tl += bal; }
          else if (bucket === 'equity') { equity.push(row); te += bal; }
          else if (bucket === 'equity_neg') { equity.push({ ...row, balance: -bal, name: (r.accountName || code) + ' (expense)' }); te -= bal; }
        }
        return json({ type, asOf: to || null, assets, liabilities, equity, totalAssets: Math.round(ta * 100) / 100, totalLiabilities: Math.round(tl * 100) / 100, totalEquity: Math.round(te * 100) / 100 });
      }

      // General ledger
      if (type === 'general-ledger' || type === 'gl') {
        const accountCode = url.searchParams.get('accountCode') || '';
        let sql = `SELECT jl.*, j.entryDate, j.description as journalDescription, j.sourceType, j.sourceId, j.createdBy
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
        const binds = [tid];
        if (accountCode) { sql += ` AND jl.accountCode = ?`; binds.push(accountCode); }
        if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        sql += ` ORDER BY j.entryDate, j.createdAt, jl.id LIMIT 1000`;
        const lines = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        return json({ type, from: from || null, to: to || null, accountCode: accountCode || null, lines });
      }

      // Cash flow (from cash/mpesa journal lines classified by sourceType)
      if (type === 'cash-flow') {
        let sql = `SELECT j.sourceType, j.entryDate, jl.accountCode, jl.debit, jl.credit, jl.memo, j.description
                   FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                   WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0 AND jl.accountCode IN ('1000','1010')`;
        const binds = [tid];
        if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
        if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
        const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
        const operating = [], investing = [], financing = [];
        let op = 0, inv = 0, fin = 0;
        for (const r of rows) {
          const net = Math.round(((Number(r.debit) || 0) - (Number(r.credit) || 0)) * 100) / 100;
          const st = String(r.sourceType || '');
          const entry = { date: r.entryDate, sourceType: st, accountCode: r.accountCode, amount: net, memo: r.memo || r.description };
          // Classify
          if (st === 'sale' || st === 'customer-receipt' || st === 'expense' || st === 'po-payment' || st === 'sales-return' || st === 'po-return') {
            operating.push(entry); op += net;
          } else if (st === 'manual' || st === 'reversal') {
            financing.push(entry); fin += net;
          } else {
            operating.push(entry); op += net;
          }
        }
        return json({
          type, from: from || null, to: to || null,
          operating, investing, financing,
          netOperating: Math.round(op * 100) / 100,
          netInvesting: Math.round(inv * 100) / 100,
          netFinancing: Math.round(fin * 100) / 100,
          netChange: Math.round((op + inv + fin) * 100) / 100
        });
      }

      // Sales / COGS / margin from sales table
      const loadSales = async () => {
        let q = `SELECT * FROM sales WHERE tenantId = ?`;
        const b = [tid];
        if (from) { q += ` AND substr(date,1,10) >= ?`; b.push(from); }
        if (to) { q += ` AND substr(date,1,10) <= ?`; b.push(to); }
        if (branchId && branchId !== 'all') { q += ` AND branchId = ?`; b.push(branchId); }
        return (await env.DB.prepare(q).bind(...b).all()).results || [];
      };
      const loadExpenses = async () => {
        let q = `SELECT * FROM expenses WHERE tenantId = ?`;
        const b = [tid];
        if (from) { q += ` AND substr(date,1,10) >= ?`; b.push(from); }
        if (to) { q += ` AND substr(date,1,10) <= ?`; b.push(to); }
        if (branchId && branchId !== 'all') { q += ` AND branchId = ?`; b.push(branchId); }
        return (await env.DB.prepare(q).bind(...b).all()).results || [];
      };

      const parseItems = (s) => {
        try {
          const v = typeof s === 'string' ? JSON.parse(s || '[]') : (s || []);
          return Array.isArray(v) ? v : [];
        } catch { return []; }
      };

      if (type === 'sales-revenue') {
        const salesRows = await loadSales();
        const buckets = {};
        for (const s of salesRows) {
          const day = String(s.date || '').slice(0, 10);
          let key = day;
          if (groupBy === 'week') {
            const d = new Date(day || '1970-01-01');
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
            key = d.getFullYear() + '-W' + String(week).padStart(2, '0');
          } else if (groupBy === 'month') key = day.slice(0, 7);
          else if (groupBy === 'branch') key = s.branchId || 'default';
          else if (groupBy === 'item' || groupBy === 'category') {
            for (const it of parseItems(s.items)) {
              const k = groupBy === 'item' ? (it.name || it.id || 'item') : (it.category || 'Uncategorized');
              if (!buckets[k]) buckets[k] = { key: k, revenue: 0, qty: 0, count: 0 };
              const line = (Number(it.price) || 0) * (Number(it.qty) || 0);
              buckets[k].revenue += line;
              buckets[k].qty += Number(it.qty) || 0;
              buckets[k].count += 1;
            }
            continue;
          }
          if (!buckets[key]) buckets[key] = { key, revenue: 0, count: 0 };
          buckets[key].revenue += Number(s.totalAmount) || 0;
          buckets[key].count += 1;
        }
        const rows = Object.values(buckets).map(r => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 })).sort((a, b) => b.revenue - a.revenue);
        return json({ type, groupBy, from: from || null, to: to || null, branchId: branchId || null, rows, totalRevenue: Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100 });
      }

      if (type === 'gross-profit' || type === 'profit-margin') {
        const salesRows = await loadSales();
        const buckets = {};
        let totalRev = 0, totalCogs = 0;
        for (const s of salesRows) {
          for (const it of parseItems(s.items)) {
            const qty = Number(it.qty) || 0;
            const rev = (Number(it.price) || 0) * qty;
            const cogs = (Number(it.cogs != null ? it.cogs : it.buyingPrice) || 0) * qty;
            totalRev += rev; totalCogs += cogs;
            let key = 'All';
            if (groupBy === 'item') key = it.name || it.id || 'item';
            else if (groupBy === 'category') key = it.category || 'Uncategorized';
            else if (groupBy === 'branch') key = s.branchId || 'default';
            else if (groupBy === 'month') key = String(s.date || '').slice(0, 7);
            else key = String(s.date || '').slice(0, 10);
            if (!buckets[key]) buckets[key] = { key, revenue: 0, cogs: 0, qty: 0 };
            buckets[key].revenue += rev;
            buckets[key].cogs += cogs;
            buckets[key].qty += qty;
          }
        }
        const rows = Object.values(buckets).map(r => {
          const gp = r.revenue - r.cogs;
          return {
            key: r.key,
            revenue: Math.round(r.revenue * 100) / 100,
            cogs: Math.round(r.cogs * 100) / 100,
            grossProfit: Math.round(gp * 100) / 100,
            marginPct: r.revenue > 0 ? Math.round((gp / r.revenue) * 10000) / 100 : 0,
            qty: r.qty
          };
        }).sort((a, b) => b.grossProfit - a.grossProfit);
        const gp = totalRev - totalCogs;
        return json({
          type, groupBy, from: from || null, to: to || null, branchId: branchId || null, rows,
          totalRevenue: Math.round(totalRev * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          totalGrossProfit: Math.round(gp * 100) / 100,
          overallMarginPct: totalRev > 0 ? Math.round((gp / totalRev) * 10000) / 100 : 0
        });
      }

      if (type === 'expense-analysis') {
        const expRows = await loadExpenses();
        const buckets = {};
        for (const e of expRows) {
          let key = e.category || 'Other';
          if (groupBy === 'supplier' || groupBy === 'payee') key = e.paidTo || e.payer || 'Unknown';
          else if (groupBy === 'date') key = String(e.date || '').slice(0, 10);
          else if (groupBy === 'branch') key = e.branchId || 'default';
          else if (groupBy === 'month') key = String(e.date || '').slice(0, 7);
          if (!buckets[key]) buckets[key] = { key, amount: 0, paid: 0, count: 0 };
          buckets[key].amount += Number(e.amount) || 0;
          buckets[key].paid += Number(e.paidAmount != null ? e.paidAmount : e.amount) || 0;
          buckets[key].count += 1;
        }
        const rows = Object.values(buckets).map(r => ({
          key: r.key,
          amount: Math.round(r.amount * 100) / 100,
          paid: Math.round(r.paid * 100) / 100,
          count: r.count
        })).sort((a, b) => b.amount - a.amount);
        return json({ type, groupBy, from: from || null, to: to || null, branchId: branchId || null, rows, totalAmount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100 });
      }

      if (type === 'comparative') {
        const runPnl = async (f, t) => {
          let sql = `SELECT jl.accountCode, a.type as accountType, SUM(jl.debit) as dr, SUM(jl.credit) as cr
                     FROM journal_lines jl INNER JOIN journals j ON j.id = jl.journalId
                     LEFT JOIN chart_of_accounts a ON a.tenantId = jl.tenantId AND a.code = jl.accountCode
                     WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
          const binds = [tid];
          if (f) { sql += ` AND j.entryDate >= ?`; binds.push(f); }
          if (t) { sql += ` AND j.entryDate <= ?`; binds.push(t); }
          sql += ` GROUP BY jl.accountCode`;
          const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
          let income = 0, expense = 0;
          for (const r of rows) {
            const typeA = (r.accountType || '').toLowerCase();
            const code = String(r.accountCode || '');
            const dr = Number(r.dr) || 0, cr = Number(r.cr) || 0;
            if (typeA === 'revenue' || code.startsWith('4')) income += (cr - dr);
            else if (typeA === 'expense' || code.startsWith('5')) expense += (dr - cr);
          }
          return { income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100, net: Math.round((income - expense) * 100) / 100 };
        };
        const current = await runPnl(from, to);
        const previous = await runPnl(compareFrom || from, compareTo || to);
        return json({
          type,
          current: { from: from || null, to: to || null, ...current },
          previous: { from: compareFrom || null, to: compareTo || null, ...previous },
          variance: {
            income: Math.round((current.income - previous.income) * 100) / 100,
            expense: Math.round((current.expense - previous.expense) * 100) / 100,
            net: Math.round((current.net - previous.net) * 100) / 100
          }
        });
      }

      // Branch profitability
      if (type === 'branch-profitability' || type === 'branch_profitability') {
        const salesRows = await loadSales();
        const expRows = await loadExpenses();
        const buckets = {};
        const ensure = (k) => {
          if (!buckets[k]) buckets[k] = { key: k, revenue: 0, cogs: 0, expenses: 0, salesCount: 0 };
          return buckets[k];
        };
        for (const s of salesRows) {
          const k = s.branchId || 'default';
          const b = ensure(k);
          b.revenue += Number(s.totalAmount) || 0;
          b.salesCount += 1;
          for (const it of parseItems(s.items)) {
            const qty = Number(it.qty) || 0;
            b.cogs += (Number(it.cogs != null ? it.cogs : it.buyingPrice) || 0) * qty;
          }
        }
        for (const e of expRows) {
          const k = e.branchId || 'default';
          const b = ensure(k);
          b.expenses += Number(e.amount) || 0;
        }
        // Resolve branch names if possible
        let branchNames = {};
        try {
          const br = (await env.DB.prepare(`SELECT id, name FROM branches WHERE tenantId = ?`).bind(tid).all()).results || [];
          for (const x of br) branchNames[x.id] = x.name;
        } catch (_) {}
        const rows = Object.values(buckets).map(r => {
          const gp = r.revenue - r.cogs;
          const net = gp - r.expenses;
          return {
            key: r.key,
            branchName: branchNames[r.key] || r.key,
            revenue: Math.round(r.revenue * 100) / 100,
            cogs: Math.round(r.cogs * 100) / 100,
            grossProfit: Math.round(gp * 100) / 100,
            expenses: Math.round(r.expenses * 100) / 100,
            netProfit: Math.round(net * 100) / 100,
            marginPct: r.revenue > 0 ? Math.round((gp / r.revenue) * 10000) / 100 : 0,
            salesCount: r.salesCount
          };
        }).sort((a, b) => b.netProfit - a.netProfit);
        return json({
          type, from: from || null, to: to || null, rows,
          totalRevenue: Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
          totalNetProfit: Math.round(rows.reduce((s, r) => s + r.netProfit, 0) * 100) / 100
        });
      }

      // Tax summary (sales tax + purchase tax from POs + expense tax + ledger 2100)
      if (type === 'tax-summary' || type === 'tax_summary') {
        const salesRows = await loadSales();
        const expRows = await loadExpenses();
        // Load purchase orders for purchase (input) tax
        let poRows = [];
        try {
          let pq = `SELECT * FROM purchase_orders WHERE tenantId = ?`;
          const pb = [tid];
          if (from) { pq += ` AND substr(date,1,10) >= ?`; pb.push(from); }
          if (to) { pq += ` AND substr(date,1,10) <= ?`; pb.push(to); }
          if (branchId && branchId !== 'all') { pq += ` AND branchId = ?`; pb.push(branchId); }
          poRows = (await env.DB.prepare(pq).bind(...pb).all()).results || [];
        } catch (_) { poRows = []; }

        let salesTaxCollected = 0, salesTaxable = 0, salesCount = 0;
        let purchaseTax = 0, expenseTax = 0, purchaseCount = 0, expenseCount = 0;
        const byRate = {};

        for (const s of salesRows) {
          const total = Number(s.totalAmount) || 0;
          const rate = Number(s.taxRate) || 0;
          let tax = Number(s.taxAmount) || 0;
          // Derive tax if missing using inclusive/exclusive (same formula as POS)
          if (!tax && rate > 0 && total > 0) {
            if (s.taxInclusive) {
              tax = total - (total / (1 + rate / 100));
            } else {
              tax = total - (total / (1 + rate / 100));
            }
          }
          tax = Math.round(tax * 100) / 100;
          salesTaxCollected += tax;
          // Taxable base = amount excluding tax (works for both inclusive & exclusive totals)
          salesTaxable += Math.max(0, total - tax);
          if (tax > 0 || rate > 0) salesCount += 1;
          const rk = String(rate || '0');
          if (!byRate[rk]) byRate[rk] = { rate: rate, salesTax: 0, salesCount: 0, purchaseTax: 0, purchaseCount: 0 };
          byRate[rk].salesTax += tax;
          byRate[rk].salesCount += 1;
        }

        for (const po of poRows) {
          const total = Number(po.amount) || 0;
          const rate = Number(po.taxRate) || 0;
          let tax = Number(po.taxAmount) || 0;
          // Derive tax from amount using inclusive/exclusive rules (same approach as sales)
          if (!tax && rate > 0 && total > 0) {
            if (po.taxInclusive) {
              tax = total - (total / (1 + rate / 100));
            } else {
              // amount stored as base+tax when exclusive
              tax = total - (total / (1 + rate / 100));
            }
          }
          tax = Math.round(tax * 100) / 100;
          purchaseTax += tax;
          if (tax > 0 || rate > 0) purchaseCount += 1;
          const rk = String(rate || '0');
          if (!byRate[rk]) byRate[rk] = { rate: rate, salesTax: 0, salesCount: 0, purchaseTax: 0, purchaseCount: 0 };
          byRate[rk].purchaseTax += tax;
          byRate[rk].purchaseCount += 1;
        }

        for (const e of expRows) {
          const total = Number(e.amount) || 0;
          const rate = Number(e.taxRate) || 0;
          let tax = Number(e.taxAmount) || 0;
          // Same inclusive/exclusive derivation as sales / purchases
          if (!tax && rate > 0 && total > 0) {
            if (e.taxInclusive) {
              tax = total - (total / (1 + rate / 100));
            } else {
              tax = total - (total / (1 + rate / 100));
            }
          }
          tax = Math.round(tax * 100) / 100;
          expenseTax += tax;
          if (tax > 0) expenseCount += 1;
        }

        const totalInputTax = purchaseTax + expenseTax;

        // Ledger tax payable movements
        let ledgerTaxDr = 0, ledgerTaxCr = 0;
        try {
          let sql = `SELECT SUM(jl.debit) as dr, SUM(jl.credit) as cr FROM journal_lines jl
                     INNER JOIN journals j ON j.id = jl.journalId
                     WHERE jl.tenantId = ? AND jl.accountCode = '2100' AND IFNULL(j.voided,0) = 0`;
          const binds = [tid];
          if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
          if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
          const row = await env.DB.prepare(sql).bind(...binds).first();
          ledgerTaxDr = Number(row?.dr) || 0;
          ledgerTaxCr = Number(row?.cr) || 0;
        } catch (_) {}

        const netTaxPayable = Math.round((salesTaxCollected - totalInputTax) * 100) / 100;
        return json({
          type, from: from || null, to: to || null, branchId: branchId || null,
          salesTaxCollected: Math.round(salesTaxCollected * 100) / 100,
          salesTaxableBase: Math.round(salesTaxable * 100) / 100,
          salesWithTaxCount: salesCount,
          purchaseTax: Math.round(purchaseTax * 100) / 100,
          purchaseWithTaxCount: purchaseCount,
          expenseTax: Math.round(expenseTax * 100) / 100,
          expenseWithTaxCount: expenseCount,
          inputTax: Math.round(totalInputTax * 100) / 100,
          netTaxPayable,
          ledgerTaxPayableCredit: Math.round(ledgerTaxCr * 100) / 100,
          ledgerTaxPayableDebit: Math.round(ledgerTaxDr * 100) / 100,
          ledgerTaxNet: Math.round((ledgerTaxCr - ledgerTaxDr) * 100) / 100,
          byRate: Object.values(byRate).map(r => ({
            rate: r.rate,
            salesTax: Math.round(r.salesTax * 100) / 100,
            salesCount: r.salesCount,
            purchaseTax: Math.round((r.purchaseTax || 0) * 100) / 100,
            purchaseCount: r.purchaseCount || 0
          }))
        });
      }

      return json({ error: 'Unknown report type. Use type=pnl|trial-balance|balance-sheet|sales-revenue|gross-profit|expense-analysis|comparative|cash-flow|general-ledger|chart-of-accounts|branch-profitability|tax-summary' }, 400);
    }


    // Profit & Loss for selected period (from journal lines)
    if ((routeType === 'ledger-pnl' || routeType === 'ledger_pnl') && request.method === 'GET') {
      if (!auth) return deny('Auth required');
      const tid = auth.tenantId || 'tenant-default';
      await ensureDefaultChart(tid);
      const url = new URL(request.url);
      const from = (url.searchParams.get('from') || '').slice(0, 10);
      const to = (url.searchParams.get('to') || '').slice(0, 10);
      let sql = `SELECT jl.accountCode, a.name as accountName, a.type as accountType,
                        SUM(jl.debit) as dr, SUM(jl.credit) as cr
                 FROM journal_lines jl
                 INNER JOIN journals j ON j.id = jl.journalId
                 LEFT JOIN chart_of_accounts a ON a.tenantId = jl.tenantId AND a.code = jl.accountCode
                 WHERE jl.tenantId = ? AND IFNULL(j.voided,0) = 0`;
      const binds = [tid];
      if (from) { sql += ` AND j.entryDate >= ?`; binds.push(from); }
      if (to) { sql += ` AND j.entryDate <= ?`; binds.push(to); }
      sql += ` GROUP BY jl.accountCode`;
      const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
      const income = [];
      const expenses = [];
      let totalIncome = 0, totalExpense = 0;
      for (const r of rows) {
        const type = (r.accountType || '').toLowerCase();
        const code = r.accountCode;
        const dr = Number(r.dr) || 0;
        const cr = Number(r.cr) || 0;
        // Revenue: credit-normal; expense: debit-normal
        if (type === 'revenue' || code.startsWith('4')) {
          const amt = Math.round((cr - dr) * 100) / 100;
          if (Math.abs(amt) > 0.001) {
            income.push({ code, name: r.accountName || code, amount: amt });
            totalIncome += amt;
          }
        } else if (type === 'expense' || code.startsWith('5')) {
          const amt = Math.round((dr - cr) * 100) / 100;
          if (Math.abs(amt) > 0.001) {
            expenses.push({ code, name: r.accountName || code, amount: amt });
            totalExpense += amt;
          }
        }
      }
      totalIncome = Math.round(totalIncome * 100) / 100;
      totalExpense = Math.round(totalExpense * 100) / 100;
      return json({
        from: from || null,
        to: to || null,
        income,
        expenses,
        totalIncome,
        totalExpense,
        netProfit: Math.round((totalIncome - totalExpense) * 100) / 100
      });
    }


// STOCK MOVEMENTS (server-side permanent history)
    if (routeType === 'stock-movements' || routeType === 'stock_movements') {
      const tid = auth.tenantId || 'tenant-default';
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY, tenantId TEXT, branchId TEXT, itemId TEXT, itemName TEXT,
          qtyChange REAL, reason TEXT, ref TEXT, userName TEXT, at TEXT
        )`).run();
      } catch (_) {}
      if (request.method === 'GET') {
        const rows = (await env.DB.prepare(
          `SELECT * FROM stock_movements WHERE tenantId = ? ORDER BY at DESC LIMIT 500`
        ).bind(tid).all()).results || [];
        return json({ movements: rows });
      }
      if (request.method === 'POST') {
        const body = await request.json();
        const id = body.id || ('sm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        await env.DB.prepare(
          `INSERT INTO stock_movements (id, tenantId, branchId, itemId, itemName, qtyChange, reason, ref, userName, at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, tid, body.branchId || '', body.itemId || '', body.itemName || '',
          Number(body.qtyChange) || 0, body.reason || '', body.ref || '',
          body.userName || body.user || auth.user?.name || '', body.at || new Date().toISOString()
        ).run();
        return json({ success: true, id });
      }
      if (request.method === 'DELETE') {
        const body = request.headers.get('Content-Type') ? await request.json().catch(() => ({})) : {};
        if (id) {
          await env.DB.prepare(`DELETE FROM stock_movements WHERE id = ? AND tenantId = ?`).bind(id, tid).run();
        } else if (body.itemId) {
          await env.DB.prepare(`DELETE FROM stock_movements WHERE tenantId = ? AND itemId = ?`).bind(tid, body.itemId).run();
        } else if (body.ref) {
          await env.DB.prepare(`DELETE FROM stock_movements WHERE tenantId = ? AND ref = ?`).bind(tid, body.ref).run();
        }
        return json({ success: true });
      }
    }

    // TENANT SETTINGS blob (payment methods, sales terms, loyalty, etims, targets, tasks, cashups, auditLog, itemVariances, poApprovalLimit, returnRequests)
    if (routeType === 'tenant-settings' || routeType === 'tenant_settings') {
      const tid = auth.tenantId || 'tenant-default';
      await ensureTenantSettingsSchema();
      if (request.method === 'GET') {
        let row = await env.DB.prepare(`SELECT * FROM tenant_settings WHERE tenantId = ? LIMIT 1`).bind(tid).first();
        return json({ settings: row || null });
      }
      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.json();
        if (body.poApprovalLimit !== undefined && !auth.isAdmin && !can(auth, 'purchase', 'delete')) {
          return deny('Only users with Purchase Delete permission (or Admin) can set the Purchase Approval Limit.');
        }
        const pm = body.paymentMethods != null ? (typeof body.paymentMethods === 'string' ? body.paymentMethods : JSON.stringify(body.paymentMethods)) : null;
        const st = body.salesTerms != null ? (typeof body.salesTerms === 'string' ? body.salesTerms : JSON.stringify(body.salesTerms)) : null;
        const loy = body.loyalty != null ? (typeof body.loyalty === 'string' ? body.loyalty : JSON.stringify(body.loyalty)) : null;
        const et = body.etims != null ? (typeof body.etims === 'string' ? body.etims : JSON.stringify(body.etims)) : null;
        const targets = body.salesTargets != null ? (typeof body.salesTargets === 'string' ? body.salesTargets : JSON.stringify(body.salesTargets)) : null;
        const tasks = body.tasks != null ? (typeof body.tasks === 'string' ? body.tasks : JSON.stringify(body.tasks)) : null;
        const cashups = body.cashups != null ? (typeof body.cashups === 'string' ? body.cashups : JSON.stringify(body.cashups)) : null;
        const auditLog = body.auditLog != null ? (typeof body.auditLog === 'string' ? body.auditLog : JSON.stringify(body.auditLog)) : null;
        const itemVariances = body.itemVariances != null ? (typeof body.itemVariances === 'string' ? body.itemVariances : JSON.stringify(body.itemVariances)) : null;
        const poApprovalLimit = body.poApprovalLimit !== undefined && body.poApprovalLimit !== null ? Math.max(0, parseFloat(body.poApprovalLimit) || 0) : null;
        const returnRequests = body.returnRequests != null ? (typeof body.returnRequests === 'string' ? body.returnRequests : JSON.stringify(body.returnRequests)) : null;
        const creditPolicy = body.creditPolicy !== undefined ? (body.creditPolicy === 'stop' ? 'stop' : 'warn') : null;
        const existing = await env.DB.prepare(`SELECT * FROM tenant_settings WHERE tenantId = ? LIMIT 1`).bind(tid).first();
        if (existing) {
          try {
            await env.DB.prepare(
              `UPDATE tenant_settings SET
                paymentMethods = COALESCE(?, paymentMethods),
                salesTerms = COALESCE(?, salesTerms),
                loyalty = COALESCE(?, loyalty),
                etims = COALESCE(?, etims),
                salesTargets = COALESCE(?, salesTargets),
                tasks = COALESCE(?, tasks),
                cashups = COALESCE(?, cashups),
                auditLog = COALESCE(?, auditLog),
                itemVariances = COALESCE(?, itemVariances),
                poApprovalLimit = COALESCE(?, poApprovalLimit),
                returnRequests = COALESCE(?, returnRequests),
                creditPolicy = COALESCE(?, creditPolicy),
                updatedAt = ?
               WHERE tenantId = ?`
            ).bind(pm, st, loy, et, targets, tasks, cashups, auditLog, itemVariances, poApprovalLimit, returnRequests, creditPolicy, Date.now(), tid).run();
          } catch (_) {
            await env.DB.prepare(
              `UPDATE tenant_settings SET
                paymentMethods = COALESCE(?, paymentMethods),
                salesTerms = COALESCE(?, salesTerms),
                loyalty = COALESCE(?, loyalty),
                etims = COALESCE(?, etims),
                salesTargets = COALESCE(?, salesTargets),
                tasks = COALESCE(?, tasks),
                cashups = COALESCE(?, cashups),
                auditLog = COALESCE(?, auditLog),
                updatedAt = ?
               WHERE tenantId = ?`
            ).bind(pm, st, loy, et, targets, tasks, cashups, auditLog, Date.now(), tid).run();
          }
        } else {
          try {
            await env.DB.prepare(
              `INSERT INTO tenant_settings (id, tenantId, paymentMethods, salesTerms, loyalty, etims, salesTargets, tasks, cashups, auditLog, itemVariances, poApprovalLimit, returnRequests, creditPolicy, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(tid, tid, pm, st, loy, et, targets, tasks, cashups, auditLog, itemVariances, poApprovalLimit ?? 0, returnRequests, creditPolicy || 'warn', Date.now()).run();
          } catch (_) {
            await env.DB.prepare(
              `INSERT INTO tenant_settings (id, tenantId, paymentMethods, salesTerms, loyalty, etims, salesTargets, tasks, cashups, auditLog, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(tid, tid, pm, st, loy, et, targets, tasks, cashups, auditLog, Date.now()).run();
          }
        }
        if (poApprovalLimit !== null) {
          try { await appendTenantAuditRecord(tid, auth.user?.name || 'Admin', 'update', 'purchase_limit', `PO Admin Approval Limit set to ${poApprovalLimit}`); } catch (_) {}
        }
        return json({ success: true });
      }
    }



    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}