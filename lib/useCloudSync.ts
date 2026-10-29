import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { cloudService } from '../services/cloudService';

interface SyncModule {
    collection: string;
    stateSetter: Dispatch<SetStateAction<any[]>>;
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const getLocalCacheKey = (collection: string, cacheScope?: string) => {
    // Quote and contract archives contain customer and commercial data. Never use the old
    // unscoped key: it can belong to another signed-in account on this device.
    if (collection === 'jilco_quotes_archive' || collection === 'jilco_contracts_archive') {
        return cacheScope ? `${collection}::${cacheScope}` : null;
    }
    return collection;
};

export const useCloudSync = (modules: SyncModule[], cacheScope?: string) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    // ✅ useRef لتجنب stale closure — يضمن وصول saveRecord/deleteRecord لأحدث stateSetters
    const modulesRef = useRef(modules);
    modulesRef.current = modules;
    const scopeRef = useRef(cacheScope);
    scopeRef.current = cacheScope;
    const scopeGeneration = useRef(0);
    const loadSequence = useRef<Record<string, number>>({});
    const contractRevision = useRef(0);

    const upsertContract = (records: any[], id: string, contract: any) => {
        const number = contract.data?.number || contract.number;
        return [{ ...contract, id }, ...records.filter(record => {
            const recordId = record.id || record.data?.id;
            if (recordId) return recordId !== id;
            return !number || (record.data?.number || record.number) !== number;
        })];
    };

    const updateContractCache = (scope: string | undefined, update: (records: any[]) => any[]) => {
        try {
            const key = getLocalCacheKey('jilco_contracts_archive', scope);
            if (!key) return;
            const cached = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(update(Array.isArray(cached) ? cached : [])));
        } catch (error) { console.error('Contract cloud operation succeeded but its local cache could not be updated:', error); }
    };

    const sortNewestFirst = (arr: any[]) => {
        return [...arr].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date || a.timestamp || 0).getTime();
            const dateB = new Date(b.createdAt || b.date || b.timestamp || 0).getTime();
            return dateB - dateA;
        });
    };

    useEffect(() => {
        const mods = modulesRef.current;
        const generation = ++scopeGeneration.current;
        const isCurrent = () => scopeGeneration.current === generation && scopeRef.current === cacheScope;
        // Don't keep the previous account's in-memory quote list while the next
        // account's cloud data is loading (or if the account is unavailable).
        mods.find(({ collection }) => collection === 'jilco_quotes_archive')?.stateSetter([]);
        mods.find(({ collection }) => collection === 'jilco_contracts_archive')?.stateSetter([]);
        loadAllInternal(mods, cacheScope, generation);

        // الاشتراك في التحديثات اللحظية لكل collection
        const unsubscribes = mods.map(({ collection, stateSetter }) => {
            if (collection === 'jilco_contracts_archive' && !cacheScope) return () => {};
            let snapshotRequest: { id: number; revision: number } | undefined;
            return cloudService.subscribeToCollection(collection, (payload) => {
                if (!isCurrent()) return;
                if (collection === 'jilco_contracts_archive' && payload.eventType === 'SNAPSHOT_LOADING') {
                    snapshotRequest = { id: payload.requestId, revision: contractRevision.current };
                    return;
                }
                if (collection === 'jilco_contracts_archive' && payload.eventType === 'ERROR') {
                    setSyncStatus('error');
                    return;
                }
                if (collection === 'jilco_contracts_archive' && payload.eventType === 'SNAPSHOT') {
                    if (!Array.isArray(payload.records)) { setSyncStatus('error'); return; }
                    if (snapshotRequest && snapshotRequest.id === payload.requestId && snapshotRequest.revision !== contractRevision.current) {
                        // The snapshot began before a local cloud mutation completed.
                        // Fetch again so concurrent changes from other users are retained too.
                        void loadAllInternal([{ collection, stateSetter }], cacheScope, generation);
                        return;
                    }
                    ++contractRevision.current;
                    const snapshot = sortNewestFirst(payload.records.map((row: any) => ({ ...row.data, id: row.record_id })));
                    stateSetter((prev: any[]) => isCurrent() ? snapshot : prev);
                    updateContractCache(cacheScope, () => snapshot);
                    setSyncStatus('synced');
                    return;
                }
                setSyncStatus('syncing');

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const updatedRecord = payload.new;
                    if (collection === 'jilco_contracts_archive') {
                        ++contractRevision.current;
                        const contract = { ...updatedRecord.data, id: updatedRecord.record_id };
                        stateSetter((prev: any[]) => isCurrent()
                            ? sortNewestFirst(upsertContract(prev, updatedRecord.record_id, contract)) : prev);
                        updateContractCache(cacheScope, records => sortNewestFirst(upsertContract(records, updatedRecord.record_id, contract)));
                    } else {
                        stateSetter((prev: any[]) => {
                            if (!isCurrent()) return prev;
                            const exists = prev.find(q => (q.id || q.number) === updatedRecord.record_id);
                            const newArr = exists
                                ? prev.map(q => (q.id || q.number) === updatedRecord.record_id ? updatedRecord.data : q)
                                : [updatedRecord.data, ...prev];
                            return sortNewestFirst(newArr);
                        });
                    }
                } else if (payload.eventType === 'DELETE') {
                    if (collection === 'jilco_contracts_archive') ++contractRevision.current;
                    const deletedId = payload.old.record_id;
                    stateSetter((prev: any[]) => {
                        if (!isCurrent()) return prev;
                        return prev.filter(q => !matchesRecordId(q, collection, deletedId));
                    });
                    if (collection === 'jilco_contracts_archive') updateContractCache(cacheScope,
                        records => records.filter(record => !matchesRecordId(record, collection, deletedId)));
                }

                setTimeout(() => { if (isCurrent()) setSyncStatus('synced'); }, 1000);
            });
        });

        const refreshSubcontractCosts = () => { void loadAllInternal(modulesRef.current); };
        window.addEventListener('subcontract-data-changed', refreshSubcontractCosts);
        return () => {
            ++scopeGeneration.current;
            unsubscribes.forEach(unsub => unsub());
            window.removeEventListener('subcontract-data-changed', refreshSubcontractCosts);
        };
    }, [cacheScope]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAllInternal = async (mods: SyncModule[], requestedScope = cacheScope, generation = scopeGeneration.current) => {
        const isCurrent = () => scopeRef.current === requestedScope && scopeGeneration.current === generation;
        setSyncStatus('syncing');
        try {
            await Promise.all(mods.map(async ({ collection, stateSetter }) => {
                if (!isCurrent()) return;
                const sequence = (loadSequence.current[collection] || 0) + 1;
                loadSequence.current[collection] = sequence;
                const isCollectionCurrent = () => isCurrent() && loadSequence.current[collection] === sequence;
                if (collection === 'jilco_contracts_archive' && !requestedScope) {
                    stateSetter([]);
                    return;
                }
                // 1. محلي أولاً للسرعة
                const localKey = getLocalCacheKey(collection, requestedScope);
                const localData = localKey ? localStorage.getItem(localKey) : null;
                let localRecords: any[] = [];
                if (localData) {
                    try {
                        const parsedLocal = JSON.parse(localData);
                        localRecords = Array.isArray(parsedLocal) ? parsedLocal : [];
                        stateSetter(prev => isCollectionCurrent() ? sortNewestFirst(localRecords) : prev);
                    } catch (e) { }
                }

                // 2. السحابة
                const revision = contractRevision.current;
                const isLoadCurrent = () => isCollectionCurrent() && (collection !== 'jilco_contracts_archive'
                    || contractRevision.current === revision);
                const cloudData = await cloudService.loadCollection(collection);
                // A response started before a confirmed save, delete or realtime
                // snapshot must not restore older records over the newer archive.
                if (!isLoadCurrent()) return;
                if (cloudData && cloudData.length > 0) {
                    const parsed = cloudData.map((row: any) => {
                        const item = row.data;
                        // A read must never delete and recreate contracts. Their server
                        // identifier and persisted fields are authoritative.
                        if (collection === 'jilco_contracts_archive') return { ...item, id: row.record_id };
                        // Self-healing
                        const localId = item.id || item.number;
                        if (localId && localId !== row.record_id) {
                            cloudService.deleteRecord(collection, row.record_id).then(() => {
                                cloudService.saveRecord(collection, localId, item);
                            });
                        }
                        return item;
                    });
                    stateSetter(prev => isLoadCurrent() ? sortNewestFirst(parsed) : prev);
                    if (localKey) localStorage.setItem(localKey, JSON.stringify(parsed));
                } else if ((collection === 'jilco_quotes_archive' || collection === 'jilco_contracts_archive') && cloudData && localKey) {
                    // A successful empty cloud response is authoritative. Remove
                    // stale records for this same account instead of preserving them.
                    stateSetter(prev => isLoadCurrent() ? [] : prev);
                    localStorage.setItem(localKey, '[]');
                }
                // Failed cloud reads throw and retain only this identity's scoped cache.
            }));
            if (isCurrent()) setSyncStatus('synced');
        } catch (e) {
            console.error('useCloudSync loadAll error:', e);
            if (isCurrent()) setSyncStatus('error');
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
            return update ? {
                ...invoice, paidAmount: Number(update.paidAmount) || 0, status: update.status,
                ...(Array.isArray(update.items) ? { items: update.items } : {}),
                ...(update.grandTotal !== undefined ? { grandTotal: Number(update.grandTotal), discountAmount: Number(update.discountAmount) || 0 } : {}),
                ...(update.customerId !== undefined ? { customerId: update.customerId || undefined } : {})
            } : invoice;
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
        collection === 'jilco_contracts_archive'
            ? (record.id || record.data?.id || record.data?.number || record.number) === id
            : (collection === 'jilco_receipts_archive' || collection === 'jilco_invoices_archive')
            ? (record.number || record.id) === id || record.id === id
            : (record.id || record.number) === id;

    const saveRecord = async (collection: string, id: string, data: any): Promise<boolean> => {
        if (collection === 'jilco_contracts_archive') {
            const requestedScope = cacheScope;
            const generation = scopeGeneration.current;
            const isCurrent = () => scopeRef.current === requestedScope && scopeGeneration.current === generation;
            if (!requestedScope || !isCurrent()) return false;
            setSyncStatus('syncing');
            try {
                const success = await cloudService.saveRecord(collection, id, data);
                if (!isCurrent()) return false;
                if (!success) { setSyncStatus('error'); return false; }
                ++contractRevision.current;
                const mod = modulesRef.current.find(module => module.collection === collection);
                mod?.stateSetter(prev => isCurrent() ? sortNewestFirst(upsertContract(prev, id, data)) : prev);
                updateContractCache(requestedScope, records => sortNewestFirst(upsertContract(records, id, data)));
                setSyncStatus('synced');
                return true;
            } catch (error) {
                if (isCurrent()) setSyncStatus('error');
                return false;
            }
        }
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

            const localKey = getLocalCacheKey(collection, cacheScope);
            // Keep existing quote cache unchanged until cloud confirms a save.
            // The editor remains open on failure, but an unsaved record should
            // not reappear as a saved quote after a reload.
            if (localKey && collection !== 'jilco_quotes_archive') {
                const localArr = JSON.parse(localStorage.getItem(localKey) || '[]');
                const exists = localArr.find((q: any) => matchesRecordId(q, collection, id));
                const updated = exists
                    ? localArr.map((q: any) => matchesRecordId(q, collection, id) ? data : q)
                    : [data, ...localArr];
                localStorage.setItem(localKey, JSON.stringify(updated));
            }

            const result = collection === 'jilco_receipts_archive'
                ? await cloudService.saveReceiptWithInvoiceRecalculation(id, data)
                : collection === 'jilco_invoices_archive'
                    ? await cloudService.saveInvoiceRecord(id, data).then(invoiceResult => ({
                        success: invoiceResult.success,
                        invoices: invoiceResult.invoice ? [invoiceResult.invoice] : []
                    }))
                : { success: await cloudService.saveRecord(collection, id, data), invoices: [] };

            if (result.success && localKey && collection === 'jilco_quotes_archive') {
                const localArr = JSON.parse(localStorage.getItem(localKey) || '[]');
                const exists = localArr.find((q: any) => matchesRecordId(q, collection, id));
                const updated = exists
                    ? localArr.map((q: any) => matchesRecordId(q, collection, id) ? data : q)
                    : [data, ...localArr];
                localStorage.setItem(localKey, JSON.stringify(updated));
            }

            if (result.success) applyInvoicePaymentUpdates(result.invoices);

            setSyncStatus(result.success ? 'synced' : 'error');
            return result.success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const deleteRecord = async (collection: string, id: string): Promise<boolean> => {
        const requestedScope = cacheScope;
        const generation = scopeGeneration.current;
        const isCurrent = () => scopeRef.current === requestedScope && scopeGeneration.current === generation;
        if (collection === 'jilco_contracts_archive' && !requestedScope) return false;
        setSyncStatus('syncing');
        try {
            const result = collection === 'jilco_receipts_archive'
                ? await cloudService.deleteReceiptWithInvoiceRecalculation(id)
                : { success: await cloudService.deleteRecord(collection, id), invoices: [] };
            if (collection === 'jilco_contracts_archive' && !isCurrent()) return false;
            if (!result.success) {
                setSyncStatus('error');
                return false;
            }
            if (collection === 'jilco_contracts_archive') ++contractRevision.current;

            const mod = modulesRef.current.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => collection === 'jilco_contracts_archive' && !isCurrent()
                    ? prev : prev.filter((q: any) => !matchesRecordId(q, collection, id)));
            }

            if (collection === 'jilco_contracts_archive') {
                updateContractCache(requestedScope, records => records.filter(record => !matchesRecordId(record, collection, id)));
                setSyncStatus('synced');
                return true;
            }

            const localKey = getLocalCacheKey(collection, cacheScope);
            if (collection === 'jilco_receipts_archive') {
                try {
                    const localArr = JSON.parse(localStorage.getItem(localKey || collection) || '[]');
                    localStorage.setItem(localKey || collection, JSON.stringify(
                        localArr.filter((q: any) => !matchesRecordId(q, collection, id))
                    ));
                } catch (error) {
                    console.error('Receipt was deleted in the cloud but the local cache could not be updated:', error);
                }
                applyInvoicePaymentUpdates(result.invoices);
            } else {
                if (!localKey) {
                    setSyncStatus('synced');
                    return true;
                }
                const localArr = JSON.parse(localStorage.getItem(localKey) || '[]');
                localStorage.setItem(localKey, JSON.stringify(
                    localArr.filter((q: any) => !matchesRecordId(q, collection, id))
                ));
            }

            setSyncStatus('synced');
            return true;
        } catch (e) {
            if (collection !== 'jilco_contracts_archive' || isCurrent()) setSyncStatus('error');
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
