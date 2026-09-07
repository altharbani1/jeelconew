import { supabase } from './supabaseClient';
import { Subcontract, Subcontractor } from '../types';

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
  async save(table: 'subcontractors' | 'subcontracts', company: string, value: any, existing?: any) {
    const fields = table === 'subcontractors' ? contractorFields : contractFields;
    const payload = Object.fromEntries(Object.entries(fields).filter(([key]) => value[key] !== undefined)
      .map(([key, column]) => [column, value[key] === '' && !['name', 'specialty', 'scopeOfWork'].includes(key) ? null : value[key]]));
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
