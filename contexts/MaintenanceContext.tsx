import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MaintenanceContract, MaintenanceTicket } from '../types';

interface MaintenanceContextType {
    contracts: MaintenanceContract[];
    tickets: MaintenanceTicket[];
    addContract: (contract: MaintenanceContract) => void;
    updateContract: (id: string, contract: Partial<MaintenanceContract>) => void;
    deleteContract: (id: string) => void;
    addTicket: (ticket: MaintenanceTicket) => void;
    updateTicket: (id: string, ticket: Partial<MaintenanceTicket>) => void;
    deleteTicket: (id: string) => void;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const MaintenanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        const savedContracts = localStorage.getItem('jilco_maintenance_contracts');
        const savedTickets = localStorage.getItem('jilco_maintenance_tickets');

        if (savedContracts) setContracts(JSON.parse(savedContracts));
        if (savedTickets) setTickets(JSON.parse(savedTickets));
    }, []);

    // Save to local storage when state changes
    useEffect(() => {
        localStorage.setItem('jilco_maintenance_contracts', JSON.stringify(contracts));
    }, [contracts]);

    useEffect(() => {
        localStorage.setItem('jilco_maintenance_tickets', JSON.stringify(tickets));
    }, [tickets]);

    // Actions
    const addContract = (contract: MaintenanceContract) => setContracts(prev => [...prev, contract]);

    const updateContract = (id: string, updatedFields: Partial<MaintenanceContract>) => {
        setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updatedFields } : c));
    };

    const deleteContract = (id: string) => setContracts(prev => prev.filter(c => c.id !== id));

    const addTicket = (ticket: MaintenanceTicket) => setTickets(prev => [...prev, ticket]);

    const updateTicket = (id: string, updatedFields: Partial<MaintenanceTicket>) => {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
    };

    const deleteTicket = (id: string) => setTickets(prev => prev.filter(t => t.id !== id));

    return (
        <MaintenanceContext.Provider value={{
            contracts, tickets,
            addContract, updateContract, deleteContract,
            addTicket, updateTicket, deleteTicket
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
