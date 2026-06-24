import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';

interface SalesContextType {
    quotes: any[];
    customers: any[];
    invoices: any[];
    receipts: any[];
    setQuotes: React.Dispatch<React.SetStateAction<any[]>>;
    setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
    setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    setReceipts: React.Dispatch<React.SetStateAction<any[]>>;
    saveSalesRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteSalesRecord: (collection: string, id: string) => Promise<boolean>;
    saveQuote: (id: string, quote: any) => Promise<boolean>;
    deleteQuote: (id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);

    const modules = [
        { collection: 'jilco_quotes_archive', stateSetter: setQuotes },
        { collection: 'jilco_customers', stateSetter: setCustomers },
        { collection: 'jilco_invoices_archive', stateSetter: setInvoices },
        { collection: 'jilco_receipts_archive', stateSetter: setReceipts }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    const saveSalesRecord = (collection: string, id: string, data: any) =>
        saveRecord(collection, id, data);

    const deleteSalesRecord = (collection: string, id: string) =>
        deleteRecord(collection, id);

    const saveQuote = (id: string, data: any) =>
        saveRecord('jilco_quotes_archive', id, data);

    const deleteQuote = (id: string) =>
        deleteRecord('jilco_quotes_archive', id);

    return (
        <SalesContext.Provider value={{
            quotes, customers, invoices, receipts,
            setQuotes, setCustomers, setInvoices, setReceipts,
            saveSalesRecord, deleteSalesRecord, saveQuote, deleteQuote, syncStatus
        }}>
            {children}
        </SalesContext.Provider>
    );
};

export const useSales = () => {
    const context = useContext(SalesContext);
    if (!context) throw new Error('useSales must be used within a SalesProvider');
    return context;
};
