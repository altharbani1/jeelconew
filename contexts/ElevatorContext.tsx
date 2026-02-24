import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';

interface ElevatorContextType {
    elevators: any[];
    setElevators: React.Dispatch<React.SetStateAction<any[]>>;
    saveElevatorRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteElevatorRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const ElevatorContext = createContext<ElevatorContextType | undefined>(undefined);

export const ElevatorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [elevators, setElevators] = useState<any[]>([]);

    const modules = [
        { collection: 'jilco_smart_elevators', stateSetter: setElevators }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <ElevatorContext.Provider value={{
            elevators,
            setElevators,
            saveElevatorRecord: saveRecord,
            deleteElevatorRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </ElevatorContext.Provider>
    );
};

export const useElevator = () => {
    const context = useContext(ElevatorContext);
    if (context === undefined) throw new Error('useElevator must be used within an ElevatorProvider');
    return context;
};
