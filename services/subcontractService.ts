import { supabase } from './supabaseClient';
import { Subcontract, Subcontractor, SubcontractWorkOrder, SubcontractReceipt, SubcontractVoucher, SubcontractAccountEntry } from '../types';

const contractorFields: Record<string, string> = {
  name: 'name', contactPerson: 'contact_person', phone: 'phone', email: 'email', specialty: 'specialty',
  nationalId: 'national_id', vatNumber: 'vat_number', address: 'address', bankName: 'bank_name',
  bankAccountNumber: 'bank_account_number', notes: 'notes', rating: 'rating', status: 'status'
};
const contractFields: Record<string, string> = {
  number: 'number', subcontractorId: 'subcontractor_id', projectId: 'project_legacy_id', projectName: 'project_name',
  date: 'contract_date', totalAmount: 'total_amount', scopeOfWork: 'scope_of_work', startDate: 'start_date',
  endDate: 'end_date', status: 'status', notes: 'notes', progressPercentage: 'progress_percentage'
};
const workOrderFields: Record<string, string> = {
  subcontractId: 'subcontract_id', subcontractorId: 'subcontractor_id', number: 'number', title: 'title',
  scopeOfWork: 'scope_of_work', status: 'status', issueDate: 'issue_date', dueDate: 'due_date', assignedTo: 'assigned_to',
  estimatedAmount: 'estimated_amount', actualAmount: 'actual_amount', notes: 'notes', createdBy: 'created_by'
};
const receiptFields: Record<string, string> = {
  subcontractId: 'subcontract_id', workOrderId: 'work_order_id', number: 'number', type: 'type', status: 'status',
  receiptDate: 'receipt_date', description: 'description', quantity: 'quantity', amount: 'amount', receivedBy: 'received_by',
  acceptedBy: 'accepted_by', acceptedAt: 'accepted_at', rejectionReason: 'rejection_reason', notes: 'notes'
};
const voucherFields: Record<string, string> = {
  subcontractId: 'subcontract_id', certificateId: 'certificate_id', number: 'number', type: 'type', status: 'status', amount: 'amount',
  voucherDate: 'voucher_date', paymentMethod: 'payment_method', referenceNumber: 'reference_number', description: 'description',
  approvedBy: 'approved_by', paidAt: 'paid_at'
};
const decode = (row: any, fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column]]));
async function checked(query: any) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
export const subcontractService = {
  async load(company: string) {
    const [contractors, contracts, certificates, attachments] = await Promise.all(
      ['subcontractors', 'subcontracts', 'subcontract_certificates', 'subcontract_attachments'].map(table =>
        checked(supabase.from(table).select('*').eq('company_id', company).order('created_at', { ascending: false }))));
    return {
      subcontractors: contractors.map((r: any) => ({ ...decode(r, contractorFields), id: r.id, createdAt: r.created_at, updatedAt: r.updated_at })) as Subcontractor[],
      subcontracts: contracts.map((r: any) => ({
        ...decode(r, contractFields), id: r.id, updatedAt: r.updated_at,
        totalAmount: Number(r.total_amount), progressPercentage: Number(r.progress_percentage),
        subcontractorName: contractors.find((s: any) => s.id === r.subcontractor_id)?.name || '',
        payments: certificates.filter((p: any) => p.subcontract_id === r.id).map((p: any) => ({
          id: p.id, subcontractId: p.subcontract_id, amount: Number(p.net_payable), description: p.description,
          dueDate: p.due_date, status: p.status, paymentMethod: p.payment_method, paymentDate: p.payment_date,
          referenceNumber: p.reference_number, progressPercentage: p.progress_percentage == null ? undefined : Number(p.progress_percentage),
          notes: p.notes, engineerApprovedAt: p.engineer_approved_at, financeApprovedAt: p.finance_approved_at, updatedAt: p.updated_at
        })),
        attachments: attachments.filter((a: any) => a.subcontract_id === r.id).map((a: any) => ({
          id: a.id, name: a.file_name, url: '', storagePath: a.object_path,
          type: a.mime_type === 'application/pdf' ? 'pdf' : 'image', date: a.created_at
        }))
      })) as Subcontract[]
    };
  },
  async loadDocuments(company: string) {
    const [orders, receipts, vouchers] = await Promise.all([
      checked(supabase.from('subcontract_work_orders').select('*').eq('company_id', company).order('issue_date', { ascending: false })),
      checked(supabase.from('subcontract_receipts').select('*').eq('company_id', company).order('receipt_date', { ascending: false })),
      checked(supabase.from('subcontract_vouchers').select('*').eq('company_id', company).order('voucher_date', { ascending: false }))
    ]);
    return {
      workOrders: orders.map((r: any) => ({ ...decode(r, workOrderFields), id: r.id, companyId: r.company_id, estimatedAmount: Number(r.estimated_amount || 0), actualAmount: r.actual_amount == null ? undefined : Number(r.actual_amount), createdAt: r.created_at, updatedAt: r.updated_at })) as SubcontractWorkOrder[],
      receipts: receipts.map((r: any) => ({ ...decode(r, receiptFields), id: r.id, companyId: r.company_id, quantity: r.quantity == null ? undefined : Number(r.quantity), amount: r.amount == null ? undefined : Number(r.amount), createdAt: r.created_at, updatedAt: r.updated_at })) as SubcontractReceipt[],
      vouchers: vouchers.map((r: any) => ({ ...decode(r, voucherFields), id: r.id, companyId: r.company_id, amount: Number(r.amount), createdAt: r.created_at, updatedAt: r.updated_at })) as SubcontractVoucher[]
    };
  },
  async saveDocument(table: 'subcontract_work_orders' | 'subcontract_receipts' | 'subcontract_vouchers', company: string, value: any, existing?: any) {
    if (!value.subcontractId?.trim()) throw new Error('يجب اختيار عقد مقاول الباطن قبل حفظ المستند.');
    const fields = table === 'subcontract_work_orders' ? workOrderFields : table === 'subcontract_receipts' ? receiptFields : voucherFields;
    const payload = Object.fromEntries(Object.entries(fields).filter(([key]) => value[key] !== undefined)
      .map(([key, column]) => [column, value[key] === '' ? null : value[key]]));
    const query = existing
      ? supabase.from(table).update(payload).eq('company_id', company).eq('id', existing.id).eq('updated_at', value.updatedAt || existing.updatedAt)
      : supabase.from(table).insert({ ...payload, id: value.id || crypto.randomUUID(), company_id: company });
    const rows = await checked(query.select('id'));
    if (!rows?.length) throw new Error('تغير المستند أو لم يعد متاحاً. حدّث البيانات وأعد المحاولة.');
    return rows[0];
  },
  async removeDocument(table: 'subcontract_work_orders' | 'subcontract_receipts' | 'subcontract_vouchers', company: string, id: string) {
    const rows = await checked(supabase.from(table).delete().eq('company_id', company).eq('id', id).select('id'));
    if (!rows?.length) throw new Error('لم يُحذف المستند. تحقق من حالته وصلاحياتك.');
  },
  async accountStatement(company: string, subcontractId: string): Promise<SubcontractAccountEntry[]> {
    const [contractResult, certificates, payments, vouchers, ledgerEntries] = await Promise.all([
      checked(supabase.from('subcontracts').select('id,number,contract_date,total_amount').eq('company_id', company).eq('id', subcontractId).single()),
      checked(supabase.from('subcontract_certificates').select('id,certificate_number,description,due_date,net_payable').eq('company_id', company).eq('subcontract_id', subcontractId)),
      checked(supabase.from('subcontract_payments').select('id,amount,payment_date,reference_number').eq('company_id', company).eq('subcontract_id', subcontractId)),
      checked(supabase.from('subcontract_vouchers').select('id,number,description,voucher_date,amount,type,status').eq('company_id', company).eq('subcontract_id', subcontractId)),
      checked(supabase.from('subcontract_ledger_entries').select('id,entry_date,entry_type,reference_number,description,debit,credit').eq('company_id', company).eq('subcontract_id', subcontractId))
    ]);
    const rows: SubcontractAccountEntry[] = [];
    rows.push({ date: contractResult.contract_date, number: contractResult.number, type: 'contract', description: 'قيمة عقد مقاول الباطن', debit: Number(contractResult.total_amount), credit: 0, balance: 0, referenceId: contractResult.id });
    certificates.forEach((r: any) => rows.push({ date: r.due_date, number: r.certificate_number, type: 'certificate', description: r.description, debit: Number(r.net_payable), credit: 0, balance: 0, referenceId: r.id }));
    payments.forEach((r: any) => rows.push({ date: r.payment_date, number: r.reference_number || r.id, type: 'payment', description: 'سداد مستخلص مقاول', debit: 0, credit: Number(r.amount), balance: 0, referenceId: r.id }));
    const postedVoucherRefs = new Set((ledgerEntries || []).map((r: any) => r.reference_number));
    vouchers.filter((r: any) => r.status !== 'cancelled' && !postedVoucherRefs.has(r.number)).forEach((r: any) => rows.push({ date: r.voucher_date, number: r.number, type: 'voucher', description: r.description, debit: r.type === 'deduction' ? 0 : Number(r.amount), credit: r.type === 'deduction' ? Number(r.amount) : 0, balance: 0, referenceId: r.id }));
    (ledgerEntries || []).forEach((r: any) => rows.push({ date: r.entry_date, number: r.reference_number, type: r.entry_type === 'deduction' ? 'deduction' : 'voucher', description: r.description, debit: Number(r.debit || 0), credit: Number(r.credit || 0), balance: 0, referenceId: r.id }));
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
    let balance = 0; return rows.map(row => ({ ...row, balance: (balance += row.debit - row.credit) }));
  },
  async postVoucher(id: string) {
    return checked(supabase.rpc('post_subcontract_voucher', { p_voucher_id: id }));
  },
  async save(table: 'subcontractors' | 'subcontracts', company: string, value: any, existing?: any) {
    const fields = table === 'subcontractors' ? contractorFields : contractFields;
    const saveValue = table === 'subcontracts' && !existing
      ? { ...value, status: value.status || 'draft', progressPercentage: Number(value.progressPercentage || 0), scopeOfWork: value.scopeOfWork?.trim() || '' }
      : value;
    if (table === 'subcontracts' && !saveValue.scopeOfWork?.trim()) {
      throw new Error('نطاق العمل مطلوب قبل حفظ عقد مقاول الباطن.');
    }
    const payload = Object.fromEntries(Object.entries(fields).filter(([key]) => saveValue[key] !== undefined)
      .map(([key, column]) => [column, saveValue[key] === '' && !['name', 'specialty', 'scopeOfWork'].includes(key) ? null : saveValue[key]]));
    const query = existing
      ? supabase.from(table).update(payload).eq('company_id', company).eq('id', existing.id).eq('updated_at', value.updatedAt || existing.updatedAt)
      : supabase.from(table).insert({ ...payload, id: value.id, company_id: company });
    const rows = await checked(query.select('id'));
    if (!rows?.length) throw new Error('تغير السجل أو لم يعد متاحاً. حدّث البيانات وأعد المحاولة.');
  },
  async remove(table: string, company: string, id: string) {
    const rows = await checked(supabase.from(table).delete().eq('company_id', company).eq('id', id).select('id'));
    if (!rows?.length) throw new Error('لم يُحذف السجل. حدّث البيانات وتحقق من صلاحياتك.');
  },
  async certificate(action: string, id: string, data: Record<string, any> = {}) {
    return checked(supabase.rpc('subcontract_certificate_action', { p_action: action, p_id: id, p_data: data }));
  },
  async pay(id: string, details: any) {
    return checked(supabase.rpc('pay_subcontract_certificate', {
      p_certificate_id: id, p_payment_method: details.paymentMethod,
      p_payment_date: details.paymentDate, p_reference_number: details.referenceNumber || null
    }));
  },
  async upload(company: string, contractId: string, file: File, userId: string) {
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024)
      throw new Error('اختر PDF أو صورة PNG/JPEG/WebP بحجم لا يتجاوز 20 ميجابايت.');
    const id = crypto.randomUUID(), path = `${company}/${contractId}/${id}`;
    await checked(supabase.storage.from('subcontract-documents').upload(path, file));
    try {
      await checked(supabase.from('subcontract_attachments').insert({
        id, company_id: company, subcontract_id: contractId, file_name: file.name,
        object_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: userId
      }));
    } catch (error) {
      await supabase.storage.from('subcontract-documents').remove([path]);
      throw error;
    }
  },
  async attachmentUrl(path: string) {
    const data = await checked(supabase.storage.from('subcontract-documents').createSignedUrl(path, 300));
    return data.signedUrl as string;
  }
};
