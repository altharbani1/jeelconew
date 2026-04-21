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

        return () => unsubscribes.forEach(unsub => unsub());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAllInternal = async (mods: SyncModule[]) => {
        setSyncStatus('syncing');
        try {
            await Promise.all(mods.map(async ({ collection, stateSetter }) => {
                // 1. محلي أولاً للسرعة
                const localData = localStorage.getItem(collection);
                if (localData) {
                    try { stateSetter(sortNewestFirst(JSON.parse(localData))); } catch (e) { }
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
                        return item;
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

    const saveRecord = async (collection: string, id: string, data: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const mod = modulesRef.current.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => {
                    const exists = prev.find((q: any) => (q.id || q.number) === id);
                    const newArr = exists ? prev.map((q: any) => (q.id || q.number) === id ? data : q) : [data, ...prev];
                    return sortNewestFirst(newArr);
                });
            }

            const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
            const exists = localArr.find((q: any) => (q.id || q.number) === id);
            const updated = exists
                ? localArr.map((q: any) => (q.id || q.number) === id ? data : q)
                : [data, ...localArr];
            localStorage.setItem(collection, JSON.stringify(updated));

            const success = await cloudService.saveRecord(collection, id, data);

            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const deleteRecord = async (collection: string, id: string): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const mod = modulesRef.current.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => prev.filter((q: any) => (q.id || q.number) !== id));
            }

            const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
            localStorage.setItem(collection, JSON.stringify(
                localArr.filter((q: any) => (q.id || q.number) !== id)
            ));

            const success = await cloudService.deleteRecord(collection, id);
            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    return {
        syncStatus,
        saveRecord,
        deleteRecord,
        loadAll: () => loadAllInternal(modulesRef.current)
    };
};
