import { useState, useEffect } from 'react';
import { cloudService } from '../services/cloudService';

/**
 * useCloudSync - Hook مشترك للمزامنة مع Supabase
 * 
 * يُقلّص الكود المكرر في SalesContext, ProjectContext, HRContext, PurchaseContext, InventoryContext
 * 
 * @param modules - قائمة المجموعات مع الدوال المقابلة لتحديث الحالة
 */
interface SyncModule {
    collection: string;
    stateSetter: React.Dispatch<React.SetStateAction<any[]>>;
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export const useCloudSync = (modules: SyncModule[]) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

    useEffect(() => {
        loadAll();

        // ✅ Subscribe to real-time changes for each collection
        const unsubscribes = modules.map(({ collection, stateSetter }) =>
            cloudService.subscribeToCollection(collection, (payload) => {
                setSyncStatus('syncing');

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const updatedRecord = payload.new;
                    stateSetter((prev: any[]) => {
                        const exists = prev.find(q => (q.id || q.number) === updatedRecord.record_id);
                        if (exists) {
                            return prev.map(q => (q.id || q.number) === updatedRecord.record_id ? updatedRecord.data : q);
                        }
                        return [updatedRecord.data, ...prev];
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

    /** تحميل جميع البيانات: محلياً أولاً (سريع) ثم من السحابة */
    const loadAll = async () => {
        setSyncStatus('syncing');
        try {
            await Promise.all(modules.map(async ({ collection, stateSetter }) => {
                // 1. محلي أولاً للسرعة
                const localData = localStorage.getItem(collection);
                if (localData) {
                    try { stateSetter(JSON.parse(localData)); } catch (e) { }
                }

                // 2. السحابة
                const cloudData = await cloudService.loadCollection(collection);
                if (cloudData && cloudData.length > 0) {
                    const parsed = cloudData.map((row: any) => {
                        const item = row.data;

                        // Self-healing: إصلاح التناقض بين record_id والـ id الفعلي
                        const localId = item.id || item.number;
                        if (localId && localId !== row.record_id) {
                            cloudService.deleteRecord(collection, row.record_id).then(() => {
                                cloudService.saveRecord(collection, localId, item);
                            });
                        }

                        return item;
                    });

                    stateSetter(parsed);
                    localStorage.setItem(collection, JSON.stringify(parsed));
                } else {
                    // السحابة فارغة — امسح المحلي لمنع ظهور عناصر محذوفة
                    stateSetter([]);
                    localStorage.setItem(collection, '[]');
                }
            }));
            setSyncStatus('synced');
        } catch (e) {
            console.error('useCloudSync loadAll error:', e);
            setSyncStatus('error');
        }
    };

    /** حفظ سجل مع Optimistic UI Update */
    const saveRecord = async (
        collection: string,
        id: string,
        data: any
    ): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            // 1. تحديث متفائل للواجهة
            const mod = modules.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => {
                    const exists = prev.find((q: any) => (q.id || q.number) === id);
                    if (exists) return prev.map((q: any) => (q.id || q.number) === id ? data : q);
                    return [data, ...prev];
                });
            }

            // 2. Supabase
            const success = await cloudService.saveRecord(collection, id, data);

            // 3. Cache محلي
            const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
            const exists = localArr.find((q: any) => (q.id || q.number) === id);
            const updated = exists
                ? localArr.map((q: any) => (q.id || q.number) === id ? data : q)
                : [data, ...localArr];
            localStorage.setItem(collection, JSON.stringify(updated));

            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    /** حذف سجل مع Optimistic UI Update */
    const deleteRecord = async (collection: string, id: string): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            // 1. تحديث متفائل
            const mod = modules.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => prev.filter((q: any) => (q.id || q.number) !== id));
            }

            // 2. Cache محلي
            const localArr = JSON.parse(localStorage.getItem(collection) || '[]');
            localStorage.setItem(collection, JSON.stringify(
                localArr.filter((q: any) => (q.id || q.number) !== id)
            ));

            // 3. Supabase
            const success = await cloudService.deleteRecord(collection, id);
            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    return { syncStatus, saveRecord, deleteRecord, loadAll };
};
