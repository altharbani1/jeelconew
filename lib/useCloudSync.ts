import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { cloudService } from '../services/cloudService';

interface SyncModule {
    collection: string;
    stateSetter: Dispatch<SetStateAction<any[]>>;
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export const useCloudSync = (modules: SyncModule[]) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    // ✅ useRef لتجنب stale closure — يضمن وصول saveRecord/deleteRecord لأحدث stateSetters
    const modulesRef = useRef(modules);
    modulesRef.current = modules;

    const sortNewestFirst = (arr: any[]) => {
        return [...arr].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date || a.timestamp || 0).getTime();
            const dateB = new Date(b.createdAt || b.date || b.timestamp || 0).getTime();
            return dateB - dateA;
        });
    };

    useEffect(() => {
        const mods = modulesRef.current;
        loadAllInternal(mods);

        // الاشتراك في التحديثات اللحظية لكل collection
        const unsubscribes = mods.map(({ collection, stateSetter }) =>
            cloudService.subscribeToCollection(collection, (payload) => {
                setSyncStatus('syncing');

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const updatedRecord = payload.new;
                    stateSetter((prev: any[]) => {
                        const exists = prev.find(q => (q.id || q.number) === updatedRecord.record_id);
                        const newArr = exists
                            ? prev.map(q => (q.id || q.number) === updatedRecord.record_id ? updatedRecord.data : q)
                            : [updatedRecord.data, ...prev];
                        return sortNewestFirst(newArr);
                    });
                } else if (payload.eventType === 'DELETE') {
                    const deletedId = payload.old.record_id;
                    stateSetter((prev: any[]) => prev.filter(q => (q.id || q.number) !== deletedId));
                }

                setTimeout(() => setSyncStatus('synced'), 1000);
            })
        );

        const refreshSubcontractCosts = () => { void loadAllInternal(modulesRef.current); };
        window.addEventListener('subcontract-data-changed', refreshSubcontractCosts);
        return () => {
            unsubscribes.forEach(unsub => unsub());
            window.removeEventListener('subcontract-data-changed', refreshSubcontractCosts);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAllInternal = async (mods: SyncModule[]) => {
        setSyncStatus('syncing');
        try {
            await Promise.all(mods.map(async ({ collection, stateSetter }) => {
                // 1. محلي أولاً للسرعة
                const localData = localStorage.getItem(collection);
                let localRecords: any[] = [];
                if (localData) {
                    try {
                        const parsedLocal = JSON.parse(localData);
                        localRecords = Array.isArray(parsedLocal) ? parsedLocal : [];
                        stateSetter(sortNewestFirst(localRecords));
                    } catch (e) { }
                }

                // 2. السحابة
                const cloudData = await cloudService.loadCollection(collection);
                if (cloudData && cloudData.length > 0) {
                    const parsed = cloudData.map((row: any) => {
                        const item = row.data;
                        // Self-healing
                        const localId = item.id || item.number;
                        if (localId && localId !== row.record_id) {
                            cloudService.deleteRecord(collection, row.record_id).then(() => {
                                cloudService.saveRecord(collection, localId, item);
                            });
                        }
                        if (collection !== 'jilco_contracts_archive') return item;

                        // Old relational rows did not persist payment terms or technical specs.
                        // Recover only fields that are still empty in the cloud from this browser's
                        // last full copy. Once saved, the cloud values become authoritative.
                        const local = localRecords.find((record: any) => {
                            const recordId = record.id || record.data?.id;
                            const itemId = item.id || item.data?.id;
                            const recordNumber = record.number || record.data?.number;
                            const itemNumber = item.number || item.data?.number;
                            return (recordId && itemId && recordId === itemId)
                                || (recordNumber && itemNumber && recordNumber === itemNumber);
                        });
                        if (!local) return item;
                        return {
                            ...local,
                            ...item,
                            data: {
                                ...local.data,
                                ...item.data,
                                paymentTerms: item.data?.paymentTerms?.length
                                    ? item.data.paymentTerms
                                    : (local.data?.paymentTerms || [])
                            },
                            specs: { ...(local.specs || {}), ...(item.specs || {}) }
                        };
                    });
                    stateSetter(sortNewestFirst(parsed));
                    localStorage.setItem(collection, JSON.stringify(parsed));
                }
                // ⚠️ SAFETY: Never wipe local data if cloud returns empty.
                // Cloud may return empty due to network issues or Supabase downtime.
                // Local data (already loaded above) remains intact.
            }));
            setSyncStatus('synced');
        } catch (e) {
            console.error('useCloudSync loadAll error:', e);
            setSyncStatus('error');
        }
    };

    const applyInvoicePaymentUpdates = (updates: any[]) => {
        if (!updates.length) return;
        const invoiceModule = modulesRef.current.find(m => m.collection === 'jilco_invoices_archive');
        const apply = (records: any[]) => records.map(invoice => {
            const update = updates.find((item: any) =>
                (item.number && item.number === invoice.number)
                || (item.id && item.id === (invoice.id || invoice.number))
            );
            return update ? { ...invoice, paidAmount: Number(update.paidAmount) || 0, status: update.status } : invoice;
        });

        invoiceModule?.stateSetter(prev => apply(prev));
        try {
            const localInvoices = JSON.parse(localStorage.getItem('jilco_invoices_archive') || '[]');
            localStorage.setItem('jilco_invoices_archive', JSON.stringify(apply(Array.isArray(localInvoices) ? localInvoices : [])));
        } catch (error) {
            console.error('Failed to update cached invoice payment totals:', error);
        }
    };

    const matchesRecordId = (record: any, collection: string, id: string) =>
        collection === 'jilco_receipts_archive'
            ? (record.number || record.id) === id || record.id === id
            : (record.id || record.number) === id;

    const saveRecord = async (collection: string, id: string, data: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const mod = modulesRef.current.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => {
                    const exists = prev.find((q: any) => matchesRecordId(q, collection, id));
                    const newArr = exists ? prev.map((q: any) => matchesRecordId(q, collection, id) ? data : q) : [data, ...prev];
                    return sortNewestFirst(newArr);
                });
            }

            const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
            const exists = localArr.find((q: any) => matchesRecordId(q, collection, id));
            const updated = exists
                ? localArr.map((q: any) => matchesRecordId(q, collection, id) ? data : q)
                : [data, ...localArr];
            localStorage.setItem(collection, JSON.stringify(updated));

            const result = collection === 'jilco_receipts_archive'
                ? await cloudService.saveReceiptWithInvoiceRecalculation(id, data)
                : collection === 'jilco_invoices_archive'
                    ? await cloudService.saveInvoiceRecord(id, data).then(invoiceResult => ({
                        success: invoiceResult.success,
                        invoices: invoiceResult.invoice ? [invoiceResult.invoice] : []
                    }))
                : { success: await cloudService.saveRecord(collection, id, data), invoices: [] };

            if (result.success) applyInvoicePaymentUpdates(result.invoices);

            setSyncStatus(result.success ? 'synced' : 'error');
            return result.success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const deleteRecord = async (collection: string, id: string): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const result = collection === 'jilco_receipts_archive'
                ? await cloudService.deleteReceiptWithInvoiceRecalculation(id)
                : { success: await cloudService.deleteRecord(collection, id), invoices: [] };
            if (!result.success) {
                setSyncStatus('error');
                return false;
            }

            const mod = modulesRef.current.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => prev.filter((q: any) => !matchesRecordId(q, collection, id)));
            }

            if (collection === 'jilco_receipts_archive') {
                try {
                    const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
                    localStorage.setItem(collection, JSON.stringify(
                        localArr.filter((q: any) => !matchesRecordId(q, collection, id))
                    ));
                } catch (error) {
                    console.error('Receipt was deleted in the cloud but the local cache could not be updated:', error);
                }
                applyInvoicePaymentUpdates(result.invoices);
            } else {
                const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
                localStorage.setItem(collection, JSON.stringify(
                    localArr.filter((q: any) => !matchesRecordId(q, collection, id))
                ));
            }

            setSyncStatus('synced');
            return true;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    return {
        syncStatus,
        saveRecord,
        deleteRecord,
        reserveInvoiceNumber: (year: number) => cloudService.reserveInvoiceNumber(year),
        loadAll: () => loadAllInternal(modulesRef.current)
    };
};
