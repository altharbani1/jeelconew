import type { Subcontract, SubcontractPayment, Subcontractor } from '../types';

export function validateSubcontractor(value: Partial<Subcontractor>) {
    if (!value.name?.trim() || !value.specialty?.trim()) throw new Error('اسم المقاول والتخصص مطلوبان');
}

export function validateSubcontract(value: Partial<Subcontract>) {
    if (!value.subcontractorId || !value.projectId || !value.number?.trim()) throw new Error('المقاول والمشروع ورقم العقد مطلوبة');
    if (!Number.isFinite(value.totalAmount) || value.totalAmount <= 0) throw new Error('قيمة العقد يجب أن تكون موجبة');
    if (!value.date || !value.startDate || !value.endDate || value.endDate < value.startDate) throw new Error('أدخل تواريخ صحيحة؛ الانتهاء لا يسبق البدء');
    if (!Number.isFinite(value.progressPercentage) || value.progressPercentage < 0 || value.progressPercentage > 100) throw new Error('نسبة الإنجاز بين 0 و100');
    if (!['draft', 'active', 'completed', 'cancelled'].includes(value.status)) throw new Error('حالة العقد غير صحيحة');
    if (value.status === 'completed' && value.progressPercentage !== 100) throw new Error('إكمال العقد يتطلب إنجاز 100%');
    let cents = 0;
    for (const p of value.payments || []) {
        validatePayment(p);
        cents += Math.round(p.amount * 100);
    }
    if (cents > Math.round(value.totalAmount * 100)) throw new Error('إجمالي الدفعات يتجاوز قيمة العقد');
}

export function validatePayment(p: Partial<SubcontractPayment>) {
    if (!p.description?.trim() || !p.dueDate) throw new Error('وصف الدفعة وتاريخ الاستحقاق مطلوبان');
    if (!Number.isFinite(p.amount) || p.amount <= 0 || Math.abs(p.amount * 100 - Math.round(p.amount * 100)) > 0.00001) throw new Error('مبلغ الدفعة موجب وبمنزلتين عشريتين كحد أقصى');
    if (p.progressPercentage != null && (!Number.isFinite(p.progressPercentage) || p.progressPercentage < 0 || p.progressPercentage > 100)) throw new Error('نسبة الإنجاز بين 0 و100');
}

export const effectiveContracts = (contracts: Subcontract[]) => contracts.filter(c => c.status === 'active' || c.status === 'completed');
export function subcontractStats(contracts: Subcontract[], today = new Date().toISOString().slice(0, 10)) {
    const effective = effectiveContracts(contracts);
    const payments = effective.flatMap(c => c.payments || []);
    const sum = (ps: SubcontractPayment[]) => ps.reduce((s, p) => s + Math.round(p.amount * 100), 0) / 100;
    return {
        activeContracts: contracts.filter(c => c.status === 'active').length,
        totalCommitted: effective.reduce((s, c) => s + Math.round(c.totalAmount * 100), 0) / 100,
        totalPaid: sum(payments.filter(p => p.status === 'paid')),
        totalPending: sum(payments.filter(p => p.status === 'approved' && p.dueDate <= today))
    };
}
