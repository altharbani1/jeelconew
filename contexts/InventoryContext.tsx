import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';
import { SupplierProduct, InventoryTransaction } from '../types';

interface InventoryContextType {
    supplierProducts: SupplierProduct[];
    inventoryTransactions: InventoryTransaction[];
    setSupplierProducts: React.Dispatch<React.SetStateAction<SupplierProduct[]>>;
    setInventoryTransactions: React.Dispatch<React.SetStateAction<InventoryTransaction[]>>;
    saveInventoryRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteInventoryRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
    const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);

    const modules = [
        { collection: 'jilco_supplier_products', stateSetter: setSupplierProducts as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_inventory_transactions', stateSetter: setInventoryTransactions as React.Dispatch<React.SetStateAction<any[]>> }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <InventoryContext.Provider value={{
            supplierProducts,
            inventoryTransactions,
            setSupplierProducts,
            setInventoryTransactions,
            saveInventoryRecord: saveRecord,
            deleteInventoryRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) throw new Error('useInventory must be used within an InventoryProvider');
    return context;
};
