import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useCloudSync } from '../lib/useCloudSync';

interface ProjectContextType {
    projects: any[];
    phases: any[];
    contracts: any[];
    expenses: any[];
    claims: any[];
    documents: any[];
    warranties: any[];
    setProjects: React.Dispatch<React.SetStateAction<any[]>>;
    setPhases: React.Dispatch<React.SetStateAction<any[]>>;
    setContracts: React.Dispatch<React.SetStateAction<any[]>>;
    setExpenses: React.Dispatch<React.SetStateAction<any[]>>;
    setClaims: React.Dispatch<React.SetStateAction<any[]>>;
    setDocuments: React.Dispatch<React.SetStateAction<any[]>>;
    setWarranties: React.Dispatch<React.SetStateAction<any[]>>;
    saveProjectRecord: (collection: string, id: string, data: any) => Promise<boolean>;
    deleteProjectRecord: (collection: string, id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [projects, setProjects] = useState<any[]>([]);
    const [phases, setPhases] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [warranties, setWarranties] = useState<any[]>([]);

    const modules = [
        { collection: 'jilco_projects', stateSetter: setProjects },
        { collection: 'jilco_phases', stateSetter: setPhases },
        { collection: 'jilco_contracts_archive', stateSetter: setContracts },
        { collection: 'jilco_expenses_archive', stateSetter: setExpenses },
        { collection: 'jilco_claims_archive', stateSetter: setClaims },
        { collection: 'jilco_documents', stateSetter: setDocuments },
        { collection: 'jilco_warranties_archive', stateSetter: setWarranties }
    ];

    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    return (
        <ProjectContext.Provider value={{
            projects, phases, contracts, expenses, claims, documents, warranties,
            setProjects, setPhases, setContracts, setExpenses, setClaims, setDocuments, setWarranties,
            saveProjectRecord: saveRecord,
            deleteProjectRecord: deleteRecord,
            syncStatus
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) throw new Error('useProject must be used within a ProjectProvider');
    return context;
};
