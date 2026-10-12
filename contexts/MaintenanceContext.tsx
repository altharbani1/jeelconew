import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MaintenanceContract, MaintenanceTicket, MaintenanceVisit } from '../types';
import { useCloudSync } from '../lib/useCloudSync';

interface MaintenanceContextType {
    contracts: MaintenanceContract[];
    tickets: MaintenanceTicket[];
    visits: MaintenanceVisit[];
    addContract: (contract: MaintenanceContract) => Promise<void>;
    updateContract: (id: string, contract: Partial<MaintenanceContract>) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    addTicket: (ticket: MaintenanceTicket) => Promise<void>;
    updateTicket: (id: string, ticket: Partial<MaintenanceTicket>) => Promise<void>;
    deleteTicket: (id: string) => Promise<void>;
    updateVisit: (id: string, visit: Partial<MaintenanceVisit>) => Promise<void>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const MaintenanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
    const [visits, setVisits] = useState<MaintenanceVisit[]>([]);

    // Keep the existing localStorage keys as a fast offline cache while syncing
    // the same records through the shared Supabase-backed cloud store.
    const modules = [
        { collection: 'jilco_maintenance_contracts', stateSetter: setContracts as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_tickets', stateSetter: setTickets as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_visits', stateSetter: setVisits as React.Dispatch<React.SetStateAction<any[]>> }
    ];
    const { syncStatus, saveRecord, deleteRecord } = useCloudSync(modules);

    const generateVisitsForContract = async (contract: MaintenanceContract) => {
        const newVisits: MaintenanceVisit[] = [];
        const startDate = new Date(contract.startDate);
        const endDate = new Date(contract.endDate);
        const visitsCount = contract.visitsPerYear;
        
        if (visitsCount <= 0) return;

        const totalTime = endDate.getTime() - startDate.getTime();
        const totalDays = Math.floor(totalTime / (1000 * 3600 * 24));
        const intervalDays = totalDays / visitsCount;

        for (let i = 1; i <= visitsCount; i++) {
            const scheduledDate = new Date(startDate.getTime() + (intervalDays * i * 24 * 3600 * 1000));
            newVisits.push({
                id: `VISIT-${Date.now()}-${i}`,
                contractId: contract.id,
                scheduledDate: scheduledDate.toISOString().split('T')[0],
                status: 'pending'
            });
        }

        setVisits(prev => [...prev, ...newVisits]);
        await Promise.all(newVisits.map(visit => saveRecord('jilco_maintenance_visits', visit.id, visit)));
    };

    // Actions
    const addContract = async (contract: MaintenanceContract) => {
        setContracts(prev => [...prev, contract]);
        await saveRecord('jilco_maintenance_contracts', contract.id, contract);
        await generateVisitsForContract(contract);
    };

    const updateContract = async (id: string, updatedFields: Partial<MaintenanceContract>) => {
        const current = contracts.find(contract => contract.id === id);
        if (!current) return;
        const updated = { ...current, ...updatedFields };
        setContracts(prev => prev.map(c => c.id === id ? updated : c));
        await saveRecord('jilco_maintenance_contracts', id, updated);
    };

    const deleteContract = async (id: string) => {
        const linkedVisits = visits.filter(visit => visit.contractId === id);
        setContracts(prev => prev.filter(c => c.id !== id));
        setVisits(prev => prev.filter(visit => visit.contractId !== id));
        await deleteRecord('jilco_maintenance_contracts', id);
        await Promise.all(linkedVisits.map(visit => deleteRecord('jilco_maintenance_visits', visit.id)));
    };

    const addTicket = async (ticket: MaintenanceTicket) => {
        setTickets(prev => [...prev, ticket]);
        await saveRecord('jilco_maintenance_tickets', ticket.id, ticket);
    };

    const updateTicket = async (id: string, updatedFields: Partial<MaintenanceTicket>) => {
        const current = tickets.find(ticket => ticket.id === id);
        if (!current) return;
        const updated = { ...current, ...updatedFields };
        setTickets(prev => prev.map(t => t.id === id ? updated : t));
        await saveRecord('jilco_maintenance_tickets', id, updated);
    };

    const deleteTicket = async (id: string) => {
        setTickets(prev => prev.filter(t => t.id !== id));
        await deleteRecord('jilco_maintenance_tickets', id);
    };

    const updateVisit = async (id: string, updatedFields: Partial<MaintenanceVisit>) => {
        const current = visits.find(visit => visit.id === id);
        if (!current) return;
        const updated = { ...current, ...updatedFields };
        setVisits(prev => prev.map(v => v.id === id ? updated : v));
        await saveRecord('jilco_maintenance_visits', id, updated);
    };

    return (
        <MaintenanceContext.Provider value={{
            contracts, tickets, visits,
            addContract, updateContract, deleteContract,
            addTicket, updateTicket, deleteTicket,
            updateVisit,
            syncStatus
        }}>
            {children}
        </MaintenanceContext.Provider>
    );
};

export const useMaintenance = () => {
    const context = useContext(MaintenanceContext);
    if (context === undefined) {
        throw new Error('useMaintenance must be used within a MaintenanceProvider');
    }
    return context;
};
