import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cloudService } from '../services/cloudService';

interface DataContextType {
    config: any;
    setConfig: React.Dispatch<React.SetStateAction<any>>;
    saveSpecsDb: (data: any) => Promise<boolean>;
    saveConfig: (data: any) => Promise<boolean>;
    saveRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteRecordLocallyAndCloud: (collection: string, id: string) => Promise<boolean>;
    migrateAllLocalData: () => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    specsDb: any;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    const [specsDb, setSpecsDb] = useState<any>({});

    useEffect(() => {
        // Config only — module data is handled by specialized contexts (SalesContext, ProjectContext, etc.)
        loadConfig();
        loadSpecsDb();
    }, []);

    const loadConfig = async () => {
        // 1. Local first (fast)
        const localConfig = localStorage.getItem('jilco_quote_data');
        if (localConfig) {
            try { setConfig(JSON.parse(localConfig).config); } catch (e) { }
        }
        // 2. Sync from cloud
        try {
            const cloudConfig = await cloudService.loadCompanyConfig();
            // A cloud read that started before the user edited the profile must
            // not replace that newer local draft when it finally resolves.
            if (cloudConfig && localStorage.getItem('jilco_quote_data') === localConfig) {
                setConfig(cloudConfig);
            }
        } catch (e) {
            console.error('Failed to load config from cloud:', e);
        }
    };

    const loadSpecsDb = async () => {
        const localSpecs = localStorage.getItem('jilco_specs_db');
        if (localSpecs) {
            try {
                const parsed = JSON.parse(localSpecs);
                const singleton = parsed.find((p: any) => p.id === 'singleton_specs');
                if (singleton) {
                    const { id: _id, ...cachedSpecs } = singleton;
                    setSpecsDb(cachedSpecs);
                }
            } catch (e) { }
        }

        try {
            const cloudData = await cloudService.loadCollection('jilco_specs_db');
            if (cloudData && cloudData.length > 0 && cloudData[0].data) {
                setSpecsDb(cloudData[0].data);
            }
        } catch (e) {
            console.error('Failed to load specs from cloud:', e);
        }
    };

    // Generic Save — used by modules without a dedicated context (e.g., SpecsManager, SmartElevator)
    const saveRecord = async (collection: string, id: string, recordData: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const success = await cloudService.saveRecord(collection, id, recordData);

            // Keep local cache fresh
            const localArray = JSON.parse(localStorage.getItem(collection) || '[]');
            const localRecord = recordData?.id ? recordData : { id, ...recordData };
            const exists = localArray.find((q: any) => (q.id || q.number) === id);
            const updatedLocalArray = exists
                ? localArray.map((q: any) => (q.id || q.number) === id ? localRecord : q)
                : [localRecord, ...localArray];
            localStorage.setItem(collection, JSON.stringify(updatedLocalArray));

            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const deleteRecordLocallyAndCloud = async (collection: string, id: string): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const localArray = JSON.parse(localStorage.getItem(collection) || '[]');
            localStorage.setItem(collection, JSON.stringify(
                localArray.filter((q: any) => (q.id || q.number) !== id)
            ));
            const success = await cloudService.deleteRecord(collection, id);
            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const saveConfig = async (configData: any): Promise<boolean> => {
        setConfig(configData);
        try {
            const existingData = JSON.parse(localStorage.getItem('jilco_quote_data') || '{}');
            existingData.config = configData;
            localStorage.setItem('jilco_quote_data', JSON.stringify(existingData));
        } catch (error) {
            console.error('Company config local cache save failed:', error);
            return false;
        }
        const success = await cloudService.saveCompanyConfig(configData);
        setSyncStatus(success ? 'synced' : 'error');
        return success;
    };

    const saveSpecsDb = async (specsData: any): Promise<boolean> => {
        setSpecsDb(specsData);
        return await saveRecord('jilco_specs_db', 'singleton_specs', specsData);
    };

    // One-time migration: push all localStorage data to Supabase cloud
    const migrateAllLocalData = async (): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const collectionsToMigrate = [
                'jilco_invoices_archive', 'jilco_receipts_archive',
                'jilco_contracts_archive', 'jilco_customers', 'jilco_projects', 'jilco_phases',
                'jilco_expenses_archive', 'jilco_claims_archive', 'jilco_documents',
                'jilco_warranties_archive', 'jilco_hr_employees', 'jilco_hr_commissions',
                'jilco_smart_elevators', 'jilco_suppliers', 'jilco_supplier_products',
                'jilco_purchase_invoices', 'jilco_supplier_payments', 'jilco_inventory_transactions',
                'jilco_maintenance_contracts', 'jilco_maintenance_tickets', 'jilco_maintenance_ticket_events', 'jilco_maintenance_part_usages', 'jilco_maintenance_visits'
            ];

            let totalMigrated = 0;
            let failedRecords = 0;
            for (const collection of collectionsToMigrate) {
                const localData = localStorage.getItem(collection);
                if (localData) {
                    const parsedArray = JSON.parse(localData);
                    if (Array.isArray(parsedArray)) {
                        for (const item of parsedArray) {
                            const itemId = item.id || item.number || (Date.now().toString() + Math.random().toString(36).substring(7));
                            const saved = await cloudService.saveRecord(collection, itemId, item);
                            if (saved) totalMigrated++;
                            else failedRecords++;
                        }
                    }
                }
            }

            console.log(`✅ Migration Complete: Migrated ${totalMigrated} records.`);
            setSyncStatus(failedRecords > 0 ? 'error' : 'synced');
            return failedRecords === 0;
        } catch (e) {
            console.error('Migration failed:', e);
            setSyncStatus('error');
            return false;
        }
    };

    // When an existing Chrome installation opens the new cloud-backed build,
    // migrate its local records once after authentication. The marker prevents
    // repeated uploads while keeping the original localStorage untouched.
    useEffect(() => {
        const migrationMarker = 'jilco_cloud_migration_v6';
        if (localStorage.getItem(migrationMarker)) return;
        const sourceKeys = [
            'jilco_customers', 'jilco_projects', 'jilco_invoices_archive', 'jilco_receipts_archive',
            'jilco_maintenance_contracts', 'jilco_maintenance_tickets', 'jilco_maintenance_ticket_events', 'jilco_maintenance_part_usages', 'jilco_maintenance_visits'
        ];
        const hasLocalRecords = sourceKeys.some((key) => {
            const raw = localStorage.getItem(key);
            try { return Array.isArray(JSON.parse(raw || 'null')) && JSON.parse(raw || '[]').length > 0; } catch { return false; }
        });
        if (!hasLocalRecords) return;
        void migrateAllLocalData().then((ok) => {
            if (ok) localStorage.setItem(migrationMarker, new Date().toISOString());
        });
    }, []);

    return (
        <DataContext.Provider value={{
            config, setConfig,
            specsDb,
            saveRecord, deleteRecordLocallyAndCloud,
            saveConfig, saveSpecsDb,
            migrateAllLocalData, syncStatus
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
