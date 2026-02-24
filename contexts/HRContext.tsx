import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';

interface HRContextType {
    hrEmployees: any[];
    hrCommissions: any[];
    setHrEmployees: React.Dispatch<React.SetStateAction<any[]>>;
    setHrCommissions: React.Dispatch<React.SetStateAction<any[]>>;
    saveHRRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteHRRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const HRContext = createContext<HRContextType | undefined>(undefined);

export const HRProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [hrEmployees, setHrEmployees] = useState<any[]>([]);
    const [hrCommissions, setHrCommissions] = useState<any[]>([]);

    const modules = [
        { collection: 'jilco_hr_employees', stateSetter: setHrEmployees },
        { collection: 'jilco_hr_commissions', stateSetter: setHrCommissions }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <HRContext.Provider value={{
            hrEmployees, hrCommissions,
            setHrEmployees, setHrCommissions,
            saveHRRecord: saveRecord,
            deleteHRRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </HRContext.Provider>
    );
};

export const useHR = () => {
    const context = useContext(HRContext);
    if (context === undefined) throw new Error('useHR must be used within an HRProvider');
    return context;
};
