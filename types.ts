
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
  doors: string;
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
  footerText: string;
  contactPhone: string;
  contactEmail: string;
  vatNumber?: string; // رقم الضريبة / السجل التجاري
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
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  customerName: string;
  customerVatNumber: string;
  items: QuoteItem[];
  status: 'paid' | 'pending' | 'overdue';
  contractId?: string; // ربط بالعقد
  contractNumber?: string; // رقم العقد للعرض
  paymentTermName?: string; // اسم الدفعة
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
  durationMonths: number;
  paymentTerms: PaymentTerm[]; 
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
}

export type PurchasePaymentType = 'credit' | 'cash' | 'transfer';

export interface PurchaseInvoice {
  id: string;
  number: string; // Invoice number from supplier
  supplierId: string;
  date: string;
  items: QuoteItem[]; // Reuse QuoteItem structure
  totalAmount: number;
  discountRate?: number; // Discount percentage (e.g., 5 for 5%)
  discountAmount?: number; // Calculated discount amount
  taxRate?: number; // Tax rate percentage (e.g., 15 for 15%)
  taxAmount: number;
  grandTotal: number;
  status: 'paid' | 'pending' | 'partial';
  paymentType?: PurchasePaymentType; // New Field: ajil, cash, transfer
  notes?: string;
  attachment?: string; // Legacy field
  attachments?: Attachment[]; // New multiple attachments field
  projectId?: string; // Link to Project
  projectName?: string; // Cache Project Name
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
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
  files?: ProjectFile[];
}

export interface ProjectPhase {
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
  notes: string;
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
  phone: string;
  email?: string;
  nationalId?: string; // New: IQAMA or ID
  status: EmployeeStatus; // New: Status
  basicSalary: number;
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
  // Actions
  | 'manage_users' // Create/Delete Users
  | 'delete_records' // General delete permission
  | 'approve_payments' // For managers/accountants
  | 'edit_company_settings';

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

export type SystemView = 'dashboard' | 'quotes' | 'installation_quotes' | 'invoices' | 'receipts' | 'contracts' | 'projects' | 'company_profile' | 'specs_manager' | 'customers' | 'purchases' | 'warranties' | 'calculator' | 'claims' | 'expenses' | 'hr' | 'smart_elevator' | 'users' | 'forms' | 'documents' | 'activity_log';

// --- PERMISSIONS CONFIGURATION ---
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [], // Admin gets everything by default in logic
  manager: [
    'view_dashboard', 'view_quotes', 'view_contracts', 'view_customers', 
    'view_invoices', 'view_receipts', 'view_expenses', 'view_purchases',
    'view_claims', 'view_projects', 'view_hr', 'view_smart_elevator',
    'view_reports', 'view_warranties', 'view_calculator', 'view_specs_manager',
    'view_documents', 'view_forms', 'view_company_profile', 'view_activity_log',
    'approve_payments', 'delete_records', 'edit_company_settings'
  ],
  sales: [
    'view_dashboard', 'view_customers', 'view_quotes', 'view_contracts', 
    'view_calculator', 'view_forms', 'view_warranties', 'view_smart_elevator'
  ],
  accountant: [
    'view_dashboard', 'view_invoices', 'view_receipts', 'view_expenses', 
    'view_purchases', 'view_claims', 'view_hr', 'view_contracts', 'view_documents'
  ],
  technician: [
    'view_dashboard', 'view_projects', 'view_smart_elevator', 'view_specs_manager', 
    'view_warranties', 'view_forms', 'view_documents'
  ]
};

// Export ALL Permissions for UI Generation
export const ALL_PERMISSIONS: {id: Permission, label: string, type: 'view' | 'action'}[] = [
    { id: 'view_dashboard', label: 'الرئيسية', type: 'view' },
    { id: 'view_customers', label: 'العملاء', type: 'view' },
    { id: 'view_quotes', label: 'عروض الأسعار', type: 'view' },
    { id: 'view_contracts', label: 'العقود', type: 'view' },
    { id: 'view_projects', label: 'المشاريع', type: 'view' },
    { id: 'view_invoices', label: 'الفواتير', type: 'view' },
    { id: 'view_receipts', label: 'سندات القبض', type: 'view' },
    { id: 'view_expenses', label: 'المصروفات', type: 'view' },
    { id: 'view_purchases', label: 'المشتريات', type: 'view' },
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
    
    { id: 'manage_users', label: 'إضافة/حذف مستخدمين', type: 'action' },
    { id: 'delete_records', label: 'حذف السجلات (فواتير/عقود)', type: 'action' },
    { id: 'approve_payments', label: 'اعتماد العمولات والصرف', type: 'action' },
    { id: 'edit_company_settings', label: 'تعديل إعدادات الشركة', type: 'action' },
];
