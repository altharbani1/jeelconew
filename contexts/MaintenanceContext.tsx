import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MaintenanceContract, MaintenanceTicket, MaintenanceVisit } from '../types';

interface MaintenanceContextType {
    contracts: MaintenanceContract[];
    tickets: MaintenanceTicket[];
    visits: MaintenanceVisit[];
    addContract: (contract: MaintenanceContract) => void;
    updateContract: (id: string, contract: Partial<MaintenanceContract>) => void;
    deleteContract: (id: string) => void;
    addTicket: (ticket: MaintenanceTicket) => void;
    updateTicket: (id: string, ticket: Partial<MaintenanceTicket>) => void;
    deleteTicket: (id: string) => void;
    updateVisit: (id: string, visit: Partial<MaintenanceVisit>) => void;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const MaintenanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
    const [visits, setVisits] = useState<MaintenanceVisit[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        const savedContracts = localStorage.getItem('jilco_maintenance_contracts');
        const savedTickets = localStorage.getItem('jilco_maintenance_tickets');
        const savedVisits = localStorage.getItem('jilco_maintenance_visits');

        if (savedContracts) setContracts(JSON.parse(savedContracts));
        if (savedTickets) setTickets(JSON.parse(savedTickets));
        if (savedVisits) setVisits(JSON.parse(savedVisits));
    }, []);

    // Save to local storage when state changes
    useEffect(() => {
        localStorage.setItem('jilco_maintenance_contracts', JSON.stringify(contracts));
    }, [contracts]);

    useEffect(() => {
        localStorage.setItem('jilco_maintenance_tickets', JSON.stringify(tickets));
    }, [tickets]);

    useEffect(() => {
        localStorage.setItem('jilco_maintenance_visits', JSON.stringify(visits));
    }, [visits]);

    const generateVisitsForContract = (contract: MaintenanceContract) => {
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
    };

    // Actions
    const addContract = (contract: MaintenanceContract) => {
        setContracts(prev => [...prev, contract]);
        generateVisitsForContract(contract);
    };

    const updateContract = (id: string, updatedFields: Partial<MaintenanceContract>) => {
        setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updatedFields } : c));
    };

    const deleteContract = (id: string) => {
        setContracts(prev => prev.filter(c => c.id !== id));
        setVisits(prev => prev.filter(v => v.contractId !== id));
    };

    const addTicket = (ticket: MaintenanceTicket) => setTickets(prev => [...prev, ticket]);

    const updateTicket = (id: string, updatedFields: Partial<MaintenanceTicket>) => {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
    };

    const deleteTicket = (id: string) => setTickets(prev => prev.filter(t => t.id !== id));

    const updateVisit = (id: string, updatedFields: Partial<MaintenanceVisit>) => {
        setVisits(prev => prev.map(v => v.id === id ? { ...v, ...updatedFields } : v));
    };

    return (
        <MaintenanceContext.Provider value={{
            contracts, tickets, visits,
            addContract, updateContract, deleteContract,
            addTicket, updateTicket, deleteTicket,
            updateVisit
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
