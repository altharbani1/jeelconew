import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';

interface PurchaseContextType {
    suppliers: any[];
    purchaseInvoices: any[];
    supplierPayments: any[];
    setSuppliers: React.Dispatch<React.SetStateAction<any[]>>;
    setPurchaseInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    setSupplierPayments: React.Dispatch<React.SetStateAction<any[]>>;
    savePurchaseRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deletePurchaseRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

export const PurchaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<any[]>([]);

    const modules = [
        { collection: 'jilco_suppliers', stateSetter: setSuppliers },
        { collection: 'jilco_purchase_invoices', stateSetter: setPurchaseInvoices },
        { collection: 'jilco_supplier_payments', stateSetter: setSupplierPayments }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <PurchaseContext.Provider value={{
            suppliers, purchaseInvoices, supplierPayments,
            setSuppliers, setPurchaseInvoices, setSupplierPayments,
            savePurchaseRecord: saveRecord,
            deletePurchaseRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </PurchaseContext.Provider>
    );
};

export const usePurchase = () => {
    const context = useContext(PurchaseContext);
    if (context === undefined) throw new Error('usePurchase must be used within a PurchaseProvider');
    return context;
};
