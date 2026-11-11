-- schema.sql
CREATE TABLE IF NOT EXISTS shop_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT,
  tagline TEXT,
  currency TEXT,
  phone TEXT,
  location TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  buyingPrice REAL,
  price REAL,
  quantity INTEGER,
  lowStockAlert INTEGER,
  trackInventory BOOLEAN,
  status TEXT,
  photoUrl TEXT,
  sku TEXT,
  size TEXT,
  colour TEXT,
  wholesalePrice REAL,
  tenantId TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  location TEXT,
  eligibility TEXT 
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  date TEXT,
  customerName TEXT,
  saleType TEXT,
  items TEXT,
  totalAmount REAL,
  paymentMethod TEXT,
  mpesaCode TEXT,
  cashier TEXT,
  paidAmount REAL,
  balanceDue REAL,
  deadline TEXT,
  subtotal REAL,
  taxAmount REAL,
  taxRate REAL,
  taxName TEXT,
  taxInclusive INTEGER DEFAULT 0,
  returnHistory TEXT,
  originalSaleType TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT,
  category TEXT,
  description TEXT,
  amount REAL,
  paymentMethod TEXT,
  mpesaCode TEXT,
  payer TEXT,
  paidTo TEXT,
  paidAmount REAL,
  balanceDue REAL,
  paymentStatus TEXT,
  taxAmount REAL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS item_statuses (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT,
  canSell BOOLEAN
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  pin TEXT,
  phone TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT,
  privileges TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  location TEXT,
  creditTermType TEXT,
  creditDays INTEGER
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  date TEXT,
  supplierId TEXT,
  supplierName TEXT,
  itemId TEXT,
  itemName TEXT,
  quantity INTEGER,
  cost REAL,
  amount REAL,
  paidAmount REAL,
  balanceDue REAL,
  paymentMethod TEXT,
  paymentStatus TEXT,
  workflowStatus TEXT,
  deadline TEXT,
  taxAmount REAL,
  taxRate REAL,
  returnedQty INTEGER DEFAULT 0,
  returnHistory TEXT,
  taxInclusive INTEGER DEFAULT 0,
  paymentHistory TEXT
);

-- Append to the bottom of schema.sql
CREATE TABLE IF NOT EXISTS website_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fontFamily TEXT,
  baseFontSize INTEGER,
  primaryColor TEXT,
  headingWeight TEXT,
  headingTransform TEXT,
  cardGlow TEXT,
  catalogHeight INTEGER,
  catalogObjectFit TEXT,
  heroTitle TEXT,
  heroSubtitle TEXT,
  heroImage TEXT,
  aboutTitle TEXT,
  aboutText TEXT,
  contactAddress TEXT,
  footerText TEXT,
  whatsappPhone TEXT
);

-- HR Module Tables
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT,
  position TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  hireDate TEXT,
  salary REAL,
  status TEXT,
  nationalId TEXT,
  bankAccount TEXT,
  bankName TEXT,
  leaveBalance REAL,
  managerId TEXT,
  userId TEXT,
  tenantId TEXT
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employeeId TEXT,
  employeeName TEXT,
  leaveType TEXT,
  startDate TEXT,
  endDate TEXT,
  days REAL,
  reason TEXT,
  status TEXT,
  approvedBy TEXT,
  createdAt TEXT,
  managerId TEXT,
  approverId TEXT,
  managerName TEXT
);

CREATE TABLE IF NOT EXISTS payroll (
  id TEXT PRIMARY KEY,
  employeeId TEXT,
  employeeName TEXT,
  period TEXT,
  basicSalary REAL,
  allowances REAL,
  deductions REAL,
  taxAmount REAL,
  netPay REAL,
  status TEXT,
  paidDate TEXT,
  notes TEXT,
  allowanceBreakdown TEXT,
  deductionBreakdown TEXT,
  allowanceOtherSpec TEXT,
  deductionOtherSpec TEXT
);

CREATE TABLE IF NOT EXISTS hr_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  defaultAnnualLeave REAL,
  leaveTypes TEXT,
  departments TEXT,
  payrollCycle TEXT,
  payDay INTEGER
);

CREATE TABLE IF NOT EXISTS tax_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  salesTaxEnabled INTEGER,
  salesTaxRate REAL,
  salesTaxName TEXT,
  purchaseTaxEnabled INTEGER,
  purchaseTaxRate REAL,
  purchaseTaxName TEXT,
  taxInclusive INTEGER
);
