
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, ShoppingBag, ArrowUpRight, DollarSign, Package, 
  Settings, ShieldAlert, Plus, Trash2, Edit, CheckCircle, 
  CreditCard, RefreshCw, FileText, Download, Upload,
  Smartphone, Calendar, TrendingUp, Layers, Clock, ToggleLeft, ToggleRight, LogOut, Lock, Check, X, Eye, Wallet, Users, Building, AlertTriangle, Printer, Database, Key, Truck, UserCheck, Briefcase, CalendarDays, Banknote, Percent
} from 'lucide-react';

export default function App() {
  // --- Auth & Session State with LocalStorage & 6-Hour Inactivity Timeout ---
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const savedUser = localStorage.getItem('erp_current_user');
    const loginTime = localStorage.getItem('erp_login_time');
    if (savedUser && loginTime) {
      const hoursPassed = (Date.now() - parseInt(loginTime, 10)) / (1000 * 60 * 60);
      if (hoursPassed < 6) return true;
      localStorage.removeItem('erp_current_user');
      localStorage.removeItem('erp_login_time');
    }
    return false;
  });

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  
  const [authToken, setAuthToken] = useState(() => { try { return localStorage.getItem('erp_auth_token') || ''; } catch (e) { return ''; } });
  const [tenantInfo, setTenantInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_tenant') || 'null'); } catch (e) { return null; }
  });
  const [authMode, setAuthMode] = useState('login'); // login | signup | super
  const [signupForm, setSignupForm] = useState({ shopName: '', adminName: '', adminPin: '', plan: 'starter', phone: '', email: '', locationName: '' });
  const [superTenants, setSuperTenants] = useState([]);
  const [superPlans, setSuperPlans] = useState([]);
  const [superPayments, setSuperPayments] = useState([]);
  const [superTab, setSuperTab] = useState('tenants');
  const [appHydrating, setAppHydrating] = useState(false);
  const [superProfile, setSuperProfile] = useState({ username: '', displayName: '' });
  const [platformKpis, setPlatformKpis] = useState(null);
  const [branches, setBranches] = useState([]);
  const [maxBranches, setMaxBranches] = useState(1);
  const [maxUsers, setMaxUsers] = useState(5);
  const [currentBranchId, setCurrentBranchId] = useState(() => {
    try { return localStorage.getItem('erp_current_branch') || ''; } catch (e) { return ''; }
  });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });
  const [paymentForm, setPaymentForm] = useState({ tenantId: '', amount: '', method: 'M-Pesa', reference: '', period: '', notes: '' });
  const [selectedPlatformPayment, setSelectedPlatformPayment] = useState(null);
  const [planForm, setPlanForm] = useState({ id: '', label: '', maxUsers: 5, maxBranches: 1, priceMonthly: 0 });
  const [newTenantForm, setNewTenantForm] = useState({ name: '', plan: 'starter', ownerEmail: '' });
  const [loginPrivileges, setLoginPrivileges] = useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_login_privileges') || 'null'); } catch (e) { return null; }
  });
  const apiFetch = (url, options = {}) => {
    const token = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_auth_token')) || authToken || '';
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const bid = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_current_branch')) || '';
      if (bid && bid !== 'all') headers['X-Branch-Id'] = bid;
    } catch (e) {}
    if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers }).then(async (res) => {
      // Do not hard-logout on every 401 (race / one failed call); caller can handle message
      return res;
    });
  };
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('erp_current_user');
    const loginTime = localStorage.getItem('erp_login_time');
    if (savedUser && loginTime) {
      const hoursPassed = (Date.now() - parseInt(loginTime, 10)) / (1000 * 60 * 60);
      if (hoursPassed < 6) {
        try { return JSON.parse(savedUser); } catch (e) { return null; }
      }
    }
    return null;
  });

  // Self Profile Password Change Modal State
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const tenantStorageKey = (base) => {
    try {
      const t = JSON.parse(localStorage.getItem('erp_tenant') || 'null');
      const tid = (t && t.id) ? String(t.id) : 'unknown';
      return base + '__' + tid;
    } catch (e) { return base; }
  };
  const [auditLog, setAuditLog] = useState([]);
  const [lastBackupAt, setLastBackupAt] = useState(() => { try { return localStorage.getItem('erp_last_backup') || ''; } catch (e) { return ''; } });
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
  const [posPriceList, setPosPriceList] = useState('retail');
  const [tasks, setTasks] = useState([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [salesTargets, setSalesTargets] = useState({});
  const [offlineQueue, setOfflineQueue] = useState(() => { try { return JSON.parse(localStorage.getItem('erp_offline_queue') || '[]'); } catch (e) { return []; } });
  const [etimsSettings, setEtimsSettings] = useState({
    invoicePrefix: 'INV',
    nextInvoiceNo: 1,
    enabled: false,
    mode: 'structure_only', // structure_only | future_api
    deviceSerial: '',
    apiEndpoint: '',
    taxpayerPin: '',
    notes: ''
  });
  const [loyaltySettings, setLoyaltySettings] = useState({ enabled: true, pointsPerCurrency: 1, redeemValue: 1 });
  const [dashboardCompareMode, setDashboardCompareMode] = useState('last_month');
  const [cashUpHistory, setCashUpHistory] = useState([]);
  const [salesLedgerSubTab, setSalesLedgerSubTab] = useState('ledger');
  const [cashUpForm, setCashUpForm] = useState({ countedCash: '', countedMpesa: '', notes: '' });
  const [cashUpModalOpen, setCashUpModalOpen] = useState(false);


  const [stockMovements, setStockMovements] = useState([]);
  const [transferForm, setTransferForm] = useState({ fromBranchId: '', toBranchId: '', lines: [{ itemId: '', qty: '' }] });
  const [inventorySubTab, setInventorySubTab] = useState('items'); // items | transfer | movements
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedPlatformShop, setSelectedPlatformShop] = useState(null);
  const [poLines, setPoLines] = useState([{ itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0 }]);
  const saveStockMovements = (next) => {
    setStockMovements(next);
    // Persist any new movements to DB (bulk callers e.g. stock transfer)
    try {
      const prevIds = new Set((stockMovements || []).map(m => m.id));
      (next || []).forEach(m => {
        if (m && m.id && !prevIds.has(m.id)) {
          apiFetch('/api/stock-movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...m, userName: m.userName || m.user || '' })
          }).catch(() => {});
        }
      });
    } catch (_) {}
  };
  const [leaveCalendarMonth, setLeaveCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [profilePinCurrent, setProfilePinCurrent] = useState('');
  const [profilePinNew, setProfilePinNew] = useState('');
  const [profilePinConfirm, setProfilePinConfirm] = useState('');

  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [profileImage, setProfileImage] = useState(() => { try { const u = JSON.parse(localStorage.getItem('erp_current_user') || 'null'); return u ? (localStorage.getItem(`erp_user_photo_${u.id}`) || '') : ''; } catch { return ''; } });
  const [selfOldPassword, setSelfOldPassword] = useState('');
  const [selfNewPassword, setSelfNewPassword] = useState('');

  // Sales Ledger & PO Pagination State
  const [salesPage, setSalesPage] = useState(1);
  const salesPerPage = 100;
  const [poPage, setPoPage] = useState(1);
  const poPerPage = 100;
  const [poSupplierFilter, setPoSupplierFilter] = useState('');
  const [poItemFilter, setPoItemFilter] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('');
  const [poDateStart, setPoDateStart] = useState('');
  const [poDateEnd, setPoDateEnd] = useState('');
  const [salesDateStart, setSalesDateStart] = useState('');
  const [salesDateEnd, setSalesDateEnd] = useState('');
  const [salesCustomerFilter, setSalesCustomerFilter] = useState('');
  const [salesTypeFilter, setSalesTypeFilter] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('');
  const [inventoryTrackFilter, setInventoryTrackFilter] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('');
  const [laybyCustomerFilter, setLaybyCustomerFilter] = useState('');
  const [laybyTypeFilter, setLaybyTypeFilter] = useState('');
  const [laybyDeadlineFilter, setLaybyDeadlineFilter] = useState('');
  const [employeePositionFilter, setEmployeePositionFilter] = useState('');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('');
  const [employeeManagerFilter, setEmployeeManagerFilter] = useState('');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('');
  const [leaveApproverFilter, setLeaveApproverFilter] = useState('');

  // Inactivity & Activity tracker for 6-hour timeout
  useEffect(() => {
    if (!isLoggedIn) return;
    const updateActivity = () => {
      localStorage.setItem('erp_login_time', Date.now().toString());
    };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);

    const interval = setInterval(() => {
      const loginTime = localStorage.getItem('erp_login_time');
      if (loginTime) {
        const hoursPassed = (Date.now() - parseInt(loginTime, 10)) / (1000 * 60 * 60);
        if (hoursPassed >= 6) {
          setIsLoggedIn(false);
    try {
      const t = localStorage.getItem('erp_auth_token');
      if (t) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {});
      localStorage.removeItem('erp_auth_token');
    } catch (e) {}
    setAuthToken('');
    setLoginPrivileges(null);
    try { localStorage.removeItem('erp_login_privileges'); } catch (e) {}
    setTenantInfo(null);
    try { localStorage.removeItem('erp_tenant'); } catch (e) {}
    setSuperTenants([]);
          setCurrentUser(null);
          localStorage.removeItem('erp_current_user');
          localStorage.removeItem('erp_login_time');
          alert('Session expired due to 6 hours of inactivity.');
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    try {
      const t = localStorage.getItem('erp_auth_token');
      if (t) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }).catch(() => {});
      localStorage.removeItem('erp_auth_token');
    } catch (e) {}
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('erp_current_user');
    localStorage.removeItem('erp_login_time');
  };

  // --- Navigation & Filter States ---
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('erp_active_tab') || 'dashboard'; } catch (e) { return 'dashboard'; }
  });
  const setActiveTabPersist = (tab) => {
    setActiveTab(tab);
    try { localStorage.setItem('erp_active_tab', tab); } catch (e) {}
  };
  const [settingsSubTab, setSettingsSubTab] = useState('profile');
  const [ledgerTrial, setLedgerTrial] = useState(null);
  const [ledgerJournals, setLedgerJournals] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [bankRecList, setBankRecList] = useState([]);
  const [bankRecDetail, setBankRecDetail] = useState(null);
  const [bankRecForm, setBankRecForm] = useState({ accountCode: '1000', statementDate: new Date().toISOString().slice(0, 10), statementBalance: '', notes: '' });
  const [bankLineForm, setBankLineForm] = useState({ lineDate: new Date().toISOString().slice(0, 10), description: '', amount: '' });
  const [bankRecLoading, setBankRecLoading] = useState(false);
  const [acctPeriods, setAcctPeriods] = useState([]);
  const [manualJournal, setManualJournal] = useState({ reason: '', entryDate: new Date().toISOString().slice(0, 10), lines: [{ accountCode: '1000', debit: '', credit: '' }, { accountCode: '5100', debit: '', credit: '' }] });
  const [periodKeyInput, setPeriodKeyInput] = useState(new Date().toISOString().slice(0, 7));
  const [ledgerPnl, setLedgerPnl] = useState(null);
  const [pnlFrom, setPnlFrom] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [pnlTo, setPnlTo] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'pm-cash', name: 'Cash', startingBalance: 0, currentBalance: 0 },
    { id: 'pm-mpesa', name: 'M-Pesa', startingBalance: 0, currentBalance: 0 }
  ]);
  const [salesTerms, setSalesTerms] = useState([
    { id: 'st-cod', name: 'Cash On Delivery', type: 'Paid', days: 0 },
    { id: 'st-pod', name: 'Pay On Delivery', type: 'Paid', days: 0 },
    { id: 'st-credit', name: 'Credit', type: 'Credit', days: 30 },
    { id: 'st-layby', name: 'Layby', type: 'Layby', days: 60 }
  ]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({ name: '', startingBalance: 0, currentBalance: 0 });
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [selectedSalesTerm, setSelectedSalesTerm] = useState(null);
  const [salesTermForm, setSalesTermForm] = useState({ name: '', type: 'Paid', days: 0 });
  const [salesTermModalOpen, setSalesTermModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [payrollPayMethod, setPayrollPayMethod] = useState('Cash');
  const [reportSubTab, setReportSubTab] = useState('sales');
  const [finReportTab, setFinReportTab] = useState('pnl');
  const [finReportData, setFinReportData] = useState(null);
  const [finReportLoading, setFinReportLoading] = useState(false);
  const [finFrom, setFinFrom] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [finTo, setFinTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [finCompareFrom, setFinCompareFrom] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  });
  const [finCompareTo, setFinCompareTo] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
  });
  const [finGroupBy, setFinGroupBy] = useState('day');
  const [finBranchId, setFinBranchId] = useState('');
  const [finAccountCode, setFinAccountCode] = useState('');
  const [dashboardTimeframe, setDashboardTimeframe] = useState('this_month');
  const [dashCustomStartDate, setDashCustomStartDate] = useState('');
  const [dashCustomEndDate, setDashCustomEndDate] = useState('');

  // Expenses Tab Filter States
  const [expenseTimeframe, setExpenseTimeframe] = useState('all');
  const [expenseCustomStartDate, setExpenseCustomStartDate] = useState('');
  const [expenseCustomEndDate, setExpenseCustomEndDate] = useState('');
  const [expensePayerFilter, setExpensePayerFilter] = useState('');
  const [expensePaidToFilter, setExpensePaidToFilter] = useState('');

  // --- Business Profile State ---
  const [shopProfile, setShopProfile] = useState({
    name: '',
    tagline: '',
    currency: 'KSh',
    phone: '',
    location: ''
  });

  // Dynamic States with Full Mock Dataset
  const [categories, setCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [itemStatuses, setItemStatuses] = useState([]);

  const [inventory, setInventory] = useState([]);

  const [customers, setCustomers] = useState([]);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // --- Purchase Module States (Suppliers & Purchase Orders) ---
  const [suppliers, setSuppliers] = useState([]);

  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', email: '', location: '', creditTermType: 'COD', creditDays: 0 });
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [newPOModalOpen, setNewPOModalOpen] = useState(false);
  const [newPOForm, setNewPOForm] = useState({ supplierId: '', supplierName: '', itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0, paymentMethod: 'Cash', paidAmount: 0, mpesaCode: '' });
  const [selectedPO, setSelectedPO] = useState(null);
  const [poPaymentModalOpen, setPoPaymentModalOpen] = useState(false);
  const [poPaymentForm, setPoPaymentForm] = useState({ payAmount: '', paymentMethod: 'Cash', mpesaCode: '' });

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [roles, setRoles] = useState([
    { id: 'role-admin', name: 'Admin', privileges: {
      dashboard: {view:true, create:true, update:true, delete:true, ownOnly:false},
      pos: {view:true, create:true, update:true, delete:true, ownOnly:false},
      sales: {view:true, create:true, update:true, delete:true, ownOnly:false},
      inventory: {view:true, create:true, update:true, delete:true, ownOnly:false},
      expenses: {view:true, create:true, update:true, delete:true, ownOnly:false},
      laybys: {view:true, create:true, update:true, delete:true, ownOnly:false},
      customers: {view:true, create:true, update:true, delete:true, ownOnly:false},
      suppliers: {view:true, create:true, update:true, delete:true, ownOnly:false},
      reports: {view:true, create:true, update:true, delete:true, ownOnly:false},
      reportSales: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportPurchase: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportExpense: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportHr: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportCustomer: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportInventory: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportAging: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportFinancial: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportLedger: {view:true, create:false, update:false, delete:false, ownOnly:false},
      settings: {view:true, create:true, update:true, delete:true, ownOnly:false},
      purchase: {view:true, create:true, update:true, delete:true, ownOnly:false},
      employees: {view:true, create:true, update:true, delete:true, ownOnly:false},
      payroll: {view:true, create:true, update:true, delete:true, ownOnly:false},
      hr: {view:true, create:true, update:true, delete:true, ownOnly:false}
    }},
    { id: 'role-manager', name: 'Manager', privileges: {
      dashboard: {view:true, create:false, update:false, delete:false, ownOnly:false},
      pos: {view:true, create:true, update:true, delete:false, ownOnly:false},
      sales: {view:true, create:true, update:true, delete:false, ownOnly:false},
      inventory: {view:true, create:true, update:true, delete:false, ownOnly:false},
      expenses: {view:true, create:true, update:true, delete:false, ownOnly:false},
      laybys: {view:true, create:true, update:true, delete:false, ownOnly:false},
      customers: {view:true, create:true, update:true, delete:false, ownOnly:false},
      suppliers: {view:true, create:true, update:true, delete:false, ownOnly:false},
      reports: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportSales: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportPurchase: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportExpense: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportHr: {view:true, create:false, update:false, delete:false, ownOnly:false},
      reportCustomer: {view:true, create:false, update:false, delete:false, ownOnly:false},
      settings: {view:false, create:false, update:false, delete:false, ownOnly:false},
      purchase: {view:true, create:true, update:true, delete:false, ownOnly:false},
      employees: {view:true, create:true, update:true, delete:false, ownOnly:false},
      payroll: {view:true, create:true, update:true, delete:false, ownOnly:false},
      hr: {view:true, create:true, update:true, delete:false, ownOnly:false}
    }},
    { id: 'role-sales', name: 'Salesperson', privileges: {
      dashboard: {view:false, create:false, update:false, delete:false, ownOnly:false},
      pos: {view:true, create:true, update:false, delete:false, ownOnly:true},
      sales: {view:true, create:false, update:false, delete:false, ownOnly:true},
      inventory: {view:true, create:false, update:false, delete:false, ownOnly:false},
      expenses: {view:false, create:false, update:false, delete:false, ownOnly:false},
      laybys: {view:true, create:true, update:true, delete:false, ownOnly:true},
      customers: {view:true, create:true, update:true, delete:false, ownOnly:false},
      suppliers: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reports: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reportSales: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reportPurchase: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reportExpense: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reportHr: {view:false, create:false, update:false, delete:false, ownOnly:false},
      reportCustomer: {view:false, create:false, update:false, delete:false, ownOnly:false},
      settings: {view:false, create:false, update:false, delete:false, ownOnly:false},
      purchase: {view:false, create:false, update:false, delete:false, ownOnly:false},
      employees: {view:false, create:false, update:false, delete:false, ownOnly:false},
      payroll: {view:false, create:false, update:false, delete:false, ownOnly:false},
      hr: {view:false, create:false, update:false, delete:false, ownOnly:false}
    }}
  ]);

  const [users, setUsers] = useState([
    { id: 'u1', name: 'Main Admin', role: 'Admin', pin: '1234', phone: '+254 700 000000', status: 'Active' },
    { id: 'u2', name: 'Alice Wambui', role: 'Salesperson', pin: '5678', phone: '+254 711 222333', status: 'Active' },
    { id: 'u3', name: 'Benta Akinyi', role: 'Manager', pin: '0000', phone: '+254 733 999888', status: 'Inactive' }
  ]);

  // POS State with Split Payment, Sale Type Selection, Custom Sale Date, Category Filter, and POS Search Bar
  const [posCart, setPosCart] = useState([]);
  const [posSelectedCustomer, setPosSelectedCustomer] = useState('');
  const [posSaleType, setPosSaleType] = useState('Paid');
  const [posSaleDate, setPosSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [posCategoryFilter, setPosCategoryFilter] = useState('all');
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posCashPaid, setPosCashPaid] = useState('');
  const [posRedeemPoints, setPosRedeemPoints] = useState('');
  const [posMpesaPaid, setPosMpesaPaid] = useState('');
  const [posMpesaCode, setPosMpesaCode] = useState('');
  const [posDeadline, setPosDeadline] = useState('');
  const [lastCompletedSale, setLastCompletedSale] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Modals & Editing Inspection States
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ wholesalePrice: '', name: '', sku: '', size: '', colour: '', category: 'Grade A Jackets', buyingPrice: '', price: '', quantity: '', lowStockAlert: 3, trackInventory: true, status: 'Listed', photoUrl: '', varianceValues: {}, branchId: '', allLocations: false });
  // User-defined item variance attributes (e.g. Size, Colour, Material) — configured under Settings → Items Setting
  const [itemVariances, setItemVariances] = useState([
    { id: 'var-size', name: 'Size' },
    { id: 'var-colour', name: 'Colour' }
  ]);
  const [varianceDraft, setVarianceDraft] = useState('');
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', location: '', eligibility: ['Paid'], salesTermId: '', paymentTerm: '', tags: '', priceList: 'retail', kraPin: '', loyaltyPoints: 0 });
  
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addRoleModalOpen, setAddRoleModalOpen] = useState(false);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [addExpenseCategoryModalOpen, setAddExpenseCategoryModalOpen] = useState(false);
  const [addStatusModalOpen, setAddStatusModalOpen] = useState(false);

  // New Creation Form States
  const [newUserForm, setNewUserForm] = useState({ name: '', role: 'Salesperson', pin: '', phone: '', status: 'Active', allowedBranches: [] }); // pin strength checked on create
  const [newRoleForm, setNewRoleForm] = useState({ name: '' });
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', status: 'Active' });
  const [newStatusForm, setNewStatusForm] = useState({ name: '', canSell: true, status: 'Active' });

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [selectedItemStatus, setSelectedItemStatus] = useState(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [selectedSaleItem, setSelectedSaleItem] = useState(null);
  const [salesReturnModalOpen, setSalesReturnModalOpen] = useState(false);
  const [salesReturnSale, setSalesReturnSale] = useState(null);
  const [salesReturnQtys, setSalesReturnQtys] = useState({});
  const [salesReturnMethod, setSalesReturnMethod] = useState('Cash');
  const [salesReturnDisposition, setSalesReturnDisposition] = useState('Saleable');
  const [purchaseReturnSettlement, setPurchaseReturnSettlement] = useState('Supplier Credit Note');
  const [purchaseReturnRefundMethod, setPurchaseReturnRefundMethod] = useState('Cash');
  const [purchaseReturnModalOpen, setPurchaseReturnModalOpen] = useState(false);
  const [purchaseReturnPO, setPurchaseReturnPO] = useState(null);
  const [purchaseReturnQty, setPurchaseReturnQty] = useState(1);
  const [purchaseReturnLineQtys, setPurchaseReturnLineQtys] = useState({});

  const [selectedExpenseItem, setSelectedExpenseItem] = useState(null);

  const [newExpense, setNewExpense] = useState({ date: new Date().toISOString().split('T')[0], category: 'Store Rent', description: '', amount: '', paidAmount: '', paymentMethod: 'Cash', mpesaCode: '', payer: '', paidTo: '' });

  // Reports Filters
    const [reportTimeframe, setReportTimeframe] = useState('all');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');

  // --- HR Module State ---
  const [hrSubTab, setHrSubTab] = useState('employees');
  const [purchaseSubTab, setPurchaseSubTab] = useState('suppliers');
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [hrSettings, setHrSettings] = useState({
    defaultAnnualLeave: 21,
    leaveTypes: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Compassionate'],
    departments: ['Sales', 'Operations', 'Admin', 'Warehouse', 'Finance'],
    payrollCycle: 'Monthly',
    payDay: 28
  });
  const [employeeForm, setEmployeeForm] = useState({ name: '', position: '', department: 'Sales', phone: '', email: '', hireDate: '', salary: '', status: 'Active', nationalId: '', bankAccount: '', bankName: '', leaveBalance: 21, managerId: '' });
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    employeeId: '',
    period: '',
    notes: '',
    allowanceItems: { Housing: 0, Transport: 0, Airtime: 0, Bonus: 0, Other: 0 },
    allowanceOtherSpec: '',
    deductionItems: { PAYE: 0, 'NHL/Housing Levy': 0, NSSF: 0, SHA: 0, Loan: 0, Pension: 0, Other: 0 },
    deductionOtherSpec: ''
  });
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [payrollPrintMode, setPayrollPrintMode] = useState(false);

  // --- Tax Settings State ---
  const [taxSettings, setTaxSettings] = useState({
    salesTaxEnabled: false,
    salesTaxRate: 16,
    salesTaxName: 'VAT',
    purchaseTaxEnabled: false,
    purchaseTaxRate: 16,
    purchaseTaxName: 'VAT',
    expenseTaxEnabled: false,
    expenseTaxRate: 16,
    expenseTaxName: 'VAT',
    taxInclusive: false
  });
  // Per-transaction tax apply (defaults follow Settings; can toggle on POS / Purchase / Expense)
  const [posApplyTax, setPosApplyTax] = useState(false);
  const [poApplyTax, setPoApplyTax] = useState(false);
  const [expenseApplyTax, setExpenseApplyTax] = useState(false);
  // Per-transaction inclusive/exclusive (defaults from Settings.taxInclusive)
  const [posTaxInclusive, setPosTaxInclusive] = useState(false);
  const [poTaxInclusive, setPoTaxInclusive] = useState(false);
  const [expenseTaxInclusive, setExpenseTaxInclusive] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportStatementCustomer, setReportStatementCustomer] = useState('');

  // Cloudflare D1 Initial Load Hook
  useEffect(() => {
    if (!localStorage.getItem('erp_auth_token') && !authToken) return;
    apiFetch('/api/all-data')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (Array.isArray(data.inventory)) {
            setInventory(data.inventory);
          }
          if (Array.isArray(data.sales)) {
            const mapped = data.sales.map(s => {
              const items = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);
              const totalAmount = parseFloat(s.totalAmount) || 0;
              const paidAmount = parseFloat(s.paidAmount) || 0;
              let balanceDue = s.balanceDue;
              if (balanceDue === undefined || balanceDue === null || balanceDue === '') balanceDue = Math.max(0, totalAmount - paidAmount);
              else balanceDue = parseFloat(balanceDue) || 0;
              return { ...s, items, totalAmount, paidAmount, balanceDue };
            });
            setSales(mapped);
          }
          if (Array.isArray(data.customers)) {
            const custs = data.customers.map(c => ({ ...c, eligibility: typeof c.eligibility === 'string' ? JSON.parse(c.eligibility || '["Paid"]') : (c.eligibility || ['Paid']) }));
            setCustomers(custs);
          }
          if (Array.isArray(data.expenses)) {
            setExpenses(data.expenses.map(e => {
              const amount = parseFloat(e.amount) || 0;
              let paid = e.paidAmount != null && e.paidAmount !== '' ? parseFloat(e.paidAmount) || 0 : (e.paymentStatus === 'Unpaid' ? 0 : amount);
              let balanceDue = e.balanceDue != null && e.balanceDue !== '' ? parseFloat(e.balanceDue) : Math.max(0, amount - paid);
              if (isNaN(balanceDue)) balanceDue = Math.max(0, amount - paid);
              balanceDue = Math.max(0, amount - paid);
              const paymentStatus = balanceDue <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');
              return { ...e, amount, paidAmount: paid, balanceDue, paymentStatus };
            }));
          }
          if (Array.isArray(data.categories)) setCategories(data.categories);
          if (Array.isArray(data.expenseCategories)) setExpenseCategories(data.expenseCategories);
          if (Array.isArray(data.itemStatuses)) setItemStatuses(data.itemStatuses);
          if (Array.isArray(data.suppliers)) {
            setSuppliers(data.suppliers);
          }
          if (Array.isArray(data.purchaseOrders)) {
            setPurchaseOrders(data.purchaseOrders);
          }
          if (data.users?.length) {
            setUsers(data.users.filter(u => u.name !== 'Sir Jycob' && u.id !== 'u-jycob').map(u => {
              let ab = u.allowedBranches;
              try { if (typeof ab === 'string') ab = JSON.parse(ab || '[]'); } catch (_) { ab = []; }
              return { ...u, allowedBranches: Array.isArray(ab) ? ab : [] };
            }));
          }
          if (data.roles?.length) setRoles(data.roles.map(r => ({ ...r, privileges: typeof r.privileges === 'string' ? JSON.parse(r.privileges) : r.privileges })));
          if (data.shopProfile) setShopProfile(data.shopProfile);
          if (Array.isArray(data.branches)) {
            setBranches(data.branches);
            setMaxBranches(data.maxBranches || 1);
            if (data.maxUsers) setMaxUsers(data.maxUsers);
            if (data.plan && tenantInfo) {
              try { setTenantInfo(prev => prev ? { ...prev, plan: data.plan, maxUsers: data.maxUsers || prev.maxUsers, maxBranches: data.maxBranches || prev.maxBranches } : prev); } catch (_) {}
            }
            try {
              const saved = localStorage.getItem('erp_current_branch');
              if (saved === 'all') setCurrentBranchId('all');
              else if (saved && data.branches.some(b => b.id === saved)) setCurrentBranchId(saved);
              else {
                const def = data.branches.find(b => b.isDefault) || data.branches[0];
                if (def) {
                  setCurrentBranchId(def.id);
                  try { localStorage.setItem('erp_current_branch', def.id); } catch (e) {}
                }
              }
            } catch (e) {}
          }
          if (Array.isArray(data.employees)) {
            setEmployees(data.employees);
          }
          if (Array.isArray(data.leaveRequests)) {
            setLeaveRequests(data.leaveRequests);
          }
          if (Array.isArray(data.payrollRecords)) {
            setPayrollRecords(data.payrollRecords.map(pr => {
              let ab = pr.allowanceBreakdown, db = pr.deductionBreakdown;
              try { if (typeof ab === 'string') ab = JSON.parse(ab || '{}'); } catch (_) { ab = {}; }
              try { if (typeof db === 'string') db = JSON.parse(db || '{}'); } catch (_) { db = {}; }
              return { ...pr, allowanceBreakdown: ab || {}, deductionBreakdown: db || {} };
            }));
          }
          if (data.hrSettings) {
            setHrSettings({
              defaultAnnualLeave: data.hrSettings.defaultAnnualLeave ?? 21,
              leaveTypes: typeof data.hrSettings.leaveTypes === 'string' ? JSON.parse(data.hrSettings.leaveTypes || '[]') : (data.hrSettings.leaveTypes || ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Compassionate']),
              departments: typeof data.hrSettings.departments === 'string' ? JSON.parse(data.hrSettings.departments || '[]') : (data.hrSettings.departments || ['Sales', 'Operations', 'Admin', 'Warehouse', 'Finance']),
              payrollCycle: data.hrSettings.payrollCycle || 'Monthly',
              payDay: data.hrSettings.payDay || 28
            });
          }
          if (data.taxSettings) {
            const ts = {
              salesTaxEnabled: !!data.taxSettings.salesTaxEnabled,
              salesTaxRate: data.taxSettings.salesTaxRate ?? 16,
              salesTaxName: data.taxSettings.salesTaxName || 'VAT',
              purchaseTaxEnabled: !!data.taxSettings.purchaseTaxEnabled,
              purchaseTaxRate: data.taxSettings.purchaseTaxRate ?? 16,
              purchaseTaxName: data.taxSettings.purchaseTaxName || 'VAT',
              expenseTaxEnabled: !!data.taxSettings.expenseTaxEnabled,
              expenseTaxRate: data.taxSettings.expenseTaxRate ?? 16,
              expenseTaxName: data.taxSettings.expenseTaxName || 'VAT',
              taxInclusive: !!data.taxSettings.taxInclusive
            };
            setTaxSettings(ts);
            setPosApplyTax(!!ts.salesTaxEnabled);
            setPoApplyTax(!!ts.purchaseTaxEnabled);
            setExpenseApplyTax(!!(ts.expenseTaxEnabled ?? ts.purchaseTaxEnabled));
            setPosTaxInclusive(!!ts.taxInclusive);
            setPoTaxInclusive(!!ts.taxInclusive);
            setExpenseTaxInclusive(!!ts.taxInclusive);
          }
          if (Array.isArray(data.stockMovements)) {
            setStockMovements(data.stockMovements.map(m => ({ ...m, user: m.userName || m.user || '', qtyChange: Number(m.qtyChange) || 0 })));
          }
          if (data.tenantSettings) {
            try {
              const ts = data.tenantSettings;
              if (ts.paymentMethods) { const pm = typeof ts.paymentMethods === 'string' ? JSON.parse(ts.paymentMethods) : ts.paymentMethods; if (Array.isArray(pm) && pm.length) setPaymentMethods(pm); }
              if (ts.salesTerms) { const st = typeof ts.salesTerms === 'string' ? JSON.parse(ts.salesTerms) : ts.salesTerms; if (Array.isArray(st) && st.length) setSalesTerms(st); }
              if (ts.loyalty) { const loy = typeof ts.loyalty === 'string' ? JSON.parse(ts.loyalty) : ts.loyalty; if (loy) setLoyaltySettings(loy); }
              if (ts.etims) { const et = typeof ts.etims === 'string' ? JSON.parse(ts.etims) : ts.etims; if (et) setEtimsSettings(et); }
              if (ts.salesTargets) { const tgt = typeof ts.salesTargets === 'string' ? JSON.parse(ts.salesTargets) : ts.salesTargets; if (tgt) setSalesTargets(tgt); }
              if (ts.tasks) { const tk = typeof ts.tasks === 'string' ? JSON.parse(ts.tasks) : ts.tasks; if (Array.isArray(tk)) setTasks(tk); }
              if (ts.cashups) { const cu = typeof ts.cashups === 'string' ? JSON.parse(ts.cashups) : ts.cashups; if (Array.isArray(cu)) setCashUpHistory(cu); }
              if (ts.auditLog) { const al = typeof ts.auditLog === 'string' ? JSON.parse(ts.auditLog) : ts.auditLog; if (Array.isArray(al)) setAuditLog(al); }
              if (ts.itemVariances) {
                const iv = typeof ts.itemVariances === 'string' ? JSON.parse(ts.itemVariances) : ts.itemVariances;
                if (Array.isArray(iv) && iv.length) setItemVariances(iv);
              }
            } catch (e) {}
          }

          // One-time push of localStorage-only data into DB (idempotent per browser)
          try {
            const migKey = 'erp_local_to_db_migrated_v1';
            if (!localStorage.getItem(migKey)) {
              const pushJson = (key, bodyKey) => {
                try {
                  const raw = localStorage.getItem(key);
                  if (!raw) return;
                  const parsed = JSON.parse(raw);
                  if (parsed == null) return;
                  if (Array.isArray(parsed) && !parsed.length) return;
                  apiFetch('/api/tenant-settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [bodyKey]: parsed })
                  }).catch(() => {});
                } catch (_) {}
              };
              pushJson('erp_tasks', 'tasks');
              pushJson('erp_cashups', 'cashups');
              pushJson('erp_sales_targets', 'salesTargets');
              pushJson('erp_loyalty', 'loyalty');
              pushJson('erp_etims', 'etims');
              pushJson('erp_sales_terms', 'salesTerms');
              try {
                const tid = (() => { try { return JSON.parse(localStorage.getItem('erp_tenant') || 'null')?.id; } catch { return null; } })();
                const pmKey = tid ? ('erp_payment_methods__' + tid) : null;
                if (pmKey) {
                  const pm = JSON.parse(localStorage.getItem(pmKey) || 'null');
                  if (Array.isArray(pm) && pm.length) {
                    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethods: pm }) }).catch(() => {});
                  }
                }
              } catch (_) {}
              try {
                const alKey = (() => {
                  try {
                    const t = JSON.parse(localStorage.getItem('erp_tenant') || 'null');
                    return t?.id ? ('erp_audit_log__' + t.id) : 'erp_audit_log';
                  } catch { return 'erp_audit_log'; }
                })();
                const al = JSON.parse(localStorage.getItem(alKey) || localStorage.getItem('erp_audit_log') || '[]');
                if (Array.isArray(al) && al.length) {
                  apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditLog: al }) }).catch(() => {});
                }
              } catch (_) {}
              // Push local-only stock movements
              try {
                const smKey = (() => {
                  try {
                    const t = JSON.parse(localStorage.getItem('erp_tenant') || 'null');
                    return t?.id ? ('erp_stock_movements__' + t.id) : 'erp_stock_movements';
                  } catch { return 'erp_stock_movements'; }
                })();
                const localSm = JSON.parse(localStorage.getItem(smKey) || localStorage.getItem('erp_stock_movements') || '[]');
                const serverIds = new Set((data.stockMovements || []).map(m => m.id));
                if (Array.isArray(localSm)) {
                  localSm.forEach(m => {
                    if (m && m.id && !serverIds.has(m.id)) {
                      apiFetch('/api/stock-movements', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...m, userName: m.userName || m.user || '' })
                      }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
              // Push local-only expenses / POs / sales not yet on server
              try {
                const localExp = JSON.parse(localStorage.getItem('erp_expenses') || '[]');
                const serverExpIds = new Set((data.expenses || []).map(e => e.id));
                if (Array.isArray(localExp)) {
                  localExp.forEach(e => {
                    if (e && e.id && !serverExpIds.has(e.id)) {
                      apiFetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
              try {
                const localPo = JSON.parse(localStorage.getItem('erp_purchase_orders') || '[]');
                const serverPoIds = new Set((data.purchaseOrders || []).map(p => p.id));
                if (Array.isArray(localPo)) {
                  localPo.forEach(p => {
                    if (p && p.id && !serverPoIds.has(p.id)) {
                      apiFetch('/api/purchase_orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
              try {
                const localSales = JSON.parse(localStorage.getItem('erp_sales') || '[]');
                const serverSaleIds = new Set((data.sales || []).map(s => s.id));
                if (Array.isArray(localSales)) {
                  localSales.forEach(s => {
                    if (s && s.id && !serverSaleIds.has(s.id)) {
                      apiFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
              try {
                const localInv = JSON.parse(localStorage.getItem('erp_inventory') || '[]');
                const serverInvIds = new Set((data.inventory || []).map(i => i.id));
                if (Array.isArray(localInv)) {
                  localInv.forEach(i => {
                    if (i && i.id && !serverInvIds.has(i.id)) {
                      apiFetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(i) }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
              try {
                const localCust = JSON.parse(localStorage.getItem('erp_customers') || '[]');
                const serverCustIds = new Set((data.customers || []).map(c => c.id));
                if (Array.isArray(localCust)) {
                  localCust.forEach(c => {
                    if (c && c.id && !serverCustIds.has(c.id)) {
                      apiFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) }).catch(() => {});
                    }
                  });
                }
              } catch (_) {}
            }
          } catch (_) {}
        }
      })
      .catch(err => console.log('Using default state dataset:', err));
  }, []);

  // --- DATABASE SYNC HANDLERS ---
  const handleCreateNewSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierForm.name) return;
    const dup = (suppliers || []).find(s => (s.name || '').trim().toLowerCase() === (newSupplierForm.name || '').trim().toLowerCase());
    if (dup && !window.confirm(`A supplier named "${dup.name}" already exists. Create another with the same name?`)) return;
    const supObj = {
      id: `sup-${Date.now()}`,
      createdBy: currentUser?.name || currentUser?.id || '',
      ...newSupplierForm
    };
    try {
      const response = await apiFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supObj)
      });
      if (response.ok) {
        setSuppliers([...suppliers, supObj]);
        setNewSupplierForm({ name: '', phone: '', email: '', location: '', creditTermType: 'COD', creditDays: 0 });
        setNewSupplierModalOpen(false);
      } else {
        alert('Failed to create new supplier in database.');
      }
    } catch (err) {
      console.error('Error saving supplier:', err);
    }
  };

  const handleSaveInventory = async (itemToSave) => {
    try {
      const vv = parseItemVarianceValues(itemToSave);
      const normalized = applyVarianceValuesToItem(itemToSave, vv);
      const prev = inventory.find(i => i.id === normalized.id);
      // Optimistic local update so Save feels instant
      setInventory(inventory.map(i => i.id === normalized.id ? normalized : i));
      setSelectedInventoryItem(null);
      logAudit('update', 'inventory', normalized.name || normalized.id);
      if (prev && prev.quantity !== normalized.quantity) logStock(normalized.id, normalized.name, (normalized.quantity||0) - (prev.quantity||0), 'Stock adjust', normalized.id);
      const response = await apiFetch(`/api/inventory/${normalized.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized)
      });
      if (!response.ok) {
        if (prev) setInventory(inventory.map(i => i.id === normalized.id ? prev : i));
        alert('Failed to update inventory item in database.');
      }
    } catch (err) {
      console.error('Error saving inventory:', err);
    }
  };

  const handleDeleteInventory = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const response = await apiFetch(`/api/inventory/${itemId}`, { method: 'DELETE' });
      if (response.ok) {
        setInventory(inventory.filter(i => i.id !== itemId));
        // Remove related stock movement history for this item
        const nextMv = (stockMovements || []).filter(m => m.itemId !== itemId && m.ref !== itemId);
        if (typeof saveStockMovements === 'function') saveStockMovements(nextMv);
        else setStockMovements(nextMv);
        apiFetch('/api/stock-movements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) }).catch(() => {});
        logAudit('delete', 'inventory', itemId);
        setSelectedInventoryItem(null);
      } else {
        alert('Failed to delete inventory item.');
      }
    } catch (err) {
      console.error('Error deleting inventory:', err);
    }
  };

  const handleSaveCustomer = async (customerToSave) => {
    try {
      const prev = customers.find(x => x.id === customerToSave.id);
      setCustomers(customers.map(x => x.id === customerToSave.id ? customerToSave : x));
      setSelectedCustomer(null);
      logAudit('update', 'customer', customerToSave.name || customerToSave.id);
      const response = await apiFetch(`/api/customers/${customerToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerToSave)
      });
      if (!response.ok) {
        if (prev) setCustomers(customers.map(x => x.id === customerToSave.id ? prev : x));
        alert('Failed to update customer in database.');
      }
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      const response = await apiFetch(`/api/customers/${customerId}`, { method: 'DELETE' });
      if (response.ok) {
        setCustomers(customers.filter(c => c.id !== customerId));
        logAudit('delete', 'customer', customerId);
        setSelectedCustomer(null);
      } else {
        alert('Failed to delete customer.');
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
    }
  };

  const persistExpenses = (list) => {
    setExpenses(list);
  };

  const normalizeExpense = (e) => {
    const amount = parseFloat(e.amount) || 0;
    let paid = e.paidAmount;
    if (paid === undefined || paid === null || paid === '') {
      // legacy rows without paidAmount: treat fully paid only if paymentStatus is Paid or missing status with no balanceDue
      if (e.paymentStatus === 'Unpaid') paid = 0;
      else if (e.paymentStatus === 'Partially Paid' && e.balanceDue != null) paid = Math.max(0, amount - (parseFloat(e.balanceDue) || 0));
      else if (e.balanceDue != null && parseFloat(e.balanceDue) > 0) paid = Math.max(0, amount - (parseFloat(e.balanceDue) || 0));
      else paid = amount;
    } else {
      paid = parseFloat(paid) || 0;
    }
    const balanceDue = Math.max(0, amount - paid);
    const paymentStatus = balanceDue <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');
    return { ...e, amount, paidAmount: paid, balanceDue, paymentStatus };
  };

  const handleSaveExpense = async (expenseToSave) => {
    const normalized = normalizeExpense(expenseToSave);
    const exists = (expenses || []).some(e => e.id === normalized.id);
    const nextList = exists
      ? expenses.map(e => e.id === normalized.id ? normalized : e)
      : [normalized, ...(expenses || [])];
    persistExpenses(nextList);
    setSelectedExpenseItem(null);
    try {
      const res = await apiFetch(`/api/expenses/${normalized.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized)
      });
      if (!res.ok) {
        await apiFetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalized)
        });
      }
    } catch (err) {
      try {
        await apiFetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalized)
        });
      } catch (err2) {
        console.warn('Expense saved locally', err2);
      }
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    persistExpenses(expenses.filter(e => e.id !== expenseId));
    setSelectedExpenseItem(null);
    try {
      await apiFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Expense deleted locally', err);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to void/delete this transaction?')) return;
    try {
      const response = await apiFetch(`/api/sales/${saleId}`, { method: 'DELETE' });
      if (response.ok) {
        setSales(sales.filter(s => s.id !== saleId));
        setSelectedSaleItem(null);
        logAudit('delete', 'sale', saleId);
      } else {
        alert('Failed to delete transaction record.');
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
    }
  };

  // --- SETTINGS DATABASE SYNC HANDLERS ---
  const handleSaveShopProfile = async () => {
    try {
      const response = await apiFetch('/api/shop-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopProfile)
      });
      if (response.ok) {
        if (tenantInfo && shopProfile.name) {
          const nextTenant = { ...tenantInfo, name: shopProfile.name };
          setTenantInfo(nextTenant);
          try { localStorage.setItem('erp_tenant', JSON.stringify(nextTenant)); } catch (e) {}
        }
        alert('Business profile updated and saved to database successfully!');
      } else {
        alert('Failed to update business profile in database.');
      }
    } catch (err) {
      console.error('Error saving shop profile:', err);
      alert('Failed to update business profile in database.');
    }
  };

  const handleSaveUser = async (userToSave) => {
    try {
      const response = await apiFetch(`/api/users/${userToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userToSave)
      });
      if (response.ok) {
        const { pin, ...safeUser } = userToSave;
        setUsers(users.map(u => u.id === userToSave.id ? { ...u, ...safeUser, pin: undefined } : u));
        setSelectedUser(null);
      } else {
        alert('Failed to update user.');
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateNewUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.pin) return;
    const userObj = {
      id: `u-${Date.now()}`,
      ...newUserForm
    };
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userObj)
      });
      if (response.ok) {
        const { pin, ...safeUser } = userObj;
        setUsers([...users, safeUser]);
        setNewUserForm({ name: '', role: 'Salesperson', pin: '', phone: '', status: 'Active', allowedBranches: [] });
        setAddUserModalOpen(false);
      } else {
        alert('Failed to create new user in database.');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const response = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
        setSelectedUser(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateNewRole = async (e) => {
    e.preventDefault();
    if (!newRoleForm.name) return;
    const roleObj = {
      id: `role-${Date.now()}`,
      name: newRoleForm.name,
      privileges: {
        dashboard: {view:false, create:false, update:false, delete:false, ownOnly:false},
        pos: {view:true, create:true, update:false, delete:false, ownOnly:true},
        sales: {view:true, create:false, update:false, delete:false, ownOnly:true},
        inventory: {view:true, create:false, update:false, delete:false, ownOnly:false},
        expenses: {view:false, create:false, update:false, delete:false, ownOnly:false},
        laybys: {view:true, create:true, update:false, delete:false, ownOnly:true},
        customers: {view:true, create:true, update:false, delete:false, ownOnly:false},
        suppliers: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reports: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reportSales: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reportPurchase: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reportExpense: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reportHr: {view:false, create:false, update:false, delete:false, ownOnly:false},
        reportCustomer: {view:false, create:false, update:false, delete:false, ownOnly:false},
        settings: {view:false, create:false, update:false, delete:false, ownOnly:false},
        purchase: {view:false, create:false, update:false, delete:false, ownOnly:false},
        employees: {view:false, create:false, update:false, delete:false, ownOnly:false},
        payroll: {view:false, create:false, update:false, delete:false, ownOnly:false},
        hr: {view:false, create:false, update:false, delete:false, ownOnly:false}
      }
    };
    try {
      const response = await apiFetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleObj)
      });
      if (response.ok) {
        setRoles([...roles, roleObj]);
        setNewRoleForm({ name: '' });
        setAddRoleModalOpen(false);
      } else {
        alert('Failed to create new role.');
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveRole = async (roleToSave) => {
    try {
      const allKeys = ['dashboard','pos','sales','inventory','expenses','laybys','customers','suppliers','reports','reportComprehensive','reportSales','reportPurchase','reportExpense','reportHr','reportCustomer','reportSalesMostItems','reportSalesMostCategories','reportSalesDormant','reportSalesBestPeople','reportSalesKpis','reportSalesPeople','reportSalesCreditsLayby','reportSalesTax','reportPurchaseSummary','reportPurchaseByCategory','reportPurchaseCogs','reportPurchaseUnpaid','reportPurchaseTax','reportExpenseHighCategories','reportExpenseFrequent','reportExpenseUnpaid','reportExpenseTax','reportHrSummary','reportHrLeaveSalary','reportCustomerStatement','reportInventory','reportAging','reportFinancial','reportLedger','settings','purchase','employees','payroll','hr'];
      const mergedPrivs = {};
      allKeys.forEach(k => {
        const p = roleToSave.privileges?.[k];
        mergedPrivs[k] = p && typeof p === 'object'
          ? { view: !!p.view, create: !!p.create, update: !!p.update, delete: !!p.delete, ownOnly: p.ownOnly === true }
          : { view: false, create: false, update: false, delete: false, ownOnly: false };
      });
      const payload = { ...roleToSave, privileges: mergedPrivs };
      const response = await apiFetch(`/api/roles/${roleToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setRoles(roles.map(r => r.id === roleToSave.id ? payload : r));
        setSelectedRole(null);
        alert('Role privileges saved. User must log in again to apply changes.');
      } else {
        alert('Failed to update role privileges.');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      const response = await apiFetch(`/api/roles/${roleId}`, { method: 'DELETE' });
      if (response.ok) {
        setRoles(roles.filter(r => r.id !== roleId));
        setSelectedRole(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateNewCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryForm.name) return;
    const catObj = {
      id: `cat-${Date.now()}`,
      ...newCategoryForm
    };
    try {
      const response = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catObj)
      });
      if (response.ok) {
        setCategories([...categories, catObj]);
        setNewCategoryForm({ name: '', status: 'Active' });
        setAddCategoryModalOpen(false);
      } else {
        alert('Failed to create new category.');
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveCategory = async (catToSave) => {
    try {
      const response = await apiFetch(`/api/categories/${catToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catToSave)
      });
      if (response.ok) {
        setCategories(categories.map(c => c.id === catToSave.id ? catToSave : c));
        setSelectedCategory(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const response = await apiFetch(`/api/categories/${catId}`, { method: 'DELETE' });
      if (response.ok) {
        setCategories(categories.filter(c => c.id !== catId));
        setSelectedCategory(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateNewStatus = async (e) => {
    e.preventDefault();
    if (!newStatusForm.name) return;
    const stObj = {
      id: `st-${Date.now()}`,
      ...newStatusForm
    };
    try {
      const response = await apiFetch('/api/item-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stObj)
      });
      if (response.ok) {
        setItemStatuses([...itemStatuses, stObj]);
        setNewStatusForm({ name: '', canSell: true, status: 'Active' });
        setAddStatusModalOpen(false);
      } else {
        alert('Failed to create item status.');
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveExpenseCategory = async (ecToSave) => {
    try {
      const response = await apiFetch(`/api/expense-categories/${ecToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ecToSave)
      });
      if (response.ok) {
        setExpenseCategories(expenseCategories.map(ec => ec.id === ecToSave.id ? ecToSave : ec));
        setSelectedExpenseCategory(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteExpenseCategory = async (ecId) => {
    if (!window.confirm('Are you sure you want to delete this expense category?')) return;
    try {
      const response = await apiFetch(`/api/expense-categories/${ecId}`, { method: 'DELETE' });
      if (response.ok) {
        setExpenseCategories(expenseCategories.filter(ec => ec.id !== ecId));
        setSelectedExpenseCategory(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveItemStatus = async (stToSave) => {
    try {
      const response = await apiFetch(`/api/item-statuses/${stToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stToSave)
      });
      if (response.ok) {
        setItemStatuses(itemStatuses.map(st => st.id === stToSave.id ? stToSave : st));
        setSelectedItemStatus(null);
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteItemStatus = async (stId) => {
    if (!window.confirm('Are you sure you want to delete this item status?')) return;
    try {
      const response = await apiFetch(`/api/item-statuses/${stId}`, { method: 'DELETE' });
      if (response.ok) {
        setItemStatuses(itemStatuses.filter(st => st.id !== stId));
        setSelectedItemStatus(null);
      }
    } catch (err) { console.error(err); }
  };

  const resolveRowBranchId = (row) => {
    if (row?.branchId) return row.branchId;
    const def = (branches || []).find(b => b.isDefault) || (branches || [])[0];
    return def ? def.id : '';
  };
  // Early location privilege list (same source as role privileges; empty = all locations)
  const earlyAllowedBranchIds = (() => {
    try {
      if ((currentUser?.role || '').toLowerCase() === 'admin') return null;
      // Prefer per-user location links when set
      let userBranches = currentUser?.allowedBranches;
      try { if (typeof userBranches === 'string') userBranches = JSON.parse(userBranches || '[]'); } catch (e) { userBranches = []; }
      if (Array.isArray(userBranches) && userBranches.length) return userBranches.map(String);
      let priv = loginPrivileges;
      if (!priv || typeof priv !== 'object') {
        const role = (roles || []).find(r => (r.name || '').toLowerCase() === (currentUser?.role || '').toLowerCase());
        priv = role?.privileges;
        if (typeof priv === 'string') { try { priv = JSON.parse(priv); } catch (e) { priv = {}; } }
      }
      const list = priv && Array.isArray(priv.allowedBranches) ? priv.allowedBranches : null;
      return list && list.length ? list.map(String) : null;
    } catch (e) { return null; }
  })();
  const filterByBranch = (list) => {
    if (!list || !Array.isArray(list)) return [];
    let rows = list;
    if (earlyAllowedBranchIds) {
      rows = rows.filter(row => {
        // Rows with no branchId are treated as shared / legacy — always include for allowed users
        if (!row?.branchId) return true;
        const bid = resolveRowBranchId(row);
        return earlyAllowedBranchIds.includes(String(bid));
      });
    }
    if (!currentBranchId || currentBranchId === 'all') return rows;
    return rows.filter(row => {
      // Shared / legacy items (no branchId) visible on every branch
      if (!row?.branchId) return true;
      return resolveRowBranchId(row) === currentBranchId;
    });
  };
  const activeBranchId = (() => {
    if (currentBranchId && currentBranchId !== 'all') {
      if (!earlyAllowedBranchIds || earlyAllowedBranchIds.includes(String(currentBranchId))) return currentBranchId;
    }
    const pool = (branches || []).filter(b => !earlyAllowedBranchIds || earlyAllowedBranchIds.includes(String(b.id)));
    const def = pool.find(b => b.isDefault) || pool[0];
    return def ? def.id : '';
  })();

  // Normalize sale line items (API / localStorage may store JSON string)
  const parseSaleItems = (saleOrItems) => {
    const raw = saleOrItems && typeof saleOrItems === 'object' && !Array.isArray(saleOrItems) ? saleOrItems.items : saleOrItems;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; } catch (e) { return []; }
    }
    return [];
  };
  const isTrackedInventory = (item) => {
    const t = item?.trackInventory;
    return t === true || t === 1 || t === '1' || t === 'true';
  };

  // Fixed Date Range Filtering Helper
  const filterByTimeframe = (items, dateKey = 'date') => {
    const now = new Date();
    return items.filter(item => {
      if (!item[dateKey]) return true;
      const itemDate = new Date(item[dateKey]);
      if (Number.isNaN(itemDate.getTime())) return true;
      if (dashboardTimeframe === 'today') {
        return itemDate.getFullYear() === now.getFullYear() &&
               itemDate.getMonth() === now.getMonth() &&
               itemDate.getDate() === now.getDate();
      }
      if (dashboardTimeframe === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return itemDate >= startOfWeek && itemDate <= endOfWeek;
      }
      if (dashboardTimeframe === 'this_month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      if (dashboardTimeframe === 'custom') {
        if (!dashCustomStartDate || !dashCustomEndDate) return true;
        const start = new Date(dashCustomStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dashCustomEndDate);
        end.setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      }
      return true;
    });
  };

  // Expenses Tab History Filter Helper
  const filterExpensesHistory = (items) => {
    const now = new Date();
    return items.filter(item => {
      if (item.date) {
        const itemDate = new Date(item.date);
        if (expenseTimeframe === 'today') {
          if (!(itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth() && itemDate.getDate() === now.getDate())) return false;
        } else if (expenseTimeframe === 'this_week') {
          const startOfWeek = new Date(now);
          startOfWeek.setHours(0, 0, 0, 0);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          if (!(itemDate >= startOfWeek && itemDate <= endOfWeek)) return false;
        } else if (expenseTimeframe === 'this_month') {
          if (!(itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear())) return false;
        } else if (expenseTimeframe === 'custom') {
          if (expenseCustomStartDate && expenseCustomEndDate) {
            const start = new Date(expenseCustomStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(expenseCustomEndDate);
            end.setHours(23, 59, 59, 999);
            if (!(itemDate >= start && itemDate <= end)) return false;
          }
        }
      }
      if (expensePayerFilter && !item.payer?.toLowerCase().includes(expensePayerFilter.toLowerCase())) {
        return false;
      }
      if (expensePaidToFilter && !item.paidTo?.toLowerCase().includes(expensePaidToFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  const branchSales = filterByBranch(sales);
  const branchExpenses = filterByBranch(expenses);
  const branchInventory = filterByBranch(inventory);
  const branchPurchaseOrders = filterByBranch(purchaseOrders);
  const branchEmployees = filterByBranch(employees);
  const filteredSales = filterByTimeframe(branchSales, 'date');
  const filteredExpenses = filterByTimeframe(branchExpenses, 'date');
  const historyFilteredExpenses = filterExpensesHistory(branchExpenses);

  // Report Date Filtering Helper
  const filterByReportTimeframe = (items, dateKey = 'date') => {
    const now = new Date();
    return items.filter(item => {
      if (!item[dateKey]) return true;
      const itemDate = new Date(item[dateKey]);
      if (Number.isNaN(itemDate.getTime())) return true;
      if (reportTimeframe === 'today') {
        return itemDate.getFullYear() === now.getFullYear() &&
               itemDate.getMonth() === now.getMonth() &&
               itemDate.getDate() === now.getDate();
      }
      if (reportTimeframe === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return itemDate >= startOfWeek && itemDate <= endOfWeek;
      }
      if (reportTimeframe === 'this_month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      if (reportTimeframe === 'custom') {
        if (!reportStartDate || !reportEndDate) return true;
        const start = new Date(reportStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      }
      return true;
    });
  };

  const reportFilteredSales = filterByReportTimeframe(branchSales, 'date');
  const reportFilteredExpenses = filterByReportTimeframe(branchExpenses, 'date');
  const reportFilteredPO = filterByReportTimeframe(branchPurchaseOrders, 'date');

  const reportTotalRevenue = reportFilteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const reportTotalCogs = reportFilteredSales.reduce((acc, s) => acc + (parseSaleItems(s).reduce((iAcc, item) => iAcc + (Number(item.cogs) || 0) * Math.max(0, (Number(item.qty) || 1) - (Number(item.returnedSaleableQty) || 0)), 0)), 0);
  const reportGrossProfit = reportTotalRevenue - reportTotalCogs;
  const reportTotalOperatingExpenses = reportFilteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const reportNetProfit = reportGrossProfit - reportTotalOperatingExpenses;

  // Safe Financial Calculations
  const totalRevenue = filteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const totalCogs = filteredSales.reduce((acc, s) => acc + (parseSaleItems(s).reduce((iAcc, item) => iAcc + (Number(item.cogs) || 0) * Math.max(0, (Number(item.qty) || 1) - (Number(item.returnedSaleableQty) || 0)), 0)), 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalOperatingExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  const cashPm = paymentMethods.find(p => p.name === 'Cash');
  const mpesaPm = paymentMethods.find(p => p.name === 'M-Pesa' || p.name === 'Mpesa');
  const cashStart = (cashPm?.currentBalance != null && cashPm.currentBalance !== '' ? cashPm.currentBalance : cashPm?.startingBalance) || 0;
  const mpesaStart = (mpesaPm?.currentBalance != null && mpesaPm.currentBalance !== '' ? mpesaPm.currentBalance : mpesaPm?.startingBalance) || 0;
  const cashSalesTotal = filteredSales.filter(s => s.paymentMethod === 'Cash' || s.paymentMethod?.includes('Cash')).reduce((sum, s) => sum + (s.paidAmount || s.totalAmount || 0), 0);
  const mpesaSalesTotal = filteredSales.filter(s => s.paymentMethod === 'M-Pesa' || s.paymentMethod?.includes('M-Pesa')).reduce((sum, s) => sum + (s.paidAmount || s.totalAmount || 0), 0);
  const cashExpensesTotal = filteredExpenses.filter(e => e.paymentMethod === 'Cash').reduce((sum, e) => sum + (parseFloat(e.paidAmount ?? e.amount) || 0), 0);
  const mpesaExpensesTotal = filteredExpenses.filter(e => e.paymentMethod === 'M-Pesa' || e.paymentMethod?.includes('M-Pesa')).reduce((sum, e) => sum + (parseFloat(e.paidAmount ?? e.amount) || 0), 0);

  const cashAtHandAccount = (parseFloat(cashStart) || 0) + cashSalesTotal - cashExpensesTotal;
  const mpesaAccountBalance = (parseFloat(mpesaStart) || 0) + mpesaSalesTotal - mpesaExpensesTotal;

  // Most Selling Items Calculation for Dashboard (Top 5)
  const dashboardItemSalesMap = {};
  filteredSales.forEach(s => {
    parseSaleItems(s).forEach(i => {
      const key = i.name;
      if (!key) return;
      if (!dashboardItemSalesMap[key]) {
        dashboardItemSalesMap[key] = { name: key, qty: 0, total: 0 };
      }
      const qty = i.qty || 1;
      dashboardItemSalesMap[key].qty += qty;
      dashboardItemSalesMap[key].total += (i.price * qty);
    });
  });
  const topSellingItems = Object.values(dashboardItemSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Top 5 Selling Item Categories for Dashboard
  const dashboardCategoryMap = {};
  filteredSales.forEach(s => {
    parseSaleItems(s).forEach(i => {
      const cat = i.category || 'Uncategorized';
      if (!dashboardCategoryMap[cat]) {
        dashboardCategoryMap[cat] = { category: cat, totalSales: 0, qty: 0 };
      }
      const qty = i.qty || 1;
      dashboardCategoryMap[cat].totalSales += (i.price * qty);
      dashboardCategoryMap[cat].qty += qty;
    });
  });
  const topSellingCategories = Object.values(dashboardCategoryMap).sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);

  // Top 5 Customers for Dashboard
  const dashboardCustomerMap = {};
  filteredSales.forEach(s => {
    const cust = s.customerName || 'Walk-in';
    if (!dashboardCustomerMap[cust]) {
      dashboardCustomerMap[cust] = { name: cust, totalSpent: 0, ordersCount: 0 };
    }
    dashboardCustomerMap[cust].totalSpent += (s.totalAmount || 0);
    dashboardCustomerMap[cust].ordersCount += 1;
  });
  const topCustomersList = Object.values(dashboardCustomerMap).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

  // 10 Low Stock Alerts list for Dashboard & Inventory

  const lowStockAlertList = (inventory || []).filter(i => isTrackedInventory(i) && (Number(i.quantity) || 0) <= (Number(i.lowStockAlert) || 3)).slice(0, 10);
  // Report helpers (Inventory / Sales by location / Expense by location / Payroll breakdown)
  const reportFilteredInventory = filterByBranch(inventory || []);
  const inventoryValuationRows = (reportFilteredInventory || []).map(i => {
    const qty = Number(i.quantity) || 0;
    const cost = Number(i.buyingPrice) || 0;
    return { id: i.id, name: i.name, category: i.category || '—', qty, cost, value: qty * cost, branchId: i.branchId || '' };
  });
  const inventoryValuationTotal = inventoryValuationRows.reduce((s, r) => s + r.value, 0);
  const soldItemIds = new Set();
  (reportFilteredSales || []).forEach(s => {
    try {
      const items = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);
      (items || []).forEach(it => { if (it.id) soldItemIds.add(String(it.id)); if (it.name) soldItemIds.add(String(it.name)); });
    } catch (_) {}
  });
  const deadStockRows = (reportFilteredInventory || []).filter(i => {
    if (!isTrackedInventory(i)) return false;
    const id = String(i.id || '');
    const name = String(i.name || '');
    return !soldItemIds.has(id) && !soldItemIds.has(name);
  }).slice(0, 50);
  const stockBalanceRows = inventoryValuationRows.slice().sort((a, b) => (b.qty || 0) - (a.qty || 0));
  const branchStockValuation = {};
  inventoryValuationRows.forEach(r => {
    const key = r.branchId || 'default';
    if (!branchStockValuation[key]) branchStockValuation[key] = { branchId: key, value: 0, qty: 0, items: 0 };
    branchStockValuation[key].value += r.value;
    branchStockValuation[key].qty += r.qty;
    branchStockValuation[key].items += 1;
  });
  const branchStockValuationList = Object.values(branchStockValuation).map(b => ({
    ...b,
    name: (branches || []).find(x => x.id === b.branchId)?.name || (b.branchId === 'default' ? 'Default / Unassigned' : b.branchId)
  }));
  const salesByLocationMap = {};
  (reportFilteredSales || []).forEach(s => {
    const key = s.branchId || 'default';
    if (!salesByLocationMap[key]) salesByLocationMap[key] = { branchId: key, revenue: 0, cogs: 0, count: 0 };
    salesByLocationMap[key].revenue += Number(s.totalAmount) || 0;
    salesByLocationMap[key].count += 1;
    try {
      const items = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);
      (items || []).forEach(it => {
        const qty = Number(it.qty) || 0;
        salesByLocationMap[key].cogs += (Number(it.cogs != null ? it.cogs : it.buyingPrice) || 0) * qty;
      });
    } catch (_) {}
  });
  const salesByLocationList = Object.values(salesByLocationMap).map(r => {
    const gp = r.revenue - r.cogs;
    return {
      ...r,
      name: (branches || []).find(x => x.id === r.branchId)?.name || (r.branchId === 'default' ? 'Default / Unassigned' : r.branchId),
      grossProfit: gp,
      marginPct: r.revenue > 0 ? (gp / r.revenue) * 100 : 0
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const expenseByLocationCategory = {};
  (reportFilteredExpenses || []).forEach(e => {
    const loc = e.branchId || 'default';
    const cat = e.category || 'Other';
    const key = loc + '||' + cat;
    if (!expenseByLocationCategory[key]) expenseByLocationCategory[key] = { branchId: loc, category: cat, amount: 0, count: 0 };
    expenseByLocationCategory[key].amount += Number(e.amount) || 0;
    expenseByLocationCategory[key].count += 1;
  });
  const expenseByLocationCategoryList = Object.values(expenseByLocationCategory).map(r => ({
    ...r,
    branchName: (branches || []).find(x => x.id === r.branchId)?.name || (r.branchId === 'default' ? 'Default / Unassigned' : r.branchId)
  })).sort((a, b) => b.amount - a.amount).slice(0, 40);
  // Purchase price variation: same item across POs with different unit costs
  const poCostByItem = {};
  (reportFilteredPO || []).forEach(po => {
    const name = po.itemName || po.itemId || 'Item';
    const cost = Number(po.cost) || 0;
    if (!cost) return;
    if (!poCostByItem[name]) poCostByItem[name] = [];
    poCostByItem[name].push(cost);
  });
  const purchasePriceVariationList = Object.entries(poCostByItem).map(([name, costs]) => {
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    const avg = costs.reduce((s, n) => s + n, 0) / costs.length;
    return { name, min, max, avg, variation: max - min, variationPct: avg > 0 ? ((max - min) / avg) * 100 : 0, samples: costs.length };
  }).filter(r => r.samples > 1 || r.variation > 0).sort((a, b) => b.variation - a.variation).slice(0, 30);
  const payrollAllowancesTotals = {};
  const payrollDeductionsTotals = {};
  (payrollRecords || []).forEach(p => {
    // optional period filter via report dates
    const pd = String(p.period || p.paidDate || p.date || '');
    if (reportTimeframe === 'custom' && reportStartDate && reportEndDate) {
      const d = pd.slice(0, 10);
      if (d && (d < reportStartDate || d > reportEndDate)) return;
    }
    let ab = p.allowanceBreakdown, db = p.deductionBreakdown;
    try { if (typeof ab === 'string') ab = JSON.parse(ab || '{}'); } catch (_) { ab = {}; }
    try { if (typeof db === 'string') db = JSON.parse(db || '{}'); } catch (_) { db = {}; }
    ab = ab || {}; db = db || {};
    const aNames = ['Housing', 'Transport', 'Airtime', 'Bonus', 'Other'];
    const dNames = ['PAYE', 'NHL/Housing Levy', 'NSSF', 'SHA', 'Loan', 'Pension', 'Other'];
    Object.entries(ab).forEach(([k, v]) => {
      if (k === '_otherSpec') return;
      const label = /^\d+$/.test(k) ? (aNames[Number(k)] || k) : k;
      const n = parseFloat(typeof v === 'object' ? (v.amount ?? v.value) : v) || 0;
      payrollAllowancesTotals[label] = (payrollAllowancesTotals[label] || 0) + n;
    });
    Object.entries(db).forEach(([k, v]) => {
      if (k === '_otherSpec') return;
      const label = /^\d+$/.test(k) ? (dNames[Number(k)] || k) : k;
      const n = parseFloat(typeof v === 'object' ? (v.amount ?? v.value) : v) || 0;
      payrollDeductionsTotals[label] = (payrollDeductionsTotals[label] || 0) + n;
    });
    // fallback totals if no breakdown
    if (!Object.keys(ab).length && (parseFloat(p.allowances) || 0) > 0) {
      payrollAllowancesTotals['Allowances (total)'] = (payrollAllowancesTotals['Allowances (total)'] || 0) + (parseFloat(p.allowances) || 0);
    }
    if (!Object.keys(db).length && (parseFloat(p.deductions) || 0) > 0) {
      payrollDeductionsTotals['Deductions (total)'] = (payrollDeductionsTotals['Deductions (total)'] || 0) + (parseFloat(p.deductions) || 0);
    }
  });

  const exportCSV = (filename, rows) => {
    if (!rows || !rows.length) { alert('No data to export.'); return; }
    const keys = Object.keys(rows[0]);
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [keys.join(',')].concat(rows.map(r => keys.map(k => esc(r[k])).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  /** Open a print-ready report window so the user can Save as PDF */
  const downloadBlobFile = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  // Real PDF table export (no external libs) — landscape A4, aligned columns
  const buildTablePdf = (title, headers, rows) => {
    const esc = (s) => String(s ?? '')
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    const shop = shopProfile?.name || tenantInfo?.name || 'NEO ERP';
    const meta = 'Generated ' + new Date().toLocaleString();
    // Landscape A4
    const pageWidth = 842;
    const pageHeight = 595;
    const marginX = 28;
    const marginY = 28;
    const usableW = pageWidth - marginX * 2;
    const cols = (headers || []).map(h => String(h));
    const colCount = Math.max(1, cols.length);
    // Measure preferred widths from header + sample rows
    const sample = [cols, ...(rows || []).slice(0, 30).map(r => cols.map(h => String(r[h] ?? r[cols.indexOf(h)] ?? '')))];
    const rawW = cols.map((h, i) => {
      let max = String(h).length;
      sample.forEach(r => { const v = Array.isArray(r) ? r[i] : r[h]; max = Math.max(max, String(v ?? '').length); });
      return Math.min(28, Math.max(6, max + 1));
    });
    const totalRaw = rawW.reduce((a, b) => a + b, 0) || 1;
    const colW = rawW.map(w => (w / totalRaw) * usableW);
    const fontSize = colCount > 8 ? 7 : (colCount > 6 ? 8 : 9);
    const lineH = fontSize + 5;
    const pages = [];
    let y = pageHeight - marginY;
    let ops = []; // drawing ops for current page

    const newPage = () => {
      if (ops.length) pages.push(ops);
      ops = [];
      y = pageHeight - marginY;
    };
    const drawText = (str, x, yy, size, bold) => {
      ops.push({ type: 'text', str: esc(String(str ?? '')).slice(0, 80), x, y: yy, size, bold: !!bold });
    };
    const drawLine = (x1, y1, x2, y2) => {
      ops.push({ type: 'line', x1, y1, x2, y2 });
    };
    const drawHeaderBlock = () => {
      drawText(shop, marginX, y, 13, true);
      y -= 16;
      drawText(title, marginX, y, 11, true);
      y -= 13;
      drawText(meta, marginX, y, 8, false);
      y -= 14;
      drawLine(marginX, y + 4, pageWidth - marginX, y + 4);
      y -= 6;
      // column headers
      let x = marginX;
      cols.forEach((h, i) => {
        drawText(h, x + 2, y, fontSize, true);
        x += colW[i];
      });
      y -= 3;
      drawLine(marginX, y, pageWidth - marginX, y);
      y -= lineH;
    };

    drawHeaderBlock();
    (rows || []).forEach((row) => {
      if (y < marginY + lineH * 2) {
        newPage();
        drawHeaderBlock();
      }
      let x = marginX;
      cols.forEach((h, i) => {
        let val = row[h];
        if (val == null && Array.isArray(row)) val = row[i];
        if (val == null) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        // fit roughly by character width ~0.5*fontSize
        const maxChars = Math.max(4, Math.floor(colW[i] / (fontSize * 0.5)) - 1);
        let s = String(val);
        if (s.length > maxChars) s = s.slice(0, maxChars - 1) + '…';
        drawText(s, x + 2, y, fontSize, false);
        x += colW[i];
      });
      y -= lineH;
    });
    if (ops.length) pages.push(ops);

    // Build PDF objects
    const objs = [];
    objs[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    objs[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
    objs[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';
    const pageIds = [];
    let nextId = 5;
    pages.forEach((pageOps) => {
      let stream = '';
      pageOps.forEach(op => {
        if (op.type === 'line') {
          stream += `${op.x1.toFixed(2)} ${op.y1.toFixed(2)} m ${op.x2.toFixed(2)} ${op.y2.toFixed(2)} l S\n`;
        } else if (op.type === 'text') {
          const font = op.bold ? '/F2' : '/F1';
          stream += `BT\n${font} ${op.size} Tf\n1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm\n(${op.str}) Tj\nET\n`;
        }
      });
      const cId = nextId++;
      objs[cId] = `${cId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
      const pId = nextId++;
      pageIds.push(pId);
      objs[pId] = `${pId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`;
    });
    const kids = pageIds.map(id => `${id} 0 R`).join(' ');
    objs[2] = `2 0 obj\n<< /Type /Pages /Kids [ ${kids} ] /Count ${pageIds.length} >>\nendobj\n`;
    let body = '%PDF-1.4\n';
    const off = [0];
    for (let i = 1; i < nextId; i++) {
      off[i] = body.length;
      body += objs[i] || `${i} 0 obj\n<< >>\nendobj\n`;
    }
    const xrefStart = body.length;
    body += `xref\n0 ${nextId}\n`;
    body += '0000000000 65535 f \n';
    for (let i = 1; i < nextId; i++) {
      body += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    }
    body += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([body], { type: 'application/pdf' });
  };
  const downloadReportPdf = (title, tableHtml, extraHtml = '') => {
    // Parse HTML table into headers + rows when possible
    const headers = [];
    const rows = [];
    const tmp = String(tableHtml || '');
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m; let isFirst = true;
    while ((m = rowRe.exec(tmp))) {
      const cells = [];
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let c;
      while ((c = cellRe.exec(m[1]))) cells.push(c[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim());
      if (!cells.length) continue;
      if (isFirst) { cells.forEach(h => headers.push(h)); isFirst = false; }
      else {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
        rows.push(obj);
      }
    }
    if (!headers.length) {
      const lines = [];
      if (extraHtml) lines.push(String(extraHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (tmp) lines.push(tmp.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const safeTitle = String(title || 'Report').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
      downloadBlobFile(safeTitle + '.pdf', buildTablePdf(title, ['Details'], lines.map(l => ({ Details: l }))));
      return;
    }
    const safeTitle = String(title || 'Report').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
    downloadBlobFile(safeTitle + '.pdf', buildTablePdf(title, headers, rows));
  };
  const exportRowsAsPdf = (title, rows) => {
    if (!rows || !rows.length) { alert('No data to export.'); return; }
    // Prefer friendly column labels
    const keys = Object.keys(rows[0]);
    const labelMap = {
      id: 'ID', date: 'Date', category: 'Category', description: 'Description', amount: 'Amount',
      paid: 'Paid', balance: 'Balance', status: 'Status', method: 'Method', payer: 'Payer',
      customer: 'Customer', type: 'Type', total: 'Total', payment: 'Payment', cashier: 'Cashier',
      supplier: 'Supplier', item: 'Item', qty: 'Qty', mpesa: 'M-Pesa TXN', employee: 'Employee',
      period: 'Period', basic: 'Basic', allowances: 'Allowances', deductions: 'Deductions', net: 'Net',
      when: 'When', reason: 'Reason', ref: 'Ref', user: 'User', qtyChange: 'Qty Change'
    };
    const headers = keys.map(k => labelMap[k] || k);
    const normalized = rows.map(r => {
      const o = {};
      keys.forEach((k, i) => { o[headers[i]] = r[k]; });
      return o;
    });
    const safeTitle = String(title || 'Report').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
    downloadBlobFile(safeTitle + '.pdf', buildTablePdf(title, headers, normalized));
  };

  const supplierPerformanceList = (suppliers || []).map(sup => {
    const pos = (purchaseOrders || []).filter(po => po.supplierName === sup.name || po.supplierId === sup.id);
    const totalSpend = pos.reduce((s, po) => s + (parseFloat(po.totalAmount) || parseFloat(po.amount) || ((parseFloat(po.unitCost)||0) * (parseFloat(po.quantity)||0)) || 0), 0);
    const returned = pos.filter(po => (po.workflowStatus || '') === 'Purchase Return' || (parseFloat(po.returnedQty) || 0) > 0);
    const received = pos.filter(po => ['Received', 'Payment', 'Purchase Return'].includes(po.workflowStatus) || po.received);
    const onTime = received.filter(po => {
      if (!po.expectedDate || !po.receivedDate) return true;
      return String(po.receivedDate).slice(0,10) <= String(po.expectedDate).slice(0,10);
    });
    const returnRate = pos.length ? (returned.length / pos.length) * 100 : 0;
    const onTimeRate = received.length ? (onTime.length / received.length) * 100 : (pos.length ? 100 : 0);
    return { id: sup.id, name: sup.name, orders: pos.length, totalSpend, returnRate, onTimeRate, returnedCount: returned.length, receivedCount: received.length };
  }).sort((a, b) => b.totalSpend - a.totalSpend);
  const getItemPrice = (item, list = 'retail') => {
    if (list === 'wholesale' && item.wholesalePrice != null && item.wholesalePrice !== '') return parseFloat(item.wholesalePrice) || parseFloat(item.price) || 0;
    return parseFloat(item.price) || 0;
  };
  const saveTasks = (next) => {
    setTasks(next);
    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: next }) })
      .then(async (res) => { if (!res.ok) { const e = await res.json().catch(() => ({})); console.warn('Task save failed', e); } })
      .catch((err) => console.warn('Task save error', err));
  };
  const saveSalesTargets = (next) => {
    setSalesTargets(next);
    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salesTargets: next }) }).catch(() => {});
  };
  const saveOfflineQueue = (next) => { setOfflineQueue(next); try { localStorage.setItem('erp_offline_queue', JSON.stringify(next)); } catch (e) {} };
  const saveEtims = (next) => {
    setEtimsSettings(next);
    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etims: next }) }).catch(() => {});
  };
  const saveLoyalty = (next) => {
    setLoyaltySettings(next);
    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loyalty: next }) }).catch(() => {});
  };
  const laybyReminderList = (sales || []).filter(s => {
    const due = parseFloat(s.balanceDue) || Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0));
    if (due <= 0) return false;
    const t = (s.saleType || s.type || '');
    return t === 'Layby' || t === 'Credit';
  }).map(s => {
    const deadline = String(s.deadline || s.dueDate || '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    let bucket = 'open';
    if (deadline) {
      if (deadline < today) bucket = 'overdue';
      else {
        const in7 = new Date(); in7.setDate(in7.getDate() + 7);
        if (deadline <= in7.toISOString().slice(0, 10)) bucket = 'due_soon';
      }
    }
    return { ...s, _due: parseFloat(s.balanceDue) || 0, _deadline: deadline, _bucket: bucket };
  }).sort((a, b) => String(a._deadline).localeCompare(String(b._deadline)));
  const deadStockList = (inventory || []).filter(i => isTrackedInventory(i)).map(item => {
    const sold = (sales || []).some(s => {
      return parseSaleItems(s).some(ii => ii.id === item.id || ii.name === item.name);
    });
    const val = (parseFloat(item.quantity) || 0) * (parseFloat(item.cogs) || parseFloat(item.buyingPrice) || parseFloat(item.price) || 0);
    return { ...item, hasSales: sold, stockValue: val };
  }).filter(i => !i.hasSales && (parseFloat(i.quantity) || 0) > 0);
  const deadStockValue = deadStockList.reduce((s, i) => s + (i.stockValue || 0), 0);
  const saveCashUps = (next) => {
    setCashUpHistory(next);
    apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cashups: next }) }).catch(() => {});
  };
  const agingBucket = (deadlineOrDate) => {
    const d = String(deadlineOrDate || '').slice(0, 10);
    if (!d) return 'no_date';
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(d + 'T00:00:00');
    const days = Math.floor((today - due) / 86400000);
    if (days <= 0) return 'current';
    if (days <= 30) return '0_30';
    if (days <= 60) return '31_60';
    return '60_plus';
  };
  const agingSales = (sales || []).filter(s => {
    const due = parseFloat(s.balanceDue) || Math.max(0, (parseFloat(s.totalAmount)||0) - (parseFloat(s.paidAmount)||0));
    return due > 0;
  }).map(s => {
    const due = parseFloat(s.balanceDue) || Math.max(0, (parseFloat(s.totalAmount)||0) - (parseFloat(s.paidAmount)||0));
    const bucket = agingBucket(s.deadline || s.dueDate || s.date);
    return { kind: 'sale', id: s.id, party: s.customerName, type: s.saleType || s.type, due, date: s.date, deadline: s.deadline || s.dueDate, bucket };
  });
  const agingPOs = (purchaseOrders || []).filter(po => (parseFloat(po.balanceDue) || 0) > 0).map(po => ({
    kind: 'purchase', id: po.id, party: po.supplierName, type: po.workflowStatus, due: parseFloat(po.balanceDue) || 0, date: po.date, deadline: po.expectedDate || po.date, bucket: agingBucket(po.expectedDate || po.date)
  }));
  const agingExpenses = (expenses || []).filter(e => (parseFloat(e.balanceDue) || 0) > 0 || (e.paymentStatus && e.paymentStatus !== 'Paid')).map(e => {
    const due = parseFloat(e.balanceDue) || Math.max(0, (parseFloat(e.amount)||0) - (parseFloat(e.paidAmount)||0));
    if (due <= 0) return null;
    return { kind: 'expense', id: e.id, party: e.paidTo || e.category, type: e.category, due, date: e.date, deadline: e.date, bucket: agingBucket(e.date) };
  }).filter(Boolean);
  const agingAll = [...agingSales, ...agingPOs, ...agingExpenses];
  const agingTotals = { current: 0, '0_30': 0, '31_60': 0, '60_plus': 0, no_date: 0 };
  agingAll.forEach(r => { agingTotals[r.bucket] = (agingTotals[r.bucket] || 0) + (r.due || 0); });

  const periodBounds = (mode) => {
    const now = new Date();
    if (mode === 'last_year') {
      const y = now.getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
    }
    // last_month
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const iso = (x) => x.toISOString().slice(0, 10);
    return { start: iso(d), end: iso(end), label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) };
  };
  const comparePeriod = periodBounds(dashboardCompareMode);
  const compareSalesTotal = (sales || []).filter(s => {
    const d = String(s.date || '').slice(0, 10);
    return d >= comparePeriod.start && d <= comparePeriod.end;
  }).reduce((s, x) => s + (parseFloat(x.totalAmount) || 0), 0);
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const currentMonthSalesTotal = (sales || []).filter(s => String(s.date || '').slice(0, 10) >= currentMonthStart).reduce((s, x) => s + (parseFloat(x.totalAmount) || 0), 0);
  const staffSalesThisMonth = {};
  (sales || []).forEach(s => {
    if (String(s.date || '').slice(0, 10) < currentMonthStart) return;
    const who = s.cashier || s.createdBy || 'Staff';
    staffSalesThisMonth[who] = (staffSalesThisMonth[who] || 0) + (parseFloat(s.totalAmount) || 0);
  });
  const payrollStatutorySummary = (() => {
    let paye = 0, nssf = 0, sha = 0;
    (payrollRecords || []).forEach(p => {
      let d = p.deductionItems;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
      d = d || {};
      paye += parseFloat(d.PAYE) || 0;
      nssf += parseFloat(d.NSSF) || 0;
      sha += parseFloat(d.SHA) || 0;
    });
    return { paye, nssf, sha };
  })();
  const buildWhatsAppReceiptText = (sale) => {
    if (!sale) return '';
    const items = Array.isArray(sale.items) ? sale.items : [];
    const lines = items.map(i => `- ${i.name} x${i.cartQty || i.qty || 1} @ ${shopProfile.currency} ${i.price}`).join('\n');
    const locName = (branches || []).find(b => b.id === (sale.branchId || activeBranchId))?.name || shopProfile.location || '';
    return `*${shopProfile.name || 'Shop'}* Receipt\n${locName ? `Location: ${locName}\n` : ''}Invoice: ${sale.invoiceNo || sale.id}\nCustomer: ${sale.customerName || ''}\nDate: ${sale.date || ''}\n${lines}\nTotal: ${shopProfile.currency} ${sale.totalAmount}\nPaid: ${shopProfile.currency} ${sale.paidAmount}\nBalance: ${shopProfile.currency} ${sale.balanceDue}\nThank you!`;
  };



  // Dashboard Expense Categories Calculation (Top 5)
  const dashboardExpenseCategoryMap = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    if (!dashboardExpenseCategoryMap[cat]) {
      dashboardExpenseCategoryMap[cat] = { category: cat, totalAmount: 0 };
    }
    dashboardExpenseCategoryMap[cat].totalAmount += (e.amount || 0);
  });
  const topDashboardExpenseCategories = Object.values(dashboardExpenseCategoryMap).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);

  // Category Breakdown for Reports
  const reportCategoryMap = {};
  reportFilteredSales.forEach(s => {
    parseSaleItems(s).forEach(i => {
      const cat = i.category || 'Uncategorized';
      if (!reportCategoryMap[cat]) {
        reportCategoryMap[cat] = { category: cat, totalSales: 0, totalCogs: 0, qty: 0 };
      }
      const qty = i.qty || 1;
      const rev = i.price * qty;
      const cogs = (Number(i.cogs) || 0) * qty;
      reportCategoryMap[cat].totalSales += rev;
      reportCategoryMap[cat].totalCogs += cogs;
      reportCategoryMap[cat].qty += qty;
    });
  });
  const reportCategoriesList = Object.values(reportCategoryMap).map(c => ({
    ...c,
    grossProfit: c.totalSales - c.totalCogs,
    margin: c.totalSales > 0 ? ((c.totalSales - c.totalCogs) / c.totalSales) * 100 : 0
  })).sort((a, b) => b.totalSales - a.totalSales);

  // Expense Category Breakdown for Reports
  const reportExpenseCategoryMap = {};
  reportFilteredExpenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    if (!reportExpenseCategoryMap[cat]) {
      reportExpenseCategoryMap[cat] = { category: cat, totalAmount: 0, count: 0 };
    }
    reportExpenseCategoryMap[cat].totalAmount += (e.amount || 0);
    reportExpenseCategoryMap[cat].count += 1;
  });
  const reportExpenseCategoriesList = Object.values(reportExpenseCategoryMap).sort((a, b) => b.totalAmount - a.totalAmount);

  // Salesperson Report Calculation for Reports
  const reportSalespersonMap = {};
  reportFilteredSales.forEach(s => {
    const cashier = s.cashier || 'Main Admin';
    if (!reportSalespersonMap[cashier]) {
      reportSalespersonMap[cashier] = { cashier, totalSales: 0, count: 0 };
    }
    reportSalespersonMap[cashier].totalSales += (s.totalAmount || 0);
    reportSalespersonMap[cashier].count += 1;
  });
  const reportSalespeopleList = Object.values(reportSalespersonMap).sort((a, b) => b.totalSales - a.totalSales);

  // Additional Report Calculations
  const reportItemSalesMap = {};
  reportFilteredSales.forEach(s => {
    parseSaleItems(s).forEach(i => {
      const name = i.name;
      if (!name) return;
      if (!reportItemSalesMap[name]) {
        reportItemSalesMap[name] = { name: name, totalSales: 0, qty: 0 };
      }
      const qty = i.qty || 1;
      reportItemSalesMap[name].totalSales += (i.price * qty);
      reportItemSalesMap[name].qty += qty;
    });
  });
  const mostSellingItemsReport = Object.values(reportItemSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const dormantItemsReport = (inventory || []).map(invItem => {
    const soldData = reportItemSalesMap[invItem.name] || { totalSales: 0, qty: 0 };
    return { name: invItem.name, category: invItem.category, totalSales: soldData.totalSales, qty: soldData.qty };
  }).sort((a, b) => a.qty - b.qty).slice(0, 5);

  const frequentExpenseCategoryReport = reportExpenseCategoriesList.map(ec => ({
    category: ec.category,
    times: ec.count,
    amountPaid: ec.totalAmount
  })).sort((a, b) => b.times - a.times);

  // Purchase Report Calculations
  const totalPurchaseAmountReport = reportFilteredPO.reduce((sum, po) => sum + (po.amount || 0), 0);
  const supplierPOFrequencyMap = {};
  reportFilteredPO.forEach(po => {
    const supName = po.supplierName || 'Unknown';
    supplierPOFrequencyMap[supName] = (supplierPOFrequencyMap[supName] || 0) + 1;
  });
  const mostFrequentSupplierReport = Object.entries(supplierPOFrequencyMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const poCategoryBreakdownMap = {};
  reportFilteredPO.forEach(po => {
    const matchedInv = inventory.find(i => i.id === po.itemId || i.name.toLowerCase() === po.itemName.toLowerCase());
    const cat = matchedInv?.category || 'Uncategorized';
    poCategoryBreakdownMap[cat] = (poCategoryBreakdownMap[cat] || 0) + (po.amount || 0);
  });
  const poCategoryBreakdownList = Object.entries(poCategoryBreakdownMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

  // POS Actions
  const addToCart = (item) => {
    const itemStatusObj = itemStatuses.find(st => st.name === item.status);
    if (itemStatusObj && !itemStatusObj.canSell) {
      alert(`Cannot sell "${item.name}" because its current status ("${item.status}") restricts sales!`);
      return;
    }
    // Prefer live inventory qty (cart rows can hold a stale snapshot)
    const live = (inventory || []).find(x => x.id === item.id) || item;
    const tracked = isTrackedInventory(live) || isTrackedInventory(item);
    const available = Number(live.quantity) || 0;
    if (tracked && available <= 0) {
      alert(`Cannot sell "${item.name}" because stock level is 0!`);
      return;
    }

    const existingIndex = posCart.findIndex(i => i.id === item.id);
    if (existingIndex > -1) {
      const updated = [...posCart];
      const currentCartQty = updated[existingIndex].cartQty || 1;
      if (tracked && currentCartQty >= available) {
        alert(`Cannot add more "${item.name}". Stock limit reached.`);
        return;
      }
      updated[existingIndex] = { ...updated[existingIndex], cartQty: currentCartQty + 1, quantity: available };
      setPosCart(updated);
    } else {
      const listPrice = getItemPrice(item, posPriceList);
      setPosCart([...posCart, { ...item, quantity: available, trackInventory: tracked ? 1 : 0, cartQty: 1, price: listPrice, priceList: posPriceList }]);
    }
  };

  const removeFromCart = (id) => {
    setPosCart(posCart.filter(i => i.id !== id));
  };

  const handleCheckout = async () => {
    if (posCart.length === 0) return;
    if (!posSelectedCustomer) {
      alert('Please select a customer for this transaction. Customer selection is mandatory to complete sale in POS.');
      return;
    }

    const cartSubtotal = posCart.reduce((sum, item) => sum + (item.price * item.cartQty), 0);
    let salesTaxAmt = 0;
    let cartTotal = cartSubtotal;
    const applySalesTax = posApplyTax && taxSettings.salesTaxRate > 0;
    if (applySalesTax) {
      if (posTaxInclusive) {
        salesTaxAmt = cartSubtotal - (cartSubtotal / (1 + taxSettings.salesTaxRate / 100));
        cartTotal = cartSubtotal;
      } else {
        salesTaxAmt = cartSubtotal * (taxSettings.salesTaxRate / 100);
        cartTotal = cartSubtotal + salesTaxAmt;
      }
    }
    const cashPaidNum = parseFloat(posCashPaid) || 0;
    const mpesaPaidNum = parseFloat(posMpesaPaid) || 0;
    const customerObj = customers.find(c => c.name === posSelectedCustomer);
    const custPts = parseFloat(customerObj?.loyaltyPoints) || 0;
    const valuePerPoint = parseFloat(loyaltySettings.redeemValue) || 1;
    let redeemPts = Math.floor(parseFloat(posRedeemPoints) || 0);
    if (!loyaltySettings.enabled || redeemPts < 0) redeemPts = 0;
    if (redeemPts > custPts) redeemPts = custPts;
    const maxPtsByTotal = valuePerPoint > 0 ? Math.floor(cartTotal / valuePerPoint) : 0;
    if (redeemPts > maxPtsByTotal) redeemPts = maxPtsByTotal;
    const redeemCredit = Math.round(redeemPts * valuePerPoint * 100) / 100;
    const totalPaidNum = cashPaidNum + mpesaPaidNum + redeemCredit;
    const balanceAmt = Math.max(0, cartTotal - totalPaidNum);

    const allowedEligibility = customerObj?.eligibility || ['Paid', 'Credit', 'Layby'];
    const eligList = Array.isArray(allowedEligibility) ? allowedEligibility : ['Paid'];
    const paidOnly = eligList.length === 1 && String(eligList[0]).toLowerCase() === 'paid';

    // Outstanding balance for paid-only customers blocks new sales until settled
    if (paidOnly || (eligList.length && eligList.every(e => String(e).toLowerCase() === 'paid'))) {
      const outstanding = (sales || [])
        .filter(s => s.customerName === posSelectedCustomer)
        .reduce((sum, s) => sum + (parseFloat(s.balanceDue) || 0), 0);
      if (outstanding > 0.009) {
        alert(`Customer "${posSelectedCustomer}" can only be sold to when their balance is zero.\n\nOutstanding balance: ${(shopProfile.currency || '')} ${outstanding.toLocaleString()}\nPlease clear the balance before completing a new sale.`);
        return;
      }
      if (posSaleType !== 'Paid') {
        alert(`Customer "${posSelectedCustomer}" is Paid-only. Sale type must be Paid.`);
        return;
      }
    }

    if (posSaleType !== 'Paid' && !eligList.includes(posSaleType)) {
      alert(`Customer "${posSelectedCustomer}" is not eligible for ${posSaleType} sales! Allowed types: ${eligList.join(', ')}`);
      return;
    }

    // Never accept payment above the sale total
    if (totalPaidNum > cartTotal + 0.009) {
      alert(`Payment cannot exceed the sale total.\nSale total: ${(shopProfile.currency || '')} ${cartTotal.toLocaleString()}\nEntered: ${(shopProfile.currency || '')} ${totalPaidNum.toLocaleString()}\nPlease adjust Cash / M-Pesa so the total paid equals the sale amount (or less for credit/layby).`);
      return;
    }

    if (posSaleType === 'Paid' && balanceAmt > 0.009) {
      alert(`Paid sales require full payment. Balance due would be ${(shopProfile.currency || '')} ${balanceAmt.toLocaleString()}.`);
      return;
    }

    if (posSaleType !== 'Paid' && balanceAmt === 0) {
      alert(`Selected sale type is ${posSaleType}, but balance due is 0. Please adjust payments or select Paid.`);
      return;
    }

    if (posSaleType !== 'Paid' && !posDeadline) {
      alert('Please select a deadline date for Credit or Layby orders.');
      return;
    }

    let paymentMethodStr = 'Cash';
    if (cashPaidNum > 0 && mpesaPaidNum > 0) {
      paymentMethodStr = `Cash (${cashPaidNum}) + M-Pesa (${mpesaPaidNum})`;
    } else if (mpesaPaidNum > 0) {
      paymentMethodStr = 'M-Pesa';
    } else {
      paymentMethodStr = 'Cash';
    }

    const finalDateObj = posSaleDate ? new Date(`${posSaleDate}T${new Date().toTimeString().split(' ')[0]}`).toISOString() : new Date().toISOString();

    const newSale = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      branchId: activeBranchId || undefined,
      date: finalDateObj,
      customerName: posSelectedCustomer,
      saleType: posSaleType,
      items: JSON.stringify(posCart.map(i => ({ id: i.id, name: i.name, price: i.price, cogs: Math.max(0, Number(i.buyingPrice) || 0), category: i.category, trackInventory: isTrackedInventory(i), qty: i.cartQty, returnedQty: 0, returnedSaleableQty: 0 }))),
      totalAmount: cartTotal,
      subtotal: cartSubtotal,
      taxAmount: Math.round(salesTaxAmt * 100) / 100,
      taxRate: applySalesTax ? taxSettings.salesTaxRate : 0,
      taxName: taxSettings.salesTaxName || 'VAT',
      taxInclusive: !!posTaxInclusive,
      paymentMethod: paymentMethodStr,
      mpesaCode: mpesaPaidNum > 0 ? (posMpesaCode || 'MPESA' + Math.floor(Math.random() * 899999 + 100000)) : 'N/A',
      cashier: currentUser?.name || 'Staff',
      createdBy: currentUser?.name || currentUser?.id || 'Staff',
      paidAmount: Math.min(totalPaidNum, cartTotal),
      balanceDue: Math.max(0, cartTotal - Math.min(totalPaidNum, cartTotal)),
      cashPaid: cashPaidNum,
      mpesaPaid: mpesaPaidNum,
      deadline: posDeadline || new Date().toISOString().split('T')[0],
      priceList: posPriceList || 'retail',
      buyerPin: customerObj?.kraPin || '',
      invoiceNo: etimsSettings.enabled
        ? `${etimsSettings.invoicePrefix || 'INV'}-${String(etimsSettings.nextInvoiceNo || 1).padStart(5, '0')}`
        : undefined,
      loyaltyPointsEarned: loyaltySettings.enabled
        ? Math.floor(Math.max(0, cashPaidNum + mpesaPaidNum) * (parseFloat(loyaltySettings.pointsPerCurrency) || 1))
        : 0,
      loyaltyPointsRedeemed: redeemPts,
      loyaltyRedeemCredit: redeemCredit
    };

    // Pre-check stock against live inventory before optimistic update
    for (const ci of posCart) {
      if (!isTrackedInventory(ci)) continue;
      const live = (inventory || []).find(x => x.id === ci.id);
      const avail = live != null ? Number(live.quantity) || 0 : Number(ci.quantity) || 0;
      if ((Number(ci.cartQty) || 0) > avail) {
        alert(`Insufficient stock for ${ci.name || ci.id}. Available: ${avail}; in cart: ${ci.cartQty}.`);
        return;
      }
    }

    const saleRecord = { ...newSale, items: JSON.parse(newSale.items) };
    // Server-first: only update local state after DB accepts the sale
    let serverOk = false;
    let serverMsg = '';
    try {
      const res = await apiFetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale)
      });
      if (res.ok) {
        serverOk = true;
        try {
          const d = await res.json();
          if (d && d.journalId) serverMsg = 'Ledger journal: ' + d.journalId;
        } catch (_) {}
      } else {
        try { const d = await res.json(); serverMsg = d.error || ('HTTP ' + res.status); } catch (_) { serverMsg = 'HTTP ' + res.status; }
      }
    } catch (e) {
      serverMsg = (e && e.message) || 'Network error';
      // Offline queue — still apply locally
      try {
        const q = [...(JSON.parse(localStorage.getItem('erp_offline_queue') || '[]')), { type: 'sale', payload: newSale, at: new Date().toISOString() }];
        saveOfflineQueue(q);
      } catch (_) {}
      serverOk = true; // allow local completion when offline
      serverMsg = (serverMsg ? serverMsg + ' — ' : '') + 'Saved offline; will sync later.';
    }
    if (!serverOk) {
      alert('Sale not posted: ' + (serverMsg || 'Unknown error'));
      return;
    }
    const updatedInventory = inventory.map(item => {
      const cartItem = posCart.find(ci => ci.id === item.id);
      if (cartItem && isTrackedInventory(item)) {
        const newQty = Math.max(0, (Number(item.quantity) || 0) - (Number(cartItem.cartQty) || 0));
        return { ...item, quantity: newQty, status: newQty === 0 ? 'Sold' : item.status };
      }
      return item;
    });
    setInventory(updatedInventory);
    const nextSales = [saleRecord, ...sales];
    setSales(nextSales);
    // Stock movement history (server + local)
    try {
      posCart.forEach(ci => {
        if (isTrackedInventory(ci)) {
          logStock(ci.id, ci.name, -(Number(ci.cartQty) || 0), 'Sale', newSale.id, activeBranchId && activeBranchId !== 'all' ? activeBranchId : '');
        }
      });
    } catch (_) {}
    setLastCompletedSale({ ...newSale, items: posCart });
    setReceiptModalOpen(true);
    setPosCart([]);
    setPosCashPaid('');
    setPosMpesaPaid('');
    setPosMpesaCode('');
    setPosSelectedCustomer('');
    setPosSaleType('Paid');
    setPosSaleDate(new Date().toISOString().split('T')[0]);
    setPosDeadline('');
    setPosRedeemPoints('');
    if (etimsSettings.enabled) {
      const nextE = { ...etimsSettings, nextInvoiceNo: (parseInt(etimsSettings.nextInvoiceNo) || 1) + 1 };
      saveEtims(nextE);
    }
    if (loyaltySettings.enabled && customerObj) {
      const earned = newSale.loyaltyPointsEarned || 0;
      const redeemed = newSale.loyaltyPointsRedeemed || 0;
      if (earned > 0 || redeemed > 0) {
        const pts = Math.max(0, (parseFloat(customerObj.loyaltyPoints) || 0) + earned - redeemed);
        const upd = { ...customerObj, loyaltyPoints: pts };
        setCustomers(customers.map(c => c.id === customerObj.id ? upd : c));
        try { await apiFetch(`/api/customers/${customerObj.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(upd) }); } catch (e) {}
      }
    }
  };

  const handleSaveNewItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.price) return;
    const vv = { ...(itemForm.varianceValues || {}) };
    (itemVariances || []).forEach(v => {
      if (v && v.name && vv[v.name] == null) vv[v.name] = '';
    });
    const withVar = applyVarianceValuesToItem({}, vv);
    const newItem = {
      id: `item-${Date.now()}`,
      createdBy: currentUser?.name || currentUser?.id || '',
      branchId: itemForm.allLocations ? '' : (itemForm.branchId || activeBranchId || undefined),
      name: itemForm.name,
      sku: (itemForm.sku || '').trim(),
      size: withVar.size || '',
      colour: withVar.colour || '',
      varianceValues: vv,
      category: itemForm.category,
      buyingPrice: parseFloat(itemForm.buyingPrice) || 0,
      price: parseFloat(itemForm.price),
      quantity: itemForm.trackInventory ? parseInt(itemForm.quantity) || 0 : 999,
      lowStockAlert: parseInt(itemForm.lowStockAlert) || 3,
      trackInventory: itemForm.trackInventory ? 1 : 0,
      status: itemForm.status,
      photoUrl: itemForm.photoUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300'
    };

    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        setInventory([newItem, ...inventory]);
        setItemForm({ name: '', sku: '', size: '', colour: '', wholesalePrice: '', category: 'Grade A Jackets', buyingPrice: '', price: '', quantity: '', lowStockAlert: 3, trackInventory: true, status: 'Listed', photoUrl: '', varianceValues: {}, branchId: '', allLocations: false });
        setNewItemModalOpen(false);
      } else {
        alert('Failed to add item to database.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNewCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name) return;
    const dup = (customers || []).find(c => (c.name || '').trim().toLowerCase() === (customerForm.name || '').trim().toLowerCase());
    if (dup && !window.confirm(`A customer named "${dup.name}" already exists. Create another with the same name?`)) return;
    const newCust = {
      id: `cust-${Date.now()}`,
      createdBy: currentUser?.name || currentUser?.id || '',
      ...customerForm
    };

    try {
      const res = await apiFetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCust)
      });
      if (res.ok) {
        setCustomers([newCust, ...customers]);
        setCustomerForm({ name: '', phone: '', location: '', eligibility: ['Paid'], salesTermId: '', paymentTerm: '' });
        setNewCustomerModalOpen(false);
      } else {
        alert('Failed to add customer to database.');
      }
    } catch (e) {
      console.error(e);
    }
  };


  // --- HR Handlers ---
  const handleSaveEmployee = async (emp) => {
    if (!emp?.name || !String(emp.name).trim()) {
      alert('Employee name is required.');
      return;
    }
    const isUpdate = employees.some(e => e.id === emp.id);
    const next = isUpdate ? employees.map(e => e.id === emp.id ? emp : e) : [emp, ...employees];
    setEmployees(next);
    setEmployeeModalOpen(false);
    setSelectedEmployee(null);
    setEmployeeForm({ name: '', position: '', department: (hrSettings.departments && hrSettings.departments[0]) || 'Sales', phone: '', email: '', hireDate: '', salary: '', status: 'Active', nationalId: '', bankAccount: '', bankName: '', leaveBalance: hrSettings.defaultAnnualLeave || 21, managerId: '' });
    try {
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `/api/employees/${emp.id}` : '/api/employees';
      const payload = {
        id: emp.id,
        name: emp.name,
        position: emp.position || '',
        department: emp.department || '',
        phone: emp.phone || '',
        email: emp.email || '',
        hireDate: emp.hireDate || '',
        salary: parseFloat(emp.salary) || 0,
        status: emp.status || 'Active',
        nationalId: emp.nationalId || '',
        bankAccount: emp.bankAccount || '',
        bankName: emp.bankName || '',
        leaveBalance: parseFloat(emp.leaveBalance) ?? 21,
        managerId: emp.managerId || '',
        branchId: emp.branchId || activeBranchId || undefined
      };
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('Employee saved locally; API returned', res.status, errText);
      }
    } catch (e) {
      console.warn('Employee saved locally; API unavailable', e);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm('Delete this employee?')) return;
    const next = employees.filter(e => e.id !== id);
    setEmployees(next);
    try {
      await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
    } catch (e) { console.warn('Employee deleted locally; API unavailable', e); }
  };

  const calcLeaveDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start), e = new Date(end);
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  };

    const handleSaveLeave = async () => {
    const resolvedEmployeeId = leaveForm.employeeId || ((!(isAdminUser || canUpdate('hr') || canUpdate('employees')) && currentEmployeeRecord?.id) ? currentEmployeeRecord.id : '');
    if (!resolvedEmployeeId || !leaveForm.startDate || !leaveForm.endDate) {
      alert((!(isAdminUser || canUpdate('hr') || canUpdate('employees')) && !currentEmployeeRecord) ? 'Your login is not linked to an employee. Ask admin to set User on your employee record.' : 'Select employee and dates.');
      return;
    }
    if (!employees.length) {
      alert('Add employees first before creating leave requests.');
      return;
    }
    const emp = employees.find(e => e.id === resolvedEmployeeId);
    if (!emp) {
      alert('Selected employee not found. Save the employee first.');
      return;
    }
    const days = calcLeaveDays(leaveForm.startDate, leaveForm.endDate);
    if (days <= 0) {
      alert('End date must be on or after start date.');
      return;
    }
    const manager = employees.find(e => e.id === emp?.managerId);
    const req = {
      id: `leave-${Date.now()}`,
      employeeId: resolvedEmployeeId,
      employeeName: emp?.name || '',
      leaveType: leaveForm.leaveType || 'Annual',
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      days,
      reason: leaveForm.reason || '',
      status: 'Pending',
      approvedBy: '',
      managerId: emp?.managerId || '',
      approverId: emp?.managerId || '',
      managerName: manager?.name || '',
      createdAt: new Date().toISOString()
    };
    const next = [req, ...leaveRequests];
    setLeaveRequests(next);
    setLeaveModalOpen(false);
    setLeaveForm({ employeeId: '', leaveType: (hrSettings.leaveTypes && hrSettings.leaveTypes[0]) || 'Annual', startDate: '', endDate: '', reason: '' });
    try {
      const res = await apiFetch('/api/leave-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
      if (!res.ok) console.warn('Leave saved locally; API returned', res.status);
    } catch (e) { console.warn('Leave saved locally; API unavailable', e); }
  };

  const handleLeaveAction = async (req, status) => {
    const updated = {
      ...req,
      status,
      approvedBy: currentUser?.name || currentUser?.id || 'Admin',
      decidedAt: new Date().toISOString()
    };
    let nextLeave = leaveRequests.map(l => l.id === req.id ? updated : l);
    setLeaveRequests(nextLeave);
    if (status === 'Approved' && !req.balanceDeducted) {
      const emp = employees.find(e => e.id === req.employeeId);
      if (emp) {
        const days = parseFloat(req.days) || 0;
        const newBal = Math.max(0, (parseFloat(emp.leaveBalance) ?? 21) - days);
        const empUpd = { ...emp, leaveBalance: newBal };
        const nextEmp = employees.map(e => e.id === emp.id ? empUpd : e);
        setEmployees(nextEmp);
        try {
          await apiFetch(`/api/employees/${emp.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(empUpd) });
        } catch (e) {}
        updated.balanceDeducted = true;
        nextLeave = nextLeave.map(l => l.id === req.id ? { ...updated } : l);
        setLeaveRequests(nextLeave);
      }
    }
    try {
      const res = await apiFetch(`/api/leave-requests/${req.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      if (!res.ok) {
        await apiFetch('/api/leave-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      }
    } catch (e) {
      try {
        await apiFetch('/api/leave-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      } catch (e2) { console.warn('Leave status kept locally', e2); }
    }
  };

  const handleGeneratePayroll = async () => {
    if (!payrollForm.employeeId || !payrollForm.period) {
      alert('Select employee and period (e.g. 2026-10).');
      return;
    }
    const emp = employees.find(e => e.id === payrollForm.employeeId);
    if (!emp) return;
    const basic = parseFloat(emp.salary) || 0;
    const aItems = payrollForm.allowanceItems || {};
    const dItems = payrollForm.deductionItems || {};
    const allowances = Object.values(aItems).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const deductions = Object.values(dItems).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const taxAmount = parseFloat(dItems.PAYE) || 0;
    const netPay = basic + allowances - deductions;
    const noteParts = [];
    if (payrollForm.notes) noteParts.push(payrollForm.notes);
    if ((parseFloat(aItems.Other) || 0) > 0 && payrollForm.allowanceOtherSpec) noteParts.push('Allowance Other: ' + payrollForm.allowanceOtherSpec);
    if ((parseFloat(dItems.Other) || 0) > 0 && payrollForm.deductionOtherSpec) noteParts.push('Deduction Other: ' + payrollForm.deductionOtherSpec);
    const rec = {
      id: `pay-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      period: payrollForm.period,
      createdBy: currentUser?.name || currentUser?.id || '',
      basicSalary: basic,
      allowances,
      deductions,
      taxAmount,
      netPay,
      status: 'Draft',
      paidDate: '',
      notes: noteParts.join(' | '),
      allowanceBreakdown: { ...aItems, _otherSpec: payrollForm.allowanceOtherSpec || '' },
      deductionBreakdown: { ...dItems, _otherSpec: payrollForm.deductionOtherSpec || '' }
    };
    setPayrollRecords([rec, ...payrollRecords]);
    setPayrollModalOpen(false);
    setPayrollForm({
      employeeId: '', period: '', notes: '',
      allowanceItems: { Housing: 0, Transport: 0, Airtime: 0, Bonus: 0, Other: 0 },
      allowanceOtherSpec: '',
      deductionItems: { PAYE: 0, 'NHL/Housing Levy': 0, NSSF: 0, SHA: 0, Loan: 0, Pension: 0, Other: 0 },
      deductionOtherSpec: ''
    });
    try {
      await apiFetch('/api/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
    } catch (e) { console.warn('Payroll saved locally; API unavailable', e); }
  };

  const handleMarkPayrollPaid = async (rec, payMethod) => {
    const method = payMethod || payrollPayMethod || 'Cash';
    const updated = { ...rec, status: 'Paid', paidDate: new Date().toISOString().split('T')[0], paymentMethod: method };
    setPayrollRecords(payrollRecords.map(p => p.id === rec.id ? updated : p));
    // Deduct net pay from selected payment account (as payroll expense)
    const net = parseFloat(rec.netPay) || 0;
    if (net > 0) {
      const exp = {
        id: `exp-payroll-${rec.id}-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        category: 'Payroll',
        description: `Payroll payment — ${rec.employeeName} (${rec.period})`,
        amount: net,
        paidAmount: net,
        balanceDue: 0,
        paymentStatus: 'Paid',
        paymentMethod: method,
        mpesaCode: '',
        payer: currentUser?.name || 'Admin',
        paidTo: rec.employeeName || 'Employee',
        taxAmount: 0
      };
      setExpenses(prev => [exp, ...prev]);
      try { await apiFetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exp) }); } catch (e) {}
    }
    try {
      await apiFetch(`/api/payroll/${rec.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    } catch (e) { console.warn('Payroll paid locally; API unavailable', e); }
  };

  const handleDeletePayroll = async (id) => {
    if (!confirm('Delete this payroll record?')) return;
    const next = payrollRecords.filter(p => p.id !== id);
    setPayrollRecords(next);
    setSelectedPayroll(null);
    try { await apiFetch(`/api/payroll/${id}`, { method: 'DELETE' }); } catch (e) {}
  };

  useEffect(() => {
    if (payrollPrintMode && selectedPayroll) {
      const t = setTimeout(() => {
        const style = document.getElementById('payroll-print-page-style') || document.createElement('style');
        style.id = 'payroll-print-page-style';
        if (!style.textContent) style.textContent = '@media print { @page { size: A4; margin: 12mm; } }';
        document.head.appendChild(style);
        window.print();
        setPayrollPrintMode(false);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [payrollPrintMode, selectedPayroll]);


    const handleSaveLeaveRequest = async (req) => {
    const days = calcLeaveDays(req.startDate, req.endDate);
    const emp = employees.find(e => e.id === req.employeeId);
    const manager = employees.find(e => e.id === (req.managerId || emp?.managerId));
    const updated = {
      ...req,
      days,
      employeeName: emp?.name || req.employeeName,
      managerId: emp?.managerId || req.managerId || '',
      approverId: emp?.managerId || req.approverId || '',
      managerName: manager?.name || req.managerName || ''
    };
    const next = leaveRequests.map(l => l.id === updated.id ? updated : l);
    setLeaveRequests(next);
    setSelectedLeave(null);
    try {
      await apiFetch(`/api/leave-requests/${updated.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    } catch (e) { console.warn('Leave updated locally', e); }
  };

  const handleDeleteLeaveRequest = async (id) => {
    if (!confirm('Delete this leave request?')) return;
    const next = leaveRequests.filter(l => l.id !== id);
    setLeaveRequests(next);
    setSelectedLeave(null);
    try { await apiFetch(`/api/leave-requests/${id}`, { method: 'DELETE' }); } catch (e) {}
  };

  const saveTenantSettingsPartial = (partial) => {
    apiFetch('/api/tenant-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    }).catch(() => {});
  };
  const persistPaymentMethods = (list) => {
    setPaymentMethods(list);
    saveTenantSettingsPartial({ paymentMethods: list });
  };
  const persistSalesTerms = (list) => {
    setSalesTerms(list);
    saveTenantSettingsPartial({ salesTerms: list });
  };
  const persistItemVariances = (list) => {
    setItemVariances(list);
    saveTenantSettingsPartial({ itemVariances: list });
  };
  const parseItemVarianceValues = (item) => {
    if (!item) return {};
    if (item.varianceValues && typeof item.varianceValues === 'object' && !Array.isArray(item.varianceValues)) return { ...item.varianceValues };
    if (typeof item.varianceValues === 'string') {
      try { const o = JSON.parse(item.varianceValues || '{}'); if (o && typeof o === 'object') return o; } catch (_) {}
    }
    const out = {};
    if (item.size) out.Size = item.size;
    if (item.colour) out.Colour = item.colour;
    return out;
  };
  const applyVarianceValuesToItem = (base, varianceValues) => {
    const vv = { ...(varianceValues || {}) };
    const lowerMap = {};
    Object.keys(vv).forEach(k => { lowerMap[String(k).toLowerCase()] = vv[k]; });
    const size = (lowerMap.size || lowerMap['size'] || base.size || '').toString().trim();
    const colour = (lowerMap.colour || lowerMap.color || lowerMap['colour'] || lowerMap['color'] || base.colour || '').toString().trim();
    return { ...base, size, colour, varianceValues: vv };
  };



  // --- Sales Return: restore inventory; refund reduces cash/mpesa via expense ---
  const openSalesReturn = (sale) => {
    const items = typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : (sale.items || []);
    const qtys = {};
    items.forEach((it, idx) => {
      const maxQ = Math.max(0, (Number(it.qty) || 0) - (Number(it.returnedQty) || 0));
      qtys[idx] = maxQ > 0 ? maxQ : 0;
    });
    setSalesReturnSale({ ...sale, items });
    setSalesReturnDisposition('Saleable');
    setSalesReturnQtys(qtys);
    setSalesReturnMethod((sale.paymentMethod || 'Cash').includes('M-Pesa') ? 'M-Pesa' : 'Cash');
    setSalesReturnModalOpen(true);
  };

  const handleProcessSalesReturn = async () => {
    if (!salesReturnSale) return;
    const items = salesReturnSale.items || [];
    let refundSubtotal = 0;
    items.forEach((it, idx) => {
      const ret = Math.min(Math.max(0, parseInt(salesReturnQtys[idx], 10) || 0), Math.max(0, (Number(it.qty) || 0) - (Number(it.returnedQty) || 0)));
      if (ret > 0) refundSubtotal += (it.price || 0) * ret;
    });
    if (refundSubtotal <= 0) {
      alert('Select at least one item quantity to return.');
      return;
    }
    // Same tax / refund math as before (for payment-method UI); server applies authoritative sale + stock update
    const origSub = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0) || salesReturnSale.totalAmount || 1;
    const origTax = parseFloat(salesReturnSale.taxAmount) || 0;
    const refundTax = origSub > 0 ? (refundSubtotal / origSub) * origTax : 0;
    const refundTotal = Math.round((refundSubtotal + (salesReturnSale.taxInclusive ? 0 : refundTax)) * 100) / 100;
    const actualRefund = Math.min(refundTotal, Math.max(0, Number(salesReturnSale.paidAmount) || 0));

    try {
      const res = await apiFetch('/api/sales-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: salesReturnSale.id,
          returnQtys: Object.fromEntries(Object.entries(salesReturnQtys).map(([k, v]) => [k, Number(v) || 0])),
          disposition: salesReturnDisposition,
          method: salesReturnMethod,
          taxInclusive: !!salesReturnSale.taxInclusive
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Sales return failed.');
        return;
      }
      // Apply server sale + inventory to local state
      if (data.sale) {
        let saleItems = data.sale.items;
        try { saleItems = typeof saleItems === 'string' ? JSON.parse(saleItems || '[]') : (saleItems || []); } catch (_) {}
        const merged = { ...data.sale, items: saleItems, type: data.sale.saleType };
        setSales(sales.map(s => s.id === merged.id ? merged : s));
      }
      if (Array.isArray(data.inventory) && data.inventory.length) {
        setInventory(prev => {
          const byId = Object.fromEntries(data.inventory.map(r => [r.id, r]));
          return prev.map(inv => byId[inv.id] ? { ...inv, ...byId[inv.id] } : inv);
        });
      }
      // Payment account outflow (same rule: not an expense)
      if (actualRefund > 0) {
        const methodName = salesReturnMethod.toLowerCase();
        setPaymentMethods(prev => {
          let matched = false;
          const next = prev.map(pm => {
            const n = (pm.name || '').toLowerCase();
            const isMatch = methodName.includes('cash') ? n === 'cash' : (methodName.includes('pesa') ? (n.includes('m-pesa') || n.includes('mpesa')) : n === methodName);
            if (!isMatch) return pm;
            matched = true;
            return { ...pm, startingBalance: Math.max(0, (Number(pm.startingBalance) || 0) - actualRefund) };
          });
          if (!matched) return next;
          return next;
        });
      }
      setSalesReturnModalOpen(false);
      setSalesReturnSale(null);
      setSelectedSaleItem(null);
      alert(`Sales return processed. Refund: ${shopProfile.currency} ${(data.refundTotal ?? refundTotal).toLocaleString()} via ${salesReturnMethod}. Inventory updated.`);
    } catch (e) {
      alert('Network error processing sales return.');
    }
  };

  // --- Purchase Return: reduce stock; reduce PO debt / paid ---
  const persistPOs = (next) => {
    setPurchaseOrders(next);
  };
  const upsertPO = async (updated) => {
    persistPOs((purchaseOrders || []).map(p => p.id === updated.id ? updated : p));
    try {
      const res = await apiFetch(`/api/purchase_orders/${updated.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      if (!res.ok) throw new Error('PO upsert failed');
    } catch (e) {
      try { await apiFetch('/api/purchase_orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }); } catch (e2) { console.warn('PO kept locally', e2); }
    }
  };

  const openPurchaseReturn = (po) => {
    if (!(po.received || ['Received', 'Payment', 'Purchase Return'].includes(po.workflowStatus))) {
      alert('A purchase return can only be created after the goods have been received.');
      return;
    }
    const already = po.returnedQty || 0;
    const maxRet = Math.max(0, (po.quantity || 0) - already);
    if (maxRet <= 0) {
      alert('No remaining quantity to return on this PO.');
      return;
    }
    // Build return lines from multi-item PO or single-item fallback
    let lines = [];
    try {
      const raw = typeof po.items === 'string' ? JSON.parse(po.items || '[]') : (po.items || []);
      if (Array.isArray(raw) && raw.length) {
        lines = raw.map(l => ({
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: Number(l.quantity) || 0,
          cost: Number(l.cost) || 0,
          returnedQty: Number(l.returnedQty) || 0
        }));
      }
    } catch (_) {}
    if (!lines.length) {
      lines = [{ itemId: po.itemId, itemName: po.itemName, quantity: po.quantity, cost: po.cost, returnedQty: already }];
    }
    const initQtys = {};
    lines.forEach((ln, idx) => {
      const max = Math.max(0, (Number(ln.quantity) || 0) - (Number(ln.returnedQty) || 0));
      initQtys[idx] = max;
    });
    setPurchaseReturnLineQtys(initQtys);
    setPurchaseReturnPO({ ...po, _returnLines: lines });
    setPurchaseReturnSettlement('Supplier Credit Note');
    setPurchaseReturnRefundMethod('Cash');
    setPurchaseReturnQty(maxRet);
    setPurchaseReturnModalOpen(true);
  };

  const handleProcessPurchaseReturn = async () => {
    if (!purchaseReturnPO) return;
    const po = purchaseReturnPO;
    const already = po.returnedQty || 0;
    const wasReceived = !!(po.received || ['Received', 'Payment', 'Purchase Return'].includes(po.workflowStatus));
    if (!wasReceived) {
      alert('A purchase return can only be created after the goods have been received.');
      return;
    }
    const maxRet = Math.max(0, (Number(po.quantity) || 0) - already);
    // Prefer per-line quantities from the modal; fall back to single total
    let requestedRet = 0;
    const lineEntries = Object.entries(purchaseReturnLineQtys || {});
    if (lineEntries.length) {
      requestedRet = lineEntries.reduce((s, [, v]) => s + (Math.max(0, parseInt(v, 10) || 0)), 0);
    } else {
      requestedRet = Math.max(1, parseInt(purchaseReturnQty, 10) || 0);
    }
    if (maxRet <= 0) {
      alert('No remaining quantity to return on this PO.');
      return;
    }
    if (requestedRet <= 0) {
      alert('Enter a valid return quantity.');
      return;
    }
    const payMethod = purchaseReturnRefundMethod || po.paymentMethod || 'Cash';

    try {
      const res = await apiFetch('/api/purchase-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: po.id,
          returnQty: requestedRet,
          settlement: purchaseReturnSettlement,
          paymentMethod: payMethod
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Purchase return failed.');
        return;
      }
      if (data.purchaseOrder) {
        let rh = data.purchaseOrder.returnHistory;
        try { rh = typeof rh === 'string' ? JSON.parse(rh || '[]') : (rh || []); } catch (_) {}
        const merged = { ...data.purchaseOrder, returnHistory: rh };
        persistPOs((purchaseOrders || []).map(p => p.id === po.id ? merged : p));
      }
      if (data.inventory) {
        setInventory(prev => prev.map(inv => inv.id === data.inventory.id ? { ...inv, ...data.inventory } : inv));
      }
      // Credit payment method if cash refund (same rule: not an expense)
      const cashRefund = Number(data.cashRefund) || 0;
      const supplierCredit = Number(data.supplierCredit) || 0;
      const retQty = Number(data.retQty) || requestedRet;
      const returnValue = Number(data.returnValue) || 0;
      if (cashRefund > 0) {
        const methodName = (payMethod || 'Cash').split('+')[0].trim().replace(/\s*\(.*\)/, '') || 'Cash';
        setPaymentMethods(prev => {
          const next = prev.map(pm => {
            const n = (pm.name || '').toLowerCase();
            const m = methodName.toLowerCase();
            if (n === m || (m.includes('cash') && n === 'cash') || (m.includes('m-pesa') && (n.includes('m-pesa') || n.includes('mpesa'))) || (m.includes('mpesa') && (n.includes('m-pesa') || n.includes('mpesa')))) {
              return { ...pm, startingBalance: (parseFloat(pm.startingBalance) || 0) + cashRefund };
            }
            return pm;
          });
          if (!next.some(pm => {
            const n = (pm.name || '').toLowerCase();
            const m = methodName.toLowerCase();
            return n === m || (m.includes('cash') && n === 'cash') || (m.includes('pesa') && n.includes('pesa'));
          })) {
            return next.map(pm => pm.name === 'Cash' ? { ...pm, startingBalance: (parseFloat(pm.startingBalance) || 0) + cashRefund } : pm);
          }
          return next;
        });
      }
      setPurchaseReturnModalOpen(false);
      setPurchaseReturnPO(null);
      const invMsg = 'Inventory reduced (items had been received).';
      const payMsg = cashRefund > 0 ? ` ${shopProfile.currency} ${cashRefund.toLocaleString()} recorded as a supplier refund to ${payMethod}.` : (purchaseReturnSettlement === 'Supplier Credit Note' ? ` Supplier credit note recorded: ${shopProfile.currency} ${supplierCredit.toLocaleString()}.` : ' Unpaid supplier balance reduced.');
      alert(`Purchase return processed: ${retQty} unit(s). Purchase amount reduced by ${shopProfile.currency} ${returnValue.toLocaleString()}.${payMsg} ${invMsg}`);
    } catch (e) {
      alert('Network error processing purchase return.');
    }
  };

  const handleSaveHrSettings = async () => {
    try {
      const res = await apiFetch('/api/hr-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hrSettings) });
      if (res.ok) alert('HR settings saved.');
      else alert('HR settings kept in this session.');
    } catch (e) {
      console.warn(e);
      alert('HR settings kept in this session.');
    }
  };

  const handleSaveTaxSettings = async () => {
    setPosApplyTax(!!taxSettings.salesTaxEnabled);
    setPoApplyTax(!!taxSettings.purchaseTaxEnabled);
    setExpenseApplyTax(!!(taxSettings.expenseTaxEnabled ?? taxSettings.purchaseTaxEnabled));
    setPosTaxInclusive(!!taxSettings.taxInclusive);
    setPoTaxInclusive(!!taxSettings.taxInclusive);
    setExpenseTaxInclusive(!!taxSettings.taxInclusive);
    try {
      const res = await apiFetch('/api/tax-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taxSettings) });
      if (res.ok) alert('Tax settings saved. POS / Purchase / Expense tax toggles updated.');
      else alert('Tax settings kept locally. Enable toggles on POS, Purchase, and Expense as needed.');
    } catch (e) {
      console.warn(e);
      alert('Tax settings kept locally. Enable toggles on POS, Purchase, and Expense as needed.');
    }
  };


  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'settings' || settingsSubTab !== 'locations') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/api/branches');
        if (!r.ok || cancelled) return;
        const x = await r.json();
        if (!cancelled) {
          setBranches(x.branches || []);
          if (x.maxBranches) setMaxBranches(x.maxBranches);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, activeTab, settingsSubTab]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'pos') return;
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
        if (e.key === 'Escape') { e.target.blur(); return; }
        return;
      }
      if (e.key === 'Escape') { setPosCart([]); setPosSearchQuery(''); }
      if (e.key === 'F2') { e.preventDefault(); const btn = document.getElementById('pos-complete-sale-btn'); if (btn) btn.click(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLoggedIn, activeTab]);

  // Auto-replay offline sales queue when connectivity returns
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const flush = async () => {
      try {
        const raw = localStorage.getItem('erp_offline_queue') || '[]';
        const q = JSON.parse(raw);
        if (!Array.isArray(q) || !q.length) return;
        const remaining = [];
        for (const job of q) {
          if (job.type !== 'sale' || !job.payload) { remaining.push(job); continue; }
          try {
            const res = await apiFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job.payload) });
            if (!res.ok && res.status !== 409) remaining.push(job);
          } catch (e) { remaining.push(job); }
        }
        saveOfflineQueue(remaining);
      } catch (e) {}
    };
    window.addEventListener('online', flush);
    // Attempt once shortly after login
    const t = setTimeout(flush, 2500);
    return () => { window.removeEventListener('online', flush); clearTimeout(t); };
  }, [isLoggedIn]);

    const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      alert('Please enter your username.');
      return;
    }
    if (!loginPin) {
      alert('Please enter your PIN.');
      return;
    }
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), pin: loginPin })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Login failed.');
        return;
      }
      const foundUser = data.user || {};
      setAuthToken(data.token || '');
      try { localStorage.setItem('erp_auth_token', data.token || ''); } catch (e) {}
      const privFromLogin = data.privileges && typeof data.privileges === 'object' ? data.privileges : null;
      setLoginPrivileges(privFromLogin);
      try { localStorage.setItem('erp_login_privileges', JSON.stringify(privFromLogin)); } catch (e) {}
      setCurrentUser(foundUser);
      // Wipe cross-tenant caches first (before loading this shop's local keys)
      try {
        ['erp_inventory','erp_sales','erp_customers','erp_purchase_orders','erp_expenses','erp_suppliers','erp_users','erp_roles','erp_employees','erp_leave_requests','erp_payroll'].forEach(k => localStorage.removeItem(k));
        setInventory([]); setSales([]); setCustomers([]); setPurchaseOrders([]); setExpenses([]); setSuppliers([]);
        setCategories([]); setExpenseCategories([]); setItemStatuses([]);
      } catch (e) {}

      if (data.tenant) {
        setTenantInfo(data.tenant);
        if (data.tenant.maxUsers) setMaxUsers(data.tenant.maxUsers);
        if (data.tenant.maxBranches) setMaxBranches(data.tenant.maxBranches);
        try { localStorage.setItem('erp_tenant', JSON.stringify(data.tenant)); } catch (e) {}
        // Seed profile with signup business name immediately (API may refine)
        setShopProfile(prev => ({
          name: data.tenant.name || prev.name || '',
          tagline: prev.tagline || '',
          currency: prev.currency || 'KSh',
          phone: prev.phone || '',
          location: prev.location || ''
        }));
        try {
          const tid = data.tenant.id || 'unknown';
          const a = JSON.parse(localStorage.getItem('erp_audit_log__' + tid) || '[]');
          setAuditLog(Array.isArray(a) ? a : []);
          const m = JSON.parse(localStorage.getItem('erp_stock_movements__' + tid) || '[]');
          setStockMovements(Array.isArray(m) ? m : []);
          const pm = JSON.parse(localStorage.getItem('erp_payment_methods__' + tid) || 'null');
          if (Array.isArray(pm) && pm.length) setPaymentMethods(pm.map(p => ({ ...p, startingBalance: parseFloat(p.startingBalance) || 0, currentBalance: p.currentBalance != null ? (parseFloat(p.currentBalance) || 0) : 0 })));
          else setPaymentMethods([
            { id: 'pm-cash', name: 'Cash', startingBalance: 0, currentBalance: 0 },
            { id: 'pm-mpesa', name: 'M-Pesa', startingBalance: 0, currentBalance: 0 }
          ]);
        } catch (e) {
          setAuditLog([]); setStockMovements([]);
          setPaymentMethods([
            { id: 'pm-cash', name: 'Cash', startingBalance: 0, currentBalance: 0 },
            { id: 'pm-mpesa', name: 'M-Pesa', startingBalance: 0, currentBalance: 0 }
          ]);
        }
      }
      if (data.isSuperAdmin) {
        setTenantInfo({ id: 'platform', name: 'Platform', plan: 'platform', isSuperAdmin: true });
        try { localStorage.setItem('erp_tenant', JSON.stringify({ id: 'platform', isSuperAdmin: true })); } catch (e) {}
      }
      setProfileImage(foundUser.photo || '');
      localStorage.setItem('erp_current_user', JSON.stringify(foundUser));
      localStorage.setItem('erp_login_time', Date.now().toString());
      setLoginPin('');

      // Default landing tab: Sales ledger if allowed, else Inventory → Purchase → HR → dashboard
      const pickLandingTab = (priv, isAdmin) => {
        const has = (tab) => isAdmin || !!(priv && priv[tab] && priv[tab].view);
        if (has('sales')) return 'sales';
        if (has('inventory')) return 'inventory';
        if (has('purchase')) return 'purchase';
        if (has('hr') || has('employees') || has('payroll')) return 'hr';
        if (has('pos')) return 'pos';
        if (has('expenses')) return 'expenses';
        if (has('dashboard')) return 'dashboard';
        return 'sales';
      };
      const isAdm = (foundUser.role || '').toLowerCase() === 'admin' || !!data.isSuperAdmin;
      const landing = pickLandingTab(privFromLogin, isAdm);
      setActiveTabPersist(landing);

      setAppHydrating(true);
      setIsLoggedIn(true);
      const hydrateTimer = setTimeout(() => setAppHydrating(false), 2500);

      // Load shop data without blocking the UI
      (async () => {
        try {
          const r2 = await apiFetch('/api/all-data');
          if (!r2.ok) { clearTimeout(hydrateTimer); setAppHydrating(false); return; }
          const payload = await r2.json();
          if (payload && Array.isArray(payload.inventory)) setInventory(payload.inventory);
          if (payload && Array.isArray(payload.sales)) setSales(payload.sales.map(s => ({ ...s, items: typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []) })));
          if (payload && Array.isArray(payload.customers)) setCustomers(payload.customers);
          if (payload && Array.isArray(payload.purchaseOrders)) setPurchaseOrders(payload.purchaseOrders.map(p => ({ ...p, items: typeof p.items === 'string' ? (() => { try { return JSON.parse(p.items); } catch { return p.items; } })() : p.items })));
          if (payload && Array.isArray(payload.users)) setUsers(payload.users);
          if (payload && Array.isArray(payload.roles)) {
            const mappedRoles = payload.roles.map(r => ({ ...r, privileges: typeof r.privileges === 'string' ? JSON.parse(r.privileges) : r.privileges }));
            setRoles(mappedRoles);
            const myRole = mappedRoles.find(r => (r.name || '').toLowerCase() === (foundUser.role || '').toLowerCase());
            if (myRole && myRole.privileges) {
              setLoginPrivileges(myRole.privileges);
              try { localStorage.setItem('erp_login_privileges', JSON.stringify(myRole.privileges)); } catch (e) {}
              // Re-pick landing if privileges refined and current was default
              const nextLand = pickLandingTab(myRole.privileges, isAdm);
              setActiveTabPersist(nextLand);
            }
          }
          if (payload && Array.isArray(payload.categories)) setCategories(payload.categories);
          if (payload && Array.isArray(payload.expenseCategories)) setExpenseCategories(payload.expenseCategories);
          if (payload && Array.isArray(payload.itemStatuses)) setItemStatuses(payload.itemStatuses);
          if (payload && payload.shopProfile) {
            setShopProfile({
              name: payload.shopProfile.name || (data.tenant && data.tenant.name) || '',
              tagline: payload.shopProfile.tagline || '',
              currency: payload.shopProfile.currency || 'KSh',
              phone: payload.shopProfile.phone || '',
              location: payload.shopProfile.location || ''
            });
          } else if (data.tenant && data.tenant.name) {
            setShopProfile(prev => ({ ...prev, name: data.tenant.name }));
          }
          if (payload && Array.isArray(payload.stockMovements)) {
            setStockMovements(payload.stockMovements.map(m => ({ ...m, user: m.userName || m.user || '', qtyChange: Number(m.qtyChange) || 0 })));
          }
          if (payload && payload.tenantSettings) {
            try {
              const ts = payload.tenantSettings;
              if (ts.paymentMethods) { const pm = typeof ts.paymentMethods === 'string' ? JSON.parse(ts.paymentMethods) : ts.paymentMethods; if (Array.isArray(pm) && pm.length) setPaymentMethods(pm); }
              if (ts.salesTerms) { const st = typeof ts.salesTerms === 'string' ? JSON.parse(ts.salesTerms) : ts.salesTerms; if (Array.isArray(st) && st.length) setSalesTerms(st); }
              if (ts.loyalty) { const loy = typeof ts.loyalty === 'string' ? JSON.parse(ts.loyalty) : ts.loyalty; if (loy) setLoyaltySettings(loy); }
              if (ts.etims) { const et = typeof ts.etims === 'string' ? JSON.parse(ts.etims) : ts.etims; if (et) setEtimsSettings(et); }
              if (ts.salesTargets) { const tgt = typeof ts.salesTargets === 'string' ? JSON.parse(ts.salesTargets) : ts.salesTargets; if (tgt) setSalesTargets(tgt); }
              if (ts.tasks) { const tk = typeof ts.tasks === 'string' ? JSON.parse(ts.tasks) : ts.tasks; if (Array.isArray(tk)) setTasks(tk); }
              if (ts.cashups) { const cu = typeof ts.cashups === 'string' ? JSON.parse(ts.cashups) : ts.cashups; if (Array.isArray(cu)) setCashUpHistory(cu); }
              if (ts.auditLog) { const al = typeof ts.auditLog === 'string' ? JSON.parse(ts.auditLog) : ts.auditLog; if (Array.isArray(al)) setAuditLog(al); }
              if (ts.itemVariances) {
                const iv = typeof ts.itemVariances === 'string' ? JSON.parse(ts.itemVariances) : ts.itemVariances;
                if (Array.isArray(iv) && iv.length) setItemVariances(iv);
              }
            } catch (e) {}
          }
          if (payload && Array.isArray(payload.branches)) { setBranches(payload.branches); if (payload.maxBranches) setMaxBranches(payload.maxBranches); }
          if (payload && Array.isArray(payload.suppliers)) setSuppliers(payload.suppliers);
          if (payload && Array.isArray(payload.expenses)) setExpenses(payload.expenses);
          if (payload && Array.isArray(payload.employees)) setEmployees(payload.employees);
        } catch (e) {}
        finally { clearTimeout(hydrateTimer); setAppHydrating(false); }
      })();
    } catch (err) {
      // Offline / API down: fallback local login (legacy) so app still opens offline
      alert('Server unreachable. Secure login requires the API (hashed PINs cannot be verified offline). Check your connection and try again.');
      return;
    }
  };

  if (!isLoggedIn) {
    const showPin = typeof window !== 'undefined' && window.__neo_show_pin;
    return (
      <div className="min-h-screen bg-[#0b1220] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-[#141c2b] border border-slate-800/80 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">NEO ERP</h1>
            <p className="text-sm text-slate-400">{authMode === 'super' ? 'Platform operator login' : authMode === 'signup' ? 'Register a new shop' : 'Sign in to your shop'}</p>
          </div>

          {authMode !== 'super' && (
            <div className="flex rounded-full bg-slate-900/80 border border-slate-700/60 p-1">
              <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${authMode === 'login' ? 'bg-slate-800 text-white shadow ring-1 ring-sky-500/60' : 'text-slate-400 hover:text-slate-200'}`}>Login</button>
              <button type="button" onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${authMode === 'signup' ? 'bg-slate-800 text-white shadow ring-1 ring-sky-500/60' : 'text-slate-400 hover:text-slate-200'}`}>Create shop</button>
            </div>
          )}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                  <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Enter your full name" required className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">PIN</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/80">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input type={showPin ? 'text' : 'password'} value={loginPin} onChange={e => setLoginPin(e.target.value)} placeholder="••••••••" required className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-sm text-amber-400 tracking-widest focus:outline-none focus:border-sky-500" />
                  <button type="button" onClick={() => { window.__neo_show_pin = !window.__neo_show_pin; setLoginPin(p => p); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Toggle PIN visibility">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-500/20">Sign in</button>
            </form>
          )}

          {authMode === 'signup' && (
            <form onSubmit={async e => {
              e.preventDefault();
              if (!signupForm.email || !String(signupForm.email).includes('@')) return alert('A valid email is required');
              if (!signupForm.phone || String(signupForm.phone).trim().length < 7) return alert('Phone number is required');
              try {
                const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signupForm) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) { alert(data.error || 'Signup failed'); return; }
                alert((data.message || 'Shop submitted.') + '\n\nYou will be contacted before your business is approved. Please wait for confirmation from the platform operator.');
                setLoginUsername(signupForm.adminName);
                setAuthMode('login');
              } catch (err) { alert('Network error'); }
            }} className="space-y-3">
              <input required placeholder="Shop / business name" value={signupForm.shopName} onChange={e => setSignupForm({ ...signupForm, shopName: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <input required placeholder="Main location / branch name" value={signupForm.locationName} onChange={e => setSignupForm({ ...signupForm, locationName: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <input required placeholder="Admin full name" value={signupForm.adminName} onChange={e => setSignupForm({ ...signupForm, adminName: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <input required type="password" placeholder="Admin PIN (min 4)" value={signupForm.adminPin} onChange={e => setSignupForm({ ...signupForm, adminPin: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <input required type="email" placeholder="Email (required)" value={signupForm.email} onChange={e => setSignupForm({ ...signupForm, email: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <input required placeholder="Phone (required)" value={signupForm.phone} onChange={e => setSignupForm({ ...signupForm, phone: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-500" />
              <select value={signupForm.plan} onChange={e => setSignupForm({ ...signupForm, plan: e.target.value })} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white">
                <option value="starter">Starter (3 users)</option>
                <option value="business">Business (15 users)</option>
                <option value="premium">Premium (100 users)</option>
              </select>
              <p className="text-[10px] text-slate-500">Your shop will be reviewed by the platform operator before it is activated.</p>
              <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm">Create Shop & Continue</button>
            </form>
          )}

          {authMode === 'super' && (
            <form onSubmit={async e => {
              e.preventDefault();
              try {
                const res = await fetch('/api/super-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername.trim(), pin: loginPin }) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) { alert(data.error || 'Super login failed'); return; }
                setAuthToken(data.token || '');
                try { localStorage.setItem('erp_auth_token', data.token || ''); } catch (e) {}
                setCurrentUser(data.user);
                setTenantInfo({ id: 'platform', name: 'Platform', isSuperAdmin: true });
                try { localStorage.setItem('erp_tenant', JSON.stringify({ id: 'platform', isSuperAdmin: true })); } catch (e) {}
                setIsLoggedIn(true);
                localStorage.setItem('erp_current_user', JSON.stringify(data.user));
                localStorage.setItem('erp_login_time', Date.now().toString());
                try {
                  const hdr = { Authorization: 'Bearer ' + (data.token || '') };
                  const tr = await fetch('/api/super-tenants', { headers: hdr });
                  if (tr.ok) { const td = await tr.json(); setSuperTenants(td.tenants || []); setSuperPlans(td.plans || []); setPlatformKpis(td.kpis || null); }
                  const pr = await fetch('/api/super-payments', { headers: hdr });
                  if (pr.ok) { const pd = await pr.json(); setSuperPayments(pd.payments || []); }
                  const pf = await fetch('/api/super-profile', { headers: hdr });
                  if (pf.ok) { const pfd = await pf.json(); setSuperProfile({ username: pfd.profile?.username || data.user?.name || '', displayName: pfd.profile?.displayName || data.user?.name || '' }); }
                } catch (err) { /* non-fatal */ }
              } catch (err) { alert('Network error'); }
            }} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Username</label>
                <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Platform username" required className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-3 px-3 text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Password / PIN</label>
                <input type="password" value={loginPin} onChange={e => setLoginPin(e.target.value)} placeholder="••••••••" required className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-3 px-3 text-sm text-amber-400 tracking-widest focus:outline-none focus:border-amber-500" />
              </div>
              <button type="submit" className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm">Enter platform console</button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-center text-xs text-slate-400 hover:text-slate-200 pt-1">← Back to shop login</button>
            </form>
          )}

          {authMode !== 'super' && (
            <p className="text-center text-xs text-slate-500">
              Platform operator?{' '}
              <button type="button" onClick={() => { setAuthMode('super'); setLoginUsername(''); setLoginPin(''); }} className="text-amber-400 hover:text-amber-300 font-semibold">Super-admin login</button>
            </p>
          )}
        </div>
      </div>
    );
  }

  const isAdminUser = (currentUser?.role || '').toLowerCase() === 'admin' || (currentUser?.role || '').toLowerCase() === 'superadmin' || !!tenantInfo?.isSuperAdmin;
  const userRoleObj = roles.find(r => (r.name || '').toLowerCase() === (currentUser?.role || '').toLowerCase())
    || roles.find(r => r.name === currentUser?.role)
    || null;
  let rawPrivileges = {};
  if (userRoleObj && userRoleObj.privileges) {
    rawPrivileges = typeof userRoleObj.privileges === 'string'
      ? (() => { try { return JSON.parse(userRoleObj.privileges); } catch (e) { return {}; } })()
      : (userRoleObj.privileges || {});
  } else if (loginPrivileges && typeof loginPrivileges === 'object') {
    rawPrivileges = loginPrivileges;
  }
  if (typeof rawPrivileges === 'string') {
    try { rawPrivileges = JSON.parse(rawPrivileges); } catch (e) { rawPrivileges = {}; }
  }
  if (!rawPrivileges || typeof rawPrivileges !== 'object' || Array.isArray(rawPrivileges)) rawPrivileges = {};
  const normalizePriv = (p) => {
    if (p === true) return { view: true, create: false, update: false, delete: false, ownOnly: false };
    if (!p || typeof p !== 'object') return { view: false, create: false, update: false, delete: false, ownOnly: false };
    return {
      view: !!p.view,
      create: p.create !== undefined ? !!p.create : !!p.update,
      update: !!p.update,
      delete: !!p.delete,
      ownOnly: p.ownOnly === true
    };
  };
  const TAB_KEYS = ['dashboard','pos','sales','inventory','expenses','laybys','customers','suppliers','reports','reportComprehensive','reportSales','reportPurchase','reportExpense','reportHr','reportCustomer','reportSalesMostItems','reportSalesMostCategories','reportSalesDormant','reportSalesBestPeople','reportSalesKpis','reportSalesPeople','reportSalesCreditsLayby','reportSalesTax','reportPurchaseSummary','reportPurchaseByCategory','reportPurchaseCogs','reportPurchaseUnpaid','reportPurchaseTax','reportExpenseHighCategories','reportExpenseFrequent','reportExpenseUnpaid','reportExpenseTax','reportHrSummary','reportHrLeaveSalary','reportCustomerStatement','reportInventory','reportAging','reportFinancial','reportLedger','settings','purchase','employees','payroll','hr'];
  const REPORT_SECTION_PARENT = {
    reportComprehensive: 'reports',
    reportSalesMostItems: 'reportSales', reportSalesMostCategories: 'reportSales', reportSalesDormant: 'reportSales', reportSalesBestPeople: 'reportSales', reportSalesKpis: 'reportSales', reportSalesPeople: 'reportSales', reportSalesCreditsLayby: 'reportSales', reportSalesTax: 'reportSales',
    reportPurchaseSummary: 'reportPurchase', reportPurchaseByCategory: 'reportPurchase', reportPurchaseCogs: 'reportPurchase', reportPurchaseUnpaid: 'reportPurchase', reportPurchaseTax: 'reportPurchase',
    reportExpenseHighCategories: 'reportExpense', reportExpenseFrequent: 'reportExpense', reportExpenseUnpaid: 'reportExpense', reportExpenseTax: 'reportExpense',
    reportHrSummary: 'reportHr', reportHrLeaveSalary: 'reportHr',
    reportCustomerStatement: 'reportCustomer',
    reportInventory: 'reports', reportAging: 'reports', reportFinancial: 'reports', reportLedger: 'reports'
  };
  const privileges = {};
  TAB_KEYS.forEach(k => {
    if (isAdminUser) {
      privileges[k] = { view: true, create: true, update: true, delete: true, ownOnly: false };
      return;
    }
    if (rawPrivileges[k] != null) {
      privileges[k] = normalizePriv(rawPrivileges[k]);
      return;
    }
    if (REPORT_SECTION_PARENT[k]) {
      const parentKey = REPORT_SECTION_PARENT[k];
      const parentView = rawPrivileges[parentKey] != null ? !!normalizePriv(rawPrivileges[parentKey]).view : false;
      privileges[k] = { view: parentView, create: false, update: false, delete: false, ownOnly: false };
      return;
    }
    privileges[k] = { view: false, create: false, update: false, delete: false, ownOnly: false };
  });
  const currentEmployeeRecord = employees.find(e =>
    (currentUser?.id && e.userId && String(e.userId) === String(currentUser.id))
  ) || employees.find(e =>
    (currentUser?.name && e.name && e.name.toLowerCase() === currentUser.name.toLowerCase()) ||
    (currentUser?.email && e.email && e.email.toLowerCase() === currentUser.email.toLowerCase())
  ) || null;
  const canApproveLeave = (lr) => {
    if (isAdminUser || privileges.hr?.update) return true;
    if (!currentEmployeeRecord || !lr) return false;
    return lr.approverId === currentEmployeeRecord.id || lr.managerId === currentEmployeeRecord.id;
  };
  const canViewReport = (key) => {
    if (isAdminUser || privileges.reports?.view) return true;
    if (privileges[key]?.view) return true;
    return Object.entries(REPORT_SECTION_PARENT).some(([sec, parent]) => parent === key && !!privileges[sec]?.view);
  };
  const canViewReportSection = (sectionKey) => {
    if (isAdminUser) return true;
    return !!privileges[sectionKey]?.view;
  };
  const reportAllowedTabs = [
    { id: 'sales', key: 'reportSales', label: 'Sales Report' },
    { id: 'purchase', key: 'reportPurchase', label: 'Purchase Report' },
    { id: 'inventory', key: 'reportInventory', label: 'Inventory Report' },
    { id: 'expense', key: 'reportExpense', label: 'Expense Report' },
    { id: 'hr', key: 'reportHr', label: 'HR Report' },
    { id: 'customer', key: 'reportCustomer', label: 'Customer Statement' },
    { id: 'aging', key: 'reportAging', label: 'Aging Report' },
    { id: 'financial', key: 'reportFinancial', label: 'Financial Reports' },
    { id: 'ledger', key: 'reportLedger', label: 'Accounting Ledger' }
  ].filter(t => canViewReport(t.key));
  const effectiveReportSubTab = reportAllowedTabs.some(t => t.id === reportSubTab) ? reportSubTab : (reportAllowedTabs[0]?.id || 'sales');
  const canView = (tab) => {
    if (isAdminUser) return true;
    return !!(privileges[tab] && privileges[tab].view);
  };
  const canCreate = (tab) => isAdminUser || !!(privileges[tab] && privileges[tab].create);
  const canUpdate = (tab) => isAdminUser || !!(privileges[tab] && privileges[tab].update);
  const canDelete = (tab) => isAdminUser || !!(privileges[tab] && privileges[tab].delete);

  // Location privileges: list of branch IDs the role may use (empty = all locations)
  const allowedBranchIds = earlyAllowedBranchIds;
  const accessibleBranches = (branches || []).filter(b => !allowedBranchIds || allowedBranchIds.includes(String(b.id)));
  const canAccessBranch = (bid) => {
    if (!allowedBranchIds) return true;
    if (!bid) {
      const def = accessibleBranches.find(b => b.isDefault) || accessibleBranches[0];
      return !!(def && allowedBranchIds.includes(String(def.id)));
    }
    return allowedBranchIds.includes(String(bid));
  };
  const logAudit = (action, entity, detail) => {
    const entry = { id: `aud-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, at: new Date().toISOString(), user: currentUser?.name || 'System', action, entity, detail: String(detail || ''), tenantId: (tenantInfo && tenantInfo.id) || '' };
    setAuditLog(prev => {
      const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 500);
      apiFetch('/api/tenant-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditLog: next }) }).catch(() => {});
      return next;
    });
  };
  const logStock = (itemId, itemName, qtyChange, reason, refId, branchId) => {
    const bid = branchId || activeBranchId || currentBranchId || '';
    const entry = { id: `sm-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, at: new Date().toISOString(), itemId: itemId || '', itemName: itemName || '', qtyChange: Number(qtyChange) || 0, reason: reason || '', ref: refId || '', user: currentUser?.name || '', userName: currentUser?.name || '', tenantId: (tenantInfo && tenantInfo.id) || '', branchId: bid && bid !== 'all' ? bid : '' };
    setStockMovements(prev => {
      const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 500);
      return next;
    });
    // Persist movement to DB (non-blocking)
    apiFetch('/api/stock-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {});
  };
  const pinStrength = (pin) => {
    const s = String(pin || '');
    if (s.length < 4) return { ok: false, label: 'Too short (min 4)', score: 0 };
    if (s.length < 6) return { ok: true, label: 'Weak', score: 1 };
    if (/^\d+$/.test(s) && s.length < 8) return { ok: true, label: 'Fair', score: 2 };
    return { ok: true, label: 'Strong', score: 3 };
  };

  /** Resize/compress profile image to a small JPEG data URL (max edge 256px). */
  const compressProfileImage = (file, maxEdge = 256, quality = 0.72) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image'));
        img.onload = () => {
          let w = img.width || maxEdge;
          let h = img.height || maxEdge;
          if (w > maxEdge || h > maxEdge) {
            if (w >= h) { h = Math.round(h * (maxEdge / w)); w = maxEdge; }
            else { w = Math.round(w * (maxEdge / h)); h = maxEdge; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    } catch (e) { reject(e); }
  });
  const downloadPayslipHtml = (pr) => {
    if (!pr) return;
    const emp = employees.find(e => e.id === pr.employeeId);
    let ab = pr.allowanceBreakdown, db = pr.deductionBreakdown;
    try { if (typeof ab === 'string') ab = JSON.parse(ab || '{}'); } catch (_) { ab = {}; }
    try { if (typeof db === 'string') db = JSON.parse(db || '{}'); } catch (_) { db = {}; }
    ab = ab || {}; db = db || {};
    const allowanceNames = ['Housing', 'Transport', 'Airtime', 'Bonus', 'Other'];
    const deductionNames = ['PAYE', 'NHL/Housing Levy', 'NSSF', 'SHA', 'Loan', 'Pension', 'Other'];
    const parseLines = (obj, names) => Object.entries(obj).filter(([k, v]) => k !== '_otherSpec' && v !== '' && v != null).map(([k, v]) => {
      const display = /^\d+$/.test(k) ? (names[Number(k)] || k) : k;
      const amount = typeof v === 'object' ? (v.amount ?? v.value ?? 0) : v;
      const n = parseFloat(amount) || 0;
      return n ? { label: display, amount: n } : null;
    }).filter(Boolean);

    const aLines = parseLines(ab, allowanceNames);
    const dLines = parseLines(db, deductionNames);
    const cur = shopProfile.currency || 'KSh';
    const shop = shopProfile.name || tenantInfo?.name || 'NEO ERP';
    const tagline = shopProfile.tagline || '';
    const location = shopProfile.location || '';
    const empName = pr.employeeName || emp?.name || '';
    const period = pr.period || '';
    const status = pr.status || '';
    const paidDate = pr.paidDate || '';
    const basic = parseFloat(pr.basicSalary) || 0;
    const allowTotal = parseFloat(pr.allowances) || 0;
    const dedTotal = parseFloat(pr.deductions) || 0;
    const net = parseFloat(pr.netPay) || (basic + allowTotal - dedTotal);
    const notes = pr.notes || '';

    // Build payslip PDF (portrait A4) matching standard payslip layout
    const esc = (s) => String(s ?? '').replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const pageWidth = 595, pageHeight = 842;
    const marginX = 48;
    const ops = [];
    let y = pageHeight - 50;
    const textAt = (str, x, yy, size, bold) => ops.push({ type: 'text', str: esc(str), x, y: yy, size, bold: !!bold });
    const line = (x1, y1, x2, y2) => ops.push({ type: 'line', x1, y1, x2, y2 });
    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

    // Header centered
    const center = (str, yy, size, bold) => {
      const approx = String(str).length * size * 0.45;
      textAt(str, Math.max(marginX, (pageWidth - approx) / 2), yy, size, bold);
    };
    center(shop, y, 16, true); y -= 16;
    if (tagline) { center(tagline, y, 9, false); y -= 12; }
    if (location) { center(location, y, 9, false); y -= 12; }
    y -= 6;
    center('PAYSLIP', y, 14, true); y -= 10;
    line(marginX, y, pageWidth - marginX, y); y -= 18;

    // Employee info box
    textAt('Employee', marginX, y, 8, false);
    textAt('Period', 320, y, 8, false); y -= 12;
    textAt(empName, marginX, y, 11, true);
    textAt(period, 320, y, 11, true); y -= 16;
    textAt('Status', marginX, y, 8, false);
    textAt('Paid Date', 320, y, 8, false); y -= 12;
    textAt(status, marginX, y, 11, true);
    textAt(paidDate || '—', 320, y, 11, true); y -= 14;
    line(marginX, y, pageWidth - marginX, y); y -= 20;

    // Summary amounts
    const rowAmt = (label, amount, bold) => {
      textAt(label, marginX, y, bold ? 11 : 10, !!bold);
      textAt(fmt(amount), pageWidth - marginX - 80, y, bold ? 11 : 10, !!bold);
      y -= 16;
    };
    rowAmt('Basic Salary', basic, false);
    rowAmt('Allowances', allowTotal, false);
    rowAmt('Deductions', dedTotal, false);
    y -= 4;
    line(marginX, y + 10, pageWidth - marginX, y + 10);
    textAt('Net Pay', marginX, y, 12, true);
    textAt(cur + ' ' + fmt(net), pageWidth - marginX - 100, y, 12, true);
    y -= 22;

    if (notes) {
      textAt('Notes: ' + notes, marginX, y, 9, false);
      y -= 16;
    }

    // Breakdown two columns
    line(marginX, y, pageWidth - marginX, y); y -= 16;
    textAt('Allowances', marginX, y, 10, true);
    textAt('Deductions', 320, y, 10, true); y -= 14;
    const maxLines = Math.max(aLines.length, dLines.length, 1);
    for (let i = 0; i < maxLines; i++) {
      if (aLines[i]) {
        textAt(aLines[i].label, marginX, y, 9, false);
        textAt(fmt(aLines[i].amount), 220, y, 9, false);
      }
      if (dLines[i]) {
        textAt(dLines[i].label, 320, y, 9, false);
        textAt(fmt(dLines[i].amount), 500, y, 9, false);
      }
      y -= 13;
    }

    // Assemble PDF
    let stream = '';
    ops.forEach(op => {
      if (op.type === 'line') {
        stream += `${op.x1.toFixed(2)} ${op.y1.toFixed(2)} m ${op.x2.toFixed(2)} ${op.y2.toFixed(2)} l S\n`;
      } else {
        const font = op.bold ? '/F2' : '/F1';
        stream += `BT\n${font} ${op.size} Tf\n1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm\n(${op.str}) Tj\nET\n`;
      }
    });
    const objs = [];
    objs[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    objs[2] = '2 0 obj\n<< /Type /Pages /Kids [ 5 0 R ] /Count 1 >>\nendobj\n';
    objs[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
    objs[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';
    objs[6] = `6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
    objs[5] = `5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 6 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`;
    let body = '%PDF-1.4\n';
    const off = [0];
    for (let i = 1; i <= 6; i++) {
      off[i] = body.length;
      body += objs[i];
    }
    const xrefStart = body.length;
    body += `xref\n0 7\n0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) body += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    body += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    const blob = new Blob([body], { type: 'application/pdf' });
    const fname = `payslip-${(empName || 'employee').replace(/\s+/g, '_')}-${period || 'period'}.pdf`;
    downloadBlobFile(fname, blob);
    logAudit('download', 'payroll', `Payslip ${pr.id || ''} ${empName}`);
  };


  const isOwnScope = (tab) => {
    if (isAdminUser) return false;
    const p = privileges[tab];
    if (!p || !p.view) return false;
    // Update/Delete elevates to all records
    if (p.update || p.delete) return false;
    // View Own only when explicitly checked — plain View = all records (read-only)
    return p.ownOnly === true;
  };
  const isOwnRecord = (rec) => {
    if (!rec || !currentUser) return false;
    const me = (currentUser.name || '').toLowerCase().trim();
    const uid = String(currentUser.id || '');
    const fields = [
      rec.createdBy, rec.cashier, rec.payer, rec.userId, rec.userName,
      rec.employeeName, rec.addedBy, rec.recordedBy, rec.openedBy
    ];
    return fields.some(f => {
      if (f == null || f === '') return false;
      const s = String(f).toLowerCase().trim();
      return s === me || String(f) === uid || s === uid.toLowerCase();
    });
  };
  const filterOwn = (tab, list) => {
    if (!Array.isArray(list)) return [];
    if (!isOwnScope(tab)) return list;
    return list.filter(isOwnRecord);
  };
  const visibleSales = filterOwn('sales', sales);
  const visibleExpenses = filterOwn('expenses', expenses);
  const visiblePOs = filterOwn('purchase', branchPurchaseOrders);
  const visibleLeave = filterOwn('hr', leaveRequests);
  const visiblePayroll = filterOwn('payroll', payrollRecords);
  const visibleLaybySales = filterOwn('laybys', (sales || []).filter(s => {
    const due = parseFloat(s.balanceDue) || Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0));
    return due > 0;
  }));
  const hrAllowedSubTabs = (() => {
    const allowed = [];
    if (isAdminUser || privileges.employees?.view) allowed.push('employees');
    if (isAdminUser || privileges.hr?.view) { allowed.push('org'); allowed.push('leave'); }
    if (isAdminUser || privileges.payroll?.view) allowed.push('payroll');
    return allowed;
  })();
  const effectiveHrSubTab = hrAllowedSubTabs.includes(hrSubTab) ? hrSubTab : (hrAllowedSubTabs[0] || 'leave');






  // Avoid blank white screen while first data pack loads after login
  if (appHydrating && !tenantInfo?.isSuperAdmin && !loginPrivileges && !isAdminUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading your shop…</p>
        <p className="text-[10px] text-slate-600">{shopProfile?.name || tenantInfo?.name || ''}</p>
      </div>
    );
  }

  if (tenantInfo?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-amber-400">Platform console</h1>
            <p className="text-[10px] text-slate-500">Super-admin · no shop POS · manage tenants, plans, payments, access</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{currentUser?.name || superProfile.displayName || 'Platform'}</span>
            <button type="button" onClick={() => {
              setIsLoggedIn(false); setCurrentUser(null); setAuthToken(''); setTenantInfo(null); setLoginPrivileges(null);
              try { localStorage.removeItem('erp_auth_token'); localStorage.removeItem('erp_current_user'); localStorage.removeItem('erp_tenant'); localStorage.removeItem('erp_login_privileges'); } catch (e) {}
            }} className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded">Log out</button>
          </div>
        </header>
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[{ id: 'tenants', label: 'Shops' }, { id: 'plans', label: 'Plans' }, { id: 'payments', label: 'Payments' }, { id: 'profile', label: 'My profile' }].map(t => (
              <button key={t.id} type="button" onClick={async () => {
                setSuperTab(t.id);
                if (t.id === 'plans') {
                  const r = await apiFetch('/api/super-plans');
                  if (r.ok) { const d = await r.json(); setSuperPlans(d.plans || []); }
                }
                if (t.id === 'tenants') {
                  const r = await apiFetch('/api/super-tenants');
                  if (r.ok) { const d = await r.json(); setSuperTenants(d.tenants || []); setSuperPlans(d.plans || []); setPlatformKpis(d.kpis || null); }
                }
                if (t.id === 'payments') {
                  const r = await apiFetch('/api/super-payments');
                  if (r.ok) { const d = await r.json(); setSuperPayments(d.payments || []); }
                }
              }} className={`px-3 py-2 rounded-lg text-xs font-bold ${superTab === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{t.label}</button>
            ))}
            <button type="button" onClick={async () => {
              const res = await apiFetch('/api/super-tenants');
              if (res.ok) { const d = await res.json(); setSuperTenants(d.tenants || []); setSuperPlans(d.plans || []); setPlatformKpis(d.kpis || null); }
              const pr = await apiFetch('/api/super-payments'); if (pr.ok) { const pd = await pr.json(); setSuperPayments(pd.payments || []); }
              const pf = await apiFetch('/api/super-profile'); if (pf.ok) { const pfd = await pf.json(); setSuperProfile({ username: pfd.profile?.username || '', displayName: pfd.profile?.displayName || '' }); }
            }} className="ml-auto px-3 py-2 text-xs text-emerald-400 font-bold">Refresh</button>
          </div>
          {platformKpis && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Shops', v: platformKpis.totalShops },
                { label: 'Active', v: platformKpis.activeShops, c: 'text-emerald-400' },
                { label: 'Trial', v: platformKpis.trialShops, c: 'text-sky-400' },
                { label: 'Suspended', v: platformKpis.suspendedShops, c: 'text-red-400' },
                { label: 'Payments (mo)', v: platformKpis.paymentsThisMonthCount },
                { label: 'Revenue (mo)', v: platformKpis.paymentsThisMonth }
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase">{k.label}</p>
                  <p className={`text-lg font-bold ${k.c || 'text-white'}`}>{typeof k.v === 'number' && k.label.includes('Revenue') ? Number(k.v).toLocaleString() : k.v}</p>
                </div>
              ))}
            </div>
          )}
          {superTab === 'tenants' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <input placeholder="Shop name" value={newTenantForm.name} onChange={e => setNewTenantForm({ ...newTenantForm, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <select value={newTenantForm.plan} onChange={e => setNewTenantForm({ ...newTenantForm, plan: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(superPlans.length ? superPlans : [{ id: 'starter', label: 'Starter' }, { id: 'business', label: 'Business' }, { id: 'premium', label: 'Premium' }]).map(p => <option key={p.id} value={p.id}>{p.label || p.id}</option>)}
                </select>
                <input placeholder="Owner email" value={newTenantForm.ownerEmail} onChange={e => setNewTenantForm({ ...newTenantForm, ownerEmail: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <button type="button" onClick={async () => {
                  if (!newTenantForm.name.trim()) return alert('Shop name required');
                  const res = await apiFetch('/api/super-tenants', { method: 'POST', body: JSON.stringify({ ...newTenantForm, trialDays: 14 }) });
                  if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Failed'); }
                  setNewTenantForm({ name: '', plan: 'starter', ownerEmail: '' });
                  const r2 = await apiFetch('/api/super-tenants'); if (r2.ok) { const x = await r2.json(); setSuperTenants(x.tenants || []); setSuperPlans(x.plans || []); setPlatformKpis(x.kpis || null); }
                }} className="bg-emerald-500 text-slate-950 font-bold rounded">Create shop (14d trial)</button>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[900px]">
                  <thead className="text-slate-400 uppercase text-[10px] bg-slate-950"><tr><th className="p-2">Shop</th><th className="p-2">Plan</th><th className="p-2">Access</th><th className="p-2">Users</th><th className="p-2">Sales</th><th className="p-2">Last pay</th><th className="p-2">Trial</th><th className="p-2">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {(superTenants || []).map(t => (
                      <tr key={t.id} className={`cursor-pointer hover:bg-slate-800/60 ${t.overdue ? 'bg-red-500/5' : ''}`} onClick={() => setSelectedPlatformShop({ ...t })}>
                        <td className="p-2"><input className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-white w-36" defaultValue={t.name} onBlur={async e => { if (e.target.value !== t.name) { await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ name: e.target.value }) }); setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, name: e.target.value } : x)); } }} /><div className="text-[9px] text-slate-500 font-mono">{t.id}</div>
                          {t.overdue && <span className="text-[9px] text-red-400 font-bold">Overdue / unpaid</span>}
                        </td>
                        <td className="p-2" onClick={e => e.stopPropagation()}><select value={t.plan || 'starter'} onChange={async e => { await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ plan: e.target.value }) }); setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, plan: e.target.value } : x)); }} className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-white">{(superPlans.length ? superPlans : [{ id: 'starter' }, { id: 'business' }, { id: 'premium' }]).map(p => <option key={p.id} value={p.id}>{p.label || p.id}</option>)}</select></td>
                        <td className="p-2" onClick={e => e.stopPropagation()}><select value={t.status || 'active'} onChange={async e => { await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ status: e.target.value }) }); setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, status: e.target.value } : x)); }} className={`bg-slate-950 border border-slate-700 rounded px-1 py-0.5 font-bold ${t.status === 'suspended' || t.status === 'deleted' ? 'text-red-400' : t.status === 'pending' ? 'text-amber-400' : t.status === 'trial' ? 'text-sky-400' : 'text-emerald-400'}`}><option value="active">active</option><option value="trial">trial</option><option value="pending">pending</option><option value="suspended">suspended</option><option value="deleted">deleted</option></select></td>
                        <td className="p-2 text-white">{t.userCount ?? '—'}<span className="text-slate-500">/{t.maxUsers ?? '—'}</span></td>
                        <td className="p-2 text-slate-300">{t.salesCount ?? '—'}</td>
                        <td className="p-2 text-slate-400">{t.lastPayment ? `${t.lastPayment.amount} · ${t.lastPayment.period || ''}` : (t.lastPaymentAt ? new Date(t.lastPaymentAt).toLocaleDateString() : '—')}</td>
                        <td className="p-2 text-slate-400">{t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}{t.trialExpired ? <span className="text-red-400 block text-[9px]">expired</span> : null}</td>
                        <td className="p-2 space-y-1" onClick={e => e.stopPropagation()}>
                          <button type="button" className="block w-full px-2 py-1 bg-sky-500/20 text-sky-400 rounded text-[10px] font-bold" onClick={async () => {
                            if (!confirm('Open this shop as support (2h session)?')) return;
                            const res = await apiFetch('/api/super-impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: t.id }) });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return alert(d.error || 'Failed');
                            try {
                              localStorage.setItem('erp_auth_token', d.token);
                              localStorage.setItem('erp_current_user', JSON.stringify(d.user));
                              localStorage.setItem('erp_tenant', JSON.stringify(d.tenant));
                              if (d.privileges) localStorage.setItem('erp_login_privileges', JSON.stringify(d.privileges));
                            } catch (e) {}
                            window.location.reload();
                          }}>Open as shop</button>
                          {t.status === 'suspended' ? (
                            <button type="button" className="block w-full px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold" onClick={async () => { await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ status: 'active' }) }); setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, status: 'active' } : x)); }}>Activate</button>
                          ) : (
                            <button type="button" className="block w-full px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] font-bold" onClick={async () => { if (!confirm('Suspend this shop? Users cannot log in.')) return; await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ status: 'suspended' }) }); setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, status: 'suspended' } : x)); }}>Suspend</button>
                          )}
                          {t.id !== 'tenant-default' && (
                            <button type="button" className="block w-full px-2 py-1 bg-red-600/30 text-red-300 rounded text-[10px] font-bold" onClick={async () => {
                              if (!confirm('PERMANENTLY delete this shop and ALL its data (users, sales, inventory, etc.)? This cannot be undone.')) return;
                              if (!confirm('Type-confirm: delete shop "' + (t.name || t.id) + '" and purge every related record?')) return;
                              const res = await apiFetch('/api/super-tenants/' + t.id, { method: 'DELETE', body: JSON.stringify({ hard: true }) });
                              const d = await res.json().catch(() => ({}));
                              if (!res.ok) return alert(d.error || 'Delete failed');
                              setSuperTenants(superTenants.filter(x => x.id !== t.id));
                              setSelectedPlatformShop(null);
                              alert('Shop and all related records deleted.');
                            }}>Delete shop</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* legacy notes column removed from header — keep soft-delete below if present */}
                    {(superTenants || []).length === 0 && (
                      <tr><td colSpan={8} className="p-6 text-center text-slate-500">No shops yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {superTab === 'plans' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">Edit existing plans below, or add a new plan. Changes save per row.</p>
                <button type="button" onClick={async () => {
                  const r = await apiFetch('/api/super-plans');
                  if (r.ok) { const d = await r.json(); setSuperPlans(d.plans || []); }
                  else alert('Could not load plans — check you are still logged in as Platform.');
                }} className="px-3 py-1.5 bg-slate-800 text-emerald-400 text-xs font-bold rounded">Reload plans</button>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="text-slate-400 text-[10px] uppercase bg-slate-950">
                    <tr>
                      <th className="p-2 text-left">Id</th>
                      <th className="p-2 text-left">Label</th>
                      <th className="p-2 text-center">Max users</th>
                      <th className="p-2 text-center">Branches</th>
                      <th className="p-2 text-center">Price / mo</th>
                      <th className="p-2 text-center">Active</th>
                      <th className="p-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(superPlans || []).length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-slate-500">No plans yet. Click Reload plans or add one below. Default starter/business/premium will seed on first load.</td></tr>
                    )}
                    {(superPlans || []).map(p => (
                      <tr key={p.id}>
                        <td className="p-2 font-mono text-slate-500 text-[10px]">{p.id}</td>
                        <td className="p-2">
                          <input className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" defaultValue={p.label || ''} id={`plan-label-${p.id}`} />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-center" defaultValue={p.maxUsers ?? 5} id={`plan-users-${p.id}`} />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-center" defaultValue={p.maxBranches ?? 1} id={`plan-branches-${p.id}`} />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-center" defaultValue={p.priceMonthly ?? 0} id={`plan-price-${p.id}`} />
                        </td>
                        <td className="p-2 text-center">
                          <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" defaultValue={p.active ? '1' : '0'} id={`plan-active-${p.id}`}>
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                          </select>
                        </td>
                        <td className="p-2 text-center space-x-1">
                          <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded" onClick={async () => {
                            const label = document.getElementById(`plan-label-${p.id}`)?.value;
                            const maxUsers = parseInt(document.getElementById(`plan-users-${p.id}`)?.value, 10);
                            const maxBranches = parseInt(document.getElementById(`plan-branches-${p.id}`)?.value, 10);
                            const priceMonthly = parseFloat(document.getElementById(`plan-price-${p.id}`)?.value);
                            const active = document.getElementById(`plan-active-${p.id}`)?.value === '1';
                            const res = await apiFetch('/api/super-plans/' + encodeURIComponent(p.id), {
                              method: 'PUT',
                              body: JSON.stringify({ label, maxUsers, maxBranches, priceMonthly, active })
                            });
                            if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Update failed'); }
                            setSuperPlans(superPlans.map(x => x.id === p.id ? { ...x, label, maxUsers, maxBranches, priceMonthly, active: active ? 1 : 0 } : x));
                            alert('Plan saved');
                          }}>Save</button>
                          <button type="button" className="px-2 py-1 bg-red-500/20 text-red-400 font-bold rounded" onClick={async () => {
                            if (!window.confirm('Delete plan ' + p.id + '?')) return;
                            const res = await apiFetch('/api/super-plans/' + encodeURIComponent(p.id), { method: 'DELETE' });
                            if (!res.ok) return alert('Delete failed');
                            setSuperPlans(superPlans.filter(x => x.id !== p.id));
                          }}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Add new plan</p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <input placeholder="Plan id e.g. pro" value={planForm.id} onChange={e => setPlanForm({ ...planForm, id: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  <input placeholder="Label" value={planForm.label} onChange={e => setPlanForm({ ...planForm, label: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  <input type="number" placeholder="Max users" value={planForm.maxUsers} onChange={e => setPlanForm({ ...planForm, maxUsers: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  <input type="number" placeholder="Branches" value={planForm.maxBranches} onChange={e => setPlanForm({ ...planForm, maxBranches: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  <input type="number" placeholder="Price/mo" value={planForm.priceMonthly} onChange={e => setPlanForm({ ...planForm, priceMonthly: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  <button type="button" onClick={async () => {
                    if (!planForm.id && !planForm.label) return alert('Plan id or label required');
                    const res = await apiFetch('/api/super-plans', { method: 'POST', body: JSON.stringify({ ...planForm, maxUsers: parseInt(planForm.maxUsers) || 5, maxBranches: parseInt(planForm.maxBranches) || 1, priceMonthly: parseFloat(planForm.priceMonthly) || 0 }) });
                    if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Save failed'); }
                    const r = await apiFetch('/api/super-plans'); if (r.ok) { const d = await r.json(); setSuperPlans(d.plans || []); }
                    setPlanForm({ id: '', label: '', maxUsers: 5, maxBranches: 1, priceMonthly: 0 });
                  }} className="bg-amber-500 text-slate-950 font-bold rounded">Add plan</button>
                </div>
              </div>
            </div>
          )}
          {superTab === 'payments' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <select value={paymentForm.tenantId} onChange={e => setPaymentForm({ ...paymentForm, tenantId: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white"><option value="">— Shop —</option>{(superTenants || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input type="number" placeholder="Amount" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <input placeholder="Method" value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <input placeholder="Reference" value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <input placeholder="Period e.g. 2026-10" value={paymentForm.period} onChange={e => setPaymentForm({ ...paymentForm, period: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                <button type="button" onClick={async () => {
                  if (!paymentForm.tenantId || !paymentForm.amount) return alert('Shop and amount required');
                  await apiFetch('/api/super-payments', { method: 'POST', body: JSON.stringify(paymentForm) });
                  setPaymentForm({ tenantId: '', amount: '', method: 'M-Pesa', reference: '', period: '', notes: '' });
                  const r = await apiFetch('/api/super-payments'); if (r.ok) { const d = await r.json(); setSuperPayments(d.payments || []); }
                }} className="bg-emerald-500 text-slate-950 font-bold rounded">Log payment</button>
              </div>
              <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-x-auto">
                <table className="w-full text-xs"><thead className="text-slate-400 text-[10px] uppercase bg-slate-950"><tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Shop</th><th className="p-2">Amount</th><th className="p-2">Method</th><th className="p-2">Ref</th><th className="p-2">Period</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{(superPayments || []).map(p => (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-800/60" onClick={() => setSelectedPlatformPayment({ ...p })}>
                    <td className="p-2 text-slate-400">{p.at ? new Date(p.at).toLocaleString() : ''}</td>
                    <td className="p-2 text-white">{p.tenantName || p.tenantId}</td>
                    <td className="p-2 text-center text-emerald-400 font-bold">{p.amount}</td>
                    <td className="p-2 text-center">{p.method}</td>
                    <td className="p-2 font-mono text-[10px]">{p.reference}</td>
                    <td className="p-2 text-center">{p.period}</td>
                  </tr>
                ))}</tbody></table>
                {selectedPlatformPayment && (
                  <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[80] p-4" onClick={() => setSelectedPlatformPayment(null)}>
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="font-bold text-white text-sm">Edit payment</h4>
                        <button type="button" onClick={() => setSelectedPlatformPayment(null)} className="text-slate-400">✕</button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-slate-400 block mb-1">Shop</label>
                          <select value={selectedPlatformPayment.tenantId || ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, tenantId: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                            <option value="">— Shop —</option>
                            {(superTenants || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Amount</label>
                          <input type="number" value={selectedPlatformPayment.amount ?? ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, amount: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Method</label>
                          <input value={selectedPlatformPayment.method || ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, method: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Reference</label>
                          <input value={selectedPlatformPayment.reference || ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, reference: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Period</label>
                          <input value={selectedPlatformPayment.period || ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, period: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">Notes</label>
                          <input value={selectedPlatformPayment.notes || ''} onChange={e => setSelectedPlatformPayment({ ...selectedPlatformPayment, notes: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button type="button" className="flex-1 py-2 bg-amber-500 text-slate-950 font-bold rounded" onClick={async () => {
                            const p = selectedPlatformPayment;
                            const res = await apiFetch('/api/super-payments/' + p.id, { method: 'PUT', body: JSON.stringify(p) });
                            if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Update failed'); }
                            const r = await apiFetch('/api/super-payments');
                            if (r.ok) { const d = await r.json(); setSuperPayments(d.payments || []); }
                            setSelectedPlatformPayment(null);
                          }}>Save</button>
                          <button type="button" className="py-2 px-3 bg-red-600 text-white font-bold rounded" onClick={async () => {
                            if (!confirm('Delete this payment record?')) return;
                            const res = await apiFetch('/api/super-payments/' + selectedPlatformPayment.id, { method: 'DELETE' });
                            if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Delete failed'); }
                            setSuperPayments((superPayments || []).filter(x => x.id !== selectedPlatformPayment.id));
                            setSelectedPlatformPayment(null);
                          }}>Delete</button>
                          <button type="button" className="py-2 px-3 bg-slate-800 text-white font-bold rounded" onClick={() => setSelectedPlatformPayment(null)}>Close</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {selectedPlatformShop && (
            <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[80] p-4" onClick={() => setSelectedPlatformShop(null)}>
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-white text-sm">Edit shop</h4>
                  <button type="button" onClick={() => setSelectedPlatformShop(null)} className="text-slate-400">✕</button>
                </div>
                <div className="space-y-2 text-xs">
                  <div><label className="text-slate-400 block mb-1">Shop name</label>
                    <input value={selectedPlatformShop.name || ''} onChange={e => setSelectedPlatformShop({ ...selectedPlatformShop, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-1">Plan</label>
                    <select value={selectedPlatformShop.plan || 'starter'} onChange={e => setSelectedPlatformShop({ ...selectedPlatformShop, plan: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                      {(superPlans.length ? superPlans : [{ id: 'starter' }, { id: 'business' }, { id: 'premium' }]).map(p => <option key={p.id} value={p.id}>{p.label || p.id}</option>)}
                    </select></div>
                  <div><label className="text-slate-400 block mb-1">Access</label>
                    <select value={selectedPlatformShop.status || 'active'} onChange={e => setSelectedPlatformShop({ ...selectedPlatformShop, status: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                      <option value="active">active</option>
                      <option value="trial">trial</option>
                      <option value="pending">pending</option>
                      <option value="suspended">suspended</option>
                      <option value="deleted">deleted</option>
                    </select></div>
                  <div><label className="text-slate-400 block mb-1">Max users</label>
                    <input type="number" value={selectedPlatformShop.maxUsers ?? 5} onChange={e => setSelectedPlatformShop({ ...selectedPlatformShop, maxUsers: parseInt(e.target.value) || 1 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                  <div><label className="text-slate-400 block mb-1">Notes</label>
                    <input value={selectedPlatformShop.notes || ''} onChange={e => setSelectedPlatformShop({ ...selectedPlatformShop, notes: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" className="flex-1 py-2 bg-amber-500 text-slate-950 font-bold rounded" onClick={async () => {
                      const t = selectedPlatformShop;
                      await apiFetch('/api/super-tenants/' + t.id, { method: 'PUT', body: JSON.stringify({ name: t.name, plan: t.plan, status: t.status, maxUsers: t.maxUsers, notes: t.notes }) });
                      setSuperTenants(superTenants.map(x => x.id === t.id ? { ...x, ...t } : x));
                      setSelectedPlatformShop(null);
                    }}>Save</button>
                    {selectedPlatformShop.id !== 'tenant-default' && (
                      <button type="button" className="py-2 px-3 bg-red-600 text-white font-bold rounded" onClick={async () => {
                        const t = selectedPlatformShop;
                        if (!confirm('PERMANENTLY delete this shop and ALL its data? This cannot be undone.')) return;
                        const res = await apiFetch('/api/super-tenants/' + t.id, { method: 'DELETE', body: JSON.stringify({ hard: true }) });
                        const d = await res.json().catch(() => ({}));
                        if (!res.ok) return alert(d.error || 'Delete failed');
                        setSuperTenants(superTenants.filter(x => x.id !== t.id));
                        setSelectedPlatformShop(null);
                      }}>Delete</button>
                    )}
                    <button type="button" className="py-2 px-3 bg-slate-800 text-white font-bold rounded" onClick={() => setSelectedPlatformShop(null)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
                    {superTab === 'profile' && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md space-y-3 text-xs">
              <h3 className="font-bold text-white">Update platform username / display name</h3>
              <p className="text-[10px] text-slate-500">Saved to platform_profile. For env login, set Cloudflare SUPER_ADMIN_NAME to the same username; PIN remains SUPER_ADMIN_PIN.</p>
              <input placeholder="Username" value={superProfile.username || ''} onChange={e => setSuperProfile({ ...superProfile, username: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              <input placeholder="Display name" value={superProfile.displayName || ''} onChange={e => setSuperProfile({ ...superProfile, displayName: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              <button type="button" onClick={async () => {
                const res = await apiFetch('/api/super-profile', { method: 'PUT', body: JSON.stringify(superProfile) });
                const d = await res.json().catch(() => ({}));
                if (!res.ok) return alert(d.error || 'Failed');
                if (d.profile) setSuperProfile(d.profile);
                if (d.profile?.displayName) setCurrentUser(cu => cu ? { ...cu, name: d.profile.displayName } : cu);
                alert(d.warning || 'Profile saved.');
              }} className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded">Save profile</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12 overflow-x-hidden">
      
      



      {/* Thermal POS Receipt Print Styles */}
      <style>{`
        .erp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 768px) {
          table { font-size: 11px; }
          .erp-table-wrap table { min-width: 560px; }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt *,
          #printable-payroll, #printable-payroll * {
            visibility: visible;
          }
          #printable-receipt, #printable-payroll {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          #printable-receipt * , #printable-payroll * {
            color: #000000 !important;
            background: transparent !important;
          }
          #printable-payroll input[type=number] { appearance: none !important; -moz-appearance: textfield !important; border: 0 !important; box-shadow: none !important; }
          #printable-payroll input[type=number]::-webkit-inner-spin-button, #printable-payroll input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
          body:has(#printable-payroll) { }
          @page { }
        }
        #printable-payroll input[type=number] { appearance: none !important; -moz-appearance: textfield !important; }
        #printable-payroll input[type=number]::-webkit-inner-spin-button, #printable-payroll input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
      `}</style>

      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg text-slate-950 font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">{shopProfile.name}</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">{shopProfile.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {(accessibleBranches || []).length > 0 && (
              <select
                value={currentBranchId || ''}
                onChange={e => {
                  const v = e.target.value;
                  setCurrentBranchId(v);
                  try { localStorage.setItem('erp_current_branch', v); } catch (err) {}
                }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white max-w-[140px]"
                title="Active location (role-limited)"
              >
                {(accessibleBranches || []).length > 1 && <option value="all">All locations</option>}
                {(accessibleBranches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' ★' : ''}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => { setProfileNameDraft(currentUser?.name || ''); setProfileImage(currentUser?.photo || ''); setUserProfileModalOpen(true); }} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg px-2.5 py-1.5 text-left" title="Open user profile">
              {profileImage || (currentUser?.id && localStorage.getItem(`erp_user_photo_${currentUser.id}`)) ? <img src={profileImage || localStorage.getItem(`erp_user_photo_${currentUser?.id}`)} alt="User profile" className="w-8 h-8 rounded-full object-cover border border-slate-700" /> : <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">{(currentUser?.name || 'U').trim().charAt(0).toUpperCase()}</span>}
              <span className="text-xs"><span className="block text-white font-semibold">{(currentUser?.name || 'User').trim().split(/\s+/)[0]}</span><span className="text-emerald-400 font-bold">{currentUser?.role}</span></span>
            </button>
            <button onClick={handleLogout} className="bg-slate-900 hover:bg-red-500/20 hover:text-red-400 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors" title="Log out"><LogOut className="w-3.5 h-3.5" /> Logout</button>
          </div>
        </div>

       {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto border-t border-slate-900 pt-1">
          {!tenantInfo?.isSuperAdmin && (isAdminUser || canView('dashboard')) && (
            <button onClick={() => setActiveTabPersist('dashboard')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <BarChart3 className="w-4 h-4" /> Dashboard
            </button>
          )}
          {(isAdminUser || canView('pos')) && (
            <button onClick={() => setActiveTabPersist('pos')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'pos' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <ShoppingBag className="w-4 h-4" /> POS / Checkout
            </button>
          )}
          {(isAdminUser || canView('sales')) && (
            <button onClick={() => setActiveTabPersist('sales')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'sales' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <CreditCard className="w-4 h-4" /> Sales Ledger
            </button>
          )}
          {(isAdminUser || canView('inventory')) && (
            <button onClick={() => setActiveTabPersist('inventory')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'inventory' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <Package className="w-4 h-4" /> Item & Inventory
            </button>
          )}
          {(isAdminUser || canView('purchase') || canView('suppliers')) && (
            <button onClick={() => setActiveTabPersist('purchase')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'purchase' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <Truck className="w-4 h-4" /> Purchase
            </button>
          )}
          {(isAdminUser || canView('expenses')) && (
            <button onClick={() => setActiveTabPersist('expenses')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'expenses' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <DollarSign className="w-4 h-4" /> Expenses
            </button>
          )}
          {(isAdminUser || canView('laybys')) && (
            <button onClick={() => setActiveTabPersist('laybys')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'laybys' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <Clock className="w-4 h-4" /> Credit & Layby
            </button>
          )}
          {(isAdminUser || canView('hr') || canView('payroll') || canView('employees')) && (
            <button onClick={() => setActiveTabPersist('hr')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'hr' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <UserCheck className="w-4 h-4" /> HR
            </button>
          )}
          {(isAdminUser || privileges.reports?.view || privileges.reportSales?.view || privileges.reportPurchase?.view || privileges.reportExpense?.view || privileges.reportHr?.view || privileges.reportCustomer?.view) && (
            <button onClick={() => setActiveTabPersist('reports')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'reports' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <FileText className="w-4 h-4" /> Reports
            </button>
          )}
          {(isAdminUser || canView('settings')) && (
            <button onClick={() => setActiveTabPersist('settings')} className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 whitespace-nowrap ${activeTab === 'settings' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400'}`}>
              <Settings className="w-4 h-4" /> Settings
            </button>
          )}
        </div>
      </header>
      
      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6">

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && (isAdminUser || canView('dashboard')) && (
          <div className="space-y-6">
            {!backupReminderDismissed && (() => {
              const last = lastBackupAt ? new Date(lastBackupAt).getTime() : 0;
              const days = last ? (Date.now() - last) / 86400000 : 999;
              if (days < 7) return null;
              return (
                <div className="bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">Weekly backup recommended</p>
                    <p className="text-amber-100/90 mt-0.5">{last ? `Last backup ${Math.floor(days)} day(s) ago.` : 'No backup recorded yet.'} Download a local JSON and/or cloud tenant backup under Settings → Backup & Restore.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setActiveTabPersist('settings'); setSettingsSubTab('backup'); }} className="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px]">Open Backup</button>
                    <button type="button" onClick={() => setBackupReminderDismissed(true)} className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px]">Remind me later</button>
                  </div>
                </div>
              );
            })()}

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Executive Dashboard & Analytics</h2>
                <p className="text-xs text-slate-400 mt-0.5">Real-time overview of revenue, accounts, categories, and staff performance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Timeframe:</span>
                <select value={dashboardTimeframe} onChange={e => setDashboardTimeframe(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-semibold rounded-lg px-3 py-1.5 focus:outline-none">
                  <option value="today">Daily (Today)</option>
                  <option value="this_week">Weekly (This Week)</option>
                  <option value="this_month">Monthly (This Month)</option>
                  <option value="custom">Custom Date Range</option>
                </select>
                {dashboardTimeframe === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input type="date" value={dashCustomStartDate} onChange={e => setDashCustomStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" value={dashCustomEndDate} onChange={e => setDashCustomEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Revenue</p>
                <h3 className="text-2xl font-bold text-white mt-2">{shopProfile.currency} {totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Cost of Goods (COGS)</p>
                <h3 className="text-2xl font-bold text-slate-300 mt-2">{shopProfile.currency} {totalCogs.toLocaleString()}</h3>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Operating Expenses</p>
                <h3 className="text-2xl font-bold text-amber-400 mt-2">{shopProfile.currency} {totalOperatingExpenses.toLocaleString()}</h3>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Net Cash Profit</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-2">{shopProfile.currency} {netProfit.toLocaleString()}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 p-5 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-400" /><h4 className="text-sm font-bold text-white">Cash at Hand Account</h4></div>
                  <p className="text-2xl font-bold text-emerald-400 mt-3">{shopProfile.currency} {cashAtHandAccount.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-emerald-400" /><h4 className="text-sm font-bold text-white">M-Pesa Account Balance</h4></div>
                  <p className="text-2xl font-bold text-emerald-400 mt-3">{shopProfile.currency} {mpesaAccountBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>


            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white">Period Compare</h4>
                    <select value={dashboardCompareMode} onChange={e => setDashboardCompareMode(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-[10px] text-white px-1 py-0.5">
                      <option value="last_month">vs Last Month</option>
                      <option value="last_year">vs Last Year</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400">This month: <span className="text-emerald-400 font-bold">{shopProfile.currency} {currentMonthSalesTotal.toLocaleString()}</span></p>
                  <p className="text-[10px] text-slate-400">{comparePeriod.label}: <span className="text-sky-400 font-bold">{shopProfile.currency} {compareSalesTotal.toLocaleString()}</span></p>
                  <p className="text-[10px] text-slate-400">Change: <span className={`font-bold ${currentMonthSalesTotal >= compareSalesTotal ? 'text-emerald-400' : 'text-red-400'}`}>{compareSalesTotal > 0 ? (((currentMonthSalesTotal - compareSalesTotal) / compareSalesTotal) * 100).toFixed(1) : '—'}%</span></p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-white">Staff Targets (This Month)</h4>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {Object.keys(staffSalesThisMonth).length === 0 ? <p className="text-[10px] text-slate-500">No sales yet.</p> :
                      Object.entries(staffSalesThisMonth).map(([who, amt]) => {
                        const target = parseFloat(salesTargets[who]) || 0;
                        const pct = target > 0 ? Math.min(100, (amt / target) * 100) : 0;
                        return (
                          <div key={who} className="text-[10px]">
                            <div className="flex justify-between text-slate-300"><span>{who}</span><span>{shopProfile.currency} {amt.toLocaleString()}{target ? ` / ${target.toLocaleString()}` : ''}</span></div>
                            {target > 0 && <div className="h-1 bg-slate-900 rounded mt-0.5"><div className="h-1 bg-emerald-500 rounded" style={{ width: pct + '%' }}></div></div>}
                          </div>
                        );
                      })}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-1">
                  <h4 className="text-xs font-bold text-white">Dead Stock Value</h4>
                  <p className="text-lg font-bold text-amber-400">{shopProfile.currency} {deadStockValue.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">{deadStockList.length} item(s) with stock but no sales history</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-sky-400">Layby / Credit Payment Reminders</h4>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-700">
                    {laybyReminderList.length === 0 ? <p className="text-[10px] text-slate-500 py-2">No open layby/credit balances.</p> :
                      laybyReminderList.slice(0, 12).map(s => (
                        <div key={s.id} className="py-1.5 flex justify-between text-[10px] gap-2">
                          <div>
                            <span className="text-white font-semibold">{s.customerName}</span>
                            <span className={`ml-1 px-1 rounded ${s._bucket === 'overdue' ? 'bg-red-500/20 text-red-400' : s._bucket === 'due_soon' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>{s._bucket}</span>
                            <p className="text-slate-500">Due {s._deadline || '—'} · {s.saleType || s.type}</p>
                          </div>
                          <span className="text-amber-400 font-bold whitespace-nowrap">{shopProfile.currency} {s._due.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400">Task / Note Board</h4>
                  <div className="flex gap-1">
                    <input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} placeholder="New task..." className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                    <button type="button" onClick={() => {
                      if (!taskDraft.trim()) return;
                      saveTasks([{ id: 'task-' + Date.now(), text: taskDraft.trim(), done: false, at: new Date().toISOString(), by: currentUser?.name || '' }, ...tasks].slice(0, 100));
                      setTaskDraft('');
                    }} className="px-2 py-1 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded">Add</button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {tasks.length === 0 ? <p className="text-[10px] text-slate-500">No tasks.</p> : tasks.slice(0, 20).map(t => (
                      <div key={t.id} className="flex items-start gap-2 text-[10px]">
                        <input type="checkbox" checked={!!t.done} onChange={() => saveTasks(tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} className="mt-0.5" />
                        <span className={`flex-1 ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{t.text}</span>
                        <button type="button" onClick={() => saveTasks(tasks.filter(x => x.id !== t.id))} className="text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                  {(offlineQueue || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] text-amber-400">Offline queue: {offlineQueue.length} sale(s) waiting to sync.</p>
                      <button type="button" onClick={async () => {
                        const q = [...(offlineQueue || [])];
                        const remaining = [];
                        let synced = 0;
                        for (const job of q) {
                          if (job.type !== 'sale' || !job.payload) { remaining.push(job); continue; }
                          try {
                            const payload = { ...job.payload };
                            if (!payload.branchId && activeBranchId) payload.branchId = activeBranchId;
                            const res = await apiFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              // Permanent client errors should not block forever on stock 409 after local already deducted
                              if (res.status === 409) { synced++; continue; }
                              throw new Error(err.error || 'fail');
                            }
                            synced++;
                          } catch (e) {
                            remaining.push(job);
                          }
                        }
                        saveOfflineQueue(remaining);
                        alert(remaining.length === 0 ? `All ${synced} queued sale(s) synced.` : `${synced} synced, ${remaining.length} still pending.`);
                      }} className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded">Sync now</button>
                    </div>
                  )}
                </div>
              </div>

            </div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              

              

              
            </div>


          </div>
        )}

        {/* 2. POS TERMINAL (Updated with Search Bar & Barcode Scanner Support) */}
        {activeTab === 'pos' && (isAdminUser || canView('pos')) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800 p-5 rounded-xl border border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <input 
                    type="text"
                    placeholder="Search name, SKU or barcode — Press Enter to add..."
                    value={posSearchQuery}
                    onChange={e => setPosSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const query = posSearchQuery.trim().toLowerCase();
                        if (!query) return;
                        const matched = (inventory || []).find(i => {
                          const id = String(i.id || '').toLowerCase();
                          const name = String(i.name || '').toLowerCase();
                          const sku = String(i.sku || i.barcode || '').toLowerCase();
                          return id === query || sku === query || name.includes(query) || sku.includes(query);
                        });
                        if (matched) {
                          addToCart(matched);
                          setPosSearchQuery('');
                        } else {
                          alert(`Item not found for barcode / search: "${posSearchQuery}"`);
                        }
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Filter Category:</span>
                  <select 
                    value={posCategoryFilter} 
                    onChange={e => setPosCategoryFilter(e.target.value)} 
                    className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-semibold rounded px-2.5 py-2 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    {(categories || []).map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(branchInventory || []).filter(i => {
                  const matchesCategory = posCategoryFilter === 'all' || i.category === posCategoryFilter;
                  const q = (posSearchQuery || '').toLowerCase();
                  const matchesSearch = !q || String(i.name || '').toLowerCase().includes(q) || String(i.id || '').toLowerCase().includes(q) || String(i.sku || i.barcode || '').toLowerCase().includes(q);
                  // Show every tenant item in POS (in stock or not); only filter by category / search
                  return matchesCategory && matchesSearch;
                }).map(item => (
                  <div key={item.id} onClick={() => addToCart(item)} className="bg-slate-900 border border-slate-700 rounded-lg p-3 cursor-pointer hover:border-emerald-500 flex flex-col justify-between relative">
                    <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">Stock: {isTrackedInventory(item) ? item.quantity : '∞'}</div>
                    <div>
                      <img src={item.photoUrl} alt="" className="w-full h-24 object-cover rounded-md mb-2" />
                      <p className="font-bold text-xs text-white line-clamp-1">{item.name}{(() => { const vv = parseItemVarianceValues(item); const parts = (itemVariances || []).map(v => vv[v.name]).filter(Boolean); if (!parts.length) parts.push(...[item.size, item.colour].filter(Boolean)); return parts.length ? ` (${parts.join(' / ')})` : ''; })()}</p>
                      <p className="text-[10px] text-slate-400">{item.category}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-xs">{shopProfile.currency} {item.price}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">+ Add</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-3 border-b border-slate-700 pb-2">Checkout Counter</h3>
                <div className="mb-3 space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price List</label>
                    <select value={posPriceList} onChange={e => setPosPriceList(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white mb-2">
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                    </select>
                    <label className="text-[10px] text-slate-400 block mb-1">Select Customer (Mandatory):</label>
                    <select value={posSelectedCustomer} onChange={e => {
                        const name = e.target.value;
                        setPosSelectedCustomer(name);
                        const cust = (customers || []).find(c => c.name === name);
                        if (!cust) return;
                        const term = salesTerms.find(t => t.id === cust.salesTermId) || salesTerms.find(t => t.name === cust.paymentTerm);
                        let saleType = 'Paid';
                        let days = 0;
                        if (term) {
                          saleType = term.type || 'Paid';
                          days = parseInt(term.days, 10) || 0;
                        } else {
                          const el = cust.eligibility || [];
                          if (el.includes('Credit')) { saleType = 'Credit'; days = salesTerms.find(t => t.type === 'Credit')?.days || 30; }
                          else if (el.includes('Layby')) { saleType = 'Layby'; days = salesTerms.find(t => t.type === 'Layby')?.days || 60; }
                          else { saleType = 'Paid'; days = 0; }
                        }
                        setPosSaleType(saleType);
                        if (days > 0) {
                          const d = new Date();
                          d.setDate(d.getDate() + days);
                          setPosDeadline(d.toISOString().split('T')[0]);
                        } else {
                          setPosDeadline('');
                        }
                      }} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" required>
                      <option value="">-- Choose Customer --</option>
                      {(customers || []).map(c => <option key={c.id} value={c.name}>{c.name} (Eligible: {(c.eligibility || ['Paid']).join(', ')}{c.paymentTerm ? ` · ${c.paymentTerm}` : ''})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Sale Type:</label>
                      <select value={posSaleType} onChange={e => setPosSaleType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-emerald-400 font-bold">
                        <option value="Paid">Paid (Cash / M-Pesa)</option>
                        <option value="Credit">Credit</option>
                        <option value="Layby">Layby</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Sale Date:</label>
                      <input 
                        type="date" 
                        value={posSaleDate} 
                        onChange={e => setPosSaleDate(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
                  {posCart.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-4">Cart is empty.</p> : posCart.map(i => {
                    return (
                      <div key={i.id} className="bg-slate-900 p-2.5 rounded border border-slate-700 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-white">{i.name}</p>
                          <button onClick={() => removeFromCart(i.id)} className="text-red-400 font-bold text-xs hover:text-red-300">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Price ({shopProfile.currency}):</label>
                            <input 
                              type="number"
                              value={i.price}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                setPosCart(posCart.map(ci => ci.id === i.id ? { ...ci, price: newPrice } : ci));
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 block mb-0.5">Quantity:</label>
                            <div className="flex items-center border border-slate-700 rounded bg-slate-950">
                              <button onClick={() => {
                                const updated = posCart.map(ci => ci.id === i.id ? { ...ci, cartQty: Math.max(1, ci.cartQty - 1) } : ci);
                                setPosCart(updated);
                              }} className="px-2 py-1 text-slate-400 hover:text-white font-bold">-</button>
                              <input 
                                type="number" 
                                min="1"
                                value={i.cartQty}
                                onChange={(e) => {
                                  const q = parseInt(e.target.value) || 1;
                                  const live = (inventory || []).find(x => x.id === i.id) || i;
                                  const avail = Number(live.quantity) || 0;
                                  if (isTrackedInventory(i) && q > avail) {
                                    alert('Stock limit reached.');
                                    return;
                                  }
                                  setPosCart(posCart.map(ci => ci.id === i.id ? { ...ci, cartQty: q } : ci));
                                }}
                                className="w-full bg-transparent text-center font-mono font-bold text-white text-xs focus:outline-none"
                              />
                              <button onClick={() => {
                                const live = (inventory || []).find(x => x.id === i.id) || i;
                                const avail = Number(live.quantity) || 0;
                                if (isTrackedInventory(i) && i.cartQty >= avail) {
                                  alert('Stock limit reached.');
                                  return;
                                }
                                const updated = posCart.map(ci => ci.id === i.id ? { ...ci, cartQty: ci.cartQty + 1 } : ci);
                                setPosCart(updated);
                              }} className="px-2 py-1 text-slate-400 hover:text-white font-bold">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 border-t border-slate-700 pt-3">
                  <div className="space-y-1.5 bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px]">
                        <span className="text-slate-300 font-semibold">{taxSettings.salesTaxName || 'VAT'} / Sales Tax</span>
                        <span className="text-slate-500 ml-1">({taxSettings.salesTaxRate}%)</span>
                      </div>
                      <button type="button" onClick={() => setPosApplyTax(!posApplyTax)} className="flex items-center gap-1 text-xs">
                        <span className={posApplyTax ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{posApplyTax ? 'ON' : 'OFF'}</span>
                        {posApplyTax ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                      </button>
                    </div>
                    {posApplyTax && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setPosTaxInclusive(false)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${!posTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-700'}`}>Exclusive</button>
                        <button type="button" onClick={() => setPosTaxInclusive(true)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${posTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-700'}`}>Inclusive</button>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const sub = posCart.reduce((sum, i) => sum + (i.price * i.cartQty), 0);
                    let tax = 0, total = sub;
                    if (posApplyTax && taxSettings.salesTaxRate > 0) {
                      if (posTaxInclusive) {
                        tax = sub - (sub / (1 + taxSettings.salesTaxRate / 100));
                        total = sub;
                      } else {
                        tax = sub * (taxSettings.salesTaxRate / 100);
                        total = sub + tax;
                      }
                    }
                    return (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Subtotal:</span>
                          <span className="text-sm font-bold text-white">{shopProfile.currency} {sub.toLocaleString()}</span>
                        </div>
                        {posApplyTax && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">{taxSettings.salesTaxName || 'VAT'} ({taxSettings.salesTaxRate}%):</span>
                            <span className="text-sm font-semibold text-amber-400">{shopProfile.currency} {tax.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Total Cart Amount:</span>
                          <span className="text-sm font-bold text-emerald-400">{shopProfile.currency} {total.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        </div>
                      </>
                    );
                  })()}

                  {loyaltySettings.enabled && posSelectedCustomer && (() => {
                    const cust = customers.find(c => c.name === posSelectedCustomer);
                    const pts = parseFloat(cust?.loyaltyPoints) || 0;
                    const vpp = parseFloat(loyaltySettings.redeemValue) || 1;
                    const sub = posCart.reduce((sum, i) => sum + (i.price * i.cartQty), 0);
                    let total = sub;
                    if (posApplyTax && taxSettings.salesTaxRate > 0 && !posTaxInclusive) {
                      total = sub + sub * (taxSettings.salesTaxRate / 100);
                    }
                    const maxPts = Math.min(pts, vpp > 0 ? Math.floor(total / vpp) : 0);
                    const redeemPts = Math.min(maxPts, Math.max(0, Math.floor(parseFloat(posRedeemPoints) || 0)));
                    const credit = redeemPts * vpp;
                    return (
                      <div className="bg-slate-900 border border-slate-700 rounded p-2 space-y-1.5 mt-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Loyalty points</span>
                          <span className="text-emerald-400 font-bold">{pts.toLocaleString()} pts</span>
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-0.5">Redeem points (max {maxPts})</label>
                            <input type="number" min="0" max={maxPts} value={posRedeemPoints} onChange={e => setPosRedeemPoints(e.target.value)} placeholder="0" className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white" />
                          </div>
                          <button type="button" onClick={() => setPosRedeemPoints(String(maxPts))} className="px-2 py-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">Max</button>
                          <button type="button" onClick={() => setPosRedeemPoints('')} className="px-2 py-1.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded">Clear</button>
                        </div>
                        {credit > 0 && (
                          <p className="text-[10px] text-sky-400">Credit: {shopProfile.currency} {credit.toLocaleString()} ({redeemPts} pts × {vpp})</p>
                        )}
                        <p className="text-[9px] text-slate-500">1 pt = {shopProfile.currency} {vpp}. Earn on cash/M-Pesa only (not on redeemed credit).</p>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Cash Paid ({shopProfile.currency}):</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={posCashPaid}
                        onChange={e => setPosCashPaid(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">M-Pesa Paid ({shopProfile.currency}):</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={posMpesaPaid}
                        onChange={e => setPosMpesaPaid(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {parseFloat(posMpesaPaid || 0) > 0 && (
                    <div className="mt-1">
                      <label className="text-[10px] text-emerald-400 block mb-1">M-Pesa Transaction Number:</label>
                      <input type="text" placeholder="e.g. QHX8920KL" value={posMpesaCode} onChange={e => setPosMpesaCode(e.target.value.toUpperCase())} className="w-full bg-slate-900 border border-emerald-500/50 rounded px-2 py-1 text-xs text-white" />
                    </div>
                  )}

                  {(() => {
                    const sub = posCart.reduce((sum, i) => sum + (i.price * i.cartQty), 0);
                    let totalCartAmt = sub;
                    if (posApplyTax && taxSettings.salesTaxRate > 0 && !posTaxInclusive) {
                      totalCartAmt = sub + sub * (taxSettings.salesTaxRate / 100);
                    }
                    const _custL = customers.find(c => c.name === posSelectedCustomer);
                    const _vpp = parseFloat(loyaltySettings.redeemValue) || 1;
                    const _rPts = loyaltySettings.enabled ? Math.min(parseFloat(_custL?.loyaltyPoints)||0, Math.floor(parseFloat(posRedeemPoints)||0)) : 0;
                    const paidTotal = (parseFloat(posCashPaid) || 0) + (parseFloat(posMpesaPaid) || 0) + (_rPts * _vpp);
                    const balanceDueCalc = Math.max(0, totalCartAmt - paidTotal);
                    return (
                      <div className="bg-slate-900 p-2 rounded border border-slate-700 flex justify-between items-center text-xs mt-2">
                        <span className="text-amber-400 font-semibold">Balance Due:</span>
                        <span className="font-bold text-amber-400">{shopProfile.currency} {balanceDueCalc.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                      </div>
                    );
                  })()}

                  {posSaleType !== 'Paid' && (
                    <div className="mt-2">
                      <label className="text-[10px] text-amber-400 block mb-1">Repayment Deadline Date:</label>
                      <input type="date" value={posDeadline} onChange={e => setPosDeadline(e.target.value)} className="w-full bg-slate-900 border border-amber-500/50 rounded px-2 py-1.5 text-xs text-white" />
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-700 mt-3">
                {(isAdminUser || canCreate('pos')) ? (
                  <button onClick={handleCheckout} disabled={posCart.length === 0 || !posSelectedCustomer} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg text-xs">Complete Sale</button>
                ) : (
                  <p className="text-[10px] text-center text-amber-400">No create privilege for POS.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. SALES LEDGER */}
        {activeTab === 'sales' && (isAdminUser || canView('sales')) && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Customer List</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Click any row to edit customer contact information or eligibility.</p>
                </div>
                {(isAdminUser || canCreate('customers')) && (
                  <button onClick={() => setNewCustomerModalOpen(true)} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Add New Customer
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Customer Name</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filterOwn('customers', customers || []).map(cust => (
                      <tr 
                        key={cust.id} 
                        onClick={() => setSelectedCustomer(cust)}
                        className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-semibold text-white">{cust.name}</td>
                        <td className="py-3 px-3">{cust.phone || 'N/A'}</td>
                        <td className="py-3 px-3">{cust.location}</td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {(cust.eligibility || ['Paid']).map(el => (
                              <span key={el} className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px]">{el}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
                <button type="button" onClick={() => setSalesLedgerSubTab('ledger')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${salesLedgerSubTab === 'ledger' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>Sales Ledger</button>
                <button type="button" onClick={() => setSalesLedgerSubTab('cashup')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${salesLedgerSubTab === 'cashup' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>Cash-up / Shift Close</button>
              </div>

              {salesLedgerSubTab === 'cashup' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Daily Cash-up / Shift Close</h4>
                    <button type="button" onClick={() => setCashUpForm({ countedCash: '', countedMpesa: '', notes: '' })} className="text-[10px] text-slate-400">Clear form</button>
                  </div>
                  <p className="text-[10px] text-slate-500">Expected from books — Cash {shopProfile.currency} {cashAtHandAccount.toLocaleString()} · M-Pesa {shopProfile.currency} {mpesaAccountBalance.toLocaleString()}. Record counted amounts only (does not change sales).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-slate-400">Counted Cash</label>
                      <input type="number" step="0.01" value={cashUpForm.countedCash} onChange={e => setCashUpForm({ ...cashUpForm, countedCash: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-400">Counted M-Pesa</label>
                      <input type="number" step="0.01" value={cashUpForm.countedMpesa} onChange={e => setCashUpForm({ ...cashUpForm, countedMpesa: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" /></div>
                    <div><label className="text-[10px] text-slate-400">Notes</label>
                      <input type="text" value={cashUpForm.notes} onChange={e => setCashUpForm({ ...cashUpForm, notes: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" /></div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-[10px]">
                    <span className="text-slate-400">Cash variance: <span className={`font-bold ${((parseFloat(cashUpForm.countedCash)||0) - cashAtHandAccount) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{shopProfile.currency} {((parseFloat(cashUpForm.countedCash)||0) - cashAtHandAccount).toLocaleString()}</span></span>
                    <span className="text-slate-400">M-Pesa variance: <span className={`font-bold ${((parseFloat(cashUpForm.countedMpesa)||0) - mpesaAccountBalance) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{shopProfile.currency} {((parseFloat(cashUpForm.countedMpesa)||0) - mpesaAccountBalance).toLocaleString()}</span></span>
                    <button type="button" onClick={() => {
                      const entry = {
                        id: 'cashup-' + Date.now(),
                        at: new Date().toISOString(),
                        by: currentUser?.name || currentUser?.id || 'Staff',
                        branchId: activeBranchId && activeBranchId !== 'all' ? activeBranchId : '',
                        expectedCash: cashAtHandAccount,
                        expectedMpesa: mpesaAccountBalance,
                        countedCash: parseFloat(cashUpForm.countedCash) || 0,
                        countedMpesa: parseFloat(cashUpForm.countedMpesa) || 0,
                        varCash: (parseFloat(cashUpForm.countedCash) || 0) - cashAtHandAccount,
                        varMpesa: (parseFloat(cashUpForm.countedMpesa) || 0) - mpesaAccountBalance,
                        notes: cashUpForm.notes || ''
                      };
                      saveCashUps([entry, ...cashUpHistory].slice(0, 90));
                      if (typeof logAudit === 'function') logAudit('cashup', 'cash', entry.id);
                      alert('Cash-up saved.');
                      setCashUpForm({ countedCash: '', countedMpesa: '', notes: '' });
                    }} className="ml-auto px-3 py-1.5 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded">Save Cash-up</button>
                  </div>
                  {cashUpHistory.length > 0 && (
                    <div className="overflow-x-auto max-h-28">
                      <table className="w-full text-[10px] text-slate-400"><thead><tr><th className="text-left py-1">When</th><th className="text-left">By</th><th className="text-left">Cash var</th><th className="text-left">M-Pesa var</th><th className="text-left">Notes</th></tr></thead>
                        <tbody>{cashUpHistory.slice(0, 8).map(cu => (
                          <tr key={cu.id}><td className="py-0.5">{cu.at ? new Date(cu.at).toLocaleString() : ''}</td><td>{cu.by}</td><td className={cu.varCash ? 'text-amber-400' : 'text-emerald-400'}>{cu.varCash}</td><td className={cu.varMpesa ? 'text-amber-400' : 'text-emerald-400'}>{cu.varMpesa}</td><td>{cu.notes}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {salesLedgerSubTab === 'ledger' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">Sales Ledger</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Click any row to inspect, print past sale receipt, update payment, or manage transaction records.</p>
                    </div>
                    <button type="button" onClick={() => exportRowsAsPdf('Sales Report', filterOwn('sales', sales || []).map(s => ({ id: s.id, date: s.date, customer: s.customerName, type: s.saleType || s.type, total: s.totalAmount, paid: s.paidAmount, balance: s.balanceDue, payment: s.paymentMethod, cashier: s.cashier || s.createdBy })))} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded flex items-center gap-1"><Download className="w-3 h-3" /> Download PDF</button>
                  </div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <input aria-label="Sales date from" type="date" value={salesDateStart} onChange={e=>setSalesDateStart(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <input aria-label="Sales date to" type="date" value={salesDateEnd} onChange={e=>setSalesDateEnd(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <select value={salesCustomerFilter} onChange={e=>setSalesCustomerFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Customers</option>{customers.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                <select value={salesTypeFilter} onChange={e=>setSalesTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Types</option>{['Paid','Credit','Layby','Returned'].map(v=><option key={v}>{v}</option>)}</select>
                <select value={salesPaymentFilter} onChange={e=>setSalesPaymentFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Payment Methods</option>{paymentMethods.map(pm=><option key={pm.id} value={pm.name}>{pm.name}</option>)}</select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">No.</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance Due</th>
                      <th className="py-2 px-3">Payment Method</th>
                      <th className="py-2 px-3">M-pesa TXN No.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {(filterOwn('sales', branchSales || []).filter(s => (!salesDateStart || String(s.date||'').slice(0,10) >= salesDateStart) && (!salesDateEnd || String(s.date||'').slice(0,10) <= salesDateEnd) && (!salesCustomerFilter || s.customerName === salesCustomerFilter) && (!salesTypeFilter || (s.saleType||s.type) === salesTypeFilter) && (!salesPaymentFilter || s.paymentMethod === salesPaymentFilter)).slice((salesPage - 1) * salesPerPage, salesPage * salesPerPage).map((s, idx) => {
                      const absoluteIndex = (salesPage - 1) * salesPerPage + idx;
                      return (
                        <tr 
                          key={s.id} 
                          onClick={() => setSelectedSaleItem({ ...s, items: parseSaleItems(s) })}
                          className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-mono text-emerald-400">{absoluteIndex + 1}</td>
                          <td className="py-3 px-3">{s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}</td>
                          <td className="py-3 px-3 font-semibold text-white">{s.customerName}</td>
                          <td className="py-3 px-3"><span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold text-[10px]">{s.saleType}</span></td>
                          <td className="py-3 px-3 font-bold text-emerald-400">{shopProfile.currency} {s.totalAmount?.toLocaleString()}</td>
                          <td className="py-3 px-3 font-bold text-amber-400">{shopProfile.currency} {s.balanceDue?.toLocaleString()}</td>
                          <td className="py-3 px-3">{s.paymentMethod}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-300">{s.mpesaCode && s.mpesaCode !== 'N/A' ? s.mpesaCode : '—'}</td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
              {Math.ceil(filterOwn('sales', sales || []).length / salesPerPage) > 1 && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-700 text-xs">
                  <span className="text-slate-400">Showing page {salesPage} of {Math.ceil(filterOwn('sales', sales || []).length / salesPerPage)} (Total records: {filterOwn('sales', sales || []).length})</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                      disabled={salesPage === 1}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded disabled:opacity-50 text-white font-bold"
                    >
                      Previous
                    </button>
                    <button 
                      onClick={() => setSalesPage(p => Math.min(Math.ceil(filterOwn('sales', sales || []).length / salesPerPage), p + 1))}
                      disabled={salesPage === Math.ceil(filterOwn('sales', sales || []).length / salesPerPage)}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded disabled:opacity-50 text-white font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

                </div>
              )}
            </div>

          </div>
        )}

        {/* 4. ITEM & INVENTORY TAB */}
        {activeTab === 'inventory' && (isAdminUser || canView('inventory')) && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Item & Inventory Management</h3>
                <p className="text-xs text-slate-400 mt-0.5">Click any row to edit item details, pricing, or stock levels.</p>
              </div>
              {(isAdminUser || canCreate('inventory')) && (
                <button onClick={() => setNewItemModalOpen(true)} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={inventoryCategoryFilter} onChange={e=>setInventoryCategoryFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Categories</option>{[...new Set((inventory||[]).map(i=>i.category).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select>
              <select value={inventoryTrackFilter} onChange={e=>setInventoryTrackFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">Track Inventory: All</option><option value="yes">Tracked</option><option value="no">Not Tracked</option></select>
              <select value={inventoryStatusFilter} onChange={e=>setInventoryStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Statuses</option>{[...new Set((inventory||[]).map(i=>i.status).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select>
            </div>
            <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700">
              {[
                { id: 'items', label: 'Items & Low Stock' },
                { id: 'transfer', label: 'Transfer Between Locations' },
                { id: 'movements', label: 'Stock Movement History' }
              ].map(t => (
                <button key={t.id} type="button" onClick={() => setInventorySubTab(t.id)} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${inventorySubTab === t.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{t.label}</button>
              ))}
            </div>
            {inventorySubTab === 'transfer' && (
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Transfer between locations</h4>
              <p className="text-[10px] text-slate-400">Choose source and destination, then add item rows. Categories, customers, suppliers, payment methods, terms and HR stay shared for the parent business.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Source location</label>
                  <select value={transferForm.fromBranchId || activeBranchId || ''} onChange={e => setTransferForm({ ...transferForm, fromBranchId: e.target.value, lines: transferForm.lines && transferForm.lines.length ? transferForm.lines : [{ itemId: '', qty: '' }] })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    <option value="">— Select source —</option>
                    {(accessibleBranches || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (default)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Destination location</label>
                  <select value={transferForm.toBranchId || ''} onChange={e => setTransferForm({ ...transferForm, toBranchId: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    <option value="">— Select destination —</option>
                    {(accessibleBranches || []).filter(b => b.id !== (transferForm.fromBranchId || activeBranchId)).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Items to transfer</p>
                  <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded" onClick={() => setTransferForm({ ...transferForm, lines: [...(transferForm.lines || [{ itemId: '', qty: '' }]), { itemId: '', qty: '' }] })}>+ Add item row</button>
                </div>
                {(transferForm.lines || [{ itemId: '', qty: '' }]).map((line, idx) => {
                  const srcId = transferForm.fromBranchId || activeBranchId;
                  const srcItems = (inventory || []).filter(i => {
                    if (!isTrackedInventory(i) || (Number(i.quantity) || 0) <= 0) return false;
                    if (!srcId) return true;
                    // Items with explicit branch must match source; items without branchId are legacy/shared and selectable from any source
                    if (!i.branchId) return true;
                    return String(i.branchId) === String(srcId);
                  });
                  return (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center">
                      <select value={line.itemId || ''} onChange={e => {
                        const lines = [...(transferForm.lines || [{ itemId: '', qty: '' }])];
                        lines[idx] = { ...lines[idx], itemId: e.target.value };
                        setTransferForm({ ...transferForm, lines });
                      }} className="sm:col-span-7 bg-slate-900 border border-slate-700 rounded p-2 text-white">
                        <option value="">Select item</option>
                        {srcItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name} (qty {i.quantity})</option>
                        ))}
                      </select>
                      <input type="number" min="1" placeholder="Qty" value={line.qty || ''} onChange={e => {
                        const lines = [...(transferForm.lines || [{ itemId: '', qty: '' }])];
                        lines[idx] = { ...lines[idx], qty: e.target.value };
                        setTransferForm({ ...transferForm, lines });
                      }} className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                      <button type="button" className="sm:col-span-2 px-2 py-2 bg-red-500/20 text-red-400 text-[10px] font-bold rounded" onClick={() => {
                        const lines = (transferForm.lines || []).filter((_, i) => i !== idx);
                        setTransferForm({ ...transferForm, lines: lines.length ? lines : [{ itemId: '', qty: '' }] });
                      }}>Remove</button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="bg-sky-500 text-slate-950 font-bold rounded px-4 py-2 text-xs" onClick={async () => {
                const fromB = transferForm.fromBranchId || activeBranchId;
                const toB = transferForm.toBranchId;
                const lines = (transferForm.lines || []).filter(l => l.itemId && (parseInt(l.qty, 10) || 0) > 0);
                if (!fromB || !toB) return alert('Select source and destination locations');
                if (String(fromB) === String(toB)) return alert('Source and destination must differ');
                if (!lines.length) return alert('Add at least one item with quantity');
                let ok = 0;
                const mvExtra = [];
                for (const line of lines) {
                  const qty = parseInt(line.qty, 10) || 0;
                  const res = await apiFetch('/api/stock-transfer', { method: 'POST', body: JSON.stringify({ fromItemId: line.itemId, toBranchId: toB, qty }) });
                  const d = await res.json().catch(() => ({}));
                  if (!res.ok) { alert(d.error || 'Transfer failed for an item'); continue; }
                  ok++;
                  if (d.from) setInventory(prev => prev.map(i => i.id === d.from.id ? { ...i, ...d.from } : i));
                  if (d.to) {
                    setInventory(prev => {
                      const exists = prev.some(i => i.id === d.to.id);
                      return exists ? prev.map(i => i.id === d.to.id ? { ...i, ...d.to } : i) : [d.to, ...prev];
                    });
                  }
                  const src = (inventory || []).find(i => i.id === line.itemId);
                  const destName = (branches || []).find(b => b.id === toB)?.name || toB;
                  mvExtra.push(
                    { id: 'mv-' + Date.now() + '-' + ok, at: new Date().toISOString(), itemName: src?.name || d.from?.name, qtyChange: -qty, reason: 'Transfer out', ref: destName, user: currentUser?.name || '' },
                    { id: 'mv-' + Date.now() + '-in-' + ok, at: new Date().toISOString(), itemName: d.to?.name || src?.name, qtyChange: qty, reason: 'Transfer in', ref: destName, user: currentUser?.name || '' }
                  );
                }
                if (mvExtra.length && typeof saveStockMovements === 'function') {
                  saveStockMovements([...mvExtra, ...(stockMovements || [])]);
                } else if (mvExtra.length) {
                  const nextMv = [...mvExtra, ...(stockMovements || [])];
                  setStockMovements(nextMv);
                }
                setTransferForm({ fromBranchId: fromB, toBranchId: '', lines: [{ itemId: '', qty: '' }] });
                if (ok) alert('Stock transferred (' + ok + ' line(s)).');
              }}>Transfer all lines</button>
            </div>
            )}

            {inventorySubTab === 'movements' && (
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Stock Movement History</h4>
                <button type="button" onClick={() => {
                  const tid = (tenantInfo && tenantInfo.id) || '';
                  const bid = activeBranchId || (currentBranchId !== 'all' ? currentBranchId : '');
                  const filtered = (stockMovements || []).filter(m => {
                    if (m.tenantId && tid && m.tenantId !== tid) return false;
                    if (bid && m.branchId && m.branchId !== bid) return false;
                    return true;
                  }).map(m => ({
                    when: m.at ? new Date(m.at).toLocaleString() : '',
                    item: m.itemName,
                    qtyChange: m.qtyChange,
                    reason: m.reason,
                    ref: m.ref,
                    user: m.user
                  }));
                  exportRowsAsPdf('Stock Movement History', filtered);
                }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
              </div>
              <p className="text-[10px] text-slate-500">Showing movements for this shop{currentBranchId && currentBranchId !== 'all' ? ' and selected location' : ''} only.</p>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs text-slate-300 min-w-[520px]">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]"><tr><th className="py-1 px-2">When</th><th className="py-1 px-2">Item</th><th className="py-1 px-2">Qty Δ</th><th className="py-1 px-2">Reason</th><th className="py-1 px-2">Ref</th><th className="py-1 px-2">User</th></tr></thead>
                  <tbody className="divide-y divide-slate-700">
                    {(() => {
                      const tid = (tenantInfo && tenantInfo.id) || '';
                      const bid = activeBranchId || (currentBranchId !== 'all' ? currentBranchId : '');
                      const filtered = (stockMovements || []).filter(m => {
                        if (m.tenantId && tid && m.tenantId !== tid) return false;
                        if (bid && m.branchId && m.branchId !== bid) return false;
                        if (bid && !m.branchId) {
                          // legacy rows without branchId: show only when viewing all locations, or if single-branch shop
                          if (currentBranchId === 'all') return true;
                          if ((branches || []).length <= 1) return true;
                          return false;
                        }
                        return true;
                      });
                      if (!filtered.length) return <tr><td colSpan={6} className="py-3 text-center text-slate-500">No movements logged yet for this location.</td></tr>;
                      return filtered.slice(0, 50).map(m => (
                        <tr key={m.id}><td className="py-1 px-2 whitespace-nowrap">{m.at ? new Date(m.at).toLocaleString() : ''}</td><td className="py-1 px-2">{m.itemName}</td><td className={`py-1 px-2 font-bold ${(m.qtyChange||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(m.qtyChange||0) > 0 ? '+' : ''}{m.qtyChange}</td><td className="py-1 px-2">{m.reason}</td><td className="py-1 px-2 font-mono text-[10px]">{m.ref}</td><td className="py-1 px-2">{m.user}</td></tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            )}
            {inventorySubTab === 'items' && (
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
                <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Stock Qty</th>
                    <th className="py-2 px-3">Track Inventory</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filterOwn('inventory', branchInventory || []).filter(item => (!inventoryCategoryFilter || item.category===inventoryCategoryFilter) && (!inventoryTrackFilter || (inventoryTrackFilter==='yes' ? !!item.trackInventory : !item.trackInventory)) && (!inventoryStatusFilter || item.status===inventoryStatusFilter)).map(item => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedInventoryItem(item)}
                      className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold text-white">{item.name}</td>
                      <td className="py-2 px-3">{item.category}</td>
                      <td className="py-2 px-3 font-bold text-emerald-400">{shopProfile.currency} {item.price}</td>
                      <td className="py-2 px-3 font-mono">{item.trackInventory ? item.quantity : 'Not Tracked'}</td>
                      <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.trackInventory ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{item.trackInventory ? 'Yes' : 'No'}</span></td>
                      <td className="py-2 px-3"><span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {activeTab === 'purchase' && (isAdminUser || canView('purchase') || canView('suppliers')) && (
          <div className="space-y-8">
            {/* Supplier List — privilege tab: suppliers (located under Purchase like customers under Sales) */}
            {(isAdminUser || canView('suppliers') || canView('purchase')) && (
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Supplier List</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Click any row to edit supplier details, location, and credit terms.</p>
                </div>
                {(isAdminUser || canCreate('suppliers') || canCreate('purchase')) && (
                  <button onClick={() => setNewSupplierModalOpen(true)} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> New Supplier
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Supplier Name</th>
                      <th className="py-2 px-3">Phone No.</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Credit Terms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {suppliers.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-slate-400">No suppliers added yet.</td></tr>
                    ) : (
                      filterOwn('suppliers', suppliers).map(sup => (
                        <tr key={sup.id} onClick={() => setSelectedSupplier(sup)} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">{sup.name}</td>
                          <td className="py-3 px-3">{sup.phone || 'N/A'}</td>
                          <td className="py-3 px-3">{sup.email || 'N/A'}</td>
                          <td className="py-3 px-3">{sup.location || 'N/A'}</td>
                          <td className="py-3 px-3">
                            <span className="bg-slate-900 px-2 py-1 rounded text-emerald-400 font-bold border border-slate-700">
                              {sup.creditTermType === 'Credit' ? `Credit (${sup.creditDays} days)` : sup.creditTermType}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Supplier Performance Snapshot</h4>
                <p className="text-[10px] text-slate-500">Total spend, return rate, and on-time receive rate from purchase orders.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 min-w-[520px]">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]"><tr>
                      <th className="py-2 px-2">Supplier</th><th className="py-2 px-2">Orders</th><th className="py-2 px-2">Total Spend</th><th className="py-2 px-2">Return Rate</th><th className="py-2 px-2">On-Time Receive</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {supplierPerformanceList.length === 0 ? (
                        <tr><td colSpan={5} className="py-3 text-center text-slate-500">No supplier data.</td></tr>
                      ) : supplierPerformanceList.map(sp => (
                        <tr key={sp.id}>
                          <td className="py-2 px-2 font-semibold text-white">{sp.name}</td>
                          <td className="py-2 px-2">{sp.orders}</td>
                          <td className="py-2 px-2 text-emerald-400 font-bold">{shopProfile.currency} {Number(sp.totalSpend||0).toLocaleString()}</td>
                          <td className="py-2 px-2">{Number(sp.returnRate||0).toFixed(0)}% ({sp.returnedCount})</td>
                          <td className="py-2 px-2">{Number(sp.onTimeRate||0).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

            {/* Purchase Orders below suppliers */}
            {(isAdminUser || canView('purchase')) && (
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-white">Purchase Orders</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Draft → Approve → Receive (stock in) → Pay / Partial → optional Purchase Return. Status only via these actions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => exportRowsAsPdf('Purchase Orders', filterOwn('purchase', purchaseOrders || []).map(po => ({ id: po.id, date: po.date, supplier: po.supplierName, item: po.itemName, qty: po.quantity, amount: po.amount, paid: po.paidAmount, balance: po.balanceDue, status: po.workflowStatus || po.paymentStatus, method: po.paymentMethod, mpesa: po.mpesaCode || '' })))} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Download PDF</button>
                  {(isAdminUser || canCreate('purchase')) && (
                    <button onClick={() => setNewPOModalOpen(true)} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Create Purchase Order
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <select value={poSupplierFilter} onChange={e=>setPoSupplierFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Suppliers</option>{suppliers.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}</select>
                <input type="date" aria-label="Purchase order from" value={poDateStart} onChange={e=>setPoDateStart(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <input type="date" aria-label="Purchase order to" value={poDateEnd} onChange={e=>setPoDateEnd(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
                <select value={poItemFilter} onChange={e=>setPoItemFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Items</option>{inventory.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}</select>
                <select value={poStatusFilter} onChange={e=>setPoStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Workflow Statuses</option>{['Draft','Approved','Received','Payment','Purchase Return'].map(v=><option key={v} value={v}>{v === 'Purchase Return' ? 'P. Return' : v}</option>)}</select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">No.</th>
                      <th className="py-2 px-3">PO ID</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Supplier</th>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Cost</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance Due</th>
                      <th className="py-2 px-3">Payment Status</th>
                      <th className="py-2 px-3">Workflow Status</th>
                      <th className="py-2 px-3">Created By</th>
                      <th className="py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filterOwn('purchase', branchPurchaseOrders).length === 0 ? (
                      <tr><td colSpan={13} className="py-4 text-center text-slate-400">No purchase orders created.</td></tr>
                    ) : (
                      filterOwn('purchase', branchPurchaseOrders).filter(po => (!poSupplierFilter || po.supplierName===poSupplierFilter) && (!poDateStart || String(po.date||'').slice(0,10)>=poDateStart) && (!poDateEnd || String(po.date||'').slice(0,10)<=poDateEnd) && (!poItemFilter || po.itemName===poItemFilter) && (!poStatusFilter || po.workflowStatus===poStatusFilter)).slice((poPage - 1) * poPerPage, poPage * poPerPage).map((po, idx) => {
                        const absoluteIndex = (poPage - 1) * poPerPage + idx;
                        return (
                          <tr key={po.id} onClick={() => setSelectedPO(po)} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                            <td className="py-3 px-3 font-mono text-slate-400">{absoluteIndex + 1}</td>
                            <td className="py-3 px-3 font-mono text-emerald-400">{po.id}</td>
                            <td className="py-3 px-3">{po.date}</td>
                            <td className="py-3 px-3 font-semibold text-white">{po.supplierName}</td>
                            <td className="py-3 px-3">{po.itemName}</td>
                            <td className="py-3 px-3 font-mono">{po.quantity}</td>
                            <td className="py-3 px-3">{shopProfile.currency} {po.cost || 0}</td>
                            <td className="py-3 px-3 font-bold text-emerald-400">{shopProfile.currency} {po.amount?.toLocaleString()}</td>
                            <td className="py-3 px-3 font-bold text-amber-400">{shopProfile.currency} {po.balanceDue?.toLocaleString()}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${po.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : po.paymentStatus === 'Partial Paid' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {po.paymentStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <span className="inline-block bg-slate-900 text-slate-200 px-2.5 py-1 rounded border border-slate-700 font-bold whitespace-nowrap">
                                {po.workflowStatus === 'Purchase Return' ? 'P. Return' : po.workflowStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sky-400 font-semibold">{po.createdBy || '—'}</td>
                            <td className="py-3 px-3 space-x-1" onClick={e => e.stopPropagation()}>
                              {po.workflowStatus === 'Draft' && (isAdminUser || canUpdate('purchase')) && (
                                <button onClick={async () => {
                                    const amt = parseFloat(po.amount) || 0;
                                    const paid = parseFloat(po.paidAmount) || 0;
                                    const updated = {
                                      ...po,
                                      workflowStatus: 'Approved',
                                      bookedPayable: amt,
                                      paidAmount: paid,
                                      balanceDue: Math.max(0, amt - paid),
                                      paymentStatus: paid <= 0 ? 'Unpaid' : (paid >= amt ? 'Paid' : 'Partial'),
                                      received: false
                                    };
                                    await upsertPO(updated);
                                  }} className="px-2 py-1 bg-blue-500/20 text-blue-400 font-bold rounded text-[10px]">Approve</button>
                              )}
                              {po.workflowStatus === 'Draft' && (isAdminUser || canDelete('purchase')) && (
                                  <button onClick={async () => {
                                    if (!window.confirm('Are you sure you want to delete this draft purchase order?')) return;
                                    const res = await apiFetch(`/api/purchase_orders/${po.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      const gid = po.groupId;
                                      const removedIds = new Set([po.id, ...((purchaseOrders || []).filter(p => gid && p.groupId === gid).map(p => p.id))]);
                                      setPurchaseOrders(purchaseOrders.filter(p => p.id !== po.id && (!gid || p.groupId !== gid)));
                                      const nextMv = (stockMovements || []).filter(m => !removedIds.has(m.ref) && m.ref !== po.id);
                                      if (typeof saveStockMovements === 'function') saveStockMovements(nextMv);
                                      else setStockMovements(nextMv);
                                      removedIds.forEach(rid => {
                                        apiFetch('/api/stock-movements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: rid }) }).catch(() => {});
                                      });
                                      if (selectedPO && (selectedPO.id === po.id || (gid && selectedPO.groupId === gid))) setSelectedPO(null);
                                    } else {
                                      alert('Failed to delete purchase order.');
                                    }
                                  }} className="px-2 py-1 bg-red-500/20 text-red-400 font-bold rounded text-[10px]">Delete</button>
                              )}
                              {po.workflowStatus === 'Approved' && (isAdminUser || canUpdate('purchase')) && (
                                <button onClick={async () => {
                                  if (po.received) { alert('This PO was already received.'); return; }
                                  const matchedInv = inventory.find(inv => inv.id === po.itemId || (inv.name || '').toLowerCase() === (po.itemName || '').toLowerCase());
                                  if (!matchedInv) { alert(`Inventory item ${po.itemName || po.itemId} was not found. Create or link the inventory item before receiving.`); return; }
                                  try {
                                    const receiveRes = await apiFetch('/api/purchase-receive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poId: po.id }) });
                                    const receiveData = await receiveRes.json().catch(() => ({}));
                                    if (!receiveRes.ok) throw new Error(receiveData.error || 'Purchase receipt failed.');
                                    const updatedPO = { ...po, ...receiveData.purchaseOrder, received: true, workflowStatus: 'Received', receivedDate: new Date().toISOString().slice(0, 10) };
                                    setPurchaseOrders((prev) => prev.map(p => p.id === po.id ? updatedPO : p));
                                    if (receiveData.inventory) setInventory((prev) => prev.map(inv => inv.id === receiveData.inventory.id ? { ...inv, ...receiveData.inventory } : inv));
                                    if (typeof logStock === 'function') logStock(matchedInv.id, matchedInv.name, receiveData.receivedQty || 0, 'PO Receive', po.id);
                                  } catch (err) { alert(err.message || 'Purchase receipt failed. Stock and PO were not updated.'); }
                                }} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 font-bold rounded text-[10px]">Receive</button>
                              )}
                              {(parseFloat(po.balanceDue) || 0) > 0 && po.paymentStatus !== 'Paid' && po.workflowStatus !== 'Purchase Return' && po.workflowStatus !== 'Draft' && (isAdminUser || canUpdate('purchase')) && (
                                <button onClick={() => {
                                  setSelectedPO(po);
                                  setPoPaymentForm({ payAmount: po.balanceDue || po.amount, paymentMethod: 'Cash' });
                                  setPoPaymentModalOpen(true);
                                }} className="px-2 py-1 bg-emerald-500 text-slate-950 font-bold rounded text-[10px]">Pay / Partial</button>
                              )}
                              {po.workflowStatus !== 'Draft' && po.workflowStatus !== 'Purchase Return' && ((po.quantity || 0) - (po.returnedQty || 0) > 0) && (isAdminUser || canUpdate('purchase')) && (
                                <button onClick={() => openPurchaseReturn(po)} className="px-2 py-1 bg-amber-500/20 text-amber-400 font-bold rounded text-[10px]">Purchase Return</button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {Math.ceil(filterOwn('purchase', purchaseOrders).length / poPerPage) > 1 && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-700 text-xs">
                  <span className="text-slate-400">Showing page {poPage} of {Math.ceil(filterOwn('purchase', purchaseOrders).length / poPerPage)} (Total POs: {filterOwn('purchase', purchaseOrders).length})</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPoPage(p => Math.max(1, p - 1))}
                      disabled={poPage === 1}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded disabled:opacity-50 text-white font-bold"
                    >
                      Previous
                    </button>
                    <button 
                      onClick={() => setPoPage(p => Math.min(Math.ceil(filterOwn('purchase', purchaseOrders).length / poPerPage), p + 1))}
                      disabled={poPage === Math.ceil(filterOwn('purchase', purchaseOrders).length / poPerPage)}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded disabled:opacity-50 text-white font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* New Supplier Modal */}
            {newSupplierModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Add New Supplier</h4>
                    <button onClick={() => setNewSupplierModalOpen(false)} className="text-slate-400">✕</button>
                  </div>
                  <form onSubmit={handleCreateNewSupplier} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Supplier Name *</label>
                      <input type="text" placeholder="Supplier Name" value={newSupplierForm.name} onChange={e => setNewSupplierForm({...newSupplierForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Phone Number</label>
                      <input type="text" placeholder="+254 7..." value={newSupplierForm.phone} onChange={e => setNewSupplierForm({...newSupplierForm, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Email</label>
                      <input type="email" placeholder="email@supplier.com" value={newSupplierForm.email} onChange={e => setNewSupplierForm({...newSupplierForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Location</label>
                      <input type="text" placeholder="Location / Address" value={newSupplierForm.location} onChange={e => setNewSupplierForm({...newSupplierForm, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Credit Terms</label>
                      <select value={newSupplierForm.creditTermType} onChange={e => setNewSupplierForm({...newSupplierForm, creditTermType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                        <option value="COD">COD (Cash on Delivery)</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </div>
                    {newSupplierForm.creditTermType === 'Credit' && (
                      <div>
                        <label className="text-slate-400 block mb-1">Credit Days</label>
                        <input type="number" value={newSupplierForm.creditDays} onChange={e => setNewSupplierForm({...newSupplierForm, creditDays: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                      </div>
                    )}
                    <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Supplier</button>
                  </form>
                </div>
              </div>
            )}

            {/* Supplier Edit Modal */}
            {selectedSupplier && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Edit Supplier: {selectedSupplier.name}</h4>
                    <button onClick={() => setSelectedSupplier(null)} className="text-slate-400">✕</button>
                  </div>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    if (!(isAdminUser || canUpdate('suppliers'))) return;
                    await apiFetch(`/api/suppliers/${selectedSupplier.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedSupplier) });
                    setSuppliers(suppliers.map(s => s.id === selectedSupplier.id ? selectedSupplier : s));
                    setSelectedSupplier(null);
                  }} className="space-y-3 text-xs">
                    <div><label className="text-slate-400 block mb-1">Supplier Name</label><input type="text" value={selectedSupplier.name} onChange={e => setSelectedSupplier({...selectedSupplier, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-1">Phone No.</label><input type="text" value={selectedSupplier.phone || ''} onChange={e => setSelectedSupplier({...selectedSupplier, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-1">Email</label><input type="email" value={selectedSupplier.email || ''} onChange={e => setSelectedSupplier({...selectedSupplier, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                    <div><label className="text-slate-400 block mb-1">Location</label><input type="text" value={selectedSupplier.location || ''} onChange={e => setSelectedSupplier({...selectedSupplier, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                    <div>
                      <label className="text-slate-400 block mb-1">Credit Terms</label>
                      <select value={selectedSupplier.creditTermType} onChange={e => setSelectedSupplier({...selectedSupplier, creditTermType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                        <option value="COD">COD</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </div>
                    {selectedSupplier.creditTermType === 'Credit' && (
                      <div><label className="text-slate-400 block mb-1">Credit Days</label><input type="number" value={selectedSupplier.creditDays || 0} onChange={e => setSelectedSupplier({...selectedSupplier, creditDays: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                    )}
                    <div className="flex gap-2 pt-2">
                      {(isAdminUser || canUpdate('suppliers')) && (
                        <button type="submit" className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                      )}
                      {(isAdminUser || canDelete('suppliers')) && (
                        <button type="button" onClick={async () => {
                          if (!window.confirm('Delete supplier?')) return;
                          await apiFetch(`/api/suppliers/${selectedSupplier.id}`, { method: 'DELETE' });
                          setSuppliers(suppliers.filter(s => s.id !== selectedSupplier.id));
                          setSelectedSupplier(null);
                        }} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                      )}
                      {(!isAdminUser && !canUpdate('suppliers') && !canDelete('suppliers')) && (
                        <button type="button" onClick={() => setSelectedSupplier(null)} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded">Close</button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* New Purchase Order Modal with Dynamic Cost & Amount Calculation */}
            {newPOModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Create Purchase Order</h4>
                    <button onClick={() => setNewPOModalOpen(false)} className="text-slate-400">✕</button>
                  </div>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    if (!newPOForm.supplierId) return alert('Select a supplier');
                    const lines = (poLines || []).filter(l => l.itemId && l.itemName && (parseInt(l.quantity) || 0) > 0);
                    if (!lines.length) return alert('Add at least one item');
                    // Single PO for multi-item: one workflow record, items stored as array
                    const linePayloads = lines.map(line => {
                      const baseAmount = parseFloat(line.amount) || ((parseFloat(line.cost) || 0) * (parseInt(line.quantity) || 1));
                      let lineTax = 0;
                      let lineFinal = baseAmount;
                      if (poApplyTax && taxSettings.purchaseTaxRate > 0) {
                        if (poTaxInclusive) {
                          lineTax = baseAmount - (baseAmount / (1 + taxSettings.purchaseTaxRate / 100));
                          lineFinal = baseAmount;
                        } else {
                          lineTax = baseAmount * (taxSettings.purchaseTaxRate / 100);
                          lineFinal = baseAmount + lineTax;
                        }
                      }
                      return {
                        itemId: line.itemId,
                        itemName: line.itemName,
                        quantity: parseInt(line.quantity) || 1,
                        cost: parseFloat(line.cost) || 0,
                        amount: lineFinal,
                        taxAmount: Math.round(lineTax * 100) / 100,
                        returnedQty: 0
                      };
                    });
                    const totalAmount = linePayloads.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                    const totalTax = linePayloads.reduce((s, l) => s + (parseFloat(l.taxAmount) || 0), 0);
                    const totalQty = linePayloads.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
                    const first = linePayloads[0];
                    const po = {
                      id: `PO-${Math.floor(Math.random() * 8999 + 1000)}`,
                      groupId: 'POG-' + Date.now(),
                      createdBy: currentUser?.name || currentUser?.id || '',
                      date: new Date().toISOString().split('T')[0],
                      supplierId: newPOForm.supplierId,
                      supplierName: newPOForm.supplierName,
                      itemId: first.itemId,
                      itemName: linePayloads.length > 1 ? `${linePayloads.length} items` : first.itemName,
                      quantity: totalQty,
                      cost: first.cost,
                      amount: totalAmount,
                      taxAmount: Math.round(totalTax * 100) / 100,
                      taxRate: poApplyTax ? taxSettings.purchaseTaxRate : 0,
                      taxInclusive: !!poTaxInclusive,
                      paidAmount: 0,
                      balanceDue: totalAmount,
                      paymentStatus: 'Unpaid',
                      workflowStatus: 'Draft',
                      paymentMethod: newPOForm.paymentMethod || 'Cash',
                      branchId: activeBranchId || undefined,
                      items: JSON.stringify(linePayloads)
                    };
                    try { await apiFetch('/api/purchase_orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(po) }); } catch (e) { console.warn(e); }
                    const nextPOs = [po, ...purchaseOrders];
                    setPurchaseOrders(nextPOs);
                    setPoLines([{ itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0 }]);
                    setNewPOModalOpen(false);
                  }} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Select Supplier *</label>
                      <select value={newPOForm.supplierId} onChange={e => {
                        const supId = e.target.value;
                        const sup = suppliers.find(s => s.id === supId);
                        setNewPOForm({...newPOForm, supplierId: supId, supplierName: sup ? sup.name : ''});
                      }} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2 border border-slate-700 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-400 font-semibold">Items *</label>
                        <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded" onClick={() => setPoLines([...(poLines || []), { itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0 }])}>+ Add item</button>
                      </div>
                      {(poLines || [{ itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0 }]).map((line, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-end">
                          <div className="col-span-5">
                            <label className="text-[9px] text-slate-500">Item</label>
                            <select value={line.itemId || ''} onChange={e => {
                              const itemId = e.target.value;
                              const invItem = (inventory || []).find(i => i.id === itemId);
                              const lines = [...(poLines || [])];
                              if (invItem) {
                                const cost = invItem.buyingPrice || 0;
                                const qty = lines[idx]?.quantity || 1;
                                lines[idx] = { itemId, itemName: invItem.name, quantity: qty, cost, amount: cost * qty };
                              } else {
                                lines[idx] = { ...lines[idx], itemId: '', itemName: '' };
                              }
                              setPoLines(lines);
                              const first = lines[0] || {};
                              setNewPOForm({ ...newPOForm, itemId: first.itemId || '', itemName: first.itemName || '', quantity: first.quantity || 1, cost: first.cost || 0, amount: lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) });
                            }} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[11px]">
                              <option value="">-- Item --</option>
                              {(inventory || []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] text-slate-500">Qty</label>
                            <input type="number" min="1" value={line.quantity || 1} onChange={e => {
                              const quantity = parseInt(e.target.value) || 1;
                              const lines = [...(poLines || [])];
                              const cost = parseFloat(lines[idx].cost) || 0;
                              lines[idx] = { ...lines[idx], quantity, amount: quantity * cost };
                              setPoLines(lines);
                              setNewPOForm({ ...newPOForm, amount: lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), quantity: lines[0]?.quantity || 1, cost: lines[0]?.cost || 0 });
                            }} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[11px]" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] text-slate-500">Cost</label>
                            <input type="number" value={line.cost || 0} onChange={e => {
                              const cost = parseFloat(e.target.value) || 0;
                              const lines = [...(poLines || [])];
                              const quantity = parseInt(lines[idx].quantity) || 1;
                              lines[idx] = { ...lines[idx], cost, amount: quantity * cost };
                              setPoLines(lines);
                              setNewPOForm({ ...newPOForm, amount: lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), cost: lines[0]?.cost || 0 });
                            }} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[11px]" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[9px] text-slate-500">Amount</label>
                            <input type="number" value={line.amount || 0} readOnly className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-300 text-[11px]" />
                          </div>
                          <div className="col-span-1">
                            <button type="button" className="w-full py-1.5 text-red-400 text-[10px] font-bold" onClick={() => {
                              const lines = (poLines || []).filter((_, i) => i !== idx);
                              const next = lines.length ? lines : [{ itemId: '', itemName: '', quantity: 1, cost: 0, amount: 0 }];
                              setPoLines(next);
                              setNewPOForm({ ...newPOForm, amount: next.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) });
                            }}>✕</button>
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-emerald-400 font-semibold">Lines total: {shopProfile.currency} {(poLines || []).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1.5 bg-slate-950 border border-slate-700 rounded p-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px]">
                          <span className="text-slate-300 font-semibold">{taxSettings.purchaseTaxName || 'VAT'} / Purchase Tax</span>
                          <span className="text-slate-500 ml-1">({taxSettings.purchaseTaxRate}%)</span>
                        </div>
                        <button type="button" onClick={() => setPoApplyTax(!poApplyTax)} className="flex items-center gap-1 text-xs">
                          <span className={poApplyTax ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{poApplyTax ? 'ON' : 'OFF'}</span>
                          {poApplyTax ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                        </button>
                      </div>
                      {poApplyTax && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setPoTaxInclusive(false)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${!poTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>Exclusive</button>
                          <button type="button" onClick={() => setPoTaxInclusive(true)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${poTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>Inclusive</button>
                        </div>
                      )}
                    </div>
                    {poApplyTax && taxSettings.purchaseTaxRate > 0 && (
                      <div className="text-[11px] space-y-1 bg-slate-950 border border-amber-500/30 rounded p-2">
                        <div className="flex justify-between"><span className="text-slate-400">Tax amount</span><span className="text-amber-400 font-semibold">{shopProfile.currency} {(poTaxInclusive ? ((parseFloat(newPOForm.amount)||0) - ((parseFloat(newPOForm.amount)||0) / (1 + taxSettings.purchaseTaxRate/100))) : ((parseFloat(newPOForm.amount)||0) * taxSettings.purchaseTaxRate/100)).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Grand total</span><span className="text-emerald-400 font-bold">{shopProfile.currency} {(poTaxInclusive ? (parseFloat(newPOForm.amount)||0) : ((parseFloat(newPOForm.amount)||0) * (1 + taxSettings.purchaseTaxRate/100))).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                      </div>
                    )}
                    <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Create Purchase Order</button>
                  </form>
                </div>
              </div>
            )}

            {/* Partial / Full Payment Modal */}
            
            {selectedPO && !poPaymentModalOpen && !purchaseReturnModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Purchase Order {selectedPO.id}</h4>
                    <button onClick={() => setSelectedPO(null)} className="text-slate-400">✕</button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Date</label>
                        <input type="date" value={String(selectedPO.date||'').slice(0,10)} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => setSelectedPO({...selectedPO, date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Created By</label>
                        <input type="text" value={selectedPO.createdBy || ''} readOnly className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Supplier</label>
                      <input type="text" value={selectedPO.supplierName || ''} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => setSelectedPO({...selectedPO, supplierName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Item</label>
                      {(() => {
                        let lines = selectedPO.items;
                        if (typeof lines === 'string') { try { lines = JSON.parse(lines); } catch { lines = null; } }
                        if (Array.isArray(lines) && lines.length > 1) {
                          return (
                            <div className="bg-slate-950 border border-slate-700 rounded p-2 space-y-1 max-h-40 overflow-y-auto">
                              {lines.map((ln, i) => (
                                <div key={i} className="flex justify-between text-xs text-slate-300">
                                  <span>{ln.itemName || ln.itemId}</span>
                                  <span className="text-slate-400">×{ln.quantity} @ {ln.cost}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <input type="text" value={selectedPO.itemName || ''} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => setSelectedPO({...selectedPO, itemName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Qty</label>
                        <input type="number" value={selectedPO.quantity || 0} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => {
                          const quantity = parseInt(e.target.value)||0;
                          const cost = parseFloat(selectedPO.cost)||0;
                          const amount = quantity * cost;
                          setSelectedPO({...selectedPO, quantity, amount, balanceDue: Math.max(0, amount - (parseFloat(selectedPO.paidAmount)||0))});
                        }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Cost</label>
                        <input type="number" value={selectedPO.cost || 0} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => {
                          const cost = parseFloat(e.target.value)||0;
                          const quantity = parseInt(selectedPO.quantity)||0;
                          const amount = quantity * cost;
                          setSelectedPO({...selectedPO, cost, amount, balanceDue: Math.max(0, amount - (parseFloat(selectedPO.paidAmount)||0))});
                        }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Amount</label>
                        <input type="number" value={selectedPO.amount || 0} disabled={!(isAdminUser || canUpdate('purchase'))} onChange={e => {
                          const amount = parseFloat(e.target.value)||0;
                          setSelectedPO({...selectedPO, amount, balanceDue: Math.max(0, amount - (parseFloat(selectedPO.paidAmount)||0))});
                        }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white disabled:opacity-70" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Payment Status</label>
                        <input type="text" value={selectedPO.paymentStatus || ''} readOnly className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-400" />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Workflow Status</label>
                        <input type="text" value={selectedPO.workflowStatus || 'Draft'} readOnly className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-300" title="Change status with Approve / Receive / Pay / Return actions only" />
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Payment History</p>
                      {(() => {
                        let hist = selectedPO.paymentHistory;
                        try { if (typeof hist === 'string') hist = JSON.parse(hist || '[]'); } catch (_) { hist = []; }
                        if (!Array.isArray(hist) || !hist.length) {
                          const paid = parseFloat(selectedPO.paidAmount) || 0;
                          hist = paid > 0 ? [{ date: selectedPO.date, amount: paid, paymentMethod: selectedPO.paymentMethod || '—', mpesaCode: selectedPO.mpesaCode || '' }] : [];
                        }
                        if (!hist.length) return <p className="text-[10px] text-slate-500">No payments recorded yet.</p>;
                        return hist.map((p, idx) => (
                          <div key={p.id || idx} className="flex flex-wrap justify-between gap-1 text-[11px] border-b border-slate-800 pb-1">
                            <span className="text-slate-400">{p.date ? new Date(p.date).toLocaleString() : '—'}</span>
                            <span className="text-white">{p.paymentMethod || p.method || '—'}</span>
                            {(String(p.paymentMethod || p.method || '').toLowerCase().includes('m-pesa') || p.mpesaCode) && (
                              <span className="text-sky-400 font-mono">TXN {p.mpesaCode || p.txnNo || '—'}</span>
                            )}
                            <span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(p.amount || 0).toLocaleString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="flex gap-2 pt-2">
                      {(isAdminUser || canUpdate('purchase')) && (
                        <button type="button" onClick={async () => {
                          const updated = { ...selectedPO };
                          setPurchaseOrders(prev => {
                            const next = prev.map(p => p.id === updated.id ? updated : p);
                            return next;
                          });
                          try { await apiFetch(`/api/purchase_orders/${updated.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }); } catch (e) {}
                          setSelectedPO(null);
                        }} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                      )}
                      {(isAdminUser || canDelete('purchase')) && (
                        <button type="button" onClick={async () => {
                          if (!window.confirm(`Delete purchase order ${selectedPO.id}? This cannot be undone.`)) return;
                          try { await apiFetch(`/api/purchase_orders/${selectedPO.id}`, { method: 'DELETE' }); } catch (e) {}
                          setPurchaseOrders(prev => {
                            const next = prev.filter(p => p.id !== selectedPO.id);
                            return next;
                          });
                          setSelectedPO(null);
                        }} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                      )}
                      <button type="button" onClick={() => setSelectedPO(null)} className="py-2 px-4 bg-slate-800 text-white font-bold rounded">Close</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {poPaymentModalOpen && selectedPO && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Make Payment for PO: {selectedPO.id}</h4>
                    <button onClick={() => setPoPaymentModalOpen(false)} className="text-slate-400">✕</button>
                  </div>
                  <form onSubmit={async e => {
                    e.preventDefault();
                    const payAmt = Math.round((parseFloat(poPaymentForm.payAmount) || 0) * 100) / 100;
                    const outstanding = Math.max(0, Number(selectedPO.balanceDue) || 0);
                    if (payAmt <= 0) { alert('Enter a payment amount greater than zero.'); return; }
                    if (payAmt > outstanding) { alert(`Payment cannot exceed the outstanding balance of ${shopProfile.currency} ${outstanding.toLocaleString()}.`); return; }
                    const newPaid = (Number(selectedPO.paidAmount) || 0) + payAmt;
                    const newBalance = Math.max(0, outstanding - payAmt);
                    const newStatus = newBalance === 0 ? 'Paid' : 'Partial';
                    const paymentRecord = { id: `popay-${Date.now()}`, date: new Date().toISOString(), amount: payAmt, paymentMethod: poPaymentForm.paymentMethod, mpesaCode: String(poPaymentForm.paymentMethod||'').toLowerCase().includes('m-pesa') ? (poPaymentForm.mpesaCode || '') : (selectedPO.mpesaCode || ''), recordedBy: currentUser?.name || 'Staff' };
                    const updated = {
                      ...selectedPO,
                      paidAmount: newPaid,
                      balanceDue: newBalance,
                      paymentMethod: selectedPO.paymentMethod && selectedPO.paymentMethod !== poPaymentForm.paymentMethod ? `${selectedPO.paymentMethod} + ${poPaymentForm.paymentMethod}` : poPaymentForm.paymentMethod,
                      paymentStatus: newStatus,
                      paymentHistory: [...(selectedPO.paymentHistory || []), paymentRecord],
                      mpesaCode: String(poPaymentForm.paymentMethod||'').toLowerCase().includes('m-pesa') ? (poPaymentForm.mpesaCode || selectedPO.mpesaCode || '') : (selectedPO.mpesaCode || ''),
                      workflowStatus: selectedPO.workflowStatus === 'Draft' ? selectedPO.workflowStatus : 'Payment'
                    };
                    await upsertPO(updated);
                    setPaymentMethods(prev => {
                      const next = prev.map(pm => (pm.name || '').toLowerCase() === poPaymentForm.paymentMethod.toLowerCase() ? { ...pm, startingBalance: Math.max(0, (Number(pm.startingBalance) || 0) - payAmt) } : pm);
                      return next;
                    });
                    setPoPaymentModalOpen(false);
                    setSelectedPO(null);
                  }} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Payment Method</label>
                      <select value={poPaymentForm.paymentMethod} onChange={e => setPoPaymentForm({...poPaymentForm, paymentMethod: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                        <option value="Cash">Cash</option>
                        <option value="M-Pesa">M-Pesa</option>
                        <option value="Bank Transfer">Bank Transfer Account</option>
                      </select>
                    </div>
                    {String(poPaymentForm.paymentMethod||'').toLowerCase().includes('m-pesa') && (
                      <div>
                        <label className="text-emerald-400 block mb-1">M-Pesa TXN No</label>
                        <input type="text" value={poPaymentForm.mpesaCode || ''} onChange={e => setPoPaymentForm({...poPaymentForm, mpesaCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="TXN No" />
                      </div>
                    )}
                    <div>
                      <label className="text-slate-400 block mb-1">Payment Amount ({shopProfile.currency})</label>
                      <input type="number" value={poPaymentForm.payAmount} onChange={e => setPoPaymentForm({...poPaymentForm, payAmount: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Submit Payment</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. EXPENSES TAB */}
        {activeTab === 'expenses' && (isAdminUser || canView('expenses')) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(isAdminUser || canCreate('expenses')) && (
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 min-h-[480px]">
                <h3 className="text-sm font-bold text-white mb-4">Record Operating Expense</h3>
                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newExpense.amount || !newExpense.description) return;
                  const baseAmt = parseFloat(newExpense.amount) || 0;
                  let taxAmt = 0;
                  let finalAmt = baseAmt;
                  if (expenseApplyTax && (taxSettings.expenseTaxRate ?? taxSettings.purchaseTaxRate) > 0) {
                    const _expRate = taxSettings.expenseTaxRate ?? taxSettings.purchaseTaxRate;
                    if (expenseTaxInclusive) {
                      taxAmt = baseAmt - (baseAmt / (1 + _expRate / 100));
                      finalAmt = baseAmt;
                    } else {
                      taxAmt = baseAmt * (_expRate / 100);
                      finalAmt = baseAmt + taxAmt;
                    }
                  }
                  const paidAmt = parseFloat(newExpense.paidAmount);
                  const paidFinal = isNaN(paidAmt) ? finalAmt : Math.min(Math.max(0, paidAmt), finalAmt);
                  const balDue = Math.max(0, finalAmt - paidFinal);
                  const payStatus = balDue <= 0 ? 'Paid' : (paidFinal > 0 ? 'Partially Paid' : 'Unpaid');
                  const exp = {
                    id: `exp-${Date.now()}`,
                    createdBy: currentUser?.name || currentUser?.id || '',
                    branchId: activeBranchId || undefined,
                    ...newExpense,
                    amount: finalAmt,
                    paidAmount: paidFinal,
                    balanceDue: balDue,
                    paymentStatus: payStatus,
                    subtotal: baseAmt,
                    taxAmount: Math.round(taxAmt * 100) / 100,
                    taxRate: expenseApplyTax ? (taxSettings.expenseTaxRate ?? taxSettings.purchaseTaxRate) : 0,
                    taxName: expenseApplyTax ? (taxSettings.expenseTaxName || 'Expense VAT') : (taxSettings.purchaseTaxName || 'VAT')
                  };
                  persistExpenses([exp, ...expenses]);
                  setNewExpense({ date: new Date().toISOString().split('T')[0], category: expenseCategories[0]?.name || 'Store Rent', description: '', amount: '', paidAmount: '', paymentMethod: 'Cash', mpesaCode: '', payer: '', paidTo: '' });
                  try {
                    await apiFetch('/api/expenses', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(exp)
                    });
                  } catch (err) {
                    console.warn('Expense saved locally', err);
                  }
                }} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Date:</label>
                    <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Expense Category:</label>
                    <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                      {(expenseCategories || []).filter(ec => ec.status !== 'Inactive').map(ec => (
                        <option key={ec.id} value={ec.name}>{ec.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Description:</label>
                    <input type="text" placeholder="Description" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Amount ({shopProfile.currency}):</label>
                    <input type="number" placeholder="Amount" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Payer (Person Paying):</label>
                      <input type="text" placeholder="e.g. Main Admin" value={newExpense.payer} onChange={e => setNewExpense({...newExpense, payer: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Paid To:</label>
                      <input type="text" placeholder="e.g. Landlord" value={newExpense.paidTo} onChange={e => setNewExpense({...newExpense, paidTo: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Payment Method:</label>
                    <select value={newExpense.paymentMethod} onChange={e => setNewExpense({...newExpense, paymentMethod: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                      {(paymentMethods || [{name:'Cash'},{name:'M-Pesa'}]).map(pm => <option key={pm.id||pm.name} value={pm.name}>{pm.name}</option>)}
                    </select>
                  </div>
                  {String(newExpense.paymentMethod||'').toLowerCase().includes('m-pesa') && (
                    <div>
                      <label className="text-[10px] text-emerald-400 block mb-1">M-Pesa Transaction Number (TXN No):</label>
                      <input type="text" value={newExpense.mpesaCode || ''} onChange={e => setNewExpense({...newExpense, mpesaCode: e.target.value})} placeholder="e.g. QH7X..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Amount Paid (leave blank = full pay):</label>
                    <input type="number" placeholder="Partial or full amount" value={newExpense.paidAmount} onChange={e => setNewExpense({...newExpense, paidAmount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div className="space-y-1.5 bg-slate-950 border border-slate-700 rounded p-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px]">
                        <span className="text-slate-300 font-semibold">{taxSettings.expenseTaxName || 'VAT'} / Expense Tax</span>
                        <span className="text-slate-500 ml-1">({taxSettings.expenseTaxRate ?? taxSettings.purchaseTaxRate}%)</span>
                      </div>
                      <button type="button" onClick={() => setExpenseApplyTax(!expenseApplyTax)} className="flex items-center gap-1 text-xs">
                        <span className={expenseApplyTax ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{expenseApplyTax ? 'ON' : 'OFF'}</span>
                        {expenseApplyTax ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                      </button>
                    </div>
                    {expenseApplyTax && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setExpenseTaxInclusive(false)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${!expenseTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>Exclusive</button>
                        <button type="button" onClick={() => setExpenseTaxInclusive(true)} className={`flex-1 py-1 rounded text-[10px] font-bold border ${expenseTaxInclusive ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>Inclusive</button>
                      </div>
                    )}
                  </div>
                  {expenseApplyTax && taxSettings.purchaseTaxRate > 0 && (
                    <div className="text-[11px] space-y-1 bg-slate-950 border border-amber-500/30 rounded p-2">
                      <div className="flex justify-between"><span className="text-slate-400">Tax</span><span className="text-amber-400 font-semibold">{shopProfile.currency} {(expenseTaxInclusive ? ((parseFloat(newExpense.amount)||0) - ((parseFloat(newExpense.amount)||0) / (1 + taxSettings.purchaseTaxRate/100))) : ((parseFloat(newExpense.amount)||0) * taxSettings.purchaseTaxRate/100)).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Total with tax</span><span className="text-emerald-400 font-bold">{shopProfile.currency} {(expenseTaxInclusive ? (parseFloat(newExpense.amount)||0) : ((parseFloat(newExpense.amount)||0) * (1 + taxSettings.purchaseTaxRate/100))).toLocaleString(undefined,{maximumFractionDigits:2})}</span></div>
                    </div>
                  )}
                  <button type="submit" className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Expense</button>
                </form>
              </div>
            )}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4 min-h-[480px]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Expense History & Filtering</h3>
                <button type="button" onClick={() => exportRowsAsPdf('Expenses Report', filterOwn('expenses', expenses || []).map(e => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount, paid: e.paidAmount, balance: e.balanceDue, status: e.paymentStatus, method: e.paymentMethod, payer: e.payer })))} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded flex items-center gap-1"><Download className="w-3 h-3" /> Download PDF</button>
                  <p className="text-[11px] text-slate-400 mt-0.5">Filter by date timeframe, payer, or paid to, and click any expense description to edit.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={expenseTimeframe} onChange={e => setExpenseTimeframe(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-semibold rounded px-2.5 py-1.5">
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                  {expenseTimeframe === 'custom' && (
                    <div className="flex items-center gap-1">
                      <input type="date" value={expenseCustomStartDate} onChange={e => setExpenseCustomStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                      <span className="text-xs text-slate-400">to</span>
                      <input type="date" value={expenseCustomEndDate} onChange={e => setExpenseCustomEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input 
                  type="text" 
                  placeholder="Filter by Payer..." 
                  value={expensePayerFilter} 
                  onChange={e => setExpensePayerFilter(e.target.value)} 
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
                <input 
                  type="text" 
                  placeholder="Filter by Paid To..." 
                  value={expensePaidToFilter} 
                  onChange={e => setExpensePaidToFilter(e.target.value)} 
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="divide-y divide-slate-700 text-xs">
                {filterOwn('expenses', historyFilteredExpenses).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No matching expenses found.</p>
                ) : (
                  filterOwn('expenses', historyFilteredExpenses).map(exp => (
                    <div key={exp.id} className="py-3 flex justify-between items-center hover:bg-slate-700/30 px-2 rounded transition-colors">
                      <div>
                        <button onClick={() => setSelectedExpenseItem(exp)} className="font-bold text-white hover:text-emerald-400 text-left underline focus:outline-none">
                          {exp.description}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {exp.date} • {exp.category} • Paid via {exp.paymentMethod}{exp.mpesaCode && exp.mpesaCode !== 'N/A' ? ` · TXN ${exp.mpesaCode}` : ''}
                          {exp.payer && <span className="text-emerald-400 ml-1.5 font-semibold">• Payer: {exp.payer}</span>}
                          {exp.paidTo && <span className="text-amber-400 ml-1.5 font-semibold">• Paid To: {exp.paidTo}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-400 block">-{shopProfile.currency} {exp.amount?.toLocaleString()}</span>
                        {(exp.paymentStatus && exp.paymentStatus !== 'Paid') && (
                          <span className="text-[10px] text-amber-400 font-semibold">{exp.paymentStatus} · Bal {shopProfile.currency} {(exp.balanceDue || 0).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. CREDIT & LAYBY TAB */}
        {activeTab === 'laybys' && (isAdminUser || canView('laybys')) && (
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-sm font-bold text-white">Pending Credit & Layby Orders</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={laybyCustomerFilter} onChange={e=>setLaybyCustomerFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Customers</option>{customers.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
              <select value={laybyTypeFilter} onChange={e=>setLaybyTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Types</option>{['Credit','Layby','Paid'].map(v=><option key={v}>{v}</option>)}</select>
              <input type="date" aria-label="Deadline" value={laybyDeadlineFilter} onChange={e=>setLaybyDeadlineFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Balance Due</th>
                    <th className="py-2 px-3">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(() => {
                    const laybyRows = (branchSales || []).filter(s => {
                      const bal = parseFloat(s.balanceDue);
                      const due = !isNaN(bal) ? bal : Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0));
                      const type = s.saleType || s.type || '';
                      if (isOwnScope('laybys') && !isOwnRecord(s)) return false;
                      // Pending balances on Credit / Layby (and Paid-with-balance edge cases)
                      return due > 0 && (type === 'Credit' || type === 'Layby' || type === 'Paid')
                        && (!laybyCustomerFilter || s.customerName === laybyCustomerFilter)
                        && (!laybyTypeFilter || type === laybyTypeFilter)
                        && (!laybyDeadlineFilter || String(s.deadline || '').slice(0, 10) === laybyDeadlineFilter);
                    });
                    if (laybyRows.length === 0) {
                      return (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-500">No pending credit or layby balances.</td></tr>
                      );
                    }
                    return laybyRows.map(s => {
                      const due = parseFloat(s.balanceDue);
                      const bal = !isNaN(due) ? due : Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0));
                      return (
                        <tr key={s.id} onClick={() => setSelectedSaleItem({ ...s, items: parseSaleItems(s), balanceDue: bal })} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">{s.customerName}</td>
                          <td className="py-3 px-3 text-emerald-400">{s.saleType || s.type}</td>
                          <td className="py-3 px-3 font-bold text-amber-400">{shopProfile.currency} {bal.toLocaleString()}</td>
                          <td className="py-3 px-3 font-mono">{s.deadline || '—'}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. REPORTS TAB (REARRANGED LAYOUT MATCHING IMAGE) */}
        {activeTab === 'hr' && (isAdminUser || canView('hr') || canView('payroll') || canView('employees')) && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white">Human Resources</h3>
              <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                {[
                  { id: 'employees', label: 'Employees' },
                  { id: 'org', label: 'Org Chart' },
                  { id: 'leave', label: 'Leave Management' },
                  { id: 'payroll', label: 'Payroll' }
                ].filter(t => hrAllowedSubTabs.includes(t.id)).map(t => (
                  <button key={t.id} onClick={() => setHrSubTab(t.id)} className={`px-3 py-1.5 text-xs font-semibold rounded ${effectiveHrSubTab === t.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{t.label}</button>
                ))}
              </div>
            </div>

            {effectiveHrSubTab === 'employees' && (isAdminUser || canView('employees')) && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-400">{employees.length} employee(s) registered</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-2xl">
                    <select value={employeePositionFilter} onChange={e=>setEmployeePositionFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Positions</option>{[...new Set(employees.map(e=>e.position).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select>
                    <select value={employeeDepartmentFilter} onChange={e=>setEmployeeDepartmentFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Departments</option>{[...new Set(employees.map(e=>e.department).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select>
                    <select value={employeeManagerFilter} onChange={e=>setEmployeeManagerFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Report To</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
                  </div>
                  {(isAdminUser || canCreate('employees')) && (
                    <button onClick={() => { setSelectedEmployee(null); setEmployeeForm({ name: '', position: '', department: (hrSettings.departments && hrSettings.departments[0]) || 'Sales', phone: '', email: '', hireDate: new Date().toISOString().split('T')[0], salary: '', status: 'Active', nationalId: '', bankAccount: '', bankName: '', leaveBalance: hrSettings.defaultAnnualLeave || 21, managerId: '' }); setEmployeeModalOpen(true); }} className="px-3 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Employee</button>
                  )}
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase text-slate-400 text-[10px] border-b border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Position</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3">User</th>
                        <th className="py-2 px-3">Reports To</th>
                        <th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3">Salary</th>
                        <th className="py-2 px-3">Leave Bal.</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filterOwn('employees', branchEmployees).filter(emp => (!employeePositionFilter || emp.position===employeePositionFilter) && (!employeeDepartmentFilter || emp.department===employeeDepartmentFilter) && (!employeeManagerFilter || emp.managerId===employeeManagerFilter)).length === 0 ? (
                        <tr><td colSpan={10} className="py-8 text-center text-slate-500">No employees yet. Add your first employee.</td></tr>
                      ) : filterOwn('employees', branchEmployees).filter(emp => (!employeePositionFilter || emp.position===employeePositionFilter) && (!employeeDepartmentFilter || emp.department===employeeDepartmentFilter) && (!employeeManagerFilter || emp.managerId===employeeManagerFilter)).map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-700/40">
                          <td className="py-2 px-3 font-semibold text-white">{emp.name}</td>
                          <td className="py-2 px-3">{emp.position || '—'}</td>
                          <td className="py-2 px-3">{emp.department || '—'}</td>
                          <td className="py-2 px-3 text-emerald-400">{(users || []).find(u => String(u.id) === String(emp.userId))?.name || '—'}</td>
                          <td className="py-2 px-3 text-sky-400">{employees.find(m => m.id === emp.managerId)?.name || '—'}</td>
                          <td className="py-2 px-3">{emp.phone || '—'}</td>
                          <td className="py-2 px-3 font-mono text-emerald-400">{shopProfile.currency} {(parseFloat(emp.salary)||0).toLocaleString()}</td>
                          <td className="py-2 px-3">{emp.leaveBalance ?? 21} days</td>
                          <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-300'}`}>{emp.status}</span></td>
                          <td className="py-2 px-3 flex gap-1">
                            {(isAdminUser || canUpdate('employees')) && (
                              <button onClick={() => { setSelectedEmployee(emp); setEmployeeForm({ ...emp, salary: emp.salary ?? '', leaveBalance: emp.leaveBalance ?? 21 }); setEmployeeModalOpen(true); }} className="p-1 text-slate-400 hover:text-emerald-400"><Edit className="w-3.5 h-3.5" /></button>
                            )}
                            {(isAdminUser || canDelete('employees')) && (
                              <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {effectiveHrSubTab === 'org' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Organization chart — who reports to whom. Set <strong className="text-slate-300">Reports To</strong> on each employee to build the tree. Managers approve leave for their direct reports.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Tree roots: no manager */}
                  <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-700 pb-2">Hierarchy</h4>
                    {employees.length === 0 ? (
                      <p className="text-xs text-slate-500">Add employees and assign managers to see the chart.</p>
                    ) : (
                      <div className="space-y-3">
                        {employees.filter(e => !e.managerId).map(root => {
                          const renderNode = (emp, depth = 0) => {
                            const reports = employees.filter(r => r.managerId === emp.id);
                            return (
                              <div key={emp.id} className="space-y-1">
                                <div className={`flex items-center gap-2 p-2 rounded-lg border ${depth === 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950 border-slate-800'}`} style={{ marginLeft: depth * 16 }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{emp.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{emp.position || '—'} · {emp.department || '—'}</p>
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${emp.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-300'}`}>{emp.status}</span>
                                </div>
                                {reports.map(r => renderNode(r, depth + 1))}
                              </div>
                            );
                          };
                          return renderNode(root, 0);
                        })}
                        {employees.filter(e => !e.managerId).length === 0 && (
                          <p className="text-xs text-amber-400">Every employee has a manager assigned — set at least one top-level employee with no manager.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-700 pb-2">Manager → Direct Reports</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {employees.filter(m => employees.some(e => e.managerId === m.id)).length === 0 ? (
                        <p className="text-xs text-slate-500">No managers with reports yet.</p>
                      ) : employees.filter(m => employees.some(e => e.managerId === m.id)).map(mgr => (
                        <div key={mgr.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                          <p className="font-bold text-emerald-400">{mgr.name} <span className="text-slate-500 font-normal">({mgr.position || mgr.department})</span></p>
                          <ul className="mt-1 space-y-0.5 text-slate-300">
                            {employees.filter(e => e.managerId === mgr.id).map(r => (
                              <li key={r.id} className="flex justify-between gap-2">
                                <span>↳ {r.name}</span>
                                <span className="text-slate-500">{r.position || '—'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

                        {effectiveHrSubTab === 'leave' && (
              <div className="space-y-4">
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Leave Calendar</h4>
                    <input type="month" value={leaveCalendarMonth} onChange={e => setLeaveCalendarMonth(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-7 gap-1 min-w-[420px] text-center text-[10px]">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-slate-500 font-bold py-1">{d}</div>)}
                      {(() => {
                        const [y, m] = (leaveCalendarMonth || '').split('-').map(Number);
                        if (!y || !m) return null;
                        const first = new Date(y, m - 1, 1);
                        const startPad = first.getDay();
                        const daysInMonth = new Date(y, m, 0).getDate();
                        const cells = [];
                        for (let i = 0; i < startPad; i++) cells.push(<div key={`p${i}`} className="h-14 bg-slate-950/40 rounded"></div>);
                        for (let day = 1; day <= daysInMonth; day++) {
                          const ds = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const onLeave = (leaveRequests || []).filter(lr => {
                            if ((lr.status || '') !== 'Approved') return false;
                            const a = String(lr.startDate || '').slice(0,10);
                            const b = String(lr.endDate || '').slice(0,10);
                            return ds >= a && ds <= b;
                          });
                          cells.push(
                            <div key={ds} className={`h-14 rounded border p-0.5 overflow-hidden ${onLeave.length ? 'border-sky-500/50 bg-sky-500/10' : 'border-slate-800 bg-slate-950'}`}>
                              <div className="text-slate-400 font-bold">{day}</div>
                              {onLeave.slice(0,2).map(lr => <div key={lr.id} className="text-[8px] text-sky-300 truncate">{lr.employeeName || lr.employeeId}</div>)}
                              {onLeave.length > 2 && <div className="text-[8px] text-slate-500">+{onLeave.length-2}</div>}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-xs text-slate-400">Leave requests & balances</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select value={leaveStatusFilter} onChange={e=>setLeaveStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Leave Statuses</option>{['Pending','Approved','Rejected'].map(v=><option key={v}>{v}</option>)}</select>
                    <select value={leaveApproverFilter} onChange={e=>setLeaveApproverFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"><option value="">All Approvers</option>{employees.map(e=><option key={e.id} value={e.name}>{e.name}</option>)}</select>
                    {(isAdminUser || canCreate('hr')) && (
                      <button onClick={() => { setLeaveForm({ employeeId: (isAdminUser || canUpdate('hr') || canUpdate('employees')) ? '' : (currentEmployeeRecord?.id || ''), leaveType: (hrSettings.leaveTypes||[])[0] || 'Annual', startDate: '', endDate: '', reason: '' }); setLeaveModalOpen(true); }} className="px-3 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> New Leave Request</button>
                    )}
                  </div>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
                    <thead className="bg-slate-900 uppercase text-slate-400 text-[10px] border-b border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Employee</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">From</th>
                        <th className="py-2 px-3">To</th>
                        <th className="py-2 px-3">Days</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 px-3">Approver</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filterOwn('hr', leaveRequests).filter(lr => (!leaveStatusFilter || lr.status===leaveStatusFilter) && (!leaveApproverFilter || (lr.approvedBy===leaveApproverFilter || lr.managerName===leaveApproverFilter))).length === 0 ? (
                        <tr><td colSpan={9} className="py-4 text-center text-slate-500">No leave requests.</td></tr>
                      ) : filterOwn('hr', leaveRequests).filter(lr => (!leaveStatusFilter || lr.status===leaveStatusFilter) && (!leaveApproverFilter || (lr.approvedBy===leaveApproverFilter || lr.managerName===leaveApproverFilter))).map(lr => (
                        <tr key={lr.id} className="hover:bg-slate-700/40 cursor-pointer" onClick={() => setSelectedLeave({ ...lr })}>
                          <td className="py-2 px-3 font-semibold text-white">{lr.employeeName}</td>
                          <td className="py-2 px-3">{lr.leaveType}</td>
                          <td className="py-2 px-3">{lr.startDate}</td>
                          <td className="py-2 px-3">{lr.endDate}</td>
                          <td className="py-2 px-3">{lr.days}</td>
                          <td className="py-2 px-3 max-w-[140px] truncate">{lr.reason || '—'}</td>
                          <td className="py-2 px-3 text-sky-400">{lr.managerName || employees.find(m => m.id === lr.approverId || m.id === lr.managerId)?.name || '—'}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lr.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : lr.status === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{lr.status}</span>
                          </td>
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            {lr.status === 'Pending' && canApproveLeave(lr) && (
                              <div className="flex gap-1">
                                <button onClick={() => handleLeaveAction(lr, 'Approved')} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">Approve</button>
                                <button onClick={() => handleLeaveAction(lr, 'Rejected')} className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">Reject</button>
                              </div>
                            )}
                            {lr.status === 'Pending' && !canApproveLeave(lr) && lr.managerName && (
                              <span className="text-[10px] text-slate-500">Awaiting {lr.managerName}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {effectiveHrSubTab === 'payroll' && (isAdminUser || canView('payroll')) && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <div>
                  <p className="text-xs text-slate-400">Payroll records ({hrSettings.payrollCycle} cycle, pay day {hrSettings.payDay})</p>
                  <p className="text-[10px] text-slate-500 mt-1">Statutory totals (all records): PAYE {shopProfile.currency} {payrollStatutorySummary.paye.toLocaleString()} · NSSF {shopProfile.currency} {payrollStatutorySummary.nssf.toLocaleString()} · SHA {shopProfile.currency} {payrollStatutorySummary.sha.toLocaleString()}</p>
                </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => exportRowsAsPdf('Payroll Report', filterOwn('payroll', payrollRecords || []).map(p => ({ id: p.id, employee: p.employeeName, period: p.period, basic: p.basicSalary, allowances: p.allowances, deductions: p.deductions, net: p.netPay, status: p.status })))} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Download PDF</button>
                    <button onClick={() => window.print()} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Print List</button>
                    {(isAdminUser || canCreate('payroll')) && (
                      <button onClick={() => { setPayrollForm({ employeeId: '', period: new Date().toISOString().slice(0,7), notes: '', allowanceItems: { Housing: 0, Transport: 0, Airtime: 0, Bonus: 0, Other: 0 }, allowanceOtherSpec: '', deductionItems: { PAYE: 0, 'NHL/Housing Levy': 0, NSSF: 0, SHA: 0, Loan: 0, Pension: 0, Other: 0 }, deductionOtherSpec: '' }); setPayrollModalOpen(true); }} className="px-3 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Generate Payroll</button>
                    )}
                  </div>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase text-slate-400 text-[10px] border-b border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Employee</th>
                        <th className="py-2 px-3">Period</th>
                        <th className="py-2 px-3">Basic</th>
                        <th className="py-2 px-3">Allowances</th>
                        <th className="py-2 px-3">Deductions</th>
                        <th className="py-2 px-3">Net Pay</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {payrollRecords.length === 0 ? (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">No payroll records yet.</td></tr>
                      ) : filterOwn('payroll', payrollRecords).map(pr => (
                        <tr key={pr.id} className="hover:bg-slate-700/40 cursor-pointer" onClick={() => {
                          let ab = pr.allowanceBreakdown, db = pr.deductionBreakdown;
                          try { if (typeof ab === 'string') ab = JSON.parse(ab || '{}'); } catch (_) { ab = {}; }
                          try { if (typeof db === 'string') db = JSON.parse(db || '{}'); } catch (_) { db = {}; }
                          setSelectedPayroll({ ...pr, allowanceBreakdown: ab || {}, deductionBreakdown: db || {} });
                        }}>
                          <td className="py-2 px-3 font-semibold text-white">{pr.employeeName}</td>
                          <td className="py-2 px-3">{pr.period}</td>
                          <td className="py-2 px-3 font-mono">{shopProfile.currency} {(pr.basicSalary||0).toLocaleString()}</td>
                          <td className="py-2 px-3 font-mono">{(pr.allowances||0).toLocaleString()}</td>
                          <td className="py-2 px-3 font-mono text-amber-400">{(pr.deductions||0).toLocaleString()}</td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-400">{shopProfile.currency} {(pr.netPay||0).toLocaleString()}</td>
                          <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pr.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-300'}`}>{pr.status}</span></td>
                          <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                            {pr.status !== 'Paid' && (isAdminUser || canUpdate('payroll')) && (
                              <>
                                <select value={payrollPayMethod} onChange={e => setPayrollPayMethod(e.target.value)} onClick={e => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded text-[10px] text-white mr-1 py-0.5">
                                  {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                                </select>
                                <button onClick={() => handleMarkPayrollPaid(pr, payrollPayMethod)} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold mr-1">Mark Paid</button>
                              </>
                            )}
                            <button onClick={() => {
                              let ab = pr.allowanceBreakdown, db = pr.deductionBreakdown;
                              try { if (typeof ab === 'string') ab = JSON.parse(ab || '{}'); } catch (_) { ab = {}; }
                              try { if (typeof db === 'string') db = JSON.parse(db || '{}'); } catch (_) { db = {}; }
                              setSelectedPayroll({ ...pr, allowanceBreakdown: ab || {}, deductionBreakdown: db || {} });
                              setPayrollPrintMode(true);
                            }} className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded text-[10px] font-bold">Print</button> <button type="button" onClick={() => downloadPayslipHtml(pr)} className="px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded text-[10px] font-bold">Download</button>
                            {pr.paidDate && <span className="text-[10px] text-slate-500 ml-1">{pr.paidDate}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (isAdminUser || privileges.reports?.view || privileges.reportSales?.view || privileges.reportPurchase?.view || privileges.reportExpense?.view || privileges.reportHr?.view || privileges.reportCustomer?.view) && (
          <div className="space-y-6">
            {/* Header Control Panel — filters always available; title+KPIs follow Comprehensive privilege */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className={canViewReportSection('reportComprehensive') ? '' : 'hidden'}>
                  <h3 className="text-lg font-bold text-white">Comprehensive Reports Center</h3>
                  <p className="text-xs text-slate-400">Track sales, expenses, customer statements, margins, inventory audit, and purchase report.</p>
                </div>
                {!canViewReportSection('reportComprehensive') && (
                <div>
                  <h3 className="text-lg font-bold text-white">Reports</h3>
                  <p className="text-xs text-slate-400">Filtered reports for your access level.</p>
                </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select value={reportTimeframe} onChange={e => setReportTimeframe(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-3 py-2 text-white">
                    <option value="all">All Dates (Default)</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                  {reportTimeframe === 'custom' && (
                    <div className="flex items-center gap-1">
                      <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                      <span className="text-xs text-slate-400">to</span>
                      <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white" />
                    </div>
                  )}
                  <select value={reportTypeFilter} onChange={e => setReportTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-3 py-2 text-emerald-400 font-semibold">
                    <option value="all">All Sale Types</option>
                    <option value="Paid">Paid Only</option>
                    <option value="Credit">Credit Only</option>
                    <option value="Layby">Layby Only</option>
                  </select>
                  <button onClick={() => window.print()} className="px-3 py-2 bg-emerald-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Print / Export
                  </button>
                </div>
              </div>

              {/* KPI Metrics Row */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-700 ${canViewReportSection('reportComprehensive') ? '' : 'hidden'}`}>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase">Gross Profit</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{shopProfile.currency} {reportGrossProfit.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase">Total Expenses</p>
                  <h4 className="text-xl font-bold text-amber-400 mt-1">{shopProfile.currency} {reportTotalOperatingExpenses.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase">Profit Margin</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{reportTotalRevenue > 0 ? ((reportGrossProfit / reportTotalRevenue) * 100).toFixed(1) : 0}%</h4>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase">Net Profit</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{shopProfile.currency} {reportNetProfit.toLocaleString()}</h4>
                </div>
              </div>
            </div>


                        <div className="space-y-4">
              <div className="w-full bg-slate-900 border border-slate-700 rounded-xl p-1.5 flex flex-wrap gap-1">
                {reportAllowedTabs.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReportSubTab(item.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${effectiveReportSubTab === item.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="min-w-0 space-y-4 w-full">
                {effectiveReportSubTab === 'sales' && (
                  <>
            {/* SECTION 1: SALES REPORT HEADER & 3-COLUMN GRID */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Sales Report</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Most Selling Items (Top 5) */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesMostItems') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">⭐ Most Selling Items (Top 5)</h4>
                  <div className="divide-y divide-slate-700">
                    {mostSellingItemsReport.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">No item sales recorded.</p>
                    ) : (
                      mostSellingItemsReport.map((item, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-white">{idx + 1}. {item.name}</p>
                            <p className="text-[10px] text-slate-400">Qty Sold: {item.qty}</p>
                          </div>
                          <span className="font-bold text-emerald-400">{shopProfile.currency} {item.totalSales.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Most Selling Categories (Sales & Margins) Table */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesMostCategories') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">🏆 Most Selling Categories (Sales & Margins)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2 px-2">Category</th>
                          <th className="py-2 px-2">Units</th>
                          <th className="py-2 px-2">Sales</th>
                          <th className="py-2 px-2">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {reportCategoriesList.length === 0 ? (
                          <tr><td colSpan={4} className="py-4 text-center text-slate-400">No category sales recorded.</td></tr>
                        ) : (
                          reportCategoriesList.map((cat, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="py-2 px-2 font-semibold text-white">{cat.category}</td>
                              <td className="py-2 px-2 font-mono">{cat.qty}</td>
                              <td className="py-2 px-2 font-bold text-emerald-400">{shopProfile.currency} {cat.totalSales.toLocaleString()}</td>
                              <td className="py-2 px-2 font-bold text-emerald-400">{cat.margin.toFixed(1)}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dormant Items (Bottom 5) */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesDormant') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">💤 Dormant Items (Bottom 5)</h4>
                  <div className="divide-y divide-slate-700">
                    {dormantItemsReport.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">No inventory items found.</p>
                    ) : (
                      dormantItemsReport.map((item, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-white">{idx + 1}. {item.name}</p>
                            <p className="text-[10px] text-slate-400">Qty Sold: {item.qty}</p>
                          </div>
                          <span className="font-bold text-slate-400">{shopProfile.currency} {item.totalSales.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 2: SALESPERSON REPORT ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Best Performing Salesperson Report */}
              <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesBestPeople') ? '' : 'hidden'}`}>
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">👨‍💼 Best Performing Salesperson Report</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                      <tr>
                        <th className="py-2 px-2">Salesperson</th>
                        <th className="py-2 px-2">Orders</th>
                        <th className="py-2 px-2">Sales Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {reportSalespeopleList.length === 0 ? (
                        <tr><td colSpan={3} className="py-4 text-center text-slate-400">No salesperson records found.</td></tr>
                      ) : (
                        reportSalespeopleList.map((sp, idx) => (
                          <tr key={idx} className="hover:bg-slate-700/50">
                            <td className="py-2 px-2 font-semibold text-white">{sp.cashier}</td>
                            <td className="py-2 px-2 font-mono">{sp.count}</td>
                            <td className="py-2 px-2 font-bold text-emerald-400">{shopProfile.currency} {sp.totalSales.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Middle Column: Key Summary Financial Cards */}
              <div className={`space-y-4 flex flex-col justify-between ${canViewReportSection('reportSalesKpis') ? '' : 'hidden'}`}>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex flex-col justify-center">
                  <p className="text-xs text-slate-400 uppercase">Total Sales</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{shopProfile.currency} {reportTotalRevenue.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex flex-col justify-center">
                  <p className="text-xs text-slate-400 uppercase">Gross Profit Margin</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{reportTotalRevenue > 0 ? ((reportGrossProfit / reportTotalRevenue) * 100).toFixed(1) : 0}%</h4>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex flex-col justify-center">
                  <p className="text-xs text-slate-400 uppercase">Net Income</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{shopProfile.currency} {reportNetProfit.toLocaleString()}</h4>
                </div>
              </div>

              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">👥 Top 5 Customers</h4>
                <div className="divide-y divide-slate-700">
                  {topCustomersList.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">No customer sales recorded.</p>
                  ) : (
                    topCustomersList.map((cust, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-white">{idx + 1}. {cust.name}</p>
                          <p className="text-[10px] text-slate-400">Orders: {cust.ordersCount}</p>
                        </div>
                        <span className="font-bold text-emerald-400">{shopProfile.currency} {cust.totalSpent.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesCreditsLayby') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Total Credits &amp; Total Layby</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Total Credit Sales</span>
                      <span className="font-bold text-amber-400">{shopProfile.currency} {reportFilteredSales.filter(s => s.saleType === 'Credit').reduce((sum, s) => sum + (s.totalAmount || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Credit Balance Due</span>
                      <span className="font-bold text-amber-400">{shopProfile.currency} {reportFilteredSales.filter(s => s.saleType === 'Credit').reduce((sum, s) => sum + (s.balanceDue || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Total Layby Sales</span>
                      <span className="font-bold text-sky-400">{shopProfile.currency} {reportFilteredSales.filter(s => s.saleType === 'Layby').reduce((sum, s) => sum + (s.totalAmount || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Layby Balance Due</span>
                      <span className="font-bold text-sky-400">{shopProfile.currency} {reportFilteredSales.filter(s => s.saleType === 'Layby').reduce((sum, s) => sum + (s.balanceDue || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded border border-emerald-500/30">
                      <span className="text-slate-300 font-semibold">Combined Outstanding</span>
                      <span className="font-bold text-emerald-400">{shopProfile.currency} {reportFilteredSales.filter(s => s.saleType === 'Credit' || s.saleType === 'Layby').reduce((sum, s) => sum + (s.balanceDue || 0), 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">⚠️ Top Sales Pending Due (Highest Debts)</h4>
                  <div className="divide-y divide-slate-700 max-h-48 overflow-y-auto">
                    {filterOwn('sales', reportFilteredSales || sales || []).filter(s => (parseFloat(s.balanceDue) || 0) > 0).sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0)).slice(0, 8).length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">No active debts pending.</p>
                    ) : (
                      filterOwn('sales', reportFilteredSales || sales || []).filter(s => (parseFloat(s.balanceDue) || 0) > 0).sort((a, b) => (b.balanceDue || 0) - (a.balanceDue || 0)).slice(0, 8).map((s, idx) => (
                        <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-white">{idx + 1}. {s.customerName} ({s.saleType})</p>
                            <p className="text-[10px] text-slate-400">Due: {s.deadline || '—'}</p>
                          </div>
                          <span className="font-bold text-amber-400">{shopProfile.currency} {(s.balanceDue || 0).toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportSalesTax') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Sales Tax Collected ({taxSettings.salesTaxName || 'VAT'})</h4>
                  <div className="space-y-2 text-xs mb-3">
                    <div className="flex justify-between"><span className="text-slate-400">Tax enabled</span><span className="text-white font-semibold">{taxSettings.salesTaxEnabled ? 'Yes' : 'No'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Rate</span><span className="text-white font-semibold">{taxSettings.salesTaxRate}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Total sales tax (period)</span><span className="text-emerald-400 font-bold">{shopProfile.currency} {sales.filter(s => {
                      if (reportTimeframe === 'all') return true;
                      const d = new Date(s.date);
                      if (reportTimeframe === 'today') return d.toDateString() === new Date().toDateString();
                      if (reportTimeframe === 'this_month') return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
                      if (reportTimeframe === 'this_week') { const now = new Date(); const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); return d >= weekStart; }
                      if (reportTimeframe === 'custom' && reportStartDate && reportEndDate) return d >= new Date(reportStartDate) && d <= new Date(reportEndDate + 'T23:59:59');
                      return true;
                    }).reduce((sum, s) => sum + (parseFloat(s.taxAmount) || 0), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                  </div>
                  </div>
              </div>

              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">📍 Sales by Location</h4>
                <p className="text-[10px] text-slate-500 mb-2">Revenue, COGS and profit margin per location for the selected report period.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                      <tr><th className="py-2 px-2">Location</th><th className="py-2 px-2 text-right">Sales #</th><th className="py-2 px-2 text-right">Revenue</th><th className="py-2 px-2 text-right">COGS</th><th className="py-2 px-2 text-right">Gross Profit</th><th className="py-2 px-2 text-right">Margin %</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {(salesByLocationList || []).length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-center text-slate-500">No sales for this period.</td></tr>
                      ) : (salesByLocationList || []).map(r => (
                        <tr key={r.branchId}><td className="py-2 px-2 text-white font-semibold">{r.name}</td><td className="py-2 px-2 text-right">{r.count}</td><td className="py-2 px-2 text-right text-emerald-400">{shopProfile.currency} {Number(r.revenue).toLocaleString()}</td><td className="py-2 px-2 text-right">{Number(r.cogs).toLocaleString()}</td><td className="py-2 px-2 text-right text-emerald-400">{Number(r.grossProfit).toLocaleString()}</td><td className="py-2 px-2 text-right">{Number(r.marginPct).toFixed(1)}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
                  </>
                )}
                {effectiveReportSubTab === 'purchase' && (
                  <>
            {/* SECTION 4: PURCHASE REPORT HEADER & 2-COLUMN GRID */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" /> Purchase Report
              </h3>
              
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${canViewReportSection('reportPurchaseSummary') ? '' : 'hidden'}`}>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Total Purchase Amount</p>
                  <h4 className="text-2xl font-bold text-emerald-400 mt-2">{shopProfile.currency} {totalPurchaseAmountReport.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Most Frequent Supplier</p>
                  <h4 className="text-2xl font-bold text-white mt-2">{mostFrequentSupplierReport}</h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Total Purchase by Categories */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportPurchaseByCategory') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Total Purchase by Categories</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Total Purchase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {poCategoryBreakdownList.length === 0 ? (
                          <tr><td colSpan={2} className="py-3 text-center text-slate-400">No purchase category records found.</td></tr>
                        ) : (
                          poCategoryBreakdownList.map((pc, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="py-2 px-3 font-semibold text-white">{pc.category}</td>
                              <td className="py-2 px-3 font-bold text-emerald-400">{shopProfile.currency} {pc.amount.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Item Category List of Total COGS Account Report */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportPurchaseCogs') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">📦 Item Category List of Total COGS Account Report</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Category Name</th>
                          <th className="py-2 px-3">Items Sold</th>
                          <th className="py-2 px-3">Value (COGS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {reportCategoriesList.length === 0 ? (
                          <tr><td colSpan={3} className="py-4 text-center text-slate-400">No category COGS records found.</td></tr>
                        ) : (
                          reportCategoriesList.map((cat, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="py-2 px-3 font-semibold text-white">{cat.category}</td>
                              <td className="py-2 px-3 font-mono">{cat.qty}</td>
                              <td className="py-2 px-3 font-bold text-amber-400">{shopProfile.currency} {cat.totalCogs.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportPurchaseUnpaid') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Total Unpaid Purchase Orders</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Unpaid / Partial POs</span>
                      <span className="font-bold text-white">{reportFilteredPO.filter(po => (po.balanceDue || 0) > 0).length}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Total Unpaid Amount</span>
                      <span className="font-bold text-amber-400">{shopProfile.currency} {reportFilteredPO.reduce((sum, po) => sum + (po.balanceDue || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="overflow-x-auto max-h-40">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-900 text-slate-400"><tr><th className="py-1 px-2">PO</th><th className="py-1 px-2">Supplier</th><th className="py-1 px-2">Balance</th></tr></thead>
                        <tbody className="divide-y divide-slate-700">
                          {reportFilteredPO.filter(po => (po.balanceDue || 0) > 0).slice(0, 30).map(po => (
                            <tr key={po.id}><td className="py-1 px-2">{po.id}</td><td className="py-1 px-2">{po.supplierName}</td><td className="py-1 px-2 text-amber-400">{(po.balanceDue||0).toLocaleString()}</td></tr>
                          ))}
                          {reportFilteredPO.filter(po => (po.balanceDue || 0) > 0).length === 0 && (
                            <tr><td colSpan={3} className="py-3 text-center text-slate-500">No unpaid purchase orders.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Purchase Price Variation</h4>
                  <p className="text-[10px] text-slate-500 mb-2">Same items purchased at different unit costs.</p>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-[11px] text-slate-300">
                      <thead className="bg-slate-900 text-slate-400"><tr><th className="py-1 px-2">Item</th><th className="py-1 px-2 text-right">Min</th><th className="py-1 px-2 text-right">Max</th><th className="py-1 px-2 text-right">Var %</th></tr></thead>
                      <tbody className="divide-y divide-slate-700">
                        {(purchasePriceVariationList || []).length === 0 ? (
                          <tr><td colSpan={4} className="py-3 text-center text-slate-500">No price variation detected.</td></tr>
                        ) : (purchasePriceVariationList || []).map((r, i) => (
                          <tr key={i}><td className="py-1 px-2 text-white">{r.name}</td><td className="py-1 px-2 text-right">{Number(r.min).toLocaleString()}</td><td className="py-1 px-2 text-right">{Number(r.max).toLocaleString()}</td><td className="py-1 px-2 text-right text-amber-400">{Number(r.variationPct).toFixed(1)}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
<div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportPurchaseTax') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Purchase Tax ({taxSettings.purchaseTaxName || 'VAT'})</h4>
                  <div className="space-y-2 text-xs mb-3">
                    <div className="flex justify-between"><span className="text-slate-400">Tax enabled</span><span className="text-white font-semibold">{taxSettings.purchaseTaxEnabled ? 'Yes' : 'No'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Rate</span><span className="text-white font-semibold">{taxSettings.purchaseTaxRate}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Total purchase tax</span><span className="text-amber-400 font-bold">{shopProfile.currency} {purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.taxAmount) || 0), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                  </div>
            
                  
                  </div>
              </div>
</>
                )}
                {effectiveReportSubTab === 'expense' && (
                  <>
            {/* SECTION 3: EXPENSE REPORTS HEADER & 2-COLUMN GRID */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Expense Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* High Expense Categories Breakdown */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportExpenseHighCategories') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">💸 High Expense Categories Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Expense Category</th>
                          <th className="py-2 px-3">Expense Count</th>
                          <th className="py-2 px-3">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {reportExpenseCategoriesList.length === 0 ? (
                          <tr><td colSpan={3} className="py-4 text-center text-slate-400">No expense records found.</td></tr>
                        ) : (
                          reportExpenseCategoriesList.map((ec, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="py-2 px-3 font-semibold text-white">{ec.category}</td>
                              <td className="py-2 px-3 font-mono">{ec.count}</td>
                              <td className="py-2 px-3 font-bold text-amber-400">{shopProfile.currency} {ec.totalAmount.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Most Frequent Expense Categories */}
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportExpenseFrequent') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">📊 Most Frequent Expense Categories</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 uppercase text-slate-400 border-b border-slate-700 text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Expense Count</th>
                          <th className="py-2 px-3">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {frequentExpenseCategoryReport.length === 0 ? (
                          <tr><td colSpan={3} className="py-4 text-center text-slate-400">No expense records found.</td></tr>
                        ) : (
                          frequentExpenseCategoryReport.map((ec, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="py-2 px-3 font-semibold text-white">{ec.category}</td>
                              <td className="py-2 px-3 font-mono">{ec.times}</td>
                              <td className="py-2 px-3 font-bold text-amber-400">{shopProfile.currency} {ec.amountPaid.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportExpenseUnpaid') ? '' : 'hidden'}`}>
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Total Unpaid Expenses</h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Unpaid / Partial Expenses</span>
                      <span className="font-bold text-white">{reportFilteredExpenses.filter(e => (e.balanceDue || 0) > 0 || (e.paymentStatus && e.paymentStatus !== 'Paid')).length}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-slate-400">Total Unpaid Amount</span>
                      <span className="font-bold text-amber-400">{shopProfile.currency} {reportFilteredExpenses.reduce((sum, e) => sum + (parseFloat(e.balanceDue) || 0), 0).toLocaleString()}</span>
                    </div>
                    <div className="overflow-x-auto max-h-40">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-900 text-slate-400"><tr><th className="py-1 px-2">Date</th><th className="py-1 px-2">Description</th><th className="py-1 px-2">Balance</th></tr></thead>
                        <tbody className="divide-y divide-slate-700">
                          {reportFilteredExpenses.filter(e => (parseFloat(e.balanceDue) || 0) > 0).slice(0, 30).map(e => (
                            <tr key={e.id}><td className="py-1 px-2">{(e.date||'').toString().slice(0,10)}</td><td className="py-1 px-2">{e.description || e.category}</td><td className="py-1 px-2 text-amber-400">{(parseFloat(e.balanceDue)||0).toLocaleString()}</td></tr>
                          ))}
                          {reportFilteredExpenses.filter(e => (parseFloat(e.balanceDue) || 0) > 0).length === 0 && (
                            <tr><td colSpan={3} className="py-3 text-center text-slate-500">No unpaid expenses.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Expense Categories per Location</h4>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-[11px] text-slate-300">
                      <thead className="bg-slate-900 text-slate-400"><tr><th className="py-1 px-2">Location</th><th className="py-1 px-2">Category</th><th className="py-1 px-2 text-right">Amount</th></tr></thead>
                      <tbody className="divide-y divide-slate-700">
                        {(expenseByLocationCategoryList || []).length === 0 ? (
                          <tr><td colSpan={3} className="py-3 text-center text-slate-500">No expenses in period.</td></tr>
                        ) : (expenseByLocationCategoryList || []).map((r, i) => (
                          <tr key={i}><td className="py-1 px-2 text-white">{r.branchName}</td><td className="py-1 px-2">{r.category}</td><td className="py-1 px-2 text-right text-amber-400">{Number(r.amount).toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={`bg-slate-800 p-5 rounded-xl border border-slate-700 ${canViewReportSection('reportExpenseTax') ? '' : 'hidden'}`}>
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Expense Tax ({taxSettings.purchaseTaxName || 'VAT'})</h4>
                <div className="space-y-2 text-xs mb-3">
                  <div className="flex justify-between"><span className="text-slate-400">Uses purchase tax settings</span><span className="text-white font-semibold">{taxSettings.purchaseTaxEnabled ? 'Enabled by default' : 'Toggle per expense'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Rate</span><span className="text-white font-semibold">{taxSettings.purchaseTaxRate}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total expense tax</span><span className="text-amber-400 font-bold">{shopProfile.currency} {expenses.reduce((sum, e) => sum + (parseFloat(e.taxAmount) || 0), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                </div>
            
                  
                  </div>
              </div>
</>
                )}
                {effectiveReportSubTab === 'hr' && (
                  <>
            {/* HR REPORTS — uses same report timeframe & location filters as other tabs */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2 flex items-center gap-2"><UserCheck className="w-4 h-4 text-sky-400" /> HR Reports</h3>
              <p className="text-[10px] text-slate-500">Uses the report location and date filters above (payroll totals respect the selected period).</p>
              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${canViewReportSection('reportHrSummary') ? '' : 'hidden'}`}>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase">Total Employees</p>
                  <p className="text-2xl font-bold text-white mt-1">{(branchEmployees || employees).length}</p>
                  <p className="text-[10px] text-emerald-400 mt-1">{(branchEmployees || employees).filter(e => e.status === 'Active').length} active</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase">Total Gross Salary</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{shopProfile.currency} {(branchEmployees || employees).reduce((s, e) => s + (parseFloat(e.salary) || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase">Total Leave Balance</p>
                  <p className="text-2xl font-bold text-sky-400 mt-1">{(branchEmployees || employees).reduce((s, e) => s + (parseFloat(e.leaveBalance) || 0), 0)} days</p>
                </div>
              </div>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 overflow-x-auto">
                <div className={canViewReportSection('reportHrLeaveSalary') ? '' : 'hidden'}>
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Employee Leave Balance & Gross Salary</h4>
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 uppercase text-slate-400 text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Employee</th>
                      <th className="py-2 px-3">Department</th>
                      <th className="py-2 px-3">Position</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Leave Balance</th>
                      <th className="py-2 px-3">Gross Salary</th>
                      <th className="py-2 px-3">Total Received Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {(branchEmployees || employees).length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-slate-500">No employees registered.</td></tr>
                    ) : (branchEmployees || employees).map(emp => {
                      const received = (payrollRecords || []).filter(p => {
                        if (p.employeeId !== emp.id || p.status !== 'Paid') return false;
                        if (reportTimeframe === 'custom' && reportStartDate && reportEndDate) {
                          const d = String(p.paidDate || p.period || '').slice(0, 10);
                          if (d && (d < reportStartDate || d > reportEndDate)) return false;
                        }
                        return true;
                      }).reduce((sum, p) => sum + (parseFloat(p.netPay) || 0), 0);
                      return (
                      <tr key={emp.id} className="hover:bg-slate-700/40">
                        <td className="py-2 px-3 font-semibold text-white">{emp.name}</td>
                        <td className="py-2 px-3">{emp.department || '—'}</td>
                        <td className="py-2 px-3">{emp.position || '—'}</td>
                        <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-300'}`}>{emp.status}</span></td>
                        <td className="py-2 px-3 font-mono text-sky-400">{emp.leaveBalance ?? 21} days</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-400">{shopProfile.currency} {(parseFloat(emp.salary)||0).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono font-bold text-sky-400">{shopProfile.currency} {received.toLocaleString()}</td>
                      </tr>
                    );})}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-xs mb-3 border-b border-slate-700 pb-2">Allowances and Deductions</h4>
                <p className="text-[10px] text-slate-500 mb-3">Totals from payroll records for the selected report period (uses report date filters when custom).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] uppercase text-emerald-400 font-bold mb-2">Allowances</p>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {Object.keys(payrollAllowancesTotals || {}).length === 0 ? (
                        <p className="text-slate-500">No allowance lines in payroll for this period.</p>
                      ) : Object.entries(payrollAllowancesTotals).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                        <div key={k} className="flex justify-between bg-slate-950 border border-slate-800 rounded px-2 py-1.5"><span className="text-slate-300">{k}</span><span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(v).toLocaleString()}</span></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-amber-400 font-bold mb-2">Deductions</p>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {Object.keys(payrollDeductionsTotals || {}).length === 0 ? (
                        <p className="text-slate-500">No deduction lines in payroll for this period.</p>
                      ) : Object.entries(payrollDeductionsTotals).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                        <div key={k} className="flex justify-between bg-slate-950 border border-slate-800 rounded px-2 py-1.5"><span className="text-slate-300">{k}</span><span className="text-amber-400 font-bold">{shopProfile.currency} {Number(v).toLocaleString()}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>


                  </>
                )}
                
                {effectiveReportSubTab === 'inventory' && canViewReportSection('reportInventory') && (
                  <>
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Inventory Report</h3>
              <p className="text-[10px] text-slate-500">Uses the same report timeframe and location filters as other report tabs.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Inventory Valuation</h4>
                  <p className="text-2xl font-bold text-emerald-400">{shopProfile.currency} {Number(inventoryValuationTotal||0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{(inventoryValuationRows||[]).length} items · qty × buying price</p>
                  <div className="mt-2 max-h-36 overflow-y-auto text-[11px] space-y-1">
                    {(inventoryValuationRows||[]).slice(0,15).map(r => (
                      <div key={r.id} className="flex justify-between"><span className="text-slate-300 truncate mr-2">{r.name}</span><span className="text-emerald-400">{Number(r.value).toLocaleString()}</span></div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Dead Stock</h4>
                  <p className="text-[10px] text-slate-500 mb-2">Tracked items with no sales in the selected period.</p>
                  <div className="max-h-44 overflow-y-auto text-[11px] space-y-1">
                    {(deadStockRows||[]).length === 0 ? <p className="text-slate-500">None detected.</p> : (deadStockRows||[]).map(i => (
                      <div key={i.id} className="flex justify-between"><span className="text-white">{i.name}</span><span className="text-slate-400">Qty {i.quantity}</span></div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Low Stock Alerts</h4>
                  <p className="text-[10px] text-slate-500 mb-2">View only — not clickable for restock.</p>
                  <div className="max-h-44 overflow-y-auto text-[11px] space-y-1">
                    {(lowStockAlertList||[]).length === 0 ? <p className="text-slate-500">All tracked items above threshold.</p> : (lowStockAlertList||[]).map(i => (
                      <div key={i.id} className="flex justify-between gap-2"><span className="text-white">{i.name}</span><span className="text-red-400 font-bold">Qty {i.quantity} / alert {i.lowStockAlert || 3}</span></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 md:col-span-1">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Stock Balance</h4>
                  <div className="max-h-52 overflow-y-auto text-[11px]">
                    <table className="w-full text-left"><thead className="text-slate-400 text-[10px]"><tr><th className="py-1">Item</th><th className="py-1 text-right">Qty</th></tr></thead>
                    <tbody className="divide-y divide-slate-700">{(stockBalanceRows||[]).slice(0,40).map(r => (
                      <tr key={r.id}><td className="py-1 text-white">{r.name}</td><td className="py-1 text-right font-mono">{r.qty}</td></tr>
                    ))}</tbody></table>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 md:col-span-2">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Stock Valuation by Branch</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]"><tr><th className="py-2 px-2">Location</th><th className="py-2 px-2 text-right">Items</th><th className="py-2 px-2 text-right">Total Qty</th><th className="py-2 px-2 text-right">Valuation</th></tr></thead>
                      <tbody className="divide-y divide-slate-700">
                        {(branchStockValuationList||[]).length === 0 ? (
                          <tr><td colSpan={4} className="py-4 text-center text-slate-500">No inventory values.</td></tr>
                        ) : (branchStockValuationList||[]).map(b => (
                          <tr key={b.branchId}><td className="py-2 px-2 text-white font-semibold">{b.name}</td><td className="py-2 px-2 text-right">{b.items}</td><td className="py-2 px-2 text-right">{b.qty}</td><td className="py-2 px-2 text-right text-emerald-400">{shopProfile.currency} {Number(b.value).toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 md:col-span-3">
                  <h4 className="font-bold text-white text-xs mb-2 border-b border-slate-700 pb-2">Full Inventory Valuation Detail</h4>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0"><tr><th className="py-2 px-2">Item</th><th className="py-2 px-2">Category</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Unit cost</th><th className="py-2 px-2 text-right">Value</th></tr></thead>
                      <tbody className="divide-y divide-slate-700">
                        {(inventoryValuationRows||[]).map(r => (
                          <tr key={r.id}><td className="py-1.5 px-2 text-white">{r.name}</td><td className="py-1.5 px-2">{r.category}</td><td className="py-1.5 px-2 text-right">{r.qty}</td><td className="py-1.5 px-2 text-right">{Number(r.cost).toLocaleString()}</td><td className="py-1.5 px-2 text-right text-emerald-400">{Number(r.value).toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
                  </>
                )}

                {effectiveReportSubTab === 'customer' && (
                  <>
            {/* SECTION 5: CUSTOMER STATEMENT HEADER & SECTION */}
            <div className={`space-y-4 ${canViewReportSection('reportCustomerStatement') ? '' : 'hidden'}`}>
              <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Customer Statement</h3>
              <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">👤 Customer Account Statement Report</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Select a customer to view their complete order statement, payment records, and balances.</p>
                  </div>
                  <select value={reportStatementCustomer} onChange={e => setReportStatementCustomer(e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded px-3 py-2 text-emerald-400 font-bold">
                    <option value="">-- Choose Customer Statement --</option>
                    {(customers || []).map(c => <option key={c.id} value={c.name}>{c.name} ({c.location})</option>)}
                  </select>
                </div>

                {reportStatementCustomer ? (
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
                    <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                      <div>
                        <p className="font-bold text-white text-sm">{reportStatementCustomer}</p>
                        <p className="text-[10px] text-slate-400">Statement generated for all recorded orders</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold">
                          Total Spent: {shopProfile.currency} {(sales || []).filter(s => s.customerName === reportStatementCustomer).reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}
                        </span>
                        <button type="button" onClick={() => {
                          const rows = (sales || []).filter(s => s.customerName === reportStatementCustomer);
                          const total = rows.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
                          const paid = rows.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
                          const bal = rows.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
                          const trs = rows.map(s => `<tr><td>${s.id||''}</td><td>${s.date ? new Date(s.date).toLocaleDateString() : ''}</td><td>${s.saleType||''}</td><td>${s.totalAmount||0}</td><td>${s.paidAmount||0}</td><td>${s.balanceDue||0}</td></tr>`).join('');
                          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statement ${reportStatementCustomer}</title>
                            <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:12px}h1{font-size:18px}</style></head><body>
                            <h1>Customer Statement — ${shopProfile.name||''}</h1>
                            <p><b>${reportStatementCustomer}</b><br/>Generated ${new Date().toLocaleString()}</p>
                            <p>Total: ${shopProfile.currency} ${total.toLocaleString()} · Paid: ${shopProfile.currency} ${paid.toLocaleString()} · Balance: ${shopProfile.currency} ${bal.toLocaleString()}</p>
                            <table><thead><tr><th>Tx</th><th>Date</th><th>Type</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${trs}</tbody></table>
                            </body></html>`;
                          const tableHtml = `<table><thead><tr><th>Tx</th><th>Date</th><th>Type</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>${trs}</tbody></table>`;
                          const extra = `<p>Total: ${shopProfile.currency} ${total.toLocaleString()} · Paid: ${shopProfile.currency} ${paid.toLocaleString()} · Balance: ${shopProfile.currency} ${bal.toLocaleString()}</p>`;
                          downloadReportPdf('Customer Statement — ' + reportStatementCustomer, tableHtml, extra);
                        }} className="px-2 py-1 bg-sky-500/20 text-sky-400 text-[10px] font-bold rounded">Download PDF</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-2">Tx ID</th>
                            <th className="py-2 px-2">Date</th>
                            <th className="py-2 px-2">Type</th>
                            <th className="py-2 px-2">Amount</th>
                            <th className="py-2 px-2">Paid</th>
                            <th className="py-2 px-2">Balance Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(sales || []).filter(s => s.customerName === reportStatementCustomer).length === 0 ? (
                            <tr><td colSpan={6} className="py-4 text-center text-slate-400">No transaction records found for this customer.</td></tr>
                          ) : (
                            (sales || []).filter(s => s.customerName === reportStatementCustomer).map(s => (
                              <tr key={s.id} className="hover:bg-slate-800/40">
                                <td className="py-2 px-2 font-mono text-emerald-400">{s.id}</td>
                                <td className="py-2 px-2">{s.date ? new Date(s.date).toLocaleDateString() : 'N/A'}</td>
                                <td className="py-2 px-2"><span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{s.saleType}</span></td>
                                <td className="py-2 px-2 font-bold">{shopProfile.currency} {s.totalAmount?.toLocaleString()}</td>
                                <td className="py-2 px-2 text-emerald-400">{shopProfile.currency} {s.paidAmount?.toLocaleString()}</td>
                                <td className="py-2 px-2 font-bold text-amber-400">{shopProfile.currency} {s.balanceDue?.toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Please select a customer above to view their detailed account statement table.</p>
                )}
              </div>
            </div>


                  </>
                )}


                {effectiveReportSubTab === 'aging' && canViewReportSection('reportAging') && (
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Aging Report</h3>
                    <p className="text-[10px] text-slate-500">Unpaid balances by age (from deadline or document date). Read-only — does not change balances.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { k: 'current', l: 'Not yet due' },
                        { k: '0_30', l: '1–30 days' },
                        { k: '31_60', l: '31–60 days' },
                        { k: '60_plus', l: '60+ days' }
                      ].map(b => (
                        <div key={b.k} className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                          <p className="text-[10px] text-slate-400 uppercase">{b.l}</p>
                          <p className="text-lg font-bold text-amber-400 mt-1">{shopProfile.currency} {(agingTotals[b.k] || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300 min-w-[640px]">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]"><tr>
                          <th className="py-2 px-2">Kind</th><th className="py-2 px-2">Ref</th><th className="py-2 px-2">Party</th><th className="py-2 px-2">Type</th><th className="py-2 px-2">Deadline</th><th className="py-2 px-2">Bucket</th><th className="py-2 px-2">Balance Due</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-700">
                          {agingAll.length === 0 ? (
                            <tr><td colSpan={7} className="py-4 text-center text-slate-500">No unpaid balances.</td></tr>
                          ) : agingAll.sort((a,b) => (b.due||0)-(a.due||0)).map(r => (
                            <tr key={r.kind + r.id}>
                              <td className="py-2 px-2 capitalize">{r.kind}</td>
                              <td className="py-2 px-2 font-mono text-[10px]">{r.id}</td>
                              <td className="py-2 px-2 text-white">{r.party}</td>
                              <td className="py-2 px-2">{r.type}</td>
                              <td className="py-2 px-2">{r.deadline ? String(r.deadline).slice(0,10) : '—'}</td>
                              <td className="py-2 px-2">{r.bucket}</td>
                              <td className="py-2 px-2 font-bold text-amber-400">{shopProfile.currency} {(r.due||0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => exportRowsAsPdf('Aging Report', agingAll.map(r => ({ kind: r.kind, id: r.id, party: r.party, type: r.type, deadline: r.deadline, bucket: r.bucket, due: r.due })))} className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-bold rounded">Download PDF</button>
                      <button type="button" onClick={() => exportCSV('aging-report.csv', agingAll.map(r => ({ kind: r.kind, id: r.id, party: r.party, type: r.type, deadline: r.deadline, bucket: r.bucket, due: r.due })))} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">Download list</button>
                    </div>
                  </div>
                )}

                {effectiveReportSubTab === 'financial' && canViewReportSection('reportFinancial') && (
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-b border-slate-700 pb-2">Financial Reports</h3>
                    <p className="text-[10px] text-slate-500">Ledger- and transaction-based statements from the database. Choose a report, set filters, then Run.</p>

                    <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
                      {[
                        { id: 'gross-profit', label: 'Gross Profit' },
                        { id: 'pnl', label: 'Profit & Loss' },
                        { id: 'branch-profitability', label: 'Branch Profitability' },
                        { id: 'general-ledger', label: 'General Ledger' },
                        { id: 'trial-balance', label: 'Trial Balance' },
                        { id: 'balance-sheet', label: 'Balance Sheet' },
                        { id: 'sales-revenue', label: 'Sales Revenue' },
                        { id: 'expense-analysis', label: 'Expense Analysis' },
                        { id: 'comparative', label: 'Comparative' },
                        { id: 'cash-flow', label: 'Cash Flow' },
                        { id: 'chart-of-accounts', label: 'Chart of Accounts' },
                        { id: 'tax-summary', label: 'Tax Summary' }
                      ].map(t => (
                        <button key={t.id} type="button" onClick={() => { setFinReportTab(t.id); setFinReportData(null); }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap ${finReportTab === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-wrap gap-2 items-end text-xs">
                      {finReportTab !== 'NONE' && (
                        <>
                          <div>
                            <label className="text-slate-500 text-[10px] block">From</label>
                            <input type="date" value={finFrom} onChange={e => setFinFrom(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-slate-500 text-[10px] block">To / As of</label>
                            <input type="date" value={finTo} onChange={e => setFinTo(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                        </>
                      )}
                      {['sales-revenue','gross-profit','expense-analysis'].includes(finReportTab) && (
                        <div>
                          <label className="text-slate-500 text-[10px] block">Group by</label>
                          <select value={finGroupBy} onChange={e => setFinGroupBy(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white">
                            {finReportTab === 'expense-analysis' ? (
                              <><option value="category">Category</option><option value="supplier">Payee / Supplier</option><option value="date">Date</option><option value="month">Month</option><option value="branch">Branch</option></>
                            ) : finReportTab === 'sales-revenue' ? (
                              <><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="item">Item</option><option value="category">Category</option><option value="branch">Branch</option></>
                            ) : (
                              <><option value="item">Item</option><option value="category">Category</option><option value="branch">Branch</option><option value="month">Month</option><option value="day">Day</option></>
                            )}
                          </select>
                        </div>
                      )}
                      {['sales-revenue','gross-profit','expense-analysis','chart-of-accounts','tax-summary'].includes(finReportTab) && (
                        <div>
                          <label className="text-slate-500 text-[10px] block">Branch</label>
                          <select value={finBranchId} onChange={e => setFinBranchId(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white">
                            <option value="">All locations</option>
                            {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
                          </select>
                        </div>
                      )}
                      {finReportTab === 'comparative' && (
                        <>
                          <div>
                            <label className="text-slate-500 text-[10px] block">Compare from</label>
                            <input type="date" value={finCompareFrom} onChange={e => setFinCompareFrom(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                          <div>
                            <label className="text-slate-500 text-[10px] block">Compare to</label>
                            <input type="date" value={finCompareTo} onChange={e => setFinCompareTo(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                          </div>
                        </>
                      )}
                      {finReportTab === 'general-ledger' && (
                        <div>
                          <label className="text-slate-500 text-[10px] block">Account code (optional)</label>
                          <input value={finAccountCode} onChange={e => setFinAccountCode(e.target.value)} placeholder="e.g. 1000" className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white w-28" />
                        </div>
                      )}
                      <button type="button" disabled={finReportLoading} className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded text-xs" onClick={async () => {
                        setFinReportLoading(true);
                        setFinReportData(null);
                        try {
                          const q = new URLSearchParams();
                          q.set('type', finReportTab);
                          if (finFrom) q.set('from', finFrom);
                          if (finTo) q.set('to', finTo);
                          if (finGroupBy) q.set('groupBy', finGroupBy);
                          if (finBranchId) q.set('branchId', finBranchId);
                          if (finAccountCode) q.set('accountCode', finAccountCode);
                          if (finReportTab === 'comparative') {
                            if (finCompareFrom) q.set('compareFrom', finCompareFrom);
                            if (finCompareTo) q.set('compareTo', finCompareTo);
                          }
                          const res = await apiFetch('/api/financial-reports?' + q.toString());
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) { alert(data.error || 'Failed to load report'); setFinReportLoading(false); return; }
                          setFinReportData(data);
                        } catch (e) {
                          alert('Network error loading report');
                        }
                        setFinReportLoading(false);
                      }}>{finReportLoading ? 'Loading…' : 'Run report'}</button>
                      {finReportData && (
                        <button type="button" className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-bold rounded" onClick={() => {
                          let rows = [];
                          const d = finReportData;
                          if (finReportTab === 'pnl') {
                            rows = [
                              ...(d.income || []).map(r => ({ section: 'Income', code: r.code, name: r.name, amount: r.amount })),
                              { section: 'Income', code: '', name: 'Total income', amount: d.totalIncome },
                              ...(d.expenses || []).map(r => ({ section: 'Expense', code: r.code, name: r.name, amount: r.amount })),
                              { section: 'Expense', code: '', name: 'Total expenses', amount: d.totalExpense },
                              { section: 'Result', code: '', name: 'Net profit', amount: d.netProfit }
                            ];
                          } else if (finReportTab === 'balance-sheet') {
                            rows = [
                              ...(d.assets || []).map(r => ({ section: 'Assets', code: r.code, name: r.name, amount: r.amount })),
                              { section: 'Assets', code: '', name: 'Total assets', amount: d.totalAssets },
                              ...(d.liabilities || []).map(r => ({ section: 'Liabilities', code: r.code, name: r.name, amount: r.amount })),
                              { section: 'Liabilities', code: '', name: 'Total liabilities', amount: d.totalLiabilities },
                              ...(d.equity || []).map(r => ({ section: 'Equity', code: r.code, name: r.name, amount: r.amount })),
                              { section: 'Equity', code: '', name: 'Total equity', amount: d.totalEquity }
                            ];
                          } else if (finReportTab === 'trial-balance') {
                            rows = (d.trial || []).map(t => ({ code: t.code, name: t.name, debit: t.debit, credit: t.credit }));
                            rows.push({ code: '', name: 'Total', debit: d.totalDebit, credit: d.totalCredit });
                          } else if (finReportTab === 'cash-flow') {
                            rows = [
                              ...(d.operating || []).map(r => ({ section: 'Operating', date: r.date, source: r.sourceType, amount: r.amount, memo: r.memo })),
                              { section: 'Operating', date: '', source: 'Net operating', amount: d.netOperating, memo: '' },
                              ...(d.investing || []).map(r => ({ section: 'Investing', date: r.date, source: r.sourceType, amount: r.amount, memo: r.memo })),
                              { section: 'Investing', date: '', source: 'Net investing', amount: d.netInvesting, memo: '' },
                              ...(d.financing || []).map(r => ({ section: 'Financing', date: r.date, source: r.sourceType, amount: r.amount, memo: r.memo })),
                              { section: 'Financing', date: '', source: 'Net financing', amount: d.netFinancing, memo: '' },
                              { section: 'Total', date: '', source: 'Net change', amount: d.netChange, memo: '' }
                            ];
                          } else if (finReportTab === 'comparative') {
                            rows = [
                              { metric: 'Income', current: d.current?.income, previous: d.previous?.income, variance: d.variance?.income },
                              { metric: 'Expense', current: d.current?.expense, previous: d.previous?.expense, variance: d.variance?.expense },
                              { metric: 'Net', current: d.current?.net, previous: d.previous?.net, variance: d.variance?.net }
                            ];
                          } else if (finReportTab === 'tax-summary') {
                            rows = [
                              { type: 'Sales tax collected', amount: d.salesTaxCollected, taxable: d.salesTaxable, count: d.salesCount },
                              { type: 'Purchase tax', amount: d.purchaseTax, taxable: '', count: d.purchaseCount },
                              { type: 'Expense tax', amount: d.expenseTax, taxable: '', count: d.expenseCount },
                              { type: 'Total input tax', amount: d.totalInputTax, taxable: '', count: '' },
                              { type: 'Net VAT position', amount: d.netVat, taxable: '', count: '' },
                              ...Object.values(d.byRate || {}).map(r => ({ type: `Rate ${r.rate}%`, amount: (r.salesTax||0)+(r.purchaseTax||0), taxable: '', count: (r.salesCount||0)+(r.purchaseCount||0) }))
                            ];
                          } else {
                            rows = d.rows || d.trial || d.income || d.accounts || d.lines || d.assets || d.operating || [];
                          }
                          if (!Array.isArray(rows) || !rows.length) {
                            // last resort: flatten object keys
                            rows = [d];
                          }
                          exportRowsAsPdf('Financial: ' + finReportTab, rows);
                        }}>Download PDF</button>
                      )}
                    </div>

                    {finReportData && (
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 text-xs">
                        {finReportTab === 'pnl' && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <h4 className="font-bold text-emerald-400 mb-1">Income</h4>
                                {(finReportData.income || []).map(r => <div key={r.code} className="flex justify-between py-0.5 border-b border-slate-800"><span className="text-slate-300">{r.code} {r.name}</span><span className="text-emerald-400">{shopProfile.currency} {Number(r.amount).toLocaleString()}</span></div>)}
                                <div className="flex justify-between font-bold pt-1"><span>Total income</span><span className="text-emerald-400">{shopProfile.currency} {Number(finReportData.totalIncome||0).toLocaleString()}</span></div>
                              </div>
                              <div>
                                <h4 className="font-bold text-amber-400 mb-1">Expenses</h4>
                                {(finReportData.expenses || []).map(r => <div key={r.code} className="flex justify-between py-0.5 border-b border-slate-800"><span className="text-slate-300">{r.code} {r.name}</span><span className="text-amber-400">{shopProfile.currency} {Number(r.amount).toLocaleString()}</span></div>)}
                                <div className="flex justify-between font-bold pt-1"><span>Total expenses</span><span className="text-amber-400">{shopProfile.currency} {Number(finReportData.totalExpense||0).toLocaleString()}</span></div>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-white">Net profit: <span className={(finReportData.netProfit||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{shopProfile.currency} {Number(finReportData.netProfit||0).toLocaleString()}</span></p>
                          </>
                        )}
                        {finReportTab === 'trial-balance' && (
                          <>
                            <p className="text-[10px] text-slate-400">{finReportData.balanced ? 'Balanced ✓' : 'Out of balance — review journals'}</p>
                            <div className="overflow-x-auto max-h-96">
                              <table className="w-full text-left text-[11px]"><thead className="text-slate-400 uppercase text-[10px]"><tr><th className="p-2">Code</th><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
                              <tbody className="divide-y divide-slate-700">{(finReportData.trial||[]).map(t => <tr key={t.code}><td className="p-2 font-mono">{t.code}</td><td className="p-2 text-white">{t.name}</td><td className="p-2 text-right">{Number(t.debit||0).toLocaleString()}</td><td className="p-2 text-right">{Number(t.credit||0).toLocaleString()}</td></tr>)}</tbody>
                              <tfoot><tr className="font-bold text-white"><td className="p-2" colSpan={2}>Total</td><td className="p-2 text-right">{Number(finReportData.totalDebit||0).toLocaleString()}</td><td className="p-2 text-right">{Number(finReportData.totalCredit||0).toLocaleString()}</td></tr></tfoot>
                              </table>
                            </div>
                          </>
                        )}
                        {finReportTab === 'balance-sheet' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><h4 className="font-bold text-sky-400 mb-1">Assets</h4>{(finReportData.assets||[]).map(r => <div key={r.code} className="flex justify-between py-0.5"><span>{r.code} {r.name}</span><span>{Number(r.balance).toLocaleString()}</span></div>)}<div className="font-bold border-t border-slate-700 mt-1 pt-1 flex justify-between"><span>Total</span><span>{Number(finReportData.totalAssets||0).toLocaleString()}</span></div></div>
                            <div><h4 className="font-bold text-amber-400 mb-1">Liabilities</h4>{(finReportData.liabilities||[]).map(r => <div key={r.code} className="flex justify-between py-0.5"><span>{r.code} {r.name}</span><span>{Number(r.balance).toLocaleString()}</span></div>)}<div className="font-bold border-t border-slate-700 mt-1 pt-1 flex justify-between"><span>Total</span><span>{Number(finReportData.totalLiabilities||0).toLocaleString()}</span></div></div>
                            <div><h4 className="font-bold text-emerald-400 mb-1">Equity / P&amp;L</h4>{(finReportData.equity||[]).map(r => <div key={r.code+r.name} className="flex justify-between py-0.5"><span>{r.code} {r.name}</span><span>{Number(r.balance).toLocaleString()}</span></div>)}<div className="font-bold border-t border-slate-700 mt-1 pt-1 flex justify-between"><span>Total</span><span>{Number(finReportData.totalEquity||0).toLocaleString()}</span></div></div>
                          </div>
                        )}
                        {['sales-revenue','gross-profit','expense-analysis'].includes(finReportTab) && (
                          <>
                            {finReportTab === 'sales-revenue' && <p className="text-slate-400">Total revenue: <span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(finReportData.totalRevenue||0).toLocaleString()}</span></p>}
                            {finReportTab === 'gross-profit' && (
                              <p className="text-slate-400">Revenue {Number(finReportData.totalRevenue||0).toLocaleString()} · COGS {Number(finReportData.totalCogs||0).toLocaleString()} · GP <span className="text-emerald-400 font-bold">{Number(finReportData.totalGrossProfit||0).toLocaleString()}</span> · Margin {Number(finReportData.overallMarginPct||0)}%</p>
                            )}
                            {finReportTab === 'expense-analysis' && <p className="text-slate-400">Total expenses: <span className="text-amber-400 font-bold">{shopProfile.currency} {Number(finReportData.totalAmount||0).toLocaleString()}</span></p>}
                            <div className="overflow-x-auto max-h-96">
                              <table className="w-full text-left text-[11px]"><thead className="text-slate-400 text-[10px] uppercase"><tr><th className="p-2">Key</th>{finReportTab==='expense-analysis' ? <><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Count</th></> : finReportTab==='sales-revenue' ? <><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">Count/Qty</th></> : <><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">COGS</th><th className="p-2 text-right">Gross profit</th><th className="p-2 text-right">Margin %</th></>}</tr></thead>
                              <tbody className="divide-y divide-slate-700">
                                {(finReportData.rows||[]).map((r,i) => (
                                  <tr key={i}><td className="p-2 text-white">{r.key}</td>
                                  {finReportTab==='expense-analysis' ? <><td className="p-2 text-right">{Number(r.amount).toLocaleString()}</td><td className="p-2 text-right">{Number(r.paid).toLocaleString()}</td><td className="p-2 text-right">{r.count}</td></> :
                                   finReportTab==='sales-revenue' ? <><td className="p-2 text-right text-emerald-400">{Number(r.revenue).toLocaleString()}</td><td className="p-2 text-right">{r.qty != null ? r.qty : r.count}</td></> :
                                   <><td className="p-2 text-right">{Number(r.revenue).toLocaleString()}</td><td className="p-2 text-right">{Number(r.cogs).toLocaleString()}</td><td className="p-2 text-right text-emerald-400">{Number(r.grossProfit).toLocaleString()}</td><td className="p-2 text-right">{Number(r.marginPct).toFixed(1)}%</td></>}
                                  </tr>
                                ))}
                              </tbody></table>
                            </div>
                          </>
                        )}
                        {finReportTab === 'branch-profitability' && (
                          <>
                            <p className="text-slate-400">Total revenue: {Number(finReportData.totalRevenue||0).toLocaleString()} · Total net profit: <span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(finReportData.totalNetProfit||0).toLocaleString()}</span></p>
                            <div className="overflow-x-auto max-h-96">
                              <table className="w-full text-left text-[11px]"><thead className="text-slate-400 text-[10px] uppercase"><tr><th className="p-2">Branch</th><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">COGS</th><th className="p-2 text-right">Gross profit</th><th className="p-2 text-right">Expenses</th><th className="p-2 text-right">Net profit</th><th className="p-2 text-right">Margin %</th><th className="p-2 text-right">Sales #</th></tr></thead>
                              <tbody className="divide-y divide-slate-700">
                                {(finReportData.rows||[]).map((r,i) => (
                                  <tr key={i}><td className="p-2 text-white">{r.branchName || r.key}</td><td className="p-2 text-right">{Number(r.revenue).toLocaleString()}</td><td className="p-2 text-right">{Number(r.cogs).toLocaleString()}</td><td className="p-2 text-right text-emerald-400">{Number(r.grossProfit).toLocaleString()}</td><td className="p-2 text-right text-amber-400">{Number(r.expenses).toLocaleString()}</td><td className="p-2 text-right font-bold">{Number(r.netProfit).toLocaleString()}</td><td className="p-2 text-right">{Number(r.marginPct).toFixed(1)}%</td><td className="p-2 text-right">{r.salesCount}</td></tr>
                                ))}
                              </tbody></table>
                            </div>
                          </>
                        )}
                        {finReportTab === 'tax-summary' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Sales tax collected</p><p className="font-bold text-emerald-400">{shopProfile.currency} {Number(finReportData.salesTaxCollected||0).toLocaleString()}</p></div>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Purchase tax</p><p className="font-bold text-amber-400">{shopProfile.currency} {Number(finReportData.purchaseTax||0).toLocaleString()}</p></div>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Expense tax</p><p className="font-bold text-orange-400">{shopProfile.currency} {Number(finReportData.expenseTax||0).toLocaleString()}</p></div>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Total input tax</p><p className="font-bold text-amber-300">{shopProfile.currency} {Number(finReportData.inputTax||0).toLocaleString()}</p></div>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Net tax payable</p><p className="font-bold text-white">{shopProfile.currency} {Number(finReportData.netTaxPayable||0).toLocaleString()}</p></div>
                              <div className="bg-slate-950 p-2 rounded border border-slate-700"><p className="text-[10px] text-slate-500">Ledger 2100 net</p><p className="font-bold text-sky-400">{shopProfile.currency} {Number(finReportData.ledgerTaxNet||0).toLocaleString()}</p></div>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Sales with tax: {finReportData.salesWithTaxCount||0}
                              {' · '}Purchases with tax: {finReportData.purchaseWithTaxCount||0}
                              {' · '}Expenses with tax: {finReportData.expenseWithTaxCount||0}
                              {' · '}Taxable base (approx): {Number(finReportData.salesTaxableBase||0).toLocaleString()}
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead className="text-slate-400 text-[10px] uppercase">
                                  <tr>
                                    <th className="p-2">Rate %</th>
                                    <th className="p-2 text-right">Sales tax</th>
                                    <th className="p-2 text-right">Sales count</th>
                                    <th className="p-2 text-right">Purchase tax</th>
                                    <th className="p-2 text-right">Purchase count</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                  {(finReportData.byRate||[]).map((r,i) => (
                                    <tr key={i}>
                                      <td className="p-2">{r.rate}</td>
                                      <td className="p-2 text-right text-emerald-400">{Number(r.salesTax||0).toLocaleString()}</td>
                                      <td className="p-2 text-right">{r.salesCount||0}</td>
                                      <td className="p-2 text-right text-amber-400">{Number(r.purchaseTax||0).toLocaleString()}</td>
                                      <td className="p-2 text-right">{r.purchaseCount||0}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {finReportTab === 'comparative' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-950 p-3 rounded border border-slate-700"><p className="text-slate-400 text-[10px]">Current ({finReportData.current?.from} → {finReportData.current?.to})</p><p>Income: {Number(finReportData.current?.income||0).toLocaleString()}</p><p>Expense: {Number(finReportData.current?.expense||0).toLocaleString()}</p><p className="font-bold text-emerald-400">Net: {Number(finReportData.current?.net||0).toLocaleString()}</p></div>
                            <div className="bg-slate-950 p-3 rounded border border-slate-700"><p className="text-slate-400 text-[10px]">Previous ({finReportData.previous?.from} → {finReportData.previous?.to})</p><p>Income: {Number(finReportData.previous?.income||0).toLocaleString()}</p><p>Expense: {Number(finReportData.previous?.expense||0).toLocaleString()}</p><p className="font-bold text-slate-300">Net: {Number(finReportData.previous?.net||0).toLocaleString()}</p></div>
                            <div className="bg-slate-950 p-3 rounded border border-slate-700"><p className="text-slate-400 text-[10px]">Variance</p><p>Income: {Number(finReportData.variance?.income||0).toLocaleString()}</p><p>Expense: {Number(finReportData.variance?.expense||0).toLocaleString()}</p><p className="font-bold text-sky-400">Net: {Number(finReportData.variance?.net||0).toLocaleString()}</p></div>
                          </div>
                        )}
                        {finReportTab === 'cash-flow' && (
                          <>
                            <p className="text-slate-400">Net operating: <span className="text-emerald-400 font-bold">{Number(finReportData.netOperating||0).toLocaleString()}</span> · Investing: {Number(finReportData.netInvesting||0).toLocaleString()} · Financing: {Number(finReportData.netFinancing||0).toLocaleString()} · <strong>Change: {Number(finReportData.netChange||0).toLocaleString()}</strong></p>
                            <div className="max-h-72 overflow-y-auto space-y-1">
                              <p className="text-[10px] uppercase text-slate-500 font-bold">Operating</p>
                              {(finReportData.operating||[]).slice(0,100).map((r,i) => <div key={i} className="flex justify-between text-[11px] border-b border-slate-800 py-0.5"><span className="text-slate-400">{r.date} · {r.sourceType} · {r.memo}</span><span className={r.amount>=0?'text-emerald-400':'text-amber-400'}>{Number(r.amount).toLocaleString()}</span></div>)}
                            </div>
                          </>
                        )}
                        {finReportTab === 'general-ledger' && (
                          <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-left text-[11px]"><thead className="text-slate-400 text-[10px] uppercase"><tr><th className="p-1">Date</th><th className="p-1">Account</th><th className="p-1">Source</th><th className="p-1">Memo</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th></tr></thead>
                            <tbody className="divide-y divide-slate-700">{(finReportData.lines||[]).map((l,i) => <tr key={i}><td className="p-1">{l.entryDate}</td><td className="p-1 font-mono">{l.accountCode}</td><td className="p-1">{l.sourceType}</td><td className="p-1 text-slate-400">{l.memo || l.journalDescription}</td><td className="p-1 text-right">{Number(l.debit||0)?Number(l.debit).toLocaleString():''}</td><td className="p-1 text-right">{Number(l.credit||0)?Number(l.credit).toLocaleString():''}</td></tr>)}</tbody></table>
                          </div>
                        )}
                        {finReportTab === 'chart-of-accounts' && (
                          <div className="overflow-x-auto max-h-96">
                            <p className="text-[10px] text-slate-500 mb-2">Balances for selected period{finReportData.from || finReportData.to ? ` (${finReportData.from || '…'} → ${finReportData.to || '…'})` : ''}{finReportData.branchId ? ` · branch ${finReportData.branchId}` : ''}.</p>
                            <table className="w-full text-left text-[11px]"><thead className="text-slate-400 text-[10px] uppercase"><tr><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2 text-right">Period debit</th><th className="p-2 text-right">Period credit</th><th className="p-2 text-right">Balance</th><th className="p-2">Active</th></tr></thead>
                            <tbody className="divide-y divide-slate-700">{(finReportData.accounts||[]).map(a => <tr key={a.code}><td className="p-2 font-mono">{a.code}</td><td className="p-2 text-white">{a.name}</td><td className="p-2">{a.type}</td><td className="p-2 text-right">{Number(a.periodDebit||0).toLocaleString()}</td><td className="p-2 text-right">{Number(a.periodCredit||0).toLocaleString()}</td><td className="p-2 text-right font-bold text-emerald-400">{Number(a.periodBalance||0).toLocaleString()}</td><td className="p-2">{a.active ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {effectiveReportSubTab === 'ledger' && canViewReportSection('reportLedger') && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Accounting Ledger (Phases 1–4)</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Auto journals, trial balance, period lock, manual entries, and void/reversal. Bank reconciliation remains under Settings → Bank Reconciliation.</p>
                      </div>
                      <button type="button" className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded" onClick={async () => {
                        setLedgerLoading(true);
                        try {
                          const [tr, jr] = await Promise.all([
                            apiFetch('/api/ledger-trial-balance'),
                            apiFetch('/api/ledger-journals')
                          ]);
                          if (tr.ok) setLedgerTrial(await tr.json());
                          if (jr.ok) { const d = await jr.json(); setLedgerJournals(d.journals || []); }
                        } catch (e) {}
                        setLedgerLoading(false);
                      }}>{ledgerLoading ? 'Loading…' : 'Refresh ledger'}</button>
                    </div>
                    {ledgerTrial && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-white">Trial balance {ledgerTrial.balanced ? <span className="text-emerald-400">(balanced)</span> : <span className="text-amber-400">(check)</span>}</h5>
                        <div className="overflow-x-auto max-h-64">
                          <table className="w-full text-left text-[11px] text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]"><tr><th className="p-2">Code</th><th className="p-2">Account</th><th className="p-2">Type</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
                            <tbody className="divide-y divide-slate-800">
                              {(ledgerTrial.trial || []).map(t => (
                                <tr key={t.code}><td className="p-2 font-mono">{t.code}</td><td className="p-2">{t.name}</td><td className="p-2 text-slate-500">{t.type}</td><td className="p-2 text-right">{(t.debit||0).toLocaleString()}</td><td className="p-2 text-right">{(t.credit||0).toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="font-bold text-white"><td className="p-2" colSpan={3}>Total</td><td className="p-2 text-right">{(ledgerTrial.totalDebit||0).toLocaleString()}</td><td className="p-2 text-right">{(ledgerTrial.totalCredit||0).toLocaleString()}</td></tr></tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="border border-slate-800 rounded-lg p-3 space-y-2">
                      <h5 className="text-xs font-bold text-white">Profit &amp; Loss (selected period)</h5>
                      <div className="flex flex-wrap gap-2 items-end text-xs">
                        <div><label className="text-slate-500 text-[10px]">From</label><input type="date" value={pnlFrom} onChange={e => setPnlFrom(e.target.value)} className="block bg-slate-950 border border-slate-700 rounded p-1.5 text-white" /></div>
                        <div><label className="text-slate-500 text-[10px]">To</label><input type="date" value={pnlTo} onChange={e => setPnlTo(e.target.value)} className="block bg-slate-950 border border-slate-700 rounded p-1.5 text-white" /></div>
                        <button type="button" className="px-2 py-1.5 bg-sky-500 text-slate-950 font-bold rounded text-[10px]" onClick={async () => {
                          const q = new URLSearchParams();
                          if (pnlFrom) q.set('from', pnlFrom);
                          if (pnlTo) q.set('to', pnlTo);
                          const r = await apiFetch('/api/ledger-pnl?' + q.toString());
                          if (r.ok) setLedgerPnl(await r.json());
                          else alert('Could not load P&L');
                        }}>Run P&amp;L</button>
                      </div>
                      {ledgerPnl && (
                        <div className="text-[11px] space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-950 p-2 rounded border border-slate-800">
                              <p className="text-slate-400 text-[10px] uppercase">Income</p>
                              {(ledgerPnl.income || []).map(r => <div key={r.code} className="flex justify-between"><span>{r.name}</span><span className="text-emerald-400">{Number(r.amount).toLocaleString()}</span></div>)}
                              <div className="flex justify-between font-bold border-t border-slate-800 mt-1 pt-1"><span>Total</span><span className="text-emerald-400">{Number(ledgerPnl.totalIncome||0).toLocaleString()}</span></div>
                            </div>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800">
                              <p className="text-slate-400 text-[10px] uppercase">Expenses</p>
                              {(ledgerPnl.expenses || []).map(r => <div key={r.code} className="flex justify-between"><span>{r.name}</span><span className="text-amber-400">{Number(r.amount).toLocaleString()}</span></div>)}
                              <div className="flex justify-between font-bold border-t border-slate-800 mt-1 pt-1"><span>Total</span><span className="text-amber-400">{Number(ledgerPnl.totalExpense||0).toLocaleString()}</span></div>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-white">Net profit: <span className={(ledgerPnl.netProfit||0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{Number(ledgerPnl.netProfit||0).toLocaleString()}</span></p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-800 rounded-lg p-3">
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-white">Period lock (YYYY-MM)</h5>
                        <div className="flex gap-2">
                          <input type="month" value={periodKeyInput} onChange={e => setPeriodKeyInput(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                          <button type="button" className="px-2 py-1 bg-amber-500 text-slate-950 text-[10px] font-bold rounded" onClick={async () => {
                            const res = await apiFetch('/api/accounting-periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodKey: periodKeyInput, status: 'closed' }) });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return alert(d.error || 'Failed');
                            alert('Period ' + periodKeyInput + ' closed');
                            const r = await apiFetch('/api/accounting-periods');
                            if (r.ok) { const x = await r.json(); setAcctPeriods(x.periods || []); }
                          }}>Close period</button>
                          <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded" onClick={async () => {
                            const res = await apiFetch('/api/accounting-periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodKey: periodKeyInput, status: 'open' }) });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return alert(d.error || 'Failed');
                            alert('Period ' + periodKeyInput + ' re-opened');
                            const r = await apiFetch('/api/accounting-periods');
                            if (r.ok) { const x = await r.json(); setAcctPeriods(x.periods || []); }
                          }}>Re-open</button>
                        </div>
                        <button type="button" className="text-[10px] text-sky-400 font-bold" onClick={async () => {
                          const r = await apiFetch('/api/accounting-periods');
                          if (r.ok) { const x = await r.json(); setAcctPeriods(x.periods || []); }
                        }}>Load periods</button>
                        <div className="text-[10px] text-slate-400 space-y-0.5 max-h-20 overflow-y-auto">
                          {(acctPeriods || []).map(p => (
                            <div key={p.id}><span className="text-white">{p.periodKey}</span> · <span className={p.status === 'closed' ? 'text-amber-400' : 'text-emerald-400'}>{p.status}</span>{p.closedBy ? ` · ${p.closedBy}` : ''}</div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-white">Manual journal</h5>
                        <input value={manualJournal.reason} onChange={e => setManualJournal({ ...manualJournal, reason: e.target.value })} placeholder="Reason (required)" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                        <input type="date" value={manualJournal.entryDate} onChange={e => setManualJournal({ ...manualJournal, entryDate: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                        {(manualJournal.lines || []).map((ln, idx) => (
                          <div key={idx} className="grid grid-cols-3 gap-1">
                            <input value={ln.accountCode} onChange={e => { const lines = [...manualJournal.lines]; lines[idx] = { ...lines[idx], accountCode: e.target.value }; setManualJournal({ ...manualJournal, lines }); }} placeholder="Code" className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[10px]" />
                            <input type="number" step="0.01" value={ln.debit} onChange={e => { const lines = [...manualJournal.lines]; lines[idx] = { ...lines[idx], debit: e.target.value }; setManualJournal({ ...manualJournal, lines }); }} placeholder="Debit" className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[10px]" />
                            <input type="number" step="0.01" value={ln.credit} onChange={e => { const lines = [...manualJournal.lines]; lines[idx] = { ...lines[idx], credit: e.target.value }; setManualJournal({ ...manualJournal, lines }); }} placeholder="Credit" className="bg-slate-950 border border-slate-700 rounded p-1.5 text-white text-[10px]" />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button type="button" className="text-[10px] text-slate-400" onClick={() => setManualJournal({ ...manualJournal, lines: [...manualJournal.lines, { accountCode: '', debit: '', credit: '' }] })}>+ Line</button>
                          <button type="button" className="px-2 py-1 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded" onClick={async () => {
                            const res = await apiFetch('/api/manual-journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manualJournal) });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return alert(d.error || 'Failed to post manual journal');
                            alert('Manual journal posted: ' + (d.id || 'ok'));
                            setManualJournal({ reason: '', entryDate: new Date().toISOString().slice(0, 10), lines: [{ accountCode: '1000', debit: '', credit: '' }, { accountCode: '5100', debit: '', credit: '' }] });
                          }}>Post manual journal</button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-white">Recent journals</h5>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {(ledgerJournals || []).length === 0 && <p className="text-[10px] text-slate-500">No journals yet. Complete a sale, expense, or PO receive to post entries.</p>}
                        {(ledgerJournals || []).slice(0, 30).map(j => (
                          <div key={j.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-[10px]">
                            <div className="flex justify-between text-slate-400"><span className="text-emerald-400 font-bold">{j.sourceType}{j.voided ? ' · VOIDED' : ''}{j.manual ? ' · manual' : ''}</span><span>{j.entryDate}</span></div>
                            <p className="text-white mt-0.5">{j.description}</p>
                            {!j.voided && (
                              <button type="button" className="mt-1 text-[10px] text-amber-400 font-bold" onClick={async () => {
                                const reason = prompt('Reason for void/reversal (optional)') || '';
                                const res = await apiFetch('/api/void-journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ journalId: j.id, reason }) });
                                const d = await res.json().catch(() => ({}));
                                if (!res.ok) return alert(d.error || 'Void failed');
                                alert('Voided. Reversal: ' + (d.reversalId || ''));
                              }}>Void / reverse</button>
                            )}
                            <table className="w-full mt-1 text-slate-400"><tbody>
                              {(j.lines || []).map(l => (
                                <tr key={l.id}><td className="py-0.5 font-mono">{l.accountCode}</td><td className="py-0.5">{l.memo}</td><td className="py-0.5 text-right text-emerald-400">{l.debit ? Number(l.debit).toLocaleString() : ''}</td><td className="py-0.5 text-right text-amber-400">{l.credit ? Number(l.credit).toLocaleString() : ''}</td></tr>
                              ))}
                            </tbody></table>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* 8. SETTINGS TAB (Updated with Direct DB Restore Handler) */}
        {activeTab === 'settings' && (isAdminUser || canView('settings')) && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-3">Admin Master Settings Center{tenantInfo?.plan ? ` · Plan: ${tenantInfo.plan}` : ''}</h3>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Settings left sidebar */}
              <div className="w-full md:w-56 shrink-0 bg-slate-900 border border-slate-700 rounded-xl p-2 space-y-0.5 sticky top-2">
                {[
                  { id: 'profile', label: 'Business Profile Setup' },
                  { id: 'plan', label: 'Plan & Limits' },
                  { id: 'locations', label: 'Locations / Branches' },
                  { id: 'users', label: 'Users Manager' },
                  { id: 'roles', label: 'Roles Configuration' },
                  { id: 'itemsSetting', label: 'Items Setting' },
                  { id: 'expenseCategories', label: 'Expense Categories' },
                  { id: 'paymentMethods', label: 'Payment Methods' },
                  { id: 'paymentBalances', label: 'Payment Method Balances' },
                  { id: 'auditLog', label: 'Audit Log' },
                  { id: 'loyalty', label: 'Loyalty Points' },
                  { id: 'etims', label: 'eTIMS / KRA Fields' },
                  { id: 'salesTargets', label: 'Staff Sales Targets' },
                  { id: 'salesSettings', label: 'Sales Setting' },
                  { id: 'tax', label: 'Tax Settings' },
                  { id: 'hr', label: 'HR Settings' },
                  { id: 'bankRec', label: 'Bank Reconciliation' },
                  { id: 'backup', label: 'Backup & Restore' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSettingsSubTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${settingsSubTab === item.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Settings content panel */}
              <div className="flex-1 min-w-0 space-y-4 w-full">
                {settingsSubTab === 'profile' && (
                  <>
{/* Top Box: Business Profile Setup */}
            <div className="bg-slate-900 p-5 rounded-xl border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Business Profile Setup</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Shop Name</label>
                  <input type="text" value={shopProfile.name} onChange={e => setShopProfile({...shopProfile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tagline / Description</label>
                  <input type="text" value={shopProfile.tagline} onChange={e => setShopProfile({...shopProfile, tagline: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Currency Symbol</label>
                  <input type="text" value={shopProfile.currency} onChange={e => setShopProfile({...shopProfile, currency: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Phone Number</label>
                  <input type="text" value={shopProfile.phone} onChange={e => setShopProfile({...shopProfile, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Location / Stall Address</label>
                  <input type="text" value={shopProfile.location} onChange={e => setShopProfile({...shopProfile, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <button onClick={handleSaveShopProfile} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded text-xs">Save Business Profile</button>
            </div>
                  </>
                )}
                {settingsSubTab === 'locations' && (
                  <>
                    <div className="bg-slate-900 p-5 rounded-xl border border-sky-500/30 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Locations / Branches</h4>
                        <span className="text-[10px] text-slate-400">{(branches || []).length} / {maxBranches} (max 20)</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Sales, stock, purchases, expenses and HR can be scoped to the location selected in the header. Plan limit: {maxBranches} location(s).</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <input placeholder="Location name" value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        <input placeholder="Address (optional)" value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        <button type="button" onClick={async () => {
                          if (!branchForm.name.trim()) return alert('Location name required');
                          if ((branches || []).length >= maxBranches) return alert('Location limit reached for your plan.');
                          const res = await apiFetch('/api/branches', { method: 'POST', body: JSON.stringify(branchForm) });
                          const d = await res.json().catch(() => ({}));
                          if (!res.ok) return alert(d.error || 'Failed');
                          setBranchForm({ name: '', address: '', phone: '' });
                          const r2 = await apiFetch('/api/branches');
                          if (r2.ok) { const x = await r2.json(); setBranches(x.branches || []); setMaxBranches(x.maxBranches || maxBranches); }
                        }} className="bg-sky-500 text-slate-950 font-bold rounded px-3 py-2">Add location</button>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        <p className="text-[10px] text-slate-500">New locations share parent business master data (item categories, statuses, customers, suppliers, payment methods, sales terms, HR settings). Stock starts empty at the new location.</p>
                        {(branches || []).map(b => (
                          <div key={b.id} onClick={() => setSelectedBranch({ ...b })} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs cursor-pointer hover:border-sky-500 transition-colors">
                            <div>
                              <span className="text-white font-bold">{b.name}</span>
                              {b.isDefault ? <span className="ml-2 text-emerald-400 text-[10px]">Default</span> : null}
                              {b.address ? <p className="text-slate-500 text-[10px]">{b.address}</p> : null}
                              <p className="text-[9px] text-sky-400 mt-0.5">Click to edit ➔</p>
                            </div>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              {!b.isDefault && (
                                <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold" onClick={async () => {
                                  await apiFetch('/api/branches/' + b.id, { method: 'PUT', body: JSON.stringify({ isDefault: true }) });
                                  const r2 = await apiFetch('/api/branches');
                                  if (r2.ok) { const x = await r2.json(); setBranches(x.branches || []); }
                                }}>Set default</button>
                              )}
                              {(branches || []).length > 1 && (
                                <button type="button" className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] font-bold" onClick={async () => {
                                  if (!confirm('Delete this location?')) return;
                                  const res = await apiFetch('/api/branches/' + b.id, { method: 'DELETE' });
                                  if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Failed'); }
                                  const r2 = await apiFetch('/api/branches');
                                  if (r2.ok) { const x = await r2.json(); setBranches(x.branches || []); }
                                }}>Delete</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {settingsSubTab === 'users' && (
                  <>
{/* Row 1 Left: Users Manager */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Users Manager</h4>
                  <button onClick={() => setAddUserModalOpen(true)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add New User
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(users || []).map(u => (
                    <div key={u.id} onClick={() => setSelectedUser(u)} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                      <div>
                        <span className="text-white font-bold text-sm">{u.name}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Role: {u.role} | Status: <span className={u.status === 'Active' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{u.status}</span></p>
                      </div>
                      <span className="text-emerald-400 text-xs font-semibold">Edit User ➔</span>
                    </div>
                  ))}
                </div>
              </div>
                  </>
                )}
                {settingsSubTab === 'roles' && (
                  <>
{/* Row 1 Right: Roles Configuration */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Roles Configuration</h4>
                  <button onClick={() => setAddRoleModalOpen(true)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add New Role
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(roles || []).map(r => (
                    <div key={r.id} onClick={() => setSelectedRole(r)} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                      <div>
                        <span className="text-white font-bold text-sm">{r.name}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Configured Privileges</p>
                      </div>
                      <span className="text-emerald-400 font-semibold">Configure ➔</span>
                    </div>
                  ))}
                </div>
              </div>
                  </>
                )}
                {settingsSubTab === 'itemsSetting' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white">Items Setting</h4>
                    <p className="text-[11px] text-slate-400">Manage categories, sellable statuses, and variance attributes used when creating inventory items.</p>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Item Categories</h4>
                        <button onClick={() => setAddCategoryModalOpen(true)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Category
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(categories || []).map(c => (
                          <div key={c.id} onClick={() => setSelectedCategory(c)} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                            <span className="text-white font-bold">{c.name} ({c.status})</span>
                            <span className="text-emerald-400">Edit ➔</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Item Status</h4>
                        <button onClick={() => setAddStatusModalOpen(true)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Status
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(itemStatuses || []).map(st => (
                          <div key={st.id} onClick={() => setSelectedItemStatus(st)} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                            <div>
                              <span className="text-white font-bold">{st.name}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Allows Sale: <span className={st.canSell ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{st.canSell ? 'Yes' : 'No'}</span></p>
                            </div>
                            <span className="text-emerald-400">Configure ➔</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Variance</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Define attributes (Size, Colour, Material, etc.). They appear as fields when adding or editing an item.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={varianceDraft}
                          onChange={e => setVarianceDraft(e.target.value)}
                          placeholder="e.g. Size, Colour, Material"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const name = (varianceDraft || '').trim();
                            if (!name) return;
                            if ((itemVariances || []).some(v => (v.name || '').toLowerCase() === name.toLowerCase())) {
                              alert('That variance already exists.');
                              return;
                            }
                            persistItemVariances([...(itemVariances || []), { id: 'var-' + Date.now(), name }]);
                            setVarianceDraft('');
                          }}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(itemVariances || []).length === 0 && (
                          <p className="text-[11px] text-slate-500">No variances yet. Add attributes your business uses (not every shop needs Size/Colour).</p>
                        )}
                        {(itemVariances || []).map(v => (
                          <div key={v.id || v.name} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                            <span className="text-white font-bold">{v.name}</span>
                            <button
                              type="button"
                              onClick={() => persistItemVariances((itemVariances || []).filter(x => (x.id || x.name) !== (v.id || v.name)))}
                              className="text-red-400 font-bold text-[10px]"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {settingsSubTab === 'expenseCategories' && (
                  <>
{/* Row 2 Right: Expense Categories */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Expense Categories</h4>
                  <button onClick={() => setAddExpenseCategoryModalOpen(true)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Expense Category
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(expenseCategories || []).map(ec => (
                    <div key={ec.id} onClick={() => setSelectedExpenseCategory(ec)} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                      <span className="text-white font-bold">{ec.name} ({ec.status || 'Active'})</span>
                      <span className="text-emerald-400">Edit ➔</span>
                    </div>
                  ))}
                </div>
              </div>
                  </>
                )}

                {settingsSubTab === 'paymentMethods' && (
                  <>
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Payment Methods</h4>
                        <button onClick={() => { setSelectedPaymentMethod(null); setPaymentMethodForm({ name: '', startingBalance: 0, currentBalance: 0 }); setPaymentMethodModalOpen(true); }} className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Method</button>
                      </div>
                      <p className="text-[10px] text-slate-400">Starting balance is included in account totals (e.g. Cash at Hand). Click a row to edit or delete.</p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {paymentMethods.map(pm => (
                          <div key={pm.id} onClick={() => { setSelectedPaymentMethod(pm); setPaymentMethodForm({ name: pm.name, startingBalance: pm.startingBalance || 0, currentBalance: pm.currentBalance != null ? pm.currentBalance : (pm.startingBalance || 0) }); setPaymentMethodModalOpen(true); }} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                            <div>
                              <span className="text-white font-bold">{pm.name}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Starting: {shopProfile.currency} {(parseFloat(pm.startingBalance)||0).toLocaleString()} · Current: {shopProfile.currency} {(parseFloat(pm.currentBalance != null ? pm.currentBalance : pm.startingBalance)||0).toLocaleString()}</p>
                            </div>
                            <span className="text-emerald-400">Edit ➔</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {settingsSubTab === 'salesSettings' && (
                  <>
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Sales Terms</h4>
                        <button onClick={() => { setSelectedSalesTerm(null); setSalesTermForm({ name: '', type: 'Paid', days: 0 }); setSalesTermModalOpen(true); }} className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Term</button>
                      </div>
                      <p className="text-[10px] text-slate-400">Terms link to sale types (Paid / Credit / Layby) and default days. Used on customers and POS.</p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {salesTerms.map(st => (
                          <div key={st.id} onClick={() => { setSelectedSalesTerm(st); setSalesTermForm({ name: st.name, type: st.type || 'Paid', days: st.days || 0 }); setSalesTermModalOpen(true); }} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs cursor-pointer hover:border-emerald-500 transition-colors">
                            <div>
                              <span className="text-white font-bold">{st.name}</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">Type: {st.type} · Days: {st.days || 0}</p>
                            </div>
                            <span className="text-emerald-400">Edit ➔</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                                {settingsSubTab === 'tax' && (
                  <>
{/* Tax Settings */}
            <div className="bg-slate-900 p-5 rounded-xl border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Percent className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sales, Purchase & Expense Tax</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 p-3 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Sales Tax</span>
                    <button type="button" onClick={() => setTaxSettings({...taxSettings, salesTaxEnabled: !taxSettings.salesTaxEnabled})} className="text-emerald-400">
                      {taxSettings.salesTaxEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                    </button>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tax Name</label>
                    <input type="text" value={taxSettings.salesTaxName} onChange={e => setTaxSettings({...taxSettings, salesTaxName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rate (%)</label>
                    <input type="number" step="0.01" value={taxSettings.salesTaxRate} onChange={e => setTaxSettings({...taxSettings, salesTaxRate: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                </div>
                <div className="space-y-2 p-3 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Purchase Tax</span>
                    <button type="button" onClick={() => setTaxSettings({...taxSettings, purchaseTaxEnabled: !taxSettings.purchaseTaxEnabled})} className="text-emerald-400">
                      {taxSettings.purchaseTaxEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                    </button>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tax Name</label>
                    <input type="text" value={taxSettings.purchaseTaxName} onChange={e => setTaxSettings({...taxSettings, purchaseTaxName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rate (%)</label>
                    <input type="number" step="0.01" value={taxSettings.purchaseTaxRate} onChange={e => setTaxSettings({...taxSettings, purchaseTaxRate: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                </div>
                <div className="space-y-2 p-3 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Expense Tax</span>
                    <button type="button" onClick={() => setTaxSettings({...taxSettings, expenseTaxEnabled: !taxSettings.expenseTaxEnabled})} className="text-emerald-400">
                      {taxSettings.expenseTaxEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                    </button>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tax Name</label>
                    <input type="text" value={taxSettings.expenseTaxName || 'VAT'} onChange={e => setTaxSettings({...taxSettings, expenseTaxName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rate (%)</label>
                    <input type="number" step="0.01" value={taxSettings.expenseTaxRate ?? 16} onChange={e => setTaxSettings({...taxSettings, expenseTaxRate: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                </div>
                <div className="sm:col-span-2 flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-300 font-semibold">Tax Inclusive Pricing</span>
                    <p className="text-[10px] text-slate-500">When on, listed prices already include tax. When off, tax is added on top.</p>
                  </div>
                  <button type="button" onClick={() => setTaxSettings({...taxSettings, taxInclusive: !taxSettings.taxInclusive})} className="text-emerald-400">
                    {taxSettings.taxInclusive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                  </button>
                </div>
              </div>
              <button onClick={handleSaveTaxSettings} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded">Save Tax Settings</button>
            </div>
                  </>
                )}
                {settingsSubTab === 'hr' && (
                  <>
{/* HR Settings */}
            <div className="bg-slate-900 p-5 rounded-xl border border-sky-500/30 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Briefcase className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">HR Settings</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Default Annual Leave (days)</label>
                  <input type="number" value={hrSettings.defaultAnnualLeave} onChange={e => setHrSettings({...hrSettings, defaultAnnualLeave: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Payroll Cycle</label>
                  <select value={hrSettings.payrollCycle} onChange={e => setHrSettings({...hrSettings, payrollCycle: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                    <option value="Monthly">Monthly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Pay Day (day of month)</label>
                  <input type="number" min="1" max="31" value={hrSettings.payDay} onChange={e => setHrSettings({...hrSettings, payDay: parseInt(e.target.value) || 28})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Leave Types (comma-separated)</label>
                  <input type="text" value={(hrSettings.leaveTypes || []).join(', ')} onChange={e => setHrSettings({...hrSettings, leaveTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Departments (comma-separated)</label>
                  <input type="text" value={(hrSettings.departments || []).join(', ')} onChange={e => setHrSettings({...hrSettings, departments: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <button onClick={handleSaveHrSettings} className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded">Save HR Settings</button>
            </div>
                  </>
                )}
                
                {settingsSubTab === 'paymentBalances' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Payment Method Balances</h4>
                    <p className="text-[10px] text-slate-500">Running balances from method starting/current balance. Cash/M-Pesa also reflect dashboard cash-at-hand style figures where applicable.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300 min-w-[480px]">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]"><tr><th className="py-2 px-2">Method</th><th className="py-2 px-2">Starting</th><th className="py-2 px-2">Current / Book</th></tr></thead>
                        <tbody className="divide-y divide-slate-800">
                          {paymentMethods.map(pm => {
                            const start = parseFloat(pm.startingBalance) || 0;
                            const cur = pm.currentBalance != null && pm.currentBalance !== '' ? parseFloat(pm.currentBalance) : start;
                            const isCash = (pm.name || '') === 'Cash';
                            const display = isCash && typeof cashAtHandAccount === 'number' ? cashAtHandAccount : cur;
                            return (
                              <tr key={pm.id}><td className="py-2 px-2 font-semibold text-white">{pm.name}</td><td className="py-2 px-2">{shopProfile.currency} {start.toLocaleString()}</td><td className="py-2 px-2 text-emerald-400 font-bold">{shopProfile.currency} {Number(display||0).toLocaleString()}</td></tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {settingsSubTab === 'auditLog' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Audit Log</h4>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => exportCSV('audit_' + new Date().toISOString().slice(0,10) + '.csv', (auditLog || []).map(a => ({ when: a.at, user: a.user, action: a.action, entity: a.entity, detail: a.detail })))} className="text-[10px] text-emerald-400 font-bold">Export CSV</button>
                        <button type="button" onClick={() => { if (window.confirm('Clear local audit log?')) { setAuditLog([]); try { localStorage.removeItem(tenantStorageKey('erp_audit_log')); localStorage.removeItem('erp_audit_log'); } catch (e) {} } }} className="text-[10px] text-red-400">Clear</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs text-slate-300 min-w-[560px]">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0"><tr><th className="py-2 px-2">When</th><th className="py-2 px-2">User</th><th className="py-2 px-2">Action</th><th className="py-2 px-2">Entity</th><th className="py-2 px-2">Detail</th></tr></thead>
                        <tbody className="divide-y divide-slate-800">
                          {(auditLog || []).length === 0 ? <tr><td colSpan={5} className="py-4 text-center text-slate-500">No audit entries yet.</td></tr> :
                            auditLog.map(a => (
                              <tr key={a.id}><td className="py-1.5 px-2 whitespace-nowrap">{a.at ? new Date(a.at).toLocaleString() : ''}</td><td className="py-1.5 px-2">{a.user}</td><td className="py-1.5 px-2 text-emerald-400">{a.action}</td><td className="py-1.5 px-2">{a.entity}</td><td className="py-1.5 px-2 text-slate-400">{a.detail}</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                
                {settingsSubTab === 'loyalty' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3 max-w-lg">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase">Loyalty Points</h4>
                    <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={!!loyaltySettings.enabled} onChange={e => saveLoyalty({ ...loyaltySettings, enabled: e.target.checked })} /> Enabled</label>
                    <div><label className="text-[10px] text-slate-400">Earn: points per {shopProfile.currency} paid (cash/M-Pesa only)</label>
                      <input type="number" step="0.01" value={loyaltySettings.pointsPerCurrency} onChange={e => saveLoyalty({ ...loyaltySettings, pointsPerCurrency: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                    <div><label className="text-[10px] text-slate-400">Redeem: {shopProfile.currency} value of 1 point</label>
                      <input type="number" step="0.01" value={loyaltySettings.redeemValue} onChange={e => saveLoyalty({ ...loyaltySettings, redeemValue: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                    <p className="text-[10px] text-slate-500">Earn on Paid sales from cash/M-Pesa paid. Redeem points at POS as a credit. Points are not earned on the redeemed amount.</p>
                  </div>
                )}
                {settingsSubTab === 'plan' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4 max-w-lg">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase">Plan & limits</h4>
                    <p className="text-[11px] text-slate-400">Your shop plan controls how many users and locations you can use. Contact the platform operator to upgrade.</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500 uppercase">Current plan</p>
                        <p className="text-lg font-bold text-white capitalize mt-1">{tenantInfo?.plan || 'starter'}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500 uppercase">Status</p>
                        <p className="text-lg font-bold text-emerald-400 mt-1 capitalize">{tenantInfo?.status || 'active'}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500 uppercase">Users</p>
                        <p className="text-lg font-bold text-white mt-1">{(users || []).length} <span className="text-slate-500 text-sm font-normal">/ {maxUsers || tenantInfo?.maxUsers || '—'}</span></p>
                        {(users || []).length >= (maxUsers || tenantInfo?.maxUsers || 999) && (
                          <p className="text-[10px] text-amber-400 mt-1">User limit reached. Upgrade to add more staff.</p>
                        )}
                      </div>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500 uppercase">Locations / branches</p>
                        <p className="text-lg font-bold text-white mt-1">{(branches || []).length} <span className="text-slate-500 text-sm font-normal">/ {maxBranches || tenantInfo?.maxBranches || '—'}</span></p>
                        {(branches || []).length >= (maxBranches || tenantInfo?.maxBranches || 999) && (
                          <p className="text-[10px] text-amber-400 mt-1">Branch limit reached. Upgrade for more locations.</p>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-1 border-t border-slate-800 pt-3">
                      <p>Starter: 3 users · 1 location</p>
                      <p>Business: 15 users · 3 locations</p>
                      <p>Premium: 100 users · 20 locations</p>
                    </div>
                  </div>
                )}
                {settingsSubTab === 'etims' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3 max-w-lg">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase">eTIMS / KRA</h4>
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                      <p className="text-slate-300 font-semibold">Integration path</p>
                      <p>1. <strong className="text-slate-200">Structure only (current)</strong> — invoice numbers + taxpayer fields stored in NEO.</p>
                      <p>2. <strong className="text-slate-200">Future: certified device / API</strong> — connect a KRA-approved eTIMS device or OSCU/VSCU API when available. No live KRA transmission until then.</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={!!etimsSettings.enabled} onChange={e => saveEtims({ ...etimsSettings, enabled: e.target.checked })} /> Assign invoice numbers on sales</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-slate-400">Invoice prefix</label>
                        <input value={etimsSettings.invoicePrefix || ''} onChange={e => saveEtims({ ...etimsSettings, invoicePrefix: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                      <div><label className="text-[10px] text-slate-400">Next invoice number</label>
                        <input type="number" value={etimsSettings.nextInvoiceNo || 1} onChange={e => saveEtims({ ...etimsSettings, nextInvoiceNo: parseInt(e.target.value) || 1 })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                    </div>
                    <div><label className="text-[10px] text-slate-400">Taxpayer PIN (business)</label>
                      <input value={etimsSettings.taxpayerPin || ''} onChange={e => saveEtims({ ...etimsSettings, taxpayerPin: e.target.value })} placeholder="e.g. P051234567X" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                    <div><label className="text-[10px] text-slate-400">Mode</label>
                      <select value={etimsSettings.mode || 'structure_only'} onChange={e => saveEtims({ ...etimsSettings, mode: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs">
                        <option value="structure_only">Structure only (no KRA API)</option>
                        <option value="future_api">Future device / API (prepared fields)</option>
                      </select>
                    </div>
                    {(etimsSettings.mode === 'future_api') && (
                      <div className="space-y-2 border border-slate-800 rounded-lg p-3">
                        <p className="text-[10px] text-amber-400">These fields are stored for a future certified integration. They do not send data to KRA yet.</p>
                        <div><label className="text-[10px] text-slate-400">Device serial / OSCU ID</label>
                          <input value={etimsSettings.deviceSerial || ''} onChange={e => saveEtims({ ...etimsSettings, deviceSerial: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                        <div><label className="text-[10px] text-slate-400">API endpoint (when provided by integrator)</label>
                          <input value={etimsSettings.apiEndpoint || ''} onChange={e => saveEtims({ ...etimsSettings, apiEndpoint: e.target.value })} placeholder="https://…" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                        <div><label className="text-[10px] text-slate-400">Notes</label>
                          <textarea value={etimsSettings.notes || ''} onChange={e => saveEtims({ ...etimsSettings, notes: e.target.value })} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500">Buyer PIN remains on the customer record. Live eTIMS submission requires a certified device or approved API partner.</p>
                  </div>
                )}
                {settingsSubTab === 'salesTargets' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3 max-w-lg">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase">Staff Sales Targets (monthly)</h4>
                    {(users || []).map(u => (
                      <div key={u.id} className="flex items-center gap-2 text-xs">
                        <span className="w-32 text-slate-300 truncate">{u.name}</span>
                        <input type="number" placeholder="Target amount" value={salesTargets[u.name] || ''} onChange={e => saveSalesTargets({ ...salesTargets, [u.name]: e.target.value })} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500">Shown on dashboard against this month's cashier totals.</p>
                  </div>
                )}
                {settingsSubTab === 'bankRec' && (
                  <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Bank / M-Pesa Reconciliation</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Enter statement lines, match them to ledger Cash (1000) or M-Pesa (1010) movements, and compare statement vs book balance.</p>
                      </div>
                      <button type="button" className="px-3 py-1.5 bg-slate-800 text-sky-400 text-xs font-bold rounded" onClick={async () => {
                        setBankRecLoading(true);
                        try {
                          const r = await apiFetch('/api/bank-reconciliations');
                          if (r.ok) { const d = await r.json(); setBankRecList(d.reconciliations || []); }
                        } catch (e) {}
                        setBankRecLoading(false);
                      }}>{bankRecLoading ? 'Loading…' : 'Refresh list'}</button>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Start reconciliation</p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-slate-500 text-[10px]">Account</label>
                          <select value={bankRecForm.accountCode} onChange={e => setBankRecForm({ ...bankRecForm, accountCode: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                            <option value="1000">1000 Cash</option>
                            <option value="1010">1010 M-Pesa</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 text-[10px]">Statement date</label>
                          <input type="date" value={bankRecForm.statementDate} onChange={e => setBankRecForm({ ...bankRecForm, statementDate: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-slate-500 text-[10px]">Statement closing balance</label>
                          <input type="number" step="0.01" value={bankRecForm.statementBalance} onChange={e => setBankRecForm({ ...bankRecForm, statementBalance: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="0" />
                        </div>
                        <div className="flex items-end">
                          <button type="button" className="w-full py-2 bg-sky-500 text-slate-950 font-bold rounded text-xs" onClick={async () => {
                            const res = await apiFetch('/api/bank-reconciliations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bankRecForm) });
                            const d = await res.json().catch(() => ({}));
                            if (!res.ok) return alert(d.error || 'Failed');
                            const r2 = await apiFetch('/api/bank-reconciliations');
                            if (r2.ok) { const x = await r2.json(); setBankRecList(x.reconciliations || []); }
                            if (d.id) {
                              const det = await apiFetch('/api/bank-reconciliations/' + d.id);
                              if (det.ok) setBankRecDetail(await det.json());
                            }
                          }}>Create</button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Sessions</p>
                      {(bankRecList || []).length === 0 && <p className="text-[10px] text-slate-500">No reconciliations yet. Create one above.</p>}
                      {(bankRecList || []).map(r => (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px]">
                          <div>
                            <span className="text-white font-bold">{r.accountCode === '1010' ? 'M-Pesa' : 'Cash'}</span>
                            <span className="text-slate-500 ml-2">{r.statementDate}</span>
                            <span className="ml-2 text-slate-400">Bal: {(Number(r.statementBalance)||0).toLocaleString()}</span>
                            <span className={`ml-2 font-bold ${r.status === 'closed' ? 'text-emerald-400' : 'text-amber-400'}`}>{r.status}</span>
                          </div>
                          <div className="flex gap-1">
                            <button type="button" className="px-2 py-1 bg-sky-500/20 text-sky-400 rounded text-[10px] font-bold" onClick={async () => {
                              const det = await apiFetch('/api/bank-reconciliations/' + r.id);
                              if (det.ok) setBankRecDetail(await det.json());
                            }}>Open</button>
                            {r.status !== 'closed' && (
                              <button type="button" className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[10px] font-bold" onClick={async () => {
                                if (!confirm('Delete this open reconciliation?')) return;
                                await apiFetch('/api/bank-reconciliations/' + r.id, { method: 'DELETE' });
                                setBankRecList((bankRecList || []).filter(x => x.id !== r.id));
                                if (bankRecDetail?.reconciliation?.id === r.id) setBankRecDetail(null);
                              }}>Delete</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {bankRecDetail && bankRecDetail.reconciliation && (
                      <div className="border border-sky-500/30 rounded-xl p-3 space-y-3 bg-slate-950/80">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <h5 className="text-sm font-bold text-white">{bankRecDetail.reconciliation.accountCode === '1010' ? 'M-Pesa' : 'Cash'} · {bankRecDetail.reconciliation.statementDate}</h5>
                            <p className="text-[10px] text-slate-400">
                              Book: <span className="text-emerald-400 font-bold">{(bankRecDetail.summary?.bookBalance||0).toLocaleString()}</span>
                              {' '}· Statement: <span className="text-sky-400 font-bold">{(bankRecDetail.summary?.statementBalance||0).toLocaleString()}</span>
                              {' '}· Diff: <span className={`font-bold ${Math.abs(bankRecDetail.summary?.difference||0) < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>{(bankRecDetail.summary?.difference||0).toLocaleString()}</span>
                              {' '}· Matched: {bankRecDetail.summary?.matchedCount||0}/{bankRecDetail.summary?.statementLineCount||0}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {bankRecDetail.reconciliation.status !== 'closed' && (
                              <>
                                <button type="button" className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded" onClick={async () => {
                                  const res = await apiFetch('/api/bank-auto-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconciliationId: bankRecDetail.reconciliation.id }) });
                                  const d = await res.json().catch(() => ({}));
                                  alert(res.ok ? `Auto-matched ${d.matched || 0} line(s)` : (d.error || 'Failed'));
                                  const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                                  if (det.ok) setBankRecDetail(await det.json());
                                }}>Auto-match by amount</button>
                                <button type="button" className="px-2 py-1 bg-amber-500 text-slate-950 text-[10px] font-bold rounded" onClick={async () => {
                                  if (!confirm('Close this reconciliation? You can still view it.')) return;
                                  await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }) });
                                  const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                                  if (det.ok) setBankRecDetail(await det.json());
                                  const r2 = await apiFetch('/api/bank-reconciliations');
                                  if (r2.ok) { const x = await r2.json(); setBankRecList(x.reconciliations || []); }
                                }}>Close reconciliation</button>
                              </>
                            )}
                            <button type="button" className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded" onClick={() => setBankRecDetail(null)}>Close panel</button>
                          </div>
                        </div>

                        {bankRecDetail.reconciliation.status !== 'closed' && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs items-end">
                            <div>
                              <label className="text-slate-500 text-[10px]">Line date</label>
                              <input type="date" value={bankLineForm.lineDate} onChange={e => setBankLineForm({ ...bankLineForm, lineDate: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px]">Description</label>
                              <input value={bankLineForm.description} onChange={e => setBankLineForm({ ...bankLineForm, description: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Statement description" />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px]">Amount (+ in / − out)</label>
                              <input type="number" step="0.01" value={bankLineForm.amount} onChange={e => setBankLineForm({ ...bankLineForm, amount: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                            </div>
                            <button type="button" className="py-2 bg-sky-500 text-slate-950 font-bold rounded text-xs" onClick={async () => {
                              if (!bankLineForm.description && !bankLineForm.amount) return alert('Enter description and amount');
                              const res = await apiFetch('/api/bank-statement-lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconciliationId: bankRecDetail.reconciliation.id, ...bankLineForm }) });
                              if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Failed'); }
                              setBankLineForm({ lineDate: bankRecForm.statementDate || new Date().toISOString().slice(0,10), description: '', amount: '' });
                              const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                              if (det.ok) setBankRecDetail(await det.json());
                            }}>Add statement line</button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Statement lines</p>
                            <div className="max-h-56 overflow-y-auto space-y-1">
                              {(bankRecDetail.statementLines || []).length === 0 && <p className="text-[10px] text-slate-500">No statement lines yet.</p>}
                              {(bankRecDetail.statementLines || []).map(sl => (
                                <div key={sl.id} className={`text-[10px] p-2 rounded border ${sl.matched ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-slate-300">{sl.lineDate} · {sl.description}</span>
                                    <span className={`font-bold ${(Number(sl.amount)||0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{(Number(sl.amount)||0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex gap-1 mt-1">
                                    {sl.matched ? (
                                      <button type="button" className="text-amber-400 font-bold" onClick={async () => {
                                        await apiFetch('/api/bank-statement-lines/' + sl.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unmatch: true }) });
                                        const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                                        if (det.ok) setBankRecDetail(await det.json());
                                      }}>Unmatch</button>
                                    ) : (
                                      <span className="text-slate-500">Select a book line → Match</span>
                                    )}
                                    {bankRecDetail.reconciliation.status !== 'closed' && !sl.matched && (
                                      <button type="button" className="text-red-400 font-bold ml-auto" onClick={async () => {
                                        await apiFetch('/api/bank-statement-lines/' + sl.id, { method: 'DELETE' });
                                        const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                                        if (det.ok) setBankRecDetail(await det.json());
                                      }}>Remove</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Book movements (ledger)</p>
                            <div className="max-h-56 overflow-y-auto space-y-1">
                              {(bankRecDetail.bookLines || []).map(bl => (
                                <div key={bl.id} className={`text-[10px] p-2 rounded border ${bl.matched ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-slate-300">{bl.entryDate} · {bl.sourceType} · {bl.memo || bl.journalDescription || ''}</span>
                                    <span className={`font-bold ${(Number(bl.amount)||0) >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{(Number(bl.amount)||0).toLocaleString()}</span>
                                  </div>
                                  {!bl.matched && bankRecDetail.reconciliation.status !== 'closed' && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <span className="text-slate-500">Match to unmatched statement:</span>
                                      {(bankRecDetail.statementLines || []).filter(s => !s.matched).map(s => (
                                        <button key={s.id} type="button" className="px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded font-bold" onClick={async () => {
                                          const res = await apiFetch('/api/bank-statement-lines/' + s.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchJournalLineId: bl.id }) });
                                          if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Match failed'); }
                                          const det = await apiFetch('/api/bank-reconciliations/' + bankRecDetail.reconciliation.id);
                                          if (det.ok) setBankRecDetail(await det.json());
                                        }}>{(Number(s.amount)||0).toLocaleString()}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {settingsSubTab === 'backup' && (
                  <>
<div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">System Backup & Restore</h4>
                </div>
                <p className="text-[11px] text-slate-400">Download a complete backup JSON file or restore from a previously backed-up file directly into database storage.</p>
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-100 text-[11px] rounded-lg px-3 py-2">
                  <p className="font-semibold">Recommended: every week</p>
                  <p className="mt-0.5 text-amber-100/90">
                    Last backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never recorded'}.
                    {' '}Run both a <strong>local JSON download</strong> and a <strong>cloud tenant backup</strong>, then store a copy off this device.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button 
                    onClick={() => {
                      const backupData = {
                        tenantId: tenantInfo?.id || undefined,
                        shopProfile,
                        categories,
                        expenseCategories,
                        itemStatuses,
                        inventory,
                        customers,
                        sales,
                        expenses,
                        roles,
                        users,
                        suppliers,
                        purchaseOrders,
                        employees,
                        leaveRequests,
                        payrollRecords,
                        hrSettings,
                        taxSettings,
                        paymentMethods,
                        auditLog,
                        stockMovements,
                        tasks,
                        salesTargets,
                        offlineQueue,
                        cashUpHistory,
                        etimsSettings,
                        loyaltySettings,
                        lastBackupAt,
                        backupDate: new Date().toISOString()
                      };
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `erp_system_backup_${new Date().toISOString().split('T')[0]}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                      const ts = new Date().toISOString();
                      try { localStorage.setItem('erp_last_backup', ts); } catch (e) {}
                      setLastBackupAt(ts);
                      setBackupReminderDismissed(false);
                    }} 
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Backup System File (Download)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiFetch('/api/tenant-backup');
                      if (!res.ok) { alert('Backup failed'); return; }
                      const data = await res.json();
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
                      const a = document.createElement('a');
                      a.href = dataStr;
                      a.download = `tenant_backup_${(tenantInfo?.id || 'shop')}_${new Date().toISOString().slice(0,10)}.json`;
                      a.click();
                    }}
                    className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded text-xs flex items-center justify-center gap-1.5 mt-2"
                  >
                    Tenant cloud backup (API)
                  </button>

                  <label className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> Restore System File (Direct DB Sync)
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={(e) => {
                        const fileReader = new FileReader();
                        if (e.target.files[0]) {
                          fileReader.readAsText(e.target.files[0], "UTF-8");
                          fileReader.onload = async (event) => {
                            try {
                              const parsed = JSON.parse(event.target.result);
                              if (window.confirm("Are you sure you want to restore system data directly into the database? This will update and sync all records.")) {
                                const response = await apiFetch('/api/restore', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(parsed)
                                });
                                if (response.ok) {
                                  if (parsed.shopProfile) setShopProfile(parsed.shopProfile);
                                  if (parsed.categories) setCategories(parsed.categories);
                                  if (parsed.tasks) { setTasks(parsed.tasks)}
                                  if (parsed.salesTargets) { setSalesTargets(parsed.salesTargets)}
                                  if (parsed.offlineQueue) { setOfflineQueue(parsed.offlineQueue); try { localStorage.setItem('erp_offline_queue', JSON.stringify(parsed.offlineQueue)); } catch (e) {} }
                                  if (parsed.cashUpHistory) { setCashUpHistory(parsed.cashUpHistory)}
                                  if (parsed.auditLog) { setAuditLog(parsed.auditLog)}
                                  if (parsed.stockMovements) { setStockMovements(parsed.stockMovements)}
                                  if (parsed.etimsSettings) { setEtimsSettings(parsed.etimsSettings)}
                                  if (parsed.loyaltySettings) { setLoyaltySettings(parsed.loyaltySettings)}
                                  if (parsed.paymentMethods) setPaymentMethods(parsed.paymentMethods);

                                  if (parsed.expenseCategories) setExpenseCategories(parsed.expenseCategories);
                                  if (parsed.itemStatuses) setItemStatuses(parsed.itemStatuses);
                                  if (parsed.inventory) setInventory(parsed.inventory);
                                  if (parsed.customers) setCustomers(parsed.customers);
                                  if (parsed.sales) setSales(parsed.sales.map(s => ({ ...s, items: typeof s.items === 'string' ? JSON.parse(s.items || '[]') : s.items })));
                                  if (parsed.expenses) setExpenses(parsed.expenses);
                                  if (parsed.roles) setRoles(parsed.roles.map(r => ({ ...r, privileges: typeof r.privileges === 'string' ? JSON.parse(r.privileges) : r.privileges })));
                                  if (parsed.users) setUsers(parsed.users);
                                  if (parsed.suppliers) setSuppliers(parsed.suppliers);
                                  if (parsed.purchaseOrders) setPurchaseOrders(parsed.purchaseOrders);
                                  alert("System restored and synced directly into database successfully!");
                                } else {
                                  alert("Failed to restore data into database.");
                                }
                              }
                            } catch (err) {
                              alert("Invalid backup JSON file or restoration error.");
                              console.error(err);
                            }
                          };
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}
      {/* User Profile Modal */}
      {userProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2"><h4 className="font-bold text-white text-sm">My User Profile</h4><button onClick={() => setUserProfileModalOpen(false)} className="text-slate-400">✕</button></div>
            <form className="space-y-3 text-xs" onSubmit={async e => {
              e.preventDefault(); if (!currentUser) return;
              const name = profileNameDraft.trim();
              if (!name) { alert('Please enter your name.'); return; }
              try {
                const payload = {
                  id: currentUser.id,
                  name,
                  role: currentUser.role,
                  phone: currentUser.phone || '',
                  status: currentUser.status || 'Active',
                  photo: profileImage || ''
                };
                const response = await apiFetch(`/api/users/${currentUser.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  alert(data.error || 'Could not save your profile to the database.');
                  return;
                }
                const updatedUser = { ...currentUser, name, photo: profileImage || '', ...(data.user || {}) };
                setUsers(prev => (prev || []).map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                setCurrentUser(updatedUser);
                try { localStorage.setItem('erp_current_user', JSON.stringify(updatedUser)); } catch (_) {}
                setUserProfileModalOpen(false);
                alert('Profile saved successfully.');
              } catch {
                alert('Could not save your profile. Please try again.');
              }
            }}>
              <div className="flex items-center gap-3"><div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">{profileImage ? <img src={profileImage} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-emerald-400">{(profileNameDraft || 'U').trim().charAt(0).toUpperCase()}</span>}</div><label className="flex-1"><span className="block text-slate-400 mb-1">Profile image</span><input type="file" accept="image/*" className="w-full text-slate-300" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { alert('Please choose an image smaller than 5 MB (it will be compressed).'); e.target.value = ''; return; } try { const dataUrl = await compressProfileImage(file, 256, 0.72); setProfileImage(dataUrl); } catch (_) { alert('Could not process image. Try a different file.'); } e.target.value = ''; }} /><span className="text-[10px] text-slate-500 mt-0.5 block">Auto-resized to max 256px JPEG for fast DB storage.</span></label></div>
              <label className="block"><span className="block text-slate-400 mb-1">Full name</span><input value={profileNameDraft} onChange={e => setProfileNameDraft(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></label>
              <p className="text-slate-500">Role: {currentUser?.role || '—'}</p>
              <div className="flex gap-2"><button type="submit" className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Profile</button><button type="button" onClick={() => { setUserProfileModalOpen(false); setChangePasswordModalOpen(true); }} className="flex-1 py-2.5 bg-slate-700 text-white font-bold rounded">Change Password</button></div>
            </form>
          </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Change PIN</p>
                <input type="password" placeholder="Current PIN" value={profilePinCurrent} onChange={e => setProfilePinCurrent(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                <input type="password" placeholder="New PIN (min 4)" value={profilePinNew} onChange={e => setProfilePinNew(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                <input type="password" placeholder="Confirm new PIN" value={profilePinConfirm} onChange={e => setProfilePinConfirm(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" />
                {profilePinNew && <p className={`text-[10px] ${pinStrength(profilePinNew).score >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>Strength: {pinStrength(profilePinNew).label}</p>}
                <button type="button" onClick={async () => {
                  if (profilePinNew !== profilePinConfirm) { alert('New PIN and confirm do not match.'); return; }
                  const st = pinStrength(profilePinNew);
                  if (!st.ok) { alert(st.label); return; }
                  if (!window.confirm('Update your PIN now?')) return;
                  try {
                    const res = await apiFetch('/api/change-pin', {
                      method: 'POST',
                      body: JSON.stringify({ currentPin: profilePinCurrent, newPin: profilePinNew })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) { alert(data.error || 'Could not update PIN'); return; }
                    setProfilePinCurrent(''); setProfilePinNew(''); setProfilePinConfirm('');
                    logAudit('update', 'user', 'PIN changed');
                    alert('PIN updated securely on server.');
                  } catch (e) {
                    alert('Network error updating PIN.');
                  }
                }} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded">Update PIN</button>
              </div>

        </div>
      )}

      {/* Self Change Password Modal */}
      {changePasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Change My Password / PIN</h4>
              <button onClick={() => setChangePasswordModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!currentUser) {
                alert('No active user session found.');
                return;
              }
              if (!selfOldPassword) {
                alert('Enter your current PIN.');
                return;
              }
              if (!selfNewPassword || selfNewPassword.length < 4) {
                alert('New PIN must be at least 4 characters.');
                return;
              }
              try {
                const response = await apiFetch('/api/change-pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ currentPin: selfOldPassword, newPin: selfNewPassword })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  alert(data.error || 'Could not update PIN on the server.');
                  return;
                }
                alert('Your password/PIN has been successfully updated!');
                setChangePasswordModalOpen(false);
                setSelfOldPassword('');
                setSelfNewPassword('');
              } catch (err) {
                console.error(err);
                alert('Network error updating PIN. Please try again.');
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Current Password / PIN</label>
                <input type="password" value={selfOldPassword} onChange={e => setSelfOldPassword(e.target.value)} required placeholder="••••" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">New Password / PIN</label>
                <input type="password" value={selfNewPassword} onChange={e => setSelfNewPassword(e.target.value)} required placeholder="••••" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Update Password</button>
            </form>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {newCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Customer</h4>
              <button onClick={() => setNewCustomerModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleSaveNewCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Customer Name</label>
                <input type="text" placeholder="Customer Name" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Phone Number</label>
                <input type="text" placeholder="Phone Number" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Location</label>
                <input type="text" placeholder="Location" value={customerForm.location} onChange={e => setCustomerForm({...customerForm, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div><label className="text-slate-400 block mb-1 text-xs">Tags (comma-separated)</label>
                <input type="text" value={customerForm.tags || ''} onChange={e => setCustomerForm({...customerForm, tags: e.target.value})} placeholder="VIP, wholesale" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
              <div><label className="text-slate-400 block mb-1 text-xs">Price List</label>
                <select value={customerForm.priceList || 'retail'} onChange={e => setCustomerForm({...customerForm, priceList: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select></div>
              <div><label className="text-slate-400 block mb-1 text-xs">KRA / Buyer PIN</label>
                <input type="text" value={customerForm.kraPin || ''} onChange={e => setCustomerForm({...customerForm, kraPin: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>
              <div><label className="text-slate-400 block mb-1 text-xs">Loyalty Points</label>
                <input type="number" value={customerForm.loyaltyPoints || 0} onChange={e => setCustomerForm({...customerForm, loyaltyPoints: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs" /></div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Sale Type Eligibility:</label>
                <div className="flex gap-4 mt-1">
                  {['Paid', 'Credit', 'Layby'].map(type => (
                    <label key={type} className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={(customerForm.eligibility || ['Paid']).includes(type)}
                        onChange={e => {
                          const currentEl = customerForm.eligibility || ['Paid'];
                          const newEl = e.target.checked ? [...currentEl, type] : currentEl.filter(t => t !== type);
                          setCustomerForm({ ...customerForm, eligibility: newEl.length > 0 ? newEl : ['Paid'] });
                        }}
                        className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Payment / Sales Term:</label>
                <select value={customerForm.salesTermId || ''} onChange={e => {
                  const term = salesTerms.find(t => t.id === e.target.value);
                  let eligibility = customerForm.eligibility || ['Paid'];
                  if (term) {
                    if (term.type === 'Paid') eligibility = ['Paid'];
                    else if (term.type === 'Credit') eligibility = Array.from(new Set([...eligibility.filter(x => x !== 'Layby'), 'Credit', 'Paid']));
                    else if (term.type === 'Layby') eligibility = Array.from(new Set([...eligibility.filter(x => x !== 'Credit'), 'Layby', 'Paid']));
                  }
                  setCustomerForm({ ...customerForm, salesTermId: e.target.value, paymentTerm: term?.name || '', eligibility });
                }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="">-- Select sales term --</option>
                  {salesTerms.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type}{t.days ? `, ${t.days} days` : ''})</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Customer</button>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModalOpen && lastCompletedSale && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 print:hidden shrink-0">
              <h4 className="font-bold text-white text-sm">Sale Receipt #{lastCompletedSale.invoiceNo || lastCompletedSale.id}</h4>
              <div className="flex gap-2 items-center">
                <button type="button" onClick={() => {
                  const msg = buildWhatsAppReceiptText(lastCompletedSale);
                  const cust = customers.find(c => c.name === lastCompletedSale.customerName);
                  const phone = (cust?.phone || '').replace(/\D/g, '');
                  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank');
                }} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">WhatsApp</button>
                <button type="button" onClick={() => {
                  const msg = buildWhatsAppReceiptText(lastCompletedSale);
                  if (navigator.clipboard) navigator.clipboard.writeText(msg);
                  alert('Receipt text copied — paste into SMS or chat.');
                }} className="px-2 py-1 bg-sky-500/20 text-sky-400 text-[10px] font-bold rounded">Copy SMS</button>
                <button onClick={() => setReceiptModalOpen(false)} className="text-slate-400">✕</button>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div id="printable-receipt" className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs text-slate-200">
              <div className="text-center border-b border-slate-800 pb-2">
                <p className="font-bold text-white text-sm">{shopProfile.name}</p>
                <p className="text-[10px] text-slate-400">{shopProfile.tagline}</p>
                <p className="text-[10px] text-slate-400">{(branches || []).find(b => b.id === (lastCompletedSale.branchId || activeBranchId))?.name || shopProfile.location} | Tel: {shopProfile.phone}</p>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Date: {new Date(lastCompletedSale.date).toLocaleString()}</span>
                <span>Cashier: {lastCompletedSale.cashier}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Customer: {lastCompletedSale.customerName}</span>
                <span>Type: <strong className="text-emerald-400">{lastCompletedSale.saleType}</strong></span>
              </div>

              <div className="border-t border-b border-slate-800 py-2 space-y-1">
                <p className="font-semibold text-emerald-400 text-[10px] uppercase">Purchased Items:</p>
                {(lastCompletedSale.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span>{it.name} (x{it.qty || 1})</span>
                    <span className="font-bold">{shopProfile.currency} {(it.price * (it.qty || 1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs pt-1">
                {(parseFloat(lastCompletedSale.taxAmount) || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span>{shopProfile.currency} {(lastCompletedSale.subtotal ?? (lastCompletedSale.totalAmount - (parseFloat(lastCompletedSale.taxAmount) || 0))).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>{lastCompletedSale.taxName || 'VAT'}{lastCompletedSale.taxRate ? ` (${lastCompletedSale.taxRate}%)` : ''}:</span>
                      <span>{shopProfile.currency} {(parseFloat(lastCompletedSale.taxAmount) || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-white">
                  <span>Total Amount:</span>
                  <span className="text-emerald-400">{shopProfile.currency} {lastCompletedSale.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Method:</span>
                  <span>{lastCompletedSale.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Paid Amount:</span>
                  <span>{shopProfile.currency} {lastCompletedSale.paidAmount.toLocaleString()}</span>
                </div>
                {lastCompletedSale.balanceDue > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Balance Due:</span>
                    <span>{shopProfile.currency} {lastCompletedSale.balanceDue.toLocaleString()} (Due: {lastCompletedSale.deadline})</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                <p>Thank you for shopping with us!</p>
              </div>
            </div>

            </div>
            <div className="flex gap-2 pt-2 print:hidden shrink-0 border-t border-slate-800">
              <button onClick={() => {
                window.print();
              }} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setReceiptModalOpen(false)} className="py-2.5 px-4 bg-slate-800 text-white font-bold rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {addUserModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New User</h4>
              <button onClick={() => setAddUserModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateNewUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Full Name</label>
                <input type="text" placeholder="e.g. Mary Atieno" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Role</label>
                <select value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">4-Digit PIN / Password</label>
                <input type="password" maxLength={8} placeholder="••••" value={newUserForm.pin} onChange={e => setNewUserForm({...newUserForm, pin: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Phone Number</label>
                <input type="text" placeholder="+254 7..." value={newUserForm.phone} onChange={e => setNewUserForm({...newUserForm, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select value={newUserForm.status} onChange={e => setNewUserForm({...newUserForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Locations (multi-select)</label>
                <p className="text-[10px] text-slate-500 mb-1">Leave empty for access to all locations. Select one or more to restrict.</p>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-950 border border-slate-700 rounded p-2">
                  {(branches || []).map(b => {
                    const list = Array.isArray(newUserForm.allowedBranches) ? newUserForm.allowedBranches.map(String) : [];
                    const checked = list.includes(String(b.id));
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-slate-300">
                        <input type="checkbox" checked={checked} onChange={() => {
                          let next = [...list];
                          if (checked) next = next.filter(x => x !== String(b.id));
                          else next.push(String(b.id));
                          setNewUserForm({ ...newUserForm, allowedBranches: next });
                        }} />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save & Create User</button>
            </form>
          </div>
        </div>
      )}

      {addRoleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Role</h4>
              <button onClick={() => setAddRoleModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateNewRole} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Role Name</label>
                <input type="text" placeholder="e.g. Supervisor" value={newRoleForm.name} onChange={e => setNewRoleForm({...newRoleForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <p className="text-[11px] text-slate-400">Note: You can configure detailed tab and CRUD permissions right after creating the role.</p>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Create Role</button>
            </form>
          </div>
        </div>
      )}

      {addCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Item Category</h4>
              <button onClick={() => setAddCategoryModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateNewCategory} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Category Name</label>
                <input type="text" placeholder="e.g. Designer Hoodies" value={newCategoryForm.name} onChange={e => setNewCategoryForm({...newCategoryForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select value={newCategoryForm.status} onChange={e => setNewCategoryForm({...newCategoryForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Category</button>
            </form>
          </div>
        </div>
      )}

      {addStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Item Status</h4>
              <button onClick={() => setAddStatusModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleCreateNewStatus} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Status Name</label>
                <input type="text" placeholder="e.g. Clearance" value={newStatusForm.name} onChange={e => setNewStatusForm({...newStatusForm, name: e.target.value})} required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Allows Sale?</label>
                <select value={newStatusForm.canSell ? 'yes' : 'no'} onChange={e => setNewStatusForm({...newStatusForm, canSell: e.target.value === 'yes'})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="yes">Yes (Ready for Sale)</option>
                  <option value="no">No (Restricts Sale)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Status</button>
            </form>
          </div>
        </div>
      )}

      {newItemModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Item</h4>
              <button type="button" onClick={() => setNewItemModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={handleSaveNewItem} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Item Name *</label>
                <input required value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">SKU / Barcode</label>
                  <input value={itemForm.sku} onChange={e => setItemForm({...itemForm, sku: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                    {(categories || []).map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Buying Price</label>
                  <input type="number" step="0.01" value={itemForm.buyingPrice} onChange={e => setItemForm({...itemForm, buyingPrice: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Selling Price *</label>
                  <input required type="number" step="0.01" value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Quantity</label>
                  <input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" disabled={!itemForm.trackInventory} />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Low Stock Alert</label>
                  <input type="number" value={itemForm.lowStockAlert} onChange={e => setItemForm({...itemForm, lowStockAlert: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={!!itemForm.trackInventory} onChange={e => setItemForm({...itemForm, trackInventory: e.target.checked})} className="rounded" id="newItemTrack" />
                <label htmlFor="newItemTrack" className="text-slate-300">Track inventory</label>
              </div>
              <div className="space-y-2 p-3 bg-slate-950 rounded border border-slate-800">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!itemForm.allLocations} onChange={e => setItemForm({...itemForm, allLocations: e.target.checked, branchId: e.target.checked ? '' : (itemForm.branchId || activeBranchId || '')})} className="rounded" id="newItemAllLoc" />
                  <label htmlFor="newItemAllLoc" className="text-slate-300 font-semibold">Available in all locations</label>
                </div>
                {!itemForm.allLocations && (
                  <div>
                    <label className="text-slate-400 block mb-1">Location</label>
                    <select value={itemForm.branchId || activeBranchId || ''} onChange={e => setItemForm({...itemForm, branchId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                      <option value="">— Select location —</option>
                      {(accessibleBranches || branches || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (default)' : ''}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select value={itemForm.status} onChange={e => setItemForm({...itemForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(itemStatuses || [{name:'Listed'}]).map(st => <option key={st.id || st.name} value={st.name}>{st.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Photo URL</label>
                <input value={itemForm.photoUrl} onChange={e => setItemForm({...itemForm, photoUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="https://..." />
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Item</button>
            </form>
          </div>
        </div>
      )}

      {selectedInventoryItem && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Inventory Item: {selectedInventoryItem.name}</h4>
              <button onClick={() => setSelectedInventoryItem(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Item Name</label><input type="text" value={selectedInventoryItem.name} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              {(itemVariances || []).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(itemVariances || []).map(v => {
                    const vv = parseItemVarianceValues(selectedInventoryItem);
                    return (
                      <div key={v.id || v.name}>
                        <label className="text-slate-400 block mb-1 text-xs">{v.name}</label>
                        <input
                          type="text"
                          value={vv[v.name] || ''}
                          onChange={e => {
                            const next = { ...vv, [v.name]: e.target.value };
                            setSelectedInventoryItem(applyVarianceValuesToItem(selectedInventoryItem, next));
                          }}
                          placeholder={`Enter ${v.name}`}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select value={selectedInventoryItem.category} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, category: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-slate-400 block mb-1">Buying Price</label><input type="number" value={selectedInventoryItem.buyingPrice} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, buyingPrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-1 font-semibold">Selling Price</label><input type="number" value={selectedInventoryItem.price} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, price: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-slate-400 block mb-1">Quantity</label><input type="number" value={selectedInventoryItem.quantity} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, quantity: parseInt(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                <div>
                  <label className="text-slate-400 block mb-1">Status</label>
                  <select value={selectedInventoryItem.status} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                    {itemStatuses.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded border border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Track Inventory?</label>
                  <input 
                    type="checkbox" 
                    checked={selectedInventoryItem.trackInventory} 
                    onChange={e => setSelectedInventoryItem({...selectedInventoryItem, trackInventory: e.target.checked})} 
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 w-4 h-4"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Low Stock Alert Threshold</label>
                  <input 
                    type="number" 
                    value={selectedInventoryItem.lowStockAlert || 3} 
                    onChange={e => setSelectedInventoryItem({...selectedInventoryItem, lowStockAlert: parseInt(e.target.value) || 3})} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Photo Image URL</label>
                <input type="text" value={selectedInventoryItem.photoUrl || ''} onChange={e => setSelectedInventoryItem({...selectedInventoryItem, photoUrl: e.target.value})} placeholder="https://images.unsplash.com/..." className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="flex gap-2 pt-2">
                {(isAdminUser || privileges.inventory?.update) && (
                  <button onClick={() => handleSaveInventory(selectedInventoryItem)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                )}
                {(isAdminUser || privileges.inventory?.delete) && (
                  <button onClick={() => handleDeleteInventory(selectedInventoryItem.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                )}
                {(!isAdminUser && !privileges.inventory?.update && !privileges.inventory?.delete) && (
                  <button onClick={() => setSelectedInventoryItem(null)} className="w-full py-2 bg-slate-800 text-white font-bold rounded">Close</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Customer: {selectedCustomer.name}</h4>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Customer Name</label><input type="text" value={selectedCustomer.name} onChange={e => setSelectedCustomer({...selectedCustomer, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Phone Number</label><input type="text" value={selectedCustomer.phone || ''} onChange={e => setSelectedCustomer({...selectedCustomer, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Location</label><input type="text" value={selectedCustomer.location || ''} onChange={e => setSelectedCustomer({...selectedCustomer, location: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Sale Type Eligibility:</label>
                <div className="flex gap-4 mt-1">
                  {['Paid', 'Credit', 'Layby'].map(type => (
                    <label key={type} className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={(selectedCustomer.eligibility || ['Paid']).includes(type)}
                        onChange={e => {
                          const currentEl = selectedCustomer.eligibility || ['Paid'];
                          const newEl = e.target.checked ? [...currentEl, type] : currentEl.filter(t => t !== type);
                          setSelectedCustomer({ ...selectedCustomer, eligibility: newEl.length > 0 ? newEl : ['Paid'] });
                        }}
                        className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Payment / Sales Term:</label>
                <select value={selectedCustomer.salesTermId || ''} onChange={e => {
                  const term = salesTerms.find(t => t.id === e.target.value);
                  let eligibility = selectedCustomer.eligibility || ['Paid'];
                  if (term) {
                    if (term.type === 'Paid') eligibility = ['Paid'];
                    else if (term.type === 'Credit') eligibility = Array.from(new Set([...(eligibility||[]).filter(x => x !== 'Layby'), 'Credit', 'Paid']));
                    else if (term.type === 'Layby') eligibility = Array.from(new Set([...(eligibility||[]).filter(x => x !== 'Credit'), 'Layby', 'Paid']));
                  }
                  setSelectedCustomer({ ...selectedCustomer, salesTermId: e.target.value, paymentTerm: term?.name || '', eligibility });
                }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="">-- Select sales term --</option>
                  {salesTerms.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type}{t.days ? `, ${t.days} days` : ''})</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                {(isAdminUser || privileges.customers?.update) && (
                  <button onClick={() => handleSaveCustomer(selectedCustomer)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                )}
                {(isAdminUser || privileges.customers?.delete) && (
                  <button onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                )}
                {(!isAdminUser && !privileges.customers?.update && !privileges.customers?.delete) && (
                  <button onClick={() => setSelectedCustomer(null)} className="w-full py-2 bg-slate-800 text-white font-bold rounded">Close</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedExpenseItem && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Expense Item</h4>
              <button onClick={() => setSelectedExpenseItem(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Date</label><input type="date" value={selectedExpenseItem.date} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select value={selectedExpenseItem.category} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, category: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(expenseCategories || []).map(ec => <option key={ec.id} value={ec.name}>{ec.name}</option>)}
                </select>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Payment History</p>
                {(() => {
                  let hist = selectedExpenseItem.paymentHistory;
                  try { if (typeof hist === 'string') hist = JSON.parse(hist || '[]'); } catch (_) { hist = []; }
                  if (!Array.isArray(hist) || !hist.length) {
                    const paid = parseFloat(selectedExpenseItem.paidAmount ?? selectedExpenseItem.amount) || 0;
                    hist = paid > 0 ? [{ date: selectedExpenseItem.date, amount: paid, paymentMethod: selectedExpenseItem.paymentMethod || '—', mpesaCode: selectedExpenseItem.mpesaCode || '' }] : [];
                  }
                  if (!hist.length) return <p className="text-[10px] text-slate-500">No payments recorded yet.</p>;
                  return hist.map((p, idx) => (
                    <div key={p.id || idx} className="flex flex-wrap justify-between gap-1 text-[11px] border-b border-slate-800 pb-1">
                      <span className="text-slate-400">{p.date ? new Date(p.date).toLocaleString() : '—'}</span>
                      <span className="text-white">{p.paymentMethod || p.method || '—'}</span>
                      {(String(p.paymentMethod || p.method || '').toLowerCase().includes('m-pesa') || p.mpesaCode) && (
                        <span className="text-sky-400 font-mono">TXN {p.mpesaCode || p.txnNo || '—'}</span>
                      )}
                      <span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(p.amount || 0).toLocaleString()}</span>
                    </div>
                  ));
                })()}
              </div>
              <div><label className="text-slate-400 block mb-1">Description</label><input type="text" value={selectedExpenseItem.description} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Total Amount</label><input type="number" value={selectedExpenseItem.amount} onChange={e => {
                const amount = parseFloat(e.target.value) || 0;
                const paid = parseFloat(selectedExpenseItem.paidAmount ?? selectedExpenseItem.amount) || 0;
                const bal = Math.max(0, amount - paid);
                setSelectedExpenseItem({...selectedExpenseItem, amount, balanceDue: bal, paymentStatus: bal <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid')});
              }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Amount Paid</label><input type="number" value={selectedExpenseItem.paidAmount ?? selectedExpenseItem.amount ?? 0} onChange={e => {
                const paid = parseFloat(e.target.value) || 0;
                const amount = parseFloat(selectedExpenseItem.amount) || 0;
                const bal = Math.max(0, amount - paid);
                setSelectedExpenseItem({...selectedExpenseItem, paidAmount: paid, balanceDue: bal, paymentStatus: bal <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid')});
              }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded border border-slate-800"><span className="text-slate-400 block">Balance Due</span><strong className="text-amber-400">{shopProfile.currency} {(selectedExpenseItem.balanceDue ?? Math.max(0, (selectedExpenseItem.amount||0) - (selectedExpenseItem.paidAmount ?? selectedExpenseItem.amount ?? 0))).toLocaleString()}</strong></div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800"><span className="text-slate-400 block">Status</span><strong className={(selectedExpenseItem.paymentStatus || 'Paid') === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}>{selectedExpenseItem.paymentStatus || 'Paid'}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-slate-400 block mb-1">Payer</label><input type="text" value={selectedExpenseItem.payer || ''} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, payer: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-1">Paid To</label><input type="text" value={selectedExpenseItem.paidTo || ''} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, paidTo: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              </div>
              <div><label className="text-slate-400 block mb-1">Payment Method</label><select value={selectedExpenseItem.paymentMethod} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, paymentMethod: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">{(paymentMethods||[{name:'Cash'},{name:'M-Pesa'}]).map(pm=><option key={pm.id||pm.name} value={pm.name}>{pm.name}</option>)}</select></div>
              {String(selectedExpenseItem.paymentMethod||'').toLowerCase().includes('m-pesa') && (
                <div><label className="text-emerald-400 block mb-1">M-Pesa TXN No</label><input type="text" value={selectedExpenseItem.mpesaCode||''} onChange={e => setSelectedExpenseItem({...selectedExpenseItem, mpesaCode: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="TXN No" /></div>
              )}
              <div className="flex gap-2 pt-2">
                {(isAdminUser || privileges.expenses?.update) && (
                  <button onClick={() => handleSaveExpense(selectedExpenseItem)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                )}
                {(isAdminUser || privileges.expenses?.delete) && (
                  <button onClick={() => handleDeleteExpense(selectedExpenseItem.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete Expense</button>
                )}
                {(!isAdminUser && !privileges.expenses?.update && !privileges.expenses?.delete) && (
                  <button onClick={() => setSelectedExpenseItem(null)} className="w-full py-2 bg-slate-800 text-white font-bold rounded">Close</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSaleItem && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Transaction Details & Payment Update: #{selectedSaleItem.id}</h4>
              <button onClick={() => setSelectedSaleItem(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded border border-slate-800">
                <div><span className="text-slate-400 block">Customer</span><strong className="text-white text-sm">{selectedSaleItem.customerName}</strong></div>
                <div><span className="text-slate-400 block">Sale Type</span><strong className="text-emerald-400 text-sm">{selectedSaleItem.saleType}</strong></div>
                <div><span className="text-slate-400 block mt-2">Total Amount</span><strong className="text-emerald-400 text-sm">{shopProfile.currency} {selectedSaleItem.totalAmount?.toLocaleString()}</strong></div>
                <div><span className="text-slate-400 block mt-2">Balance Due</span><strong className="text-amber-400 text-sm">{shopProfile.currency} {selectedSaleItem.balanceDue?.toLocaleString()}</strong></div>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Payment History</p>
                {(() => {
                  let hist = selectedSaleItem.paymentHistory;
                  try { if (typeof hist === 'string') hist = JSON.parse(hist || '[]'); } catch (_) { hist = []; }
                  if (!Array.isArray(hist) || !hist.length) {
                    const paid = parseFloat(selectedSaleItem.paidAmount) || 0;
                    if (paid > 0) {
                      hist = [{ date: selectedSaleItem.date || selectedSaleItem.createdAt, amount: paid, paymentMethod: selectedSaleItem.paymentMethod || '—', mpesaCode: selectedSaleItem.mpesaCode || '' }];
                    } else {
                      hist = [];
                    }
                  }
                  if (!hist.length) return <p className="text-[10px] text-slate-500">No payments recorded yet.</p>;
                  return (
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {hist.map((p, idx) => (
                        <div key={p.id || idx} className="flex flex-wrap justify-between gap-1 text-[11px] border-b border-slate-800 pb-1">
                          <span className="text-slate-400">{p.date ? new Date(p.date).toLocaleString() : '—'}</span>
                          <span className="text-white">{p.paymentMethod || p.method || '—'}</span>
                          {(String(p.paymentMethod || p.method || '').toLowerCase().includes('m-pesa') || p.mpesaCode) && (
                            <span className="text-sky-400 font-mono">TXN {p.mpesaCode || p.txnNo || '—'}</span>
                          )}
                          <span className="text-emerald-400 font-bold">{shopProfile.currency} {Number(p.amount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <button onClick={() => {
                setLastCompletedSale({
                  id: selectedSaleItem.id,
                  date: selectedSaleItem.date,
                  customerName: selectedSaleItem.customerName,
                  saleType: selectedSaleItem.saleType,
                  items: parseSaleItems(selectedSaleItem),
                  totalAmount: selectedSaleItem.totalAmount,
                  subtotal: selectedSaleItem.subtotal,
                  taxAmount: selectedSaleItem.taxAmount || 0,
                  taxRate: selectedSaleItem.taxRate || 0,
                  taxName: selectedSaleItem.taxName || 'VAT',
                  paymentMethod: selectedSaleItem.paymentMethod,
                  paidAmount: selectedSaleItem.paidAmount,
                  balanceDue: selectedSaleItem.balanceDue,
                  deadline: selectedSaleItem.deadline,
                  cashier: selectedSaleItem.cashier || 'Staff'
                });
                setReceiptModalOpen(true);
              }} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded flex items-center justify-center gap-1.5 border border-emerald-500/30">
                <Printer className="w-4 h-4" /> Print Past Sale Receipt
              </button>
              <button onClick={() => openSalesReturn(selectedSaleItem)} className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold rounded flex items-center justify-center gap-1.5 text-xs">
                Create Sales Return
              </button>

              {(isAdminUser || privileges.sales?.update) && (
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                  <p className="font-semibold text-emerald-400">Update Payment / Clear Balance:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Additional Paid Amount ({shopProfile.currency}):</label>
                      <input 
                        type="number" 
                        id="update-additional-paid"
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Payment Method:</label>
                      <select id="update-pay-method" defaultValue={selectedSaleItem.paymentMethod} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white" onChange={e => {
                        const box = document.getElementById('update-mpesa-wrap');
                        if (box) box.style.display = String(e.target.value || '').toLowerCase().includes('m-pesa') ? 'block' : 'none';
                      }}>
                        {(paymentMethods || [{ name: 'Cash' }, { name: 'M-Pesa' }]).map(pm => <option key={pm.id || pm.name} value={pm.name}>{pm.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div id="update-mpesa-wrap" style={{ display: String(selectedSaleItem.paymentMethod || '').toLowerCase().includes('m-pesa') ? 'block' : 'none' }}>
                    <label className="text-[10px] text-emerald-400 block mb-1">M-Pesa Transaction Number (TXN No):</label>
                    <input id="update-mpesa-code" type="text" defaultValue={selectedSaleItem.mpesaCode && selectedSaleItem.mpesaCode !== 'N/A' ? selectedSaleItem.mpesaCode : ''} placeholder="e.g. QH7X..." className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white" />
                  </div>
                  <button 
                    onClick={async () => {
                      const addInput = document.getElementById('update-additional-paid').value;
                      const method = document.getElementById('update-pay-method').value;
                      const totalAmt = parseFloat(selectedSaleItem.totalAmount) || 0;
                      const prevPaid = parseFloat(selectedSaleItem.paidAmount) || 0;
                      const currentDue = Math.max(0, (parseFloat(selectedSaleItem.balanceDue) || Math.max(0, totalAmt - prevPaid)));
                      let addAmount = parseFloat(addInput) || 0;
                      if (addAmount <= 0) {
                        alert('Enter a payment amount greater than 0.');
                        return;
                      }
                      // Do not accept more than remaining balance (same payment rules)
                      if (addAmount > currentDue) addAmount = currentDue;

                      const newPaidAmt = prevPaid + addAmount;
                      const newBalance = Math.max(0, totalAmt - newPaidAmt);
                      const newType = newBalance === 0 ? 'Paid' : (selectedSaleItem.saleType || selectedSaleItem.type || 'Credit');
                      const itemsArr = parseSaleItems(selectedSaleItem);
                      const itemsJson = JSON.stringify(itemsArr);

                      const mpesaTxnEl = document.getElementById('update-mpesa-code');
                      const mpesaTxn = mpesaTxnEl ? (mpesaTxnEl.value || '').trim() : '';
                      const updatedSale = {
                        ...selectedSaleItem,
                        paidAmount: newPaidAmt,
                        balanceDue: newBalance,
                        saleType: newType,
                        paymentMethod: method,
                        items: itemsJson,
                        mpesaCode: (method && String(method).toLowerCase().includes('m-pesa'))
                          ? (mpesaTxn || selectedSaleItem.mpesaCode || '')
                          : (selectedSaleItem.mpesaCode || 'N/A')
                      };

                      const localSale = { ...updatedSale, items: itemsArr };
                      setSales(sales.map(s => s.id === updatedSale.id ? localSale : s));
                      setSelectedSaleItem(null);
                      try {
                        const res = await apiFetch(`/api/sales/${updatedSale.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updatedSale)
                        });
                        if (!res.ok) {
                          setSales(sales.map(s => s.id === selectedSaleItem.id ? selectedSaleItem : s));
                          alert('Failed to update sale record in database.');
                        }
                      } catch (err) {
                        console.error(err);
                        alert('Network error updating payment.');
                      }
                    }}
                    className="w-full mt-2 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
                  >
                    Apply Payment & Update Status
                  </button>
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Purchased Items:</label>
                <div className="space-y-1 bg-slate-950 p-3 rounded border border-slate-800 max-h-32 overflow-y-auto">
                  {parseSaleItems(selectedSaleItem).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300 py-1 border-b border-slate-900 last:border-none">
                      <span>{it.name} (Qty: {it.qty || 1})</span>
                      <span className="font-bold text-emerald-400">{shopProfile.currency} {(Number(it.price) || 0) * (Number(it.qty) || 1)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setSelectedSaleItem(null)} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded">Close</button>
                {(isAdminUser || privileges.sales?.delete) && (
                  <button onClick={() => handleDeleteSale(selectedSaleItem.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Void / Delete Sale</button>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit User: {selectedUser.name} (Admin Override)</h4>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Name</label><input type="text" value={selectedUser.name} onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Role</label><select value={selectedUser.role} onChange={e => setSelectedUser({...selectedUser, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">{roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
              <div><label className="text-slate-400 block mb-1">Override PIN (leave blank to keep)</label><input type="password" maxLength={32} value={selectedUser.pin && !String(selectedUser.pin).startsWith('pbkdf2$') ? selectedUser.pin : ''} onChange={e => setSelectedUser({...selectedUser, pin: e.target.value})} placeholder="New PIN only if changing" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono" /></div>
              <div><label className="text-slate-400 block mb-1">Status</label><select value={selectedUser.status} onChange={e => setSelectedUser({...selectedUser, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              <div>
                <label className="text-slate-400 block mb-1">Locations (multi-select)</label>
                <p className="text-[10px] text-slate-500 mb-1">Empty = all locations. Select one or more to restrict this user.</p>
                <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-950 border border-slate-700 rounded p-2">
                  {(branches || []).map(b => {
                    let list = selectedUser.allowedBranches;
                    try { if (typeof list === 'string') list = JSON.parse(list || '[]'); } catch (_) { list = []; }
                    list = Array.isArray(list) ? list.map(String) : [];
                    const checked = list.includes(String(b.id));
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-slate-300">
                        <input type="checkbox" checked={checked} onChange={() => {
                          let next = [...list];
                          if (checked) next = next.filter(x => x !== String(b.id));
                          else next.push(String(b.id));
                          setSelectedUser({ ...selectedUser, allowedBranches: next });
                        }} />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveUser(selectedUser)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                <button onClick={() => handleDeleteUser(selectedUser.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRole && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Configure Privileges for Role: {selectedRole.name}</h4>
              <button onClick={() => setSelectedRole(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Role Name</label>
                <input type="text" value={selectedRole.name} onChange={e => setSelectedRole({...selectedRole, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-2 font-semibold">Allowed locations (leave none checked = all locations)</label>
                <div className="bg-slate-950 border border-slate-800 rounded p-3 max-h-32 overflow-y-auto space-y-1">
                  {(branches || []).length === 0 && <p className="text-slate-500 text-[10px]">No locations yet. Add them under Settings → Locations.</p>}
                  {(branches || []).map(b => {
                    const list = Array.isArray(selectedRole.privileges?.allowedBranches) ? selectedRole.privileges.allowedBranches.map(String) : [];
                    const checked = list.includes(String(b.id));
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const priv = { ...(selectedRole.privileges || {}) };
                            let next = Array.isArray(priv.allowedBranches) ? [...priv.allowedBranches].map(String) : [];
                            if (checked) next = next.filter(id => id !== String(b.id));
                            else next.push(String(b.id));
                            priv.allowedBranches = next;
                            setSelectedRole({ ...selectedRole, privileges: priv });
                          }}
                        />
                        <span>{b.name}{b.isDefault ? ' (default)' : ''}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Users with this role only see and act on selected locations (sales, stock, POS, purchases, expenses, HR, reports).</p>
              </div>
              <div>
                <label className="text-slate-400 block mb-2 font-semibold">Tab Access & CRUD Privileges:</label>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {[
                    { type: 'tab', key: 'dashboard', label: 'Dashboard' },
                    { type: 'tab', key: 'pos', label: 'POS' },
                    { type: 'tab', key: 'sales', label: 'Sales' },
                    { type: 'tab', key: 'inventory', label: 'Inventory' },
                    { type: 'tab', key: 'expenses', label: 'Expenses' },
                    { type: 'tab', key: 'laybys', label: 'Credit & Layby' },
                    { type: 'tab', key: 'customers', label: 'Customers' },
                    { type: 'tab', key: 'suppliers', label: 'Suppliers' },
                    { type: 'tab', key: 'reports', label: 'Reports (all)' },
                    { type: 'tab', key: 'reportComprehensive', label: 'Comprehensive Reports Center' },
                    { type: 'tab', key: 'reportInventory', label: 'Report · Inventory' },
                    { type: 'tab', key: 'reportAging', label: 'Report · Aging' },
                    { type: 'tab', key: 'reportFinancial', label: 'Report · Financial' },
                    { type: 'tab', key: 'reportLedger', label: 'Report · Accounting Ledger' },
                    { type: 'group', key: 'reportSales', label: 'Report · Sales', children: [
                      { key: 'reportSalesMostItems', label: 'Top Items' },
                      { key: 'reportSalesMostCategories', label: 'Categories' },
                      { key: 'reportSalesDormant', label: 'Dormant Items' },
                      { key: 'reportSalesBestPeople', label: 'Best Salesperson' },
                      { key: 'reportSalesKpis', label: 'KPI Cards (Sales/Margin/Net)' },
                      { key: 'reportSalesPeople', label: 'Salespeople by Category' },
                      { key: 'reportSalesCreditsLayby', label: 'Credit / Layby' },
                      { key: 'reportSalesTax', label: 'Tax' }
                    ]},
                    { type: 'group', key: 'reportPurchase', label: 'Report · Purchase', children: [
                      { key: 'reportPurchaseSummary', label: 'Summary' },
                      { key: 'reportPurchaseByCategory', label: 'By Category' },
                      { key: 'reportPurchaseCogs', label: 'COGS' },
                      { key: 'reportPurchaseUnpaid', label: 'Unpaid' },
                      { key: 'reportPurchaseTax', label: 'Tax' }
                    ]},
                    { type: 'group', key: 'reportExpense', label: 'Report · Expense', children: [
                      { key: 'reportExpenseHighCategories', label: 'High Categories' },
                      { key: 'reportExpenseFrequent', label: 'Frequent' },
                      { key: 'reportExpenseUnpaid', label: 'Unpaid' },
                      { key: 'reportExpenseTax', label: 'Tax' }
                    ]},
                    { type: 'group', key: 'reportHr', label: 'Report · HR', children: [
                      { key: 'reportHrSummary', label: 'Summary' },
                      { key: 'reportHrLeaveSalary', label: 'Leave & Salary' }
                    ]},
                    { type: 'group', key: 'reportCustomer', label: 'Report · Customer', children: [
                      { key: 'reportCustomerStatement', label: 'Statement' }
                    ]},
                    { type: 'tab', key: 'settings', label: 'Settings' },
                    { type: 'tab', key: 'purchase', label: 'Purchase' },
                    { type: 'tab', key: 'employees', label: 'Employees' },
                    { type: 'tab', key: 'payroll', label: 'Payroll' },
                    { type: 'tab', key: 'hr', label: 'HR' }
                  ].map(item => {
                    const renderPrivRow = (tabKey, label, indent) => (
                      <div key={tabKey} className={`bg-slate-950 p-3 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-2 ${indent ? 'ml-4 border-l-2 border-emerald-500/40' : ''}`}>
                        <span className={`font-bold text-emerald-400 ${indent ? 'text-[11px] text-slate-300' : 'text-xs capitalize'}`}>{label}</span>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {['view', 'ownOnly', 'create', 'update', 'delete'].map(action => (
                            <label key={action} className="flex items-center gap-1 text-slate-300 capitalize cursor-pointer text-[10px] sm:text-[11px]" title={action === 'ownOnly' ? 'View only records this user created. View without View Own = see all records (read-only). Update/Delete = see and change all.' : action === 'view' ? 'Open the tab and see all records unless View Own is checked' : action === 'create' ? 'Create new records' : action === 'update' ? 'Edit all records' : action === 'delete' ? 'Delete records' : ''}>
                              <input
                                type="checkbox"
                                checked={selectedRole.privileges?.[tabKey]?.[action] || false}
                                onChange={e => {
                                  const updatedPrivs = { ...selectedRole.privileges };
                                  if (!updatedPrivs[tabKey]) updatedPrivs[tabKey] = { view: false, create: false, update: false, delete: false, ownOnly: false };
                                  updatedPrivs[tabKey][action] = e.target.checked;
                                  // When toggling View on a report parent, sync all its section children
                                  if (action === 'view') {
                                    const childMap = {
                                      reportSales: ['reportSalesMostItems','reportSalesMostCategories','reportSalesDormant','reportSalesBestPeople','reportSalesKpis','reportSalesPeople','reportSalesCreditsLayby','reportSalesTax'],
                                      reportPurchase: ['reportPurchaseSummary','reportPurchaseByCategory','reportPurchaseCogs','reportPurchaseUnpaid','reportPurchaseTax'],
                                      reportExpense: ['reportExpenseHighCategories','reportExpenseFrequent','reportExpenseUnpaid','reportExpenseTax'],
                                      reportHr: ['reportHrSummary','reportHrLeaveSalary'],
                                      reportCustomer: ['reportCustomerStatement'],
                                      reports: ['reportComprehensive','reportInventory','reportAging','reportFinancial','reportLedger']
                                    };
                                    const childKeys = childMap[tabKey] || [];
                                    childKeys.forEach(ck => {
                                      if (!updatedPrivs[ck]) updatedPrivs[ck] = { view: false, create: false, update: false, delete: false, ownOnly: false };
                                      updatedPrivs[ck].view = e.target.checked;
                                    });
                                  }
                                  setSelectedRole({ ...selectedRole, privileges: updatedPrivs });
                                }}
                                className="rounded bg-slate-900 border-slate-700 text-emerald-500"
                              />
                              {action === 'ownOnly' ? 'View Own' : action}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                    if (item.type === 'group') {
                      return (
                        <div key={item.key} className="space-y-1.5">
                          {renderPrivRow(item.key, item.label, false)}
                          <p className="text-[10px] text-slate-500 pl-4">Sections under {item.label}:</p>
                          {item.children.map(ch => renderPrivRow(ch.key, ch.label, true))}
                        </div>
                      );
                    }
                    return renderPrivRow(item.key, item.label, false);
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Order: View · View Own · Create · Update · Delete. Report sections: only the section View checkbox shows/hides that block. Turning View on a Report parent (e.g. Report · Sales) sets all its sections the same. Reports (all) opens every report tab but section boxes still control each block.</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveRole(selectedRole)} className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded">Save Privileges</button>
                <button onClick={() => handleDeleteRole(selectedRole.id)} className="py-2.5 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete Role</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Category</h4>
              <button onClick={() => setSelectedCategory(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Category Name</label><input type="text" value={selectedCategory.name} onChange={e => setSelectedCategory({...selectedCategory, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveCategory(selectedCategory)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                <button onClick={() => handleDeleteCategory(selectedCategory.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addExpenseCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Add New Expense Category</h4>
              <button onClick={() => setAddExpenseCategoryModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const name = e.target.catName.value;
              if (!name) return;
              const newCat = { id: `expcat-${Date.now()}`, name, status: 'Active' };
              try {
                const res = await apiFetch('/api/expense-categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newCat)
                });
                if (res.ok) {
                  setExpenseCategories([...expenseCategories, newCat]);
                  setAddExpenseCategoryModalOpen(false);
                } else {
                  alert('Failed to save expense category.');
                }
              } catch (err) { console.error(err); }
            }} className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Category Name</label><input type="text" name="catName" placeholder="e.g., Marketing" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <button type="submit" className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Expense Category</button>
            </form>
          </div>
        </div>
      )}

      {selectedExpenseCategory && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-55 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Expense Category</h4>
              <button onClick={() => setSelectedExpenseCategory(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Category Name</label><input type="text" value={selectedExpenseCategory.name} onChange={e => setSelectedExpenseCategory({...selectedExpenseCategory, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select value={selectedExpenseCategory.status || 'Active'} onChange={e => setSelectedExpenseCategory({...selectedExpenseCategory, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveExpenseCategory(selectedExpenseCategory)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                <button onClick={() => handleDeleteExpenseCategory(selectedExpenseCategory.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItemStatus && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Item Status</h4>
              <button onClick={() => setSelectedItemStatus(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Status Name</label><input type="text" value={selectedItemStatus.name} onChange={e => setSelectedItemStatus({...selectedItemStatus, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div>
                <label className="text-slate-400 block mb-1">Allows Sale?</label>
                <select value={selectedItemStatus.canSell ? 'yes' : 'no'} onChange={e => setSelectedItemStatus({...selectedItemStatus, canSell: e.target.value === 'yes'})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="yes">Yes (Ready for Sale)</option>
                  <option value="no">No (Restricts Sale)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveItemStatus(selectedItemStatus)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                <button onClick={() => handleDeleteItemStatus(selectedItemStatus.id)} className="py-2 px-4 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {employeeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">{selectedEmployee ? 'Edit Employee' : 'Add Employee'}</h4>
              <button onClick={() => { setEmployeeModalOpen(false); setSelectedEmployee(null); }} className="text-slate-400">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2"><label className="text-slate-400 block mb-1">Full Name *</label><input type="text" value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Position</label><input type="text" value={employeeForm.position} onChange={e => setEmployeeForm({...employeeForm, position: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Department</label>
                <select value={employeeForm.department} onChange={e => setEmployeeForm({...employeeForm, department: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(hrSettings.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="text-slate-400 block mb-1">Phone</label><input type="text" value={employeeForm.phone} onChange={e => setEmployeeForm({...employeeForm, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Email</label><input type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Hire Date</label><input type="date" value={employeeForm.hireDate} onChange={e => setEmployeeForm({...employeeForm, hireDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Basic Salary</label><input type="number" value={employeeForm.salary} onChange={e => setEmployeeForm({...employeeForm, salary: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">National ID</label><input type="text" value={employeeForm.nationalId} onChange={e => setEmployeeForm({...employeeForm, nationalId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Bank Account</label><input type="text" value={employeeForm.bankAccount} onChange={e => setEmployeeForm({...employeeForm, bankAccount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Bank Name</label><input type="text" value={employeeForm.bankName || ''} onChange={e => setEmployeeForm({...employeeForm, bankName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="e.g. Equity, KCB, Co-op" /></div>
              <div><label className="text-slate-400 block mb-1">Leave Balance (days)</label><input type="number" value={employeeForm.leaveBalance} onChange={e => setEmployeeForm({...employeeForm, leaveBalance: parseFloat(e.target.value) || 0})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Reports To (Manager)</label>
                <select value={employeeForm.managerId || ''} onChange={e => setEmployeeForm({...employeeForm, managerId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="">— No manager (top level) —</option>
                  {employees.filter(e => e.id !== selectedEmployee?.id && e.id !== employeeForm.id).map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.position || e.department || 'Staff'})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">This manager approves leave for this employee. Match manager name to a login user for non-admin approval.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Linked User (optional)</label>
                <select value={employeeForm.userId || ''} onChange={e => setEmployeeForm({...employeeForm, userId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="">— No login user —</option>
                  {(users || []).filter(u => u.name !== 'Sir Jycob').map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Optional. Links this employee to a system user so leave requests auto-fill for that login.</p>
              </div>
              <div><label className="text-slate-400 block mb-1">Status</label>
                <select value={employeeForm.status} onChange={e => setEmployeeForm({...employeeForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>
            <button onClick={() => {
              if (!employeeForm.name) { alert('Name is required'); return; }
              const emp = {
                id: selectedEmployee?.id || `emp-${Date.now()}`,
                name: employeeForm.name,
                position: employeeForm.position || '',
                department: employeeForm.department || '',
                phone: employeeForm.phone || '',
                email: employeeForm.email || '',
                hireDate: employeeForm.hireDate || '',
                salary: parseFloat(employeeForm.salary) || 0,
                status: employeeForm.status || 'Active',
                nationalId: employeeForm.nationalId || '',
                bankAccount: employeeForm.bankAccount || '',
                bankName: employeeForm.bankName || '',
                leaveBalance: parseFloat(employeeForm.leaveBalance) ?? 21,
                managerId: employeeForm.managerId || '',
                userId: employeeForm.userId || '',
                createdBy: selectedEmployee?.createdBy || currentUser?.name || currentUser?.id || ''
              };
              handleSaveEmployee(emp);
            }} className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded text-xs">Save Employee</button>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">New Leave Request</h4>
              <button onClick={() => setLeaveModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Employee *</label>
                {(isAdminUser || canUpdate('hr') || canUpdate('employees')) ? (
                  <select value={leaveForm.employeeId} onChange={e => setLeaveForm({...leaveForm, employeeId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                    <option value="">Select employee</option>
                    {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name} (Bal: {e.leaveBalance ?? 21}d)</option>)}
                  </select>
                ) : (
                  <div className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                    {currentEmployeeRecord ? `${currentEmployeeRecord.name} (Bal: ${currentEmployeeRecord.leaveBalance ?? 21}d)` : (currentUser?.name || 'Your employee profile is not linked')}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Leave Type</label>
                <select value={leaveForm.leaveType} onChange={e => setLeaveForm({...leaveForm, leaveType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(hrSettings.leaveTypes || ['Annual']).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-slate-400 block mb-1">Start Date *</label><input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-1">End Date *</label><input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              </div>
              {leaveForm.startDate && leaveForm.endDate && (
                <p className="text-emerald-400 text-[11px]">Duration: {calcLeaveDays(leaveForm.startDate, leaveForm.endDate)} day(s)</p>
              )}
              <div><label className="text-slate-400 block mb-1">Reason</label><textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white h-16" /></div>
              <button onClick={handleSaveLeave} className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded">Submit Leave Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {/* Sales Return Modal */}
      {salesReturnModalOpen && salesReturnSale && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Sales Return — #{salesReturnSale.id}</h4>
              <button onClick={() => { setSalesReturnModalOpen(false); setSalesReturnSale(null); }} className="text-slate-400">✕</button>
            </div>
            <p className="text-[11px] text-slate-400">Select quantities to return (partial or full). Inventory will increase. Refund is paid out via Cash or M-Pesa.</p>
            <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {(salesReturnSale.items || []).map((it, idx) => {
                const maxQ = Math.max(0, (Number(it.qty) || 0) - (Number(it.returnedQty) || 0));
                return (
                  <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="flex-1">
                      <p className="text-white font-semibold">{it.name}</p>
                      <p className="text-[10px] text-slate-500">{shopProfile.currency} {it.price} × sold {it.qty || 1}{it.returnedQty ? ` (returned ${it.returnedQty})` : ''}</p>
                    </div>
                    <input type="number" min="0" max={maxQ} value={salesReturnQtys[idx] ?? 0} disabled={maxQ === 0}
                      onChange={e => setSalesReturnQtys({ ...salesReturnQtys, [idx]: Math.min(maxQ, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-center" />
                  </div>
                );
              })}
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Refund method</label>
              <select value={salesReturnMethod} onChange={e => setSalesReturnMethod(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs">
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Condition of returned goods</label>
              <select value={salesReturnDisposition} onChange={e => setSalesReturnDisposition(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs">
                <option value="Saleable">Accepted / saleable — return to inventory</option>
                <option value="Damaged/Rejected">Damaged / rejected — do not return to saleable inventory</option>
              </select>
            </div>
            <div className="text-xs text-amber-400 font-semibold">
              Refund estimate: {shopProfile.currency}{' '}
              {(salesReturnSale.items || []).reduce((s, it, idx) => {
                const ret = Math.min(Math.max(0, parseInt(salesReturnQtys[idx], 10) || 0), Math.max(0, (Number(it.qty) || 0) - (Number(it.returnedQty) || 0)));
                return s + (it.price || 0) * ret;
              }, 0).toLocaleString()}
            </div>
            <button onClick={handleProcessSalesReturn} className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs">Process Sales Return</button>
          </div>
        </div>
      )}

      {/* Purchase Return Modal */}
      {purchaseReturnModalOpen && purchaseReturnPO && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Purchase Return — {purchaseReturnPO.id}</h4>
              <button onClick={() => { setPurchaseReturnModalOpen(false); setPurchaseReturnPO(null); }} className="text-slate-400">✕</button>
            </div>
            <p className="text-[11px] text-slate-400">Return received items to supplier. Inventory decreases and PO amount / balance due are reduced.</p>
            <div className="text-xs space-y-1 bg-slate-950 p-3 rounded border border-slate-800">
              <p><span className="text-slate-400">Supplier:</span> {purchaseReturnPO.supplierName}</p>
              <p className="text-[10px] text-slate-500">Select how many units of each item to return.</p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(purchaseReturnPO._returnLines || [{ itemId: purchaseReturnPO.itemId, itemName: purchaseReturnPO.itemName, quantity: purchaseReturnPO.quantity, cost: purchaseReturnPO.cost, returnedQty: purchaseReturnPO.returnedQty || 0 }]).map((ln, idx) => {
                const max = Math.max(0, (Number(ln.quantity) || 0) - (Number(ln.returnedQty) || 0));
                return (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-white font-semibold">{ln.itemName || ln.itemId || 'Item'}</span>
                      <span className="text-slate-400">{shopProfile.currency} {(Number(ln.cost) || 0).toLocaleString()}/unit</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Ordered: {ln.quantity} · Returned: {ln.returnedQty || 0} · Max now: {max}</p>
                    <input type="number" min="0" max={max} value={purchaseReturnLineQtys[idx] ?? 0}
                      onChange={e => setPurchaseReturnLineQtys({ ...purchaseReturnLineQtys, [idx]: e.target.value })}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      disabled={max <= 0} />
                  </div>
                );
              })}
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Supplier settlement</label>
              <select value={purchaseReturnSettlement} onChange={e => setPurchaseReturnSettlement(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs">
                <option value="Supplier Credit Note">Supplier credit note for a future purchase</option>
                <option value="Cash/M-Pesa/Bank Refund">Cash / M-Pesa / bank refund actually received</option>
              </select>
              {purchaseReturnSettlement === 'Cash/M-Pesa/Bank Refund' && <select value={purchaseReturnRefundMethod} onChange={e => setPurchaseReturnRefundMethod(e.target.value)} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs"><option>Cash</option><option>M-Pesa</option><option>Bank</option><option>Bank Transfer</option></select>}
            </div>
            <button onClick={handleProcessPurchaseReturn} className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs">Process Purchase Return</button>
          </div>
        </div>
      )}

      
      {/* Leave edit modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Edit Leave Request</h4>
              <button onClick={() => setSelectedLeave(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Employee</label>
                <select value={selectedLeave.employeeId} onChange={e => setSelectedLeave({...selectedLeave, employeeId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Leave Type</label>
                <select value={selectedLeave.leaveType} onChange={e => setSelectedLeave({...selectedLeave, leaveType: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  {(hrSettings.leaveTypes || ['Annual','Sick','Unpaid','Maternity']).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-slate-400 block mb-1">Start</label><input type="date" value={selectedLeave.startDate || ''} onChange={e => setSelectedLeave({...selectedLeave, startDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
                <div><label className="text-slate-400 block mb-1">End</label><input type="date" value={selectedLeave.endDate || ''} onChange={e => setSelectedLeave({...selectedLeave, endDate: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              </div>
              <div><label className="text-slate-400 block mb-1">Days</label><input type="number" value={calcLeaveDays(selectedLeave.startDate, selectedLeave.endDate)} readOnly className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Reason</label><input type="text" value={selectedLeave.reason || ''} onChange={e => setSelectedLeave({...selectedLeave, reason: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div>
                <label className="text-slate-400 block mb-1">Status</label>
                <select value={selectedLeave.status} onChange={e => setSelectedLeave({...selectedLeave, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleSaveLeaveRequest(selectedLeave)} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save Changes</button>
                <button onClick={() => handleDeleteLeaveRequest(selectedLeave.id)} className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment method modal */}
                  {selectedBranch && (
              <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[70] p-4" onClick={() => setSelectedBranch(null)}>
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm">Edit location</h4>
                    <button type="button" onClick={() => setSelectedBranch(null)} className="text-slate-400">✕</button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Name</label>
                      <input value={selectedBranch.name || ''} onChange={e => setSelectedBranch({ ...selectedBranch, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Address</label>
                      <input value={selectedBranch.address || ''} onChange={e => setSelectedBranch({ ...selectedBranch, address: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Phone</label>
                      <input value={selectedBranch.phone || ''} onChange={e => setSelectedBranch({ ...selectedBranch, phone: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <label className="flex items-center gap-2 text-slate-300">
                      <input type="checkbox" checked={!!selectedBranch.isDefault} onChange={e => setSelectedBranch({ ...selectedBranch, isDefault: e.target.checked })} />
                      Default location
                    </label>
                    <p className="text-[10px] text-slate-500">Uses shared master data from the parent business. Only stock/transactions are location-specific.</p>
                    <div className="flex gap-2 pt-2">
                      <button type="button" className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded" onClick={async () => {
                        const res = await apiFetch('/api/branches/' + selectedBranch.id, { method: 'PUT', body: JSON.stringify(selectedBranch) });
                        if (!res.ok) { const d = await res.json().catch(() => ({})); return alert(d.error || 'Save failed'); }
                        const r2 = await apiFetch('/api/branches');
                        if (r2.ok) { const x = await r2.json(); setBranches(x.branches || []); setMaxBranches(x.maxBranches || maxBranches); }
                        setSelectedBranch(null);
                      }}>Save</button>
                      <button type="button" className="py-2 px-4 bg-slate-800 text-white font-bold rounded" onClick={() => setSelectedBranch(null)}>Close</button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {paymentMethodModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">{selectedPaymentMethod ? 'Edit Payment Method' : 'Add Payment Method'}</h4>
              <button onClick={() => setPaymentMethodModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Name *</label><input type="text" value={paymentMethodForm.name} onChange={e => setPaymentMethodForm({...paymentMethodForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="e.g. Bank Transfer" /></div>
              <div><label className="text-slate-400 block mb-1">Account Starting Balance</label><input type="number" value={paymentMethodForm.startingBalance} onChange={e => setPaymentMethodForm({...paymentMethodForm, startingBalance: e.target.value, currentBalance: paymentMethodForm.currentBalance === '' || paymentMethodForm.currentBalance == null ? e.target.value : paymentMethodForm.currentBalance})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">Current Balance</label><input type="number" value={paymentMethodForm.currentBalance} onChange={e => setPaymentMethodForm({...paymentMethodForm, currentBalance: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /><p className="text-[10px] text-slate-500 mt-1">Editable running balance for this account</p></div>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (!paymentMethodForm.name) { alert('Name required'); return; }
                  if (selectedPaymentMethod) {
                    persistPaymentMethods(paymentMethods.map(p => p.id === selectedPaymentMethod.id ? { ...p, name: paymentMethodForm.name, startingBalance: parseFloat(paymentMethodForm.startingBalance) || 0, currentBalance: parseFloat(paymentMethodForm.currentBalance) || 0 } : p));
                  } else {
                    persistPaymentMethods([...paymentMethods, { id: `pm-${Date.now()}`, name: paymentMethodForm.name, startingBalance: parseFloat(paymentMethodForm.startingBalance) || 0, currentBalance: parseFloat(paymentMethodForm.currentBalance) || parseFloat(paymentMethodForm.startingBalance) || 0 }]);
                  }
                  setPaymentMethodModalOpen(false);
                }} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save</button>
                {selectedPaymentMethod && (
                  <button onClick={() => {
                    if (!confirm('Delete this payment method?')) return;
                    persistPaymentMethods(paymentMethods.filter(p => p.id !== selectedPaymentMethod.id));
                    setPaymentMethodModalOpen(false);
                  }} className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales term modal */}
      {salesTermModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">{selectedSalesTerm ? 'Edit Sales Term' : 'Add Sales Term'}</h4>
              <button onClick={() => setSalesTermModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><label className="text-slate-400 block mb-1">Name *</label><input type="text" value={salesTermForm.name} onChange={e => setSalesTermForm({...salesTermForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="e.g. Cash On Delivery" /></div>
              <div>
                <label className="text-slate-400 block mb-1">Sale Type</label>
                <select value={salesTermForm.type} onChange={e => setSalesTermForm({...salesTermForm, type: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="Paid">Paid</option>
                  <option value="Credit">Credit</option>
                  <option value="Layby">Layby</option>
                </select>
              </div>
              <div><label className="text-slate-400 block mb-1">Days (for Credit / Layby)</label><input type="number" min="0" value={salesTermForm.days} onChange={e => setSalesTermForm({...salesTermForm, days: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" /></div>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (!salesTermForm.name) { alert('Name required'); return; }
                  if (selectedSalesTerm) {
                    persistSalesTerms(salesTerms.map(t => t.id === selectedSalesTerm.id ? { ...t, name: salesTermForm.name, type: salesTermForm.type, days: parseInt(salesTermForm.days, 10) || 0 } : t));
                  } else {
                    persistSalesTerms([...salesTerms, { id: `sterm-${Date.now()}`, name: salesTermForm.name, type: salesTermForm.type, days: parseInt(salesTermForm.days, 10) || 0 }]);
                  }
                  setSalesTermModalOpen(false);
                }} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded">Save</button>
                {selectedSalesTerm && (
                  <button onClick={() => {
                    if (!confirm('Delete this sales term?')) return;
                    persistSalesTerms(salesTerms.filter(t => t.id !== selectedSalesTerm.id));
                    setSalesTermModalOpen(false);
                  }} className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded">Delete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPayroll && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4 print:bg-white print:static">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto print:bg-white print:text-black print:border-0 print:shadow-none">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 print:border-slate-300">
              <h4 className="font-bold text-white text-sm print:text-black">Payslip — {selectedPayroll.employeeName}</h4>
              <button onClick={() => setSelectedPayroll(null)} className="text-slate-400 print:hidden">✕</button>
            </div>
            <div id="printable-payroll" className="space-y-3 text-xs">
              <div className="text-center border-b-2 border-slate-700 pb-3 mb-3 print:border-black">
                <h2 className="text-xl font-bold text-white print:text-black">{shopProfile.name}</h2>
                {shopProfile.tagline && <p className="text-slate-300 print:text-black mt-1">{shopProfile.tagline}</p>}
                <p className="text-slate-300 print:text-black mt-1">{shopProfile.location}{shopProfile.phone ? ` | ${shopProfile.phone}` : ''}</p>
                <h3 className="font-bold text-base uppercase tracking-wide mt-3 text-white print:text-black">PAYSLIP</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded border border-slate-800 print:bg-white print:border-slate-300">
                <div><span className="text-slate-400 block print:text-slate-600">Employee</span><strong className="text-white print:text-black">{selectedPayroll.employeeName}</strong></div>
                <div><span className="text-slate-400 block print:text-slate-600">Period</span><strong className="text-emerald-400 print:text-black">{selectedPayroll.period}</strong></div>
                <div><span className="text-slate-400 block print:text-slate-600">Status</span><strong className="text-white print:text-black">{selectedPayroll.status}</strong></div>
                <div><span className="text-slate-400 block print:text-slate-600">Paid Date</span><strong className="text-white print:text-black">{selectedPayroll.paidDate || '—'}</strong></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Basic Salary</span>
                  <input type="number" value={selectedPayroll.basicSalary} readOnly={!(isAdminUser || canUpdate('payroll'))} onChange={e => setSelectedPayroll({...selectedPayroll, basicSalary: parseFloat(e.target.value)||0, netPay: (parseFloat(e.target.value)||0) + (parseFloat(selectedPayroll.allowances)||0) - (parseFloat(selectedPayroll.deductions)||0)})} className="w-32 bg-slate-950 border border-slate-700 rounded p-1 text-right text-white print:border-0 print:bg-transparent print:text-black" />
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Allowances</span>
                  <input type="number" value={selectedPayroll.allowances} readOnly={!(isAdminUser || canUpdate('payroll'))} onChange={e => setSelectedPayroll({...selectedPayroll, allowances: parseFloat(e.target.value)||0, netPay: (parseFloat(selectedPayroll.basicSalary)||0) + (parseFloat(e.target.value)||0) - (parseFloat(selectedPayroll.deductions)||0)})} className="w-32 bg-slate-950 border border-slate-700 rounded p-1 text-right text-white print:border-0 print:bg-transparent print:text-black" />
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Deductions</span>
                  <input type="number" value={selectedPayroll.deductions} readOnly={!(isAdminUser || canUpdate('payroll'))} onChange={e => setSelectedPayroll({...selectedPayroll, deductions: parseFloat(e.target.value)||0, netPay: (parseFloat(selectedPayroll.basicSalary)||0) + (parseFloat(selectedPayroll.allowances)||0) - (parseFloat(e.target.value)||0)})} className="w-32 bg-slate-950 border border-slate-700 rounded p-1 text-right text-white print:border-0 print:bg-transparent print:text-black" />
                </div>
                <div className="flex justify-between font-bold border-t border-slate-700 pt-2"><span className="text-white print:text-black">Net Pay</span>
                  <span className="text-emerald-400 print:text-black">{shopProfile.currency} {(selectedPayroll.netPay||0).toLocaleString()}</span>
                </div>
              </div>
              {selectedPayroll.notes && <p className="text-slate-400 text-[11px]">Notes: {selectedPayroll.notes}</p>}
              {(selectedPayroll.allowanceBreakdown || selectedPayroll.deductionBreakdown) && (
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                  {selectedPayroll.allowanceBreakdown && <div><p className="font-semibold text-emerald-400 mb-1">Allowances</p>{Object.entries(selectedPayroll.allowanceBreakdown).filter(([k,v]) => k !== '_otherSpec' && v !== '' && v != null && (typeof v === 'object' || (parseFloat(v) || 0) !== 0)).map(([k,v], index) => { const allowanceNames = ['Housing', 'Transport', 'Airtime', 'Bonus', 'Other']; const displayName = /^\d+$/.test(k) ? (allowanceNames[Number(k)] || `Allowance item ${Number(k) + 1}`) : k; const amount = typeof v === 'object' ? (v.amount ?? v.value ?? 0) : v; return <label key={k} className="flex items-center justify-between gap-2"><span>{displayName}</span><input type="number" value={amount ?? 0} readOnly={!(isAdminUser || canUpdate('payroll'))} onChange={e=>{const b={...(selectedPayroll.allowanceBreakdown||{}),[k]:parseFloat(e.target.value)||0};const total=Object.entries(b).filter(([key])=>key!=='_otherSpec').reduce((n,[,value])=>n+(parseFloat(typeof value === 'object' ? (value.amount ?? value.value) : value)||0),0);setSelectedPayroll({...selectedPayroll,allowanceBreakdown:b,allowances:total,netPay:(parseFloat(selectedPayroll.basicSalary)||0)+total-(parseFloat(selectedPayroll.deductions)||0)});}} className="w-20 bg-slate-950 border border-slate-700 rounded p-1 text-right text-white print:border-0 print:bg-transparent print:text-black" /></label>})}{selectedPayroll.allowanceBreakdown._otherSpec && <p>Other: {selectedPayroll.allowanceBreakdown._otherSpec}</p>}</div>}
                  {selectedPayroll.deductionBreakdown && <div><p className="font-semibold text-amber-400 mb-1">Deductions</p>{Object.entries(selectedPayroll.deductionBreakdown).filter(([k,v]) => k !== '_otherSpec' && v !== '' && v != null && (typeof v === 'object' || (parseFloat(v) || 0) !== 0)).map(([k,v]) => { const deductionNames = ['PAYE', 'NHL/Housing Levy', 'NSSF', 'SHA', 'Loan', 'Pension', 'Other']; const displayName = /^\d+$/.test(k) ? (deductionNames[Number(k)] || `Deduction item ${Number(k) + 1}`) : k; const amount = typeof v === 'object' ? (v.amount ?? v.value ?? 0) : v; return <label key={k} className="flex items-center justify-between gap-2"><span>{displayName}</span><input type="number" value={amount ?? 0} readOnly={!(isAdminUser || canUpdate('payroll'))} onChange={e=>{const b={...(selectedPayroll.deductionBreakdown||{}),[k]:parseFloat(e.target.value)||0};const total=Object.entries(b).filter(([key])=>key!=='_otherSpec').reduce((n,[,value])=>n+(parseFloat(typeof value === 'object' ? (value.amount ?? value.value) : value)||0),0);setSelectedPayroll({...selectedPayroll,deductionBreakdown:b,deductions:total,netPay:(parseFloat(selectedPayroll.basicSalary)||0)+(parseFloat(selectedPayroll.allowances)||0)-total});}} className="w-20 bg-slate-950 border border-slate-700 rounded p-1 text-right text-white print:border-0 print:bg-transparent print:text-black" /></label>})}{selectedPayroll.deductionBreakdown._otherSpec && <p>Other: {selectedPayroll.deductionBreakdown._otherSpec}</p>}</div>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2 print:hidden items-center">
              <label className="text-[10px] text-slate-400">Paper</label>
              <select id="payroll-paper-size" defaultValue="A4" className="bg-slate-950 border border-slate-700 rounded text-xs text-white px-2 py-1">
                <option value="A4">A4</option>
                <option value="A5">A5</option>
              </select>
              {(isAdminUser || canUpdate('payroll')) && <button onClick={() => {
                const updated = { ...selectedPayroll, netPay: (parseFloat(selectedPayroll.basicSalary)||0) + (parseFloat(selectedPayroll.allowances)||0) - (parseFloat(selectedPayroll.deductions)||0) };
                setPayrollRecords(payrollRecords.map(p => p.id === updated.id ? updated : p));
                setSelectedPayroll(updated);
                apiFetch(`/api/payroll/${updated.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) }).catch(() => {});
                alert('Payroll updated.');
              }} className="flex-1 py-2 bg-emerald-500 text-slate-950 font-bold rounded text-xs">Save Changes</button>}
              <button onClick={() => {
                const size = document.getElementById('payroll-paper-size')?.value || 'A4';
                const style = document.getElementById('payroll-print-page-style') || document.createElement('style');
                style.id = 'payroll-print-page-style';
                style.textContent = size === 'A5' ? '@media print { @page { size: A5; margin: 8mm; } }' : '@media print { @page { size: A4; margin: 12mm; } }';
                document.head.appendChild(style);
                window.print();
              }} className="px-4 py-2 bg-slate-700 text-white font-bold rounded text-xs flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Print</button>
              {(isAdminUser || canDelete('payroll')) && <button onClick={() => handleDeletePayroll(selectedPayroll.id)} className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded text-xs">Delete</button>}
              {selectedPayroll.status !== 'Paid' && (isAdminUser || canUpdate('payroll')) && (
                <>
                  <select value={payrollPayMethod} onChange={e => setPayrollPayMethod(e.target.value)} className="bg-slate-950 border border-slate-700 rounded text-xs text-white px-2">
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                  </select>
                  <button onClick={() => { handleMarkPayrollPaid(selectedPayroll, payrollPayMethod); setSelectedPayroll({...selectedPayroll, status: 'Paid', paidDate: new Date().toISOString().split('T')[0], paymentMethod: payrollPayMethod}); }} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 font-bold rounded text-xs">Mark Paid</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {payrollModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm">Generate Payroll</h4>
              <button onClick={() => setPayrollModalOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Employee *</label>
                <select value={payrollForm.employeeId} onChange={e => setPayrollForm({...payrollForm, employeeId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                  <option value="">Select employee</option>
                  {employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name} — {shopProfile.currency} {(parseFloat(e.salary)||0).toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Period (YYYY-MM) *</label>
                <input type="month" value={payrollForm.period} onChange={e => setPayrollForm({...payrollForm, period: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>

              <div className="border border-slate-700 rounded-lg p-3 space-y-2">
                <h5 className="text-emerald-400 font-bold text-[11px] uppercase tracking-wider">Allowances</h5>
                {['Housing', 'Transport', 'Airtime', 'Bonus', 'Other'].map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="w-28 text-slate-400 shrink-0">{key}</label>
                    <input type="number" min="0" value={payrollForm.allowanceItems?.[key] ?? 0} onChange={e => setPayrollForm({...payrollForm, allowanceItems: { ...payrollForm.allowanceItems, [key]: e.target.value }})} className="flex-1 bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                  </div>
                ))}
                {(parseFloat(payrollForm.allowanceItems?.Other) || 0) > 0 && (
                  <div>
                    <label className="text-slate-400 block mb-1">Other allowance — specify</label>
                    <input type="text" placeholder="Specify other allowance" value={payrollForm.allowanceOtherSpec || ''} onChange={e => setPayrollForm({...payrollForm, allowanceOtherSpec: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                  </div>
                )}
              </div>

              <div className="border border-slate-700 rounded-lg p-3 space-y-2">
                <h5 className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">Deductions</h5>
                {['PAYE', 'NHL/Housing Levy', 'NSSF', 'SHA', 'Loan', 'Pension', 'Other'].map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="w-36 text-slate-400 shrink-0">{key}</label>
                    <input type="number" min="0" value={payrollForm.deductionItems?.[key] ?? 0} onChange={e => setPayrollForm({...payrollForm, deductionItems: { ...payrollForm.deductionItems, [key]: e.target.value }})} className="flex-1 bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                  </div>
                ))}
                {(parseFloat(payrollForm.deductionItems?.Other) || 0) > 0 && (
                  <div>
                    <label className="text-slate-400 block mb-1">Other deduction — specify</label>
                    <input type="text" placeholder="Specify other deduction" value={payrollForm.deductionOtherSpec || ''} onChange={e => setPayrollForm({...payrollForm, deductionOtherSpec: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes</label>
                <input type="text" value={payrollForm.notes || ''} onChange={e => setPayrollForm({...payrollForm, notes: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              </div>
              <button onClick={handleGeneratePayroll} className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded">Create Payroll Record</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}