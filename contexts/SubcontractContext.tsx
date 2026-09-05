import React, { createContext, useContext, useState, useEffect } from 'react';
import { Subcontractor, Subcontract } from '../types';
import { useAuth } from './AuthContext';
import { useSupabaseAuth } from './SupabaseAuthContext';
import { useProject } from './ProjectContext';
import { loggerService } from '../services/loggerService';
import { subcontractService, SUBCONTRACT_BUCKET } from '../services/subcontractService';
import { supabase } from '../services/supabaseClient';
import { validateSubcontract, validateSubcontractor } from '../lib/subcontractValidation';

const SubcontractContext = createContext<ReturnType<typeof useSubcontractState> | null>(null);
export const useSubcontract = () => {
    const context = useContext(SubcontractContext);
    if (!context) throw new Error('SubcontractProvider required');
    return context;
};

function useSubcontractState() {
    const { currentUser, hasPermission } = useAuth();
    const { user: cloudUser } = useSupabaseAuth();
    const { setExpenses } = useProject();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const inFlight = React.useRef(false);
    const canManage = hasPermission('approve_payments') && ['admin', 'manager'].includes(cloudUser?.role || '');
    const canDelete = canManage && hasPermission('delete_records');
    const generation = React.useRef(0);
    const readVersion = React.useRef(0);

    const reload = async () => {
        const scope = generation.current;
        const version = ++readVersion.current;
        const [people, contracts, expenses] = await Promise.all([
            subcontractService.load('subcontractors'), subcontractService.load('subcontracts'),
            subcontractService.load('jilco_expenses_archive')
        ]);
        const company = await subcontractService.companyId();
        if (scope !== generation.current || version !== readVersion.current) return;
        try {
            localStorage.setItem(`subcontractors:${company}`, JSON.stringify(people));
            localStorage.setItem(`subcontracts:${company}`, JSON.stringify(contracts));
        } catch { /* Cloud data remains authoritative if the cache is full. */ }
        setSubcontractors(people);
        setSubcontracts(contracts);
        setExpenses(expenses);
    };
    useEffect(() => {
        generation.current++;
        let active = true;
        setSubcontractors([]); setSubcontracts([]);
        if (!hasPermission('view_subcontracts')) { setSyncStatus('synced'); return; }
        const refresh = () => reload().then(() => { if (active) setSyncStatus('synced'); }).catch(e => {
            if (active) { setSyncStatus('error'); setError(e.message); }
        });
        void refresh();
        // Every refresh reads the current company's rows; no unscoped offline cache.
        const channel = supabase.channel('subcontract-refresh').on('postgres_changes',
            { event: '*', schema: 'public', table: 'jilco_realtime_data' }, () => { if (active) void refresh(); }).subscribe();
        const onFocus = () => { if (active) void refresh(); };
        window.addEventListener('focus', onFocus);
        return () => { active = false; generation.current++; void supabase.removeChannel(channel); window.removeEventListener('focus', onFocus); };
    }, [currentUser?.id, cloudUser?.id, cloudUser?.company_id]);

    const perform = async (action: () => Promise<void>): Promise<boolean> => {
        if (inFlight.current) return false;
        if (!canManage) { setError('ليست لديك صلاحية إدارة عقود الباطن'); return false; }
        inFlight.current = true; setBusy(true); setError(''); setSyncStatus('syncing');
        try {
            await action();
            setSyncStatus('synced');
            // A read failure after commit must not suggest that retrying a payment is needed.
            try { await reload(); } catch { setError('تم الحفظ؛ تعذر تحديث العرض. أعد تحميل البيانات.'); }
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'تعذر الحفظ'); setSyncStatus('error');
            try { await reload(); } catch { /* Preserve the explicit failure message. */ }
            return false;
        } finally { inFlight.current = false; setBusy(false); }
    };
    const persist = async (collection: string, record: any, revision = 0) => {
        const saved = await subcontractService.mutate(collection, record.id, record, revision);
        const setter = collection === 'subcontracts' ? setSubcontracts : setSubcontractors;
        setter((prev: any[]) => [...prev.filter(r => r.id !== saved.id), saved]);
        loggerService.addLog(currentUser, 'حفظ', record.number || record.name, 'عقود مقاولي الباطن');
    };
    const addSubcontractor = (data: Omit<Subcontractor, 'id' | 'createdAt'>) => perform(async () => {
        validateSubcontractor(data);
        await persist('subcontractors', { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    });
    const updateSubcontractor = (id: string, updates: Partial<Subcontractor>) => perform(async () => {
        const previous = subcontractors.find(s => s.id === id);
        if (!previous) throw new Error('المقاول غير موجود');
        const value = { ...previous, ...updates, id };
        validateSubcontractor(value);
        await persist('subcontractors', value, updates.revision ?? previous.revision ?? 0);
    });
    const addSubcontract = (data: Omit<Subcontract, 'id'>) => perform(async () => {
        const value = { ...data, id: crypto.randomUUID(), payments: data.payments || [], progressPercentage: data.progressPercentage || 0 };
        validateSubcontract(value);
        await persist('subcontracts', value);
    });
    const updateSubcontract = (id: string, updates: Partial<Subcontract>) => perform(async () => {
        const previous = subcontracts.find(s => s.id === id);
        if (!previous) throw new Error('العقد غير موجود');
        const value = { ...previous, ...updates, id };
        validateSubcontract(value);
        await persist('subcontracts', value, updates.revision ?? previous.revision ?? 0);
    });
    const remove = (collection: string, id: string) => perform(async () => {
        if (!canDelete) throw new Error('ليست لديك صلاحية الحذف');
        const record = (collection === 'subcontracts' ? subcontracts : subcontractors).find(s => s.id === id);
        if (!record) throw new Error('السجل غير موجود');
        await subcontractService.mutate(collection, id, null, record.revision || 0);
        loggerService.addLog(currentUser, 'حذف', id, 'عقود مقاولي الباطن');
    });
    const uploadSubcontractAttachment = (id: string, file: File, type: 'image' | 'pdf') => perform(async () => {
        const contract = subcontracts.find(s => s.id === id);
        if (!contract) throw new Error('العقد غير موجود');
        if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('اختر PDF أو PNG أو JPEG أو WebP بحجم حتى 10 ميجابايت');
        const companyId = await subcontractService.companyId();
        const attachmentId = crypto.randomUUID();
        const path = `${companyId}/${id}/${attachmentId}`;
        const { error: uploadError } = await supabase.storage.from(SUBCONTRACT_BUCKET).upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        // Keep an uploaded orphan on an ambiguous network failure: deleting it could break a committed attachment.
        await persist('subcontracts', { ...contract, attachments: [...(contract.attachments || []), {
            id: attachmentId, name: file.name, url: '', storagePath: path, type, date: new Date().toISOString()
        }] }, contract.revision || 0);
    });
    const deleteSubcontractAttachment = (id: string, attachmentId: string) => perform(async () => {
        const contract = subcontracts.find(s => s.id === id);
        if (!contract) throw new Error('العقد غير موجود');
        // Unlink only; retain the private object for audit/backup and safe recovery.
        await persist('subcontracts', { ...contract, attachments: (contract.attachments || []).filter(a => a.id !== attachmentId) }, contract.revision || 0);
    });
    const exportData = async () => {
        try {
            const companyId = await subcontractService.companyId();
            const [people, contracts, expenses] = await Promise.all(['subcontractors', 'subcontracts', 'jilco_expenses_archive'].map(c => subcontractService.load(c)));
            const backup = { version: 1, companyId, exportedAt: new Date().toISOString(), subcontractors: people, subcontracts: contracts,
                expenses: expenses.filter(e => e.categoryId === 'subcontract_payment') };
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = 'subcontracts-backup.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { setError(e.message || 'تعذر التصدير'); }
    };
    return { subcontractors, subcontracts, syncStatus, error, busy, canManage, canDelete,
        addSubcontractor, updateSubcontractor, deleteSubcontractor: (id: string) => remove('subcontractors', id),
        addSubcontract, updateSubcontract, deleteSubcontract: (id: string) => remove('subcontracts', id),
        uploadSubcontractAttachment, deleteSubcontractAttachment, exportData,
        refresh: async () => { try { await reload(); setError(''); setSyncStatus('synced'); } catch(e) { setError(e.message); setSyncStatus('error'); } } };
}
export const SubcontractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const value = useSubcontractState();
    return <SubcontractContext.Provider value={value}>{children}</SubcontractContext.Provider>;
};
