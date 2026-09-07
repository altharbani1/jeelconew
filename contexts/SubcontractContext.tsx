import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Subcontractor, Subcontract, SubcontractPayment } from '../types';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { subcontractService } from '../services/subcontractService';

function useSubcontractState() {
    const { user } = useSupabaseAuth();
    const company = user?.company_id;
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const locked = useRef(false), generation = useRef(0);
    const canManage = ['admin', 'manager'].includes(user?.role || '');
    const canEngineer = ['admin', 'manager', 'technician'].includes(user?.role || '');
    const canFinance = ['admin', 'manager', 'accountant'].includes(user?.role || '');
    const refresh = useCallback(async () => {
        const version = ++generation.current;
        if (!company) { setSubcontractors([]); setSubcontracts([]); return; }
        setSyncStatus('syncing');
        try {
            const data = await subcontractService.load(company);
            if (version !== generation.current) return;
            setSubcontractors(data.subcontractors); setSubcontracts(data.subcontracts);
            setSyncStatus('synced'); setError(null);
        } catch (e: any) {
            if (version !== generation.current) return;
            setSyncStatus('error'); setError(e.message || 'تعذر تحميل عقود الباطن'); throw e;
        }
    }, [company]);
    useEffect(() => {
        setSubcontractors([]); setSubcontracts([]);
        const reload = () => { void refresh().catch(() => {}); };
        reload(); window.addEventListener('focus', reload);
        const timer = window.setInterval(reload, 30000);
        return () => { ++generation.current; clearInterval(timer); window.removeEventListener('focus', reload); };
    }, [refresh]);
    const run = async (action: () => Promise<unknown>) => {
        if (locked.current) return false;
        locked.current = true; setBusy(true); setError(null);
        try {
            if (!company) throw new Error('سجّل الدخول بحساب سحابي مرتبط بشركة.');
            await action();
            try { await refresh(); } catch { setError('تم الحفظ، لكن تعذر تحديث العرض. اضغط تحديث.'); }
            window.dispatchEvent(new Event('subcontract-data-changed')); return true;
        } catch (e: any) { setError(e.message || 'تعذر تنفيذ العملية'); return false; }
        finally { locked.current = false; setBusy(false); }
    };
    const manage = () => { if (!canManage) throw new Error('هذه العملية تتطلب صلاحية مدير.'); };
    return {
        subcontractors, subcontracts, syncStatus, busy, error, canManage, canEngineer, canFinance, refresh,
        addSubcontractor: (data: Omit<Subcontractor, 'id' | 'createdAt'>) => run(async () => {
            manage(); await subcontractService.save('subcontractors', company!, { ...data, id: crypto.randomUUID() });
        }),
        updateSubcontractor: (id: string, data: Partial<Subcontractor>) => run(async () => {
            manage(); const old = subcontractors.find(s => s.id === id); if (!old) throw new Error('المقاول غير موجود');
            await subcontractService.save('subcontractors', company!, data, old);
        }),
        deleteSubcontractor: (id: string) => run(async () => { manage(); await subcontractService.remove('subcontractors', company!, id); }),
        addSubcontract: (data: Omit<Subcontract, 'id'>) => run(async () => {
            manage(); await subcontractService.save('subcontracts', company!, { ...data, id: crypto.randomUUID() });
        }),
        updateSubcontract: (id: string, data: Partial<Subcontract>) => run(async () => {
            manage(); const old = subcontracts.find(s => s.id === id); if (!old) throw new Error('العقد غير موجود');
            await subcontractService.save('subcontracts', company!, data, old);
        }),
        deleteSubcontract: (id: string) => run(async () => { manage(); await subcontractService.remove('subcontracts', company!, id); }),
        savePayment: (contractId: string, payment: Partial<SubcontractPayment>) => run(() =>
            subcontractService.certificate(payment.id ? 'update' : 'create', payment.id || crypto.randomUUID(), { ...payment, subcontractId: contractId })),
        deletePayment: (id: string) => run(() => subcontractService.certificate('delete', id)),
        approvePayment: (payment: SubcontractPayment) => run(() => subcontractService.certificate(payment.engineerApprovedAt ? 'finance' : 'engineer', payment.id)),
        payPayment: (payment: SubcontractPayment, details: any) => run(() => subcontractService.pay(payment.id, details)),
        uploadSubcontractAttachment: (id: string, file: File, _type: 'image' | 'pdf') => run(async () => {
            manage(); await subcontractService.upload(company!, id, file, user!.id);
        })
    };
}
const SubcontractContext = createContext<ReturnType<typeof useSubcontractState> | null>(null);
export const useSubcontract = () => {
    const context = useContext(SubcontractContext);
    if (!context) throw new Error('useSubcontract must be used within a SubcontractProvider'); return context;
};
export const SubcontractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SubcontractContext.Provider value={useSubcontractState()}>{children}</SubcontractContext.Provider>
);
