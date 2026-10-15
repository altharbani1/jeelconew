
export interface QuoteItem {
  id: string;
  description: string;
  details: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentTerm {
  name: string;
  percentage: number;
}

export interface QuoteDetails {
  number: string;
  date: string;
  customerName: string;
  customerAddress: string;
  projectName: string;
  validity: string;
  taxRate: number;
  warrantyInstallation: string;
  warrantyMotor: string;
  paymentTerms: PaymentTerm[];
  termsAndConditions?: string;
  features?: string[]; // القائمة القابلة للتعديل للمزايا
  handoverAndWarranty?: string; // صفحة التسليم والضمان القابلة للتعديل
  // New Fields
  firstPartyObligations?: string;
  secondPartyObligations?: string;
  worksDuration?: string;
  // Gallery Fields
  showGallery?: boolean;
  galleryImages?: {
    cabin?: string;
    buttons?: string;
    doors?: string;
  };
}

export interface TechnicalSpecs {
  elevatorType: string;
  capacity: string;
  speed: string;
  stops: string;
  driveType: string;
  controlSystem: string;
  powerSupply: string;
  cabin: string;
  doors: string; // Internal Doors
  externalDoors: string; // New field for External Doors
  machineRoom: string;
  rails: string;
  ropes: string;
  safety: string;
  emergency: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  iban: string;
}

export interface CompanyConfig {
  logo: string | null;
  stamp: string | null;
  headerTitle: string;
  headerSubtitle: string;
  taxNumber: string; // الرقم الضريبي للشركة
  footerText: string;
  contactPhone: string;
  contactEmail: string;
  bankAccounts: BankAccount[];
}

export interface ReceiptData {
  number: string;
  date: string;
  receivedFrom: string;
  amount: number;
  amountInWords: string;
  paymentMethod: 'cash' | 'check' | 'transfer';
  bankName?: string;
  checkNumber?: string;
  forReason: string;
  attachments?: Attachment[]; // Added attachments field
  invoiceId?: string;
  customerId?: string;
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  customerName: string;
  customerVatNumber: string;
  items: QuoteItem[];
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  customerId?: string;
  paidAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  grandTotal?: number;
  discountAmount?: number;
  isTaxInclusive?: boolean; // خيار شامل الضريبة
}

export interface ContractData {
  number: string;
  date: string;
  firstPartyName: string;
  secondPartyName: string;
  secondPartyId: string;
  location: string;
  totalValue: number;
  elevatorType: string;
  stops: number;
  elevatorCount: number; // Added field for elevator quantity
  internalDoorsCount?: number; // عدد الأبواب الداخلية
  externalDoorsCount?: number; // عدد الأبواب الخارجية
  accessControl?: string; // نظام التحكم بالوصول (اختياري)
  durationMonths: number;
  paymentTerms: PaymentTerm[];
  firstPartyObligations?: string;
  secondPartyObligations?: string;
  handoverAndWarranty?: string;
  worksDuration?: string;
}

// --- FINANCIAL CLAIM TYPES ---
export interface FinancialClaim {
  id: string;
  number: string;
  date: string;
  customerId: string;
  customerName: string;
  projectName: string;
  claimAmount: number;
  description: string; // وصف الدفعة (مثال: الدفعة الثانية - توريد المواد)
  notes?: string;
  status: 'pending' | 'paid' | 'cancelled';
}

// --- WARRANTY SYSTEM TYPES ---
export interface WarrantyData {
  id: string;
  certificateNumber: string;
  date: string;
  customerName: string;
  projectName: string;
  location: string;
  elevatorType: string;
  machineNumber: string; // Serial Number or Machine Type
  capacity: string;
  stops: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  periodYears: number;
  notes: string;
  status: 'active' | 'expired';
}

// --- PURCHASE SYSTEM TYPES ---

export interface Attachment {
  storagePath?: string;
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf';
  date: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  vatNumber?: string;
  notes?: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string; // Optional: can be generic or linked to a supplier
  name: string;
  partNumber?: string;
  purchasePrice: number;
  unit: string; // e.g., pcs, set, meter
  currentQuantity?: number; // Added for Inventory Management
}

export type InventoryTransactionType = 'in' | 'out';

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  date: string;
  type: InventoryTransactionType;
  quantity: number;
  referenceSource: 'purchase' | 'project' | 'manual';
  referenceId?: string; // e.g., Invoice Number or Project ID
  referenceName?: string; // e.g., Supplier Name or Project Name
  notes?: string;
}

export type PurchasePaymentType = 'credit' | 'cash' | 'transfer';

export interface PurchaseInvoice {
  id: string;
  number: string; // Invoice number from supplier
  supplierId: string;
  date: string;
  items: QuoteItem[]; // Reuse QuoteItem structure
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount?: number; // مجموع المبالغ المدفوعة على هذه الفاتورة
  status: 'paid' | 'pending' | 'partial';
  paymentType?: PurchasePaymentType;
  notes?: string;
  attachment?: string;
  attachments?: Attachment[];
  projectId?: string;
  projectName?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  invoiceId?: string; // ربط بفاتورة شراء محددة (اختياري)
  date: string;
  amount: number;
  method: 'cash' | 'transfer' | 'check';
  referenceNumber?: string;
  notes?: string;
}

// --- EXPENSE SYSTEM TYPES ---
export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  number: string; // PV-2024-001 (Payment Voucher)
  date: string;
  categoryId: string; // Rent, Salaries, Fuel, etc.
  categoryName: string;
  paidTo: string; // Person or Entity receiving money
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer' | 'check';
  bankName?: string; // New Field: Bank Name
  referenceNumber?: string; // Check No or Transfer ID
  attachments: Attachment[];
  projectId?: string; // Link to Project
  projectName?: string; // Cache Project Name
}

// --- SPECS DATABASE TYPES ---
export interface SpecCategory {
  id: keyof TechnicalSpecs;
  label: string;
  options: string[];
}

export interface SpecsDatabase {
  [key: string]: string[];
}


// --- PROJECT MANAGEMENT SYSTEM TYPES ---

export type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'stopped';
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'late';
export type ProjectType = 'residential' | 'commercial' | 'maintenance' | 'modernization';

export interface ProjectFile {
  id: string;
  name: string;
  url: string;
  type: 'contract' | 'invoice' | 'image' | 'other';
  date: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  startDate: string;
  endDate: string;
  totalExpectedCost: number;
  totalActualCost: number;
  status: ProjectStatus;
  notes: string;
  progress: number;
  clientName: string;
  attachments?: Attachment[];
  files?: ProjectFile[];
}

export interface ProjectPhase {
  notes?: string;
  id: string;
  projectId: string;
  name: string;
  phaseIndex: 0 | 1 | 2;
  status: PhaseStatus;
  startDate: string;
  endDate: string;
  expectedCost: number;
  actualCost: number;
  progressPercentage: number;
  assignedTo?: string; // Employee ID
  assignedToName?: string; // Employee Name
}

// --- SUBCONTRACTING SYSTEM TYPES ---
export interface Subcontractor {
  updatedAt?: string;
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  specialty: string; // e.g., 'تركيب', 'صيانة', 'أعمال مدنية'
  nationalId?: string; // أو رقم السجل التجاري
  vatNumber?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  status: 'active' | 'inactive';
}

export type SubcontractStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SubcontractPaymentStatus = 'pending' | 'approved' | 'paid';

export interface SubcontractPayment {
  archived?: boolean;
  engineerApprovedAt?: string;
  financeApprovedAt?: string;
  updatedAt?: string;
  id: string;
  subcontractId: string;
  amount: number;
  grossWorkValue?: number;
  vatAmount?: number;
  retentionAmount?: number;
  advanceRecoveryAmount?: number;
  deductionsAmount?: number;
  description: string; // e.g., 'الدفعة الأولى', 'إنجاز 50%'
  dueDate: string;
  status: SubcontractPaymentStatus;
  paymentMethod?: 'cash' | 'transfer' | 'check';
  paymentDate?: string;
  referenceNumber?: string;
  progressPercentage?: number; // لربط الدفعة بنسبة الإنجاز
  notes?: string;
}

export interface Subcontract {
  archived?: boolean;
  advancePaymentAmount?: number;
  updatedAt?: string;
  id: string;
  number: string; // e.g., SUB-2024-001
  subcontractorId: string;
  subcontractorName: string; // Cached
  projectId: string; // ربط بالمشروع الأساسي
  projectName?: string; // Cached
  date: string;
  totalAmount: number;
  scopeOfWork: string;
  startDate: string;
  endDate: string;
  status: SubcontractStatus;
  payments: SubcontractPayment[];
  attachments?: Attachment[];
  notes?: string;
  progressPercentage: number; // نسبة الإنجاز الكلية للمقاول
}

export type SubcontractWorkOrderStatus = 'draft' | 'issued' | 'in_progress' | 'completed' | 'cancelled';
export interface SubcontractWorkOrder {
  id: string;
  companyId: string;
  subcontractId: string;
  subcontractorId: string;
  number: string;
  title: string;
  scopeOfWork: string;
  status: SubcontractWorkOrderStatus;
  issueDate: string;
  dueDate?: string;
  assignedTo?: string;
  estimatedAmount: number;
  actualAmount?: number;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SubcontractReceiptStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';
export type SubcontractReceiptType = 'material' | 'work' | 'partial' | 'final';
export interface SubcontractReceipt {
  id: string;
  companyId: string;
  subcontractId: string;
  workOrderId?: string;
  number: string;
  type: SubcontractReceiptType;
  status: SubcontractReceiptStatus;
  receiptDate: string;
  description: string;
  quantity?: number;
  amount?: number;
  receivedBy?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SubcontractVoucherType = 'payment' | 'advance' | 'retention_release' | 'deduction';
export type SubcontractVoucherStatus = 'draft' | 'approved' | 'paid' | 'cancelled';
export interface SubcontractVoucher {
  archived?: boolean;
  id: string;
  companyId: string;
  subcontractId: string;
  certificateId?: string;
  number: string;
  type: SubcontractVoucherType;
  status: SubcontractVoucherStatus;
  amount: number;
  voucherDate: string;
  paymentDate?: string;
  paymentMethod?: 'cash' | 'transfer' | 'check';
  referenceNumber?: string;
  description: string;
  approvedBy?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubcontractAccountEntry {
  bucket?: 'payable' | 'advance' | 'retention';
  date: string;
  number: string;
  contractNumber?: string;
  projectName?: string;
  type: 'contract' | 'certificate' | 'payment' | 'voucher' | 'deduction';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  referenceId: string;
  certificateBreakdown?: {
    grossWorkValue: number;
    vatAmount: number;
    retentionAmount: number;
    advanceRecoveryAmount: number;
    deductionsAmount: number;
  };
}

// --- CUSTOMER MANAGEMENT TYPES ---
export type CustomerStatus = 'new' | 'contacted' | 'meeting_scheduled' | 'proposal_sent' | 'negotiation' | 'contracted' | 'lost';

export interface CustomerNote {
  id: string;
  date: string;
  content: string;
  type: 'note' | 'call' | 'meeting' | 'email';
  addedBy?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  type: 'individual' | 'company' | 'contractor';
  status: CustomerStatus;
  companyName?: string;
  vatNumber?: string;
  nationalId?: string;
  notes: CustomerNote[];
  createdAt: string;
  lastContactDate: string;
}

// --- HR & COMMISSION TYPES ---
export type EmployeeRole = 'sales' | 'technician' | 'admin' | 'manager';
export type EmployeeStatus = 'active' | 'vacation' | 'terminated';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  department?: string; // Optional for compatibility with legacy HR records
  phone: string;
  email?: string;
  nationalId?: string; // New: IQAMA or ID
  nationalIdType?: 'saudi' | 'non_saudi'; // Important for GOSI
  status: EmployeeStatus; // New: Status
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  annualLeaveBalance?: number; // Days per year
  joinDate: string;
  custodyItems: string[];
}

export interface Commission {
  id: string;
  employeeId: string;
  employeeName: string;
  contractId: string;
  contractNumber: string;
  contractValue: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid'; // Updated status flow
  date: string;
  approvalDate?: string;
  paymentDate?: string;
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // Format: YYYY-MM
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  commissions: number; // approved commissions for this month
  bonuses: number;     // manual bonuses
  gosiDeduction: number;
  loanDeduction: number;
  absenceDeduction: number;
  otherDeductions: number; // manual deductions
  netSalary: number;
  status: 'pending' | 'approved' | 'paid';
  notes?: string;
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  amount: number;
  installmentsCount: number;
  monthlyInstallment: number;
  remainingAmount: number;
  startDate: string; // YYYY-MM
  status: 'active' | 'paid';
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  absenceDays: number;
  delayHours: number;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick' | 'unpaid';
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface EmployeePayment {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer' | 'check';
  referenceNumber?: string;
  description: string; // e.g., 'راتب شهر مارس 2024' or 'سلفة'
  payrollId?: string; // Link to specific payroll record if applicable
  status: 'completed'; // Used for the HR side
}

// --- DOCUMENTS SYSTEM TYPES ---
export type DocumentCategory = 'gov' | 'contract' | 'employee' | 'project' | 'other';

export interface CompanyDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  issueDate?: string;
  expiryDate?: string; // Important for alerts
  referenceNumber?: string;
  fileUrl: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  notes?: string;
  createdAt: string;
}

// --- SMART ELEVATOR TYPES ---
export interface SmartElevator {
  id: string;
  qrCodeId: string; // Unique ID used in the QR
  projectName: string;
  location: string;
  type: string;
  machineNumber: string;
  installationDate: string;
  warrantyEndDate: string;
  lastMaintenance: string;
  nextMaintenance: string;
  status: 'active' | 'under_maintenance' | 'stopped' | 'out_of_service';
}

// --- ACTIVITY LOG TYPES ---
export interface UserLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;      // e.g., 'تسجيل دخول', 'إنشاء عرض سعر'
  details: string;     // e.g., 'عرض رقم Q-2024-001'
  module: string;      // e.g., 'المستخدمين', 'المبيعات'
  timestamp: string;   // ISO Date
}

// --- AUTH & USER TYPES ---
export type UserRole = 'admin' | 'sales' | 'accountant' | 'technician' | 'manager';

export type Permission =
  // Views
  | 'view_dashboard'
  | 'view_users'
  | 'view_company_profile'
  | 'view_specs_manager'
  | 'view_forms'
  | 'view_customers'
  | 'view_hr'
  | 'view_smart_elevator'
  | 'view_calculator'
  | 'view_quotes'
  | 'view_invoices'
  | 'view_claims'
  | 'view_receipts'
  | 'view_expenses'
  | 'view_contracts'
  | 'view_warranties'
  | 'view_projects'
  | 'view_purchases'
  | 'view_documents'
  | 'view_reports'
  | 'view_activity_log' // New permission
  | 'view_inventory'
  | 'view_maintenance' // New view for maintenance module
  | 'view_maintenance_reports'
  | 'view_subcontracts' // New view for subcontracting
  // Actions
  | 'manage_users' // Create/Delete Users
  | 'delete_records' // General delete permission
  | 'approve_payments' // For managers/accountants
  | 'edit_company_settings'
  | 'manage_maintenance_tickets'
  | 'manage_maintenance_schedule'
  | 'manage_maintenance_parts'
  | 'close_maintenance_tickets';

export interface User {
  id: string;
  username: string;
  password?: string; // Only used for verification, not displayed
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin?: string;
  customPermissions?: Permission[]; // New field for granular control
}

export enum AIRequestType {
  GENERATE_SPEC = 'GENERATE_SPEC',
  IMPROVE_TEXT = 'IMPROVE_TEXT'
}

export type SystemView = 'dashboard' | 'quotes' | 'invoices' | 'receipts' | 'contracts' | 'projects' | 'company_profile' | 'specs_manager' | 'customers' | 'purchases' | 'warranties' | 'calculator' | 'claims' | 'expenses' | 'hr' | 'smart_elevator' | 'users' | 'forms' | 'documents' | 'activity_log' | 'inventory' | 'financial_report' | 'maintenance' | 'subcontracts';

// --- PERMISSIONS CONFIGURATION ---
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [], // Admin gets everything by default in logic
  manager: [
    'view_dashboard', 'view_quotes', 'view_contracts', 'view_customers',
    'view_invoices', 'view_receipts', 'view_expenses', 'view_purchases',
    'view_claims', 'view_projects', 'view_hr', 'view_smart_elevator',
    'view_reports', 'view_warranties', 'view_calculator', 'view_specs_manager',
    'view_documents', 'view_forms', 'view_company_profile', 'view_activity_log',
    'approve_payments', 'delete_records', 'edit_company_settings', 'view_inventory',
    'view_maintenance', 'view_maintenance_reports', 'manage_maintenance_tickets', 'manage_maintenance_schedule', 'manage_maintenance_parts', 'close_maintenance_tickets', 'view_subcontracts'
  ],
  sales: [
    'view_dashboard', 'view_customers', 'view_quotes', 'view_contracts',
    'view_calculator', 'view_forms', 'view_warranties', 'view_smart_elevator'
  ],
  accountant: [
    'view_dashboard', 'view_invoices', 'view_receipts', 'view_expenses',
    'view_purchases', 'view_claims', 'view_hr', 'view_contracts', 'view_documents', 'view_inventory',
    'view_subcontracts', 'view_maintenance', 'view_maintenance_reports', 'manage_maintenance_parts'
  ],
  technician: [
    'view_dashboard', 'view_projects', 'view_smart_elevator', 'view_specs_manager',
    'view_warranties', 'view_forms', 'view_documents', 'view_maintenance', 'manage_maintenance_tickets', 'manage_maintenance_schedule'
  ]
};

// Export ALL Permissions for UI Generation
export const ALL_PERMISSIONS: { id: Permission, label: string, type: 'view' | 'action' }[] = [
  { id: 'view_dashboard', label: 'الرئيسية', type: 'view' },
  { id: 'view_customers', label: 'العملاء', type: 'view' },
  { id: 'view_quotes', label: 'عروض الأسعار', type: 'view' },
  { id: 'view_contracts', label: 'العقود', type: 'view' },
  { id: 'view_projects', label: 'المشاريع', type: 'view' },
  { id: 'view_invoices', label: 'الفواتير', type: 'view' },
  { id: 'view_purchases', label: 'المشتريات', type: 'view' },
  { id: 'view_inventory', label: 'المخزون', type: 'view' },
  { id: 'view_receipts', label: 'سندات القبض', type: 'view' },
  { id: 'view_expenses', label: 'المصروفات', type: 'view' },
  { id: 'view_claims', label: 'المطالبات', type: 'view' },
  { id: 'view_hr', label: 'الموارد البشرية', type: 'view' },
  { id: 'view_documents', label: 'الوثائق', type: 'view' },
  { id: 'view_forms', label: 'النماذج', type: 'view' },
  { id: 'view_warranties', label: 'الضمانات', type: 'view' },
  { id: 'view_smart_elevator', label: 'المصعد الذكي', type: 'view' },
  { id: 'view_calculator', label: 'الحاسبة', type: 'view' },
  { id: 'view_company_profile', label: 'ملف الشركة', type: 'view' },
  { id: 'view_specs_manager', label: 'قاعدة البيانات', type: 'view' },
  { id: 'view_users', label: 'إدارة المستخدمين', type: 'view' },
  { id: 'view_activity_log', label: 'سجل النشاطات', type: 'view' },
  { id: 'view_maintenance', label: 'الصيانة والتذاكر', type: 'view' },
  { id: 'view_maintenance_reports', label: 'تقارير الصيانة والتكلفة', type: 'view' },
  { id: 'view_subcontracts', label: 'عقود مقاولي الباطن', type: 'view' },

  { id: 'manage_users', label: 'إضافة/حذف مستخدمين', type: 'action' },
  { id: 'delete_records', label: 'حذف السجلات (فواتير/عقود)', type: 'action' },
  { id: 'approve_payments', label: 'اعتماد العمولات والصرف', type: 'action' },
  { id: 'edit_company_settings', label: 'تعديل إعدادات الشركة', type: 'action' },
  { id: 'manage_maintenance_tickets', label: 'إدارة تذاكر الصيانة', type: 'action' },
  { id: 'manage_maintenance_schedule', label: 'إدارة مواعيد الصيانة', type: 'action' },
  { id: 'manage_maintenance_parts', label: 'إدارة قطع غيار الصيانة والتكلفة', type: 'action' },
  { id: 'close_maintenance_tickets', label: 'إغلاق واعتماد تذاكر الصيانة', type: 'action' },
];

// --- Maintenance & Ticketing Types ---
export interface MaintenanceContract {
  id: string;
  number: string;          // e.g. MC-2023-001
  customerId: string;      // Related Customer ID
  startDate: string;
  endDate: string;
  visitsPerYear: number;   // Number of routine visits
  amount: number;          // Contract Value
  status: 'active' | 'expired' | 'cancelled';
  notes?: string;
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
/** Ticket workflow statuses. Legacy values remain valid for old records. */
export type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'awaiting_parts' | 'awaiting_customer' | 'resolved' | 'closed' | 'cancelled';
export type TicketType = 'routine' | 'emergency' | 'installation';

export type TicketEventType = 'created' | 'updated' | 'status_changed' | 'assigned' | 'commented' | 'resolved' | 'closed' | 'deleted';

export interface MaintenanceTicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  description: string;
  actorId?: string;
  actorName?: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MaintenanceTicket {
  id: string;
  number: string;          // e.g. TKT-2023-001
  customerId: string;
  contractId?: string;     // Optional if not under contract
  type: TicketType;
  priority: TicketPriority;
  description: string;
  technicianId?: string;   // Assigned from HR context
  visitId?: string;        // Linked field visit / work order
  reportedDate: string;
    /** Target date for resolving the ticket, calculated from its priority. */
    slaDueDate?: string;
  slaResponseDueDate?: string;
  slaResolutionDueDate?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  slaBreached?: boolean;
  resolvedDate?: string;
  status: TicketStatus;
  elevatorLocation: string; // Information on where the elevator is located inside the property
  /** Optional stable asset/elevator reference; old tickets may only have elevatorLocation. */
  assetId?: string;
  elevatorId?: string;
  elevatorNumber?: string;
  assetType?: 'elevator' | 'escalator' | 'other';
  resolution?: string;
  rootCause?: string;
  closedDate?: string;
  lastUpdatedAt?: string;
  notes?: string;
  /** قطع الغيار والعمل الميداني المسجلان أثناء معالجة التذكرة. */
  partsUsed?: MaintenancePartUsage[];
  laborCost?: number;
  actualDurationMinutes?: number;
  attachments?: Attachment[];
  customerSignature?: string;
}

/** Lifecycle of a planned field visit. `pending` is retained for legacy rows. */
export type VisitStatus = 'pending' | 'completed' | 'missed' | 'rescheduled' | 'cancelled';
export type MaintenanceVisitType = 'preventive' | 'corrective' | 'inspection' | 'emergency';
export type WorkOrderStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface MaintenanceVisit {
  id: string;
  contractId: string;
  scheduledDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  completedDate?: string; // YYYY-MM-DD
  technicianId?: string; // ID from HR
  ticketId?: string; // Linked fault ticket / work order
  /** Preventive/corrective classification used by ERP reporting. */
  visitType?: MaintenanceVisitType;
  /** Stable occurrence number within a contract schedule. */
  sequenceNumber?: number;
  /** Stable key used to reconcile recurring contract visits without duplicates. */
  recurrenceKey?: string;
  /** Expected effort; used when a visit has no explicit end time. */
  plannedDurationMinutes?: number;
  /** Actual field execution timestamps, kept separate from the scheduled slot. */
  actualStartAt?: string;
  actualEndAt?: string;
  /** Optional asset/elevator and site information for technician dispatch. */
  assetId?: string;
  location?: string;
  priority?: TicketPriority;
  rescheduleReason?: string;
  workOrderStatus?: WorkOrderStatus;
  workOrderNotes?: string;
  status: VisitStatus;
  notes?: string;
  partsUsed?: MaintenancePartUsage[];
  laborCost?: number;
  actualDurationMinutes?: number;
  attachments?: Attachment[];
  customerSignature?: string;
}

export interface MaintenancePartUsage {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  recordedAt: string;
  technicianId?: string;
  notes?: string;
}
