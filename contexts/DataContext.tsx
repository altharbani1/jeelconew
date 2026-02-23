import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cloudService } from '../services/cloudService';

interface DataContextType {
    quotes: any[];
    customers: any[];
    projects: any[];
    phases: any[];
    invoices: any[];
    receipts: any[];
    contracts: any[];
    expenses: any[];
    claims: any[];
    documents: any[];
    warranties: any[];
    hrEmployees: any[];
    hrCommissions: any[];
    suppliers: any[];
    supplierProducts: any[];
    purchaseInvoices: any[];
    supplierPayments: any[];
    elevators: any[];
    inventoryTransactions: any[];
    config: any;

    // Generic Setters
    setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
    setProjects: React.Dispatch<React.SetStateAction<any[]>>;
    setPhases: React.Dispatch<React.SetStateAction<any[]>>;
    setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    setReceipts: React.Dispatch<React.SetStateAction<any[]>>;
    setContracts: React.Dispatch<React.SetStateAction<any[]>>;
    setExpenses: React.Dispatch<React.SetStateAction<any[]>>;
    setClaims: React.Dispatch<React.SetStateAction<any[]>>;
    setQuotes: React.Dispatch<React.SetStateAction<any[]>>;
    setDocuments: React.Dispatch<React.SetStateAction<any[]>>;
    setWarranties: React.Dispatch<React.SetStateAction<any[]>>;
    setHrEmployees: React.Dispatch<React.SetStateAction<any[]>>;
    setHrCommissions: React.Dispatch<React.SetStateAction<any[]>>;
    setSuppliers: React.Dispatch<React.SetStateAction<any[]>>;
    setSupplierProducts: React.Dispatch<React.SetStateAction<any[]>>;
    setPurchaseInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    setSupplierPayments: React.Dispatch<React.SetStateAction<any[]>>;
    setElevators: React.Dispatch<React.SetStateAction<any[]>>;
    setInventoryTransactions: React.Dispatch<React.SetStateAction<any[]>>;
    setConfig: React.Dispatch<React.SetStateAction<any>>;
    saveSpecsDb: (data: any) => Promise<boolean>;
    saveConfig: (data: any) => Promise<boolean>;

    // Generic Save/Delete
    saveRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteRecordLocallyAndCloud: (collection: string, id: string) => Promise<boolean>;

    // Legacy (kept to avoid breaking quotes right now)
    saveQuote: (id: string, quote: any) => Promise<boolean>;
    deleteQuote: (id: string) => Promise<boolean>;

    migrateAllLocalData: () => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [phases, setPhases] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [warranties, setWarranties] = useState<any[]>([]);
    const [hrEmployees, setHrEmployees] = useState<any[]>([]);
    const [hrCommissions, setHrCommissions] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
    const [elevators, setElevators] = useState<any[]>([]);
    const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);

    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    // Módules to Sync mapping
    const modules: { collection: string, stateSetter: React.Dispatch<React.SetStateAction<any[]>> }[] = [
        { collection: 'jilco_quotes_archive', stateSetter: setQuotes },
        { collection: 'jilco_customers', stateSetter: setCustomers },
        { collection: 'jilco_projects', stateSetter: setProjects },
        { collection: 'jilco_phases', stateSetter: setPhases },
        { collection: 'jilco_invoices_archive', stateSetter: setInvoices },
        { collection: 'jilco_receipts_archive', stateSetter: setReceipts },
        { collection: 'jilco_contracts_archive', stateSetter: setContracts },
        { collection: 'jilco_expenses_archive', stateSetter: setExpenses },
        { collection: 'jilco_claims_archive', stateSetter: setClaims },
        { collection: 'jilco_documents', stateSetter: setDocuments },
        { collection: 'jilco_warranties_archive', stateSetter: setWarranties },
        { collection: 'jilco_hr_employees', stateSetter: setHrEmployees },
        { collection: 'jilco_hr_commissions', stateSetter: setHrCommissions },
        { collection: 'jilco_suppliers', stateSetter: setSuppliers },
        { collection: 'jilco_supplier_products', stateSetter: setSupplierProducts },
        { collection: 'jilco_purchase_invoices', stateSetter: setPurchaseInvoices },
        { collection: 'jilco_supplier_payments', stateSetter: setSupplierPayments },
        { collection: 'jilco_smart_elevators', stateSetter: setElevators },
        { collection: 'jilco_inventory_transactions', stateSetter: setInventoryTransactions }
    ];

    useEffect(() => {
        // 1. Load Initial Data for ALL modules
        loadAllData();

        // 2. Subscribe to Real-Time Updates for ALL modules
        const unsubscribes = modules.map(({ collection, stateSetter }) => {
            return cloudService.subscribeToCollection(collection, (payload) => {
                setSyncStatus('syncing');

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const updatedRecord = payload.new;
                    stateSetter((prev: any[]) => {
                        const exists = prev.find(q => (q.id || q.number) === updatedRecord.record_id);
                        if (exists) {
                            return prev.map(q => (q.id || q.number) === updatedRecord.record_id ? updatedRecord.data : q);
                        } else {
                            return [updatedRecord.data, ...prev];
                        }
                    });
                } else if (payload.eventType === 'DELETE') {
                    const deletedRecordId = payload.old.record_id;
                    stateSetter((prev: any[]) => prev.filter(q => (q.id || q.number) !== deletedRecordId));
                }

                setTimeout(() => setSyncStatus('synced'), 1000);
            });
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, []);

    const loadAllData = async () => {
        setSyncStatus('syncing');
        try {
            // Fetch everything in parallel
            await Promise.all(modules.map(async ({ collection, stateSetter }) => {
                // First try to show local for fast loading
                const localDataString = localStorage.getItem(collection);
                if (localDataString) {
                    try {
                        stateSetter(JSON.parse(localDataString));
                    } catch (e) { }
                }

                // Then fetch from cloud
                const cloudData = await cloudService.loadCollection(collection);
                if (cloudData && cloudData.length > 0) {
                    const parsedRecords = cloudData.map((row: any) => {
                        let parsed = row.data;
                        // Self-healing: Ensure local identifier matches the cloud record_id
                        if (!parsed.id && parsed.number) {
                            if (parsed.number !== row.record_id) {
                                // If the DB record ID does not match the actual 'number', it's a corrupted migration record.
                                // We fix it by deleting the bad record, and saving the correct one.
                                cloudService.deleteRecord(collection, row.record_id).then(() => {
                                    cloudService.saveRecord(collection, parsed.number, parsed);
                                });
                            }
                        } else if (parsed.id) {
                            if (parsed.id !== row.record_id) {
                                cloudService.deleteRecord(collection, row.record_id).then(() => {
                                    cloudService.saveRecord(collection, parsed.id, parsed);
                                });
                            }
                        }
                        return parsed;
                    });

                    stateSetter(parsedRecords);
                    localStorage.setItem(collection, JSON.stringify(parsedRecords)); // Update local cache
                } else {
                    // Critical Fix: If cloud is completely empty, we MUST clear the state and local storage, 
                    // otherwise deleted items keep returning from old local storage!
                    stateSetter([]);
                    localStorage.setItem(collection, '[]');
                }
            }));

            setSyncStatus('synced');
        } catch (error) {
            console.error('Error loading collections:', error);
            setSyncStatus('error');
        }

        // Special load for Config
        const localConfig = localStorage.getItem('jilco_quote_data');
        if (localConfig) {
            try { setConfig(JSON.parse(localConfig).config); } catch (e) { }
        }
        cloudService.loadCollection('jilco_config_db').then(cloudData => {
            if (cloudData && cloudData.length > 0 && cloudData[0].data) {
                setConfig(cloudData[0].data);
            }
        });
    };

    // Generic Save/Delete for all modules
    const saveRecord = async (collection: string, id: string, recordData: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            // 1. Optimistic UI update via specific state mapping
            const mod = modules.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => {
                    const exists = prev.find(q => (q.id || q.number) === id);
                    if (exists) return prev.map(q => (q.id || q.number) === id ? recordData : q);
                    return [recordData, ...prev];
                });
            }

            // 2. Save directly to Supabase Doc Store
            const success = await cloudService.saveRecord(collection, id, recordData);

            // 3. Keep Local Storage fresh
            const localArray = JSON.parse(localStorage.getItem(collection) || '[]');
            const exists = localArray.find((q: any) => (q.id || q.number) === id);
            let updatedLocalArray;
            if (exists) updatedLocalArray = localArray.map((q: any) => (q.id || q.number) === id ? recordData : q);
            else updatedLocalArray = [recordData, ...localArray];
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
            // 1. Optimistic UI update
            const mod = modules.find(m => m.collection === collection);
            if (mod) {
                mod.stateSetter(prev => prev.filter(q => (q.id || q.number) !== id));
            }

            // 2. Local Storage
            const localArray = JSON.parse(localStorage.getItem(collection) || '[]');
            localStorage.setItem(collection, JSON.stringify(localArray.filter((q: any) => (q.id || q.number) !== id)));

            // 3. Supabase
            const success = await cloudService.deleteRecord(collection, id);
            setSyncStatus(success ? 'synced' : 'error');
            return success;
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    // Legacy Wrappers for Quotes (so we don't break existing QuotesModule)
    const saveQuote = (id: string, quoteData: any) => saveRecord('jilco_quotes_archive', id, quoteData);
    const deleteQuote = (id: string) => deleteRecordLocallyAndCloud('jilco_quotes_archive', id);

    // Special save for Config
    const saveConfig = async (configData: any): Promise<boolean> => {
        setConfig(configData);
        const existingData = JSON.parse(localStorage.getItem('jilco_quote_data') || '{}');
        existingData.config = configData;
        localStorage.setItem('jilco_quote_data', JSON.stringify(existingData));
        return await cloudService.saveRecord('jilco_config_db', 'singleton_config', configData);
    };

    // Special save for SpecsDb
    const saveSpecsDb = async (specsData: any): Promise<boolean> => {
        // Needs local implementation if we use SpecsDb directly in this context, but we use it via saveRecord already in SpecsManagerModule 
        // wait, I see I used saveSpecsDb in SpecsManagerModule.
        return await saveRecord('jilco_specs_db', 'singleton_specs', specsData);
    };


    const migrateAllLocalData = async (): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            const collectionsToMigrate = modules.map(m => m.collection);

            let totalMigrated = 0;

            for (const collection of collectionsToMigrate) {
                const localData = localStorage.getItem(collection);
                if (localData) {
                    const parsedArray = JSON.parse(localData);
                    if (Array.isArray(parsedArray)) {
                        for (const item of parsedArray) {
                            // Ensure the item has an ID
                            const itemId = item.id || item.number || Date.now().toString() + Math.random().toString(36).substring(7);
                            await cloudService.saveRecord(collection, itemId, item);
                            totalMigrated++;
                        }
                    }
                }
            }

            console.log(`✅ Migration Complete: Migrated ${totalMigrated} records to Real-Time Cloud.`);
            setSyncStatus('synced');

            await loadAllData();
            return true;

        } catch (e) {
            console.error('Migration failed:', e);
            setSyncStatus('error');
            return false;
        }
    };

    return (
        <DataContext.Provider value={{
            quotes, customers, projects, phases, invoices, receipts, contracts, expenses, claims,
            documents, warranties, hrEmployees, hrCommissions, suppliers, supplierProducts, purchaseInvoices, supplierPayments, elevators, config,
            setQuotes, setCustomers, setProjects, setPhases, setInvoices, setReceipts, setContracts, setExpenses, setClaims,
            setDocuments, setWarranties, setHrEmployees, setHrCommissions, setSuppliers, setSupplierProducts, setPurchaseInvoices, setSupplierPayments, setElevators, setConfig,
            saveRecord, deleteRecordLocallyAndCloud, saveQuote, deleteQuote, saveConfig, saveSpecsDb, migrateAllLocalData, syncStatus
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
