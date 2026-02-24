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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    useEffect(() => {
        // Config only — module data is handled by specialized contexts (SalesContext, ProjectContext, etc.)
        loadConfig();
    }, []);

    const loadConfig = async () => {
        // 1. Local first (fast)
        const localConfig = localStorage.getItem('jilco_quote_data');
        if (localConfig) {
            try { setConfig(JSON.parse(localConfig).config); } catch (e) { }
        }
        // 2. Sync from cloud
        try {
            const cloudData = await cloudService.loadCollection('jilco_config_db');
            if (cloudData && cloudData.length > 0 && cloudData[0].data) {
                setConfig(cloudData[0].data);
            }
        } catch (e) {
            console.error('Failed to load config from cloud:', e);
        }
    };

    // Generic Save — used by modules without a dedicated context (e.g., SpecsManager, SmartElevator)
    const saveRecord = async (collection: string, id: string, recordData: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const success = await cloudService.saveRecord(collection, id, recordData);

            // Keep local cache fresh
            const localArray = JSON.parse(localStorage.getItem(collection) || '[]');
            const exists = localArray.find((q: any) => (q.id || q.number) === id);
            const updatedLocalArray = exists
                ? localArray.map((q: any) => (q.id || q.number) === id ? recordData : q)
                : [recordData, ...localArray];
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
        const existingData = JSON.parse(localStorage.getItem('jilco_quote_data') || '{}');
        existingData.config = configData;
        localStorage.setItem('jilco_quote_data', JSON.stringify(existingData));
        return await cloudService.saveRecord('jilco_config_db', 'singleton_config', configData);
    };

    const saveSpecsDb = async (specsData: any): Promise<boolean> => {
        return await saveRecord('jilco_specs_db', 'singleton_specs', specsData);
    };

    // One-time migration: push all localStorage data to Supabase cloud
    const migrateAllLocalData = async (): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const collectionsToMigrate = [
                'jilco_quotes_archive', 'jilco_invoices_archive', 'jilco_receipts_archive',
                'jilco_contracts_archive', 'jilco_customers', 'jilco_projects', 'jilco_phases',
                'jilco_expenses_archive', 'jilco_claims_archive', 'jilco_documents',
                'jilco_warranties_archive', 'jilco_hr_employees', 'jilco_hr_commissions',
                'jilco_smart_elevators', 'jilco_suppliers', 'jilco_supplier_products',
                'jilco_purchase_invoices', 'jilco_supplier_payments', 'jilco_inventory_transactions'
            ];

            let totalMigrated = 0;
            for (const collection of collectionsToMigrate) {
                const localData = localStorage.getItem(collection);
                if (localData) {
                    const parsedArray = JSON.parse(localData);
                    if (Array.isArray(parsedArray)) {
                        for (const item of parsedArray) {
                            const itemId = item.id || item.number || (Date.now().toString() + Math.random().toString(36).substring(7));
                            await cloudService.saveRecord(collection, itemId, item);
                            totalMigrated++;
                        }
                    }
                }
            }

            console.log(`✅ Migration Complete: Migrated ${totalMigrated} records.`);
            setSyncStatus('synced');
            return true;
        } catch (e) {
            console.error('Migration failed:', e);
            setSyncStatus('error');
            return false;
        }
    };

    return (
        <DataContext.Provider value={{
            config, setConfig,
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
