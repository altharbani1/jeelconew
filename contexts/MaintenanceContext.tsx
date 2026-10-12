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
    addVisit: (visit: MaintenanceVisit) => Promise<void>;
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
                // Deterministic IDs make retries and schedule regeneration
                // idempotent instead of creating duplicate appointments.
                id: `VISIT-${contract.id}-${i}`,
                contractId: contract.id,
                scheduledDate: scheduledDate.toISOString().split('T')[0],
                status: 'pending'
            });
        }

        setVisits(prev => {
            const byId = new Map(prev.map(visit => [visit.id, visit]));
            newVisits.forEach(visit => byId.set(visit.id, visit));
            return [...byId.values()];
        });
        const results = await Promise.all(newVisits.map(visit => saveRecord('jilco_maintenance_visits', visit.id, visit)));
        if (results.some(result => !result)) throw new Error('تعذر حفظ مواعيد الصيانة');
    };

    /**
     * Reconcile a contract's future schedule without rewriting completed visits.
     * This keeps the service history intact when dates or visit frequency change.
     */
    const reconcileVisitsForContract = async (contract: MaintenanceContract) => {
        const existing = visits
            .filter(visit => visit.contractId === contract.id)
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
        const start = new Date(`${contract.startDate}T00:00:00`);
        const end = new Date(`${contract.endDate}T00:00:00`);
        const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
        const targets = Array.from({ length: Math.max(0, contract.visitsPerYear) }, (_, index) => {
            const date = new Date(start.getTime() + (totalDays * (index + 1) / contract.visitsPerYear) * 86400000);
            return date.toISOString().split('T')[0];
        });

        const nextVisits: MaintenanceVisit[] = [];
        const writes: Promise<boolean>[] = [];
        targets.forEach((scheduledDate, index) => {
            const current = existing[index];
            if (current) {
                const next = (current.status === 'pending' || current.status === 'rescheduled')
                    ? { ...current, scheduledDate }
                    : current;
                nextVisits.push(next);
                if (next !== current) writes.push(saveRecord('jilco_maintenance_visits', next.id, next));
            } else {
                const next: MaintenanceVisit = {
                    id: `VISIT-${contract.id}-${index + 1}`,
                    contractId: contract.id,
                    scheduledDate,
                    status: 'pending'
                };
                nextVisits.push(next);
                writes.push(saveRecord('jilco_maintenance_visits', next.id, next));
            }
        });

        // Never delete completed/missed history; only remove excess future slots.
        const retainedIds = new Set(nextVisits.map(visit => visit.id));
        const removable = existing.filter(visit => !retainedIds.has(visit.id) && (visit.status === 'pending' || visit.status === 'rescheduled'));
        removable.forEach(visit => writes.push(deleteRecord('jilco_maintenance_visits', visit.id)));
        setVisits(prev => {
            const removedIds = new Set(removable.map(visit => visit.id));
            const nextById = new Map(prev.filter(visit => !removedIds.has(visit.id)).map(visit => [visit.id, visit]));
            nextVisits.forEach(visit => nextById.set(visit.id, visit));
            return Array.from(nextById.values());
        });
        const results = await Promise.all(writes);
        if (results.some(result => !result)) throw new Error('تعذر تحديث جدول مواعيد الصيانة');
    };

    // Actions
    const addContract = async (contract: MaintenanceContract) => {
        setContracts(prev => [...prev, contract]);
        const saved = await saveRecord('jilco_maintenance_contracts', contract.id, contract);
        if (!saved) {
            setContracts(prev => prev.filter(existing => existing.id !== contract.id));
            throw new Error('تعذر حفظ عقد الصيانة');
        }
        await generateVisitsForContract(contract);
    };

    const updateContract = async (id: string, updatedFields: Partial<MaintenanceContract>) => {
        const current = contracts.find(contract => contract.id === id);
        if (!current) return;
        const updated = { ...current, ...updatedFields };
        const saved = await saveRecord('jilco_maintenance_contracts', id, updated);
        if (!saved) throw new Error('تعذر تحديث عقد الصيانة');
        setContracts(prev => prev.map(contract => contract.id === id ? updated : contract));

        const scheduleChanged = updated.startDate !== current.startDate
            || updated.endDate !== current.endDate
            || updated.visitsPerYear !== current.visitsPerYear;
        if (scheduleChanged) {
            await reconcileVisitsForContract(updated);
        }
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
        const nextStatus = updatedFields.status ?? current.status;
        const updated = {
            ...current,
            ...updatedFields,
            completedDate: nextStatus === 'completed'
                ? (updatedFields.completedDate || current.completedDate || new Date().toISOString().split('T')[0])
                : updatedFields.status ? undefined : (updatedFields.completedDate ?? current.completedDate)
        };
        setVisits(prev => prev.map(v => v.id === id ? updated : v));
        await saveRecord('jilco_maintenance_visits', id, updated);
    };

    const addVisit = async (visit: MaintenanceVisit) => {
        setVisits(prev => [...prev, visit]);
        await saveRecord('jilco_maintenance_visits', visit.id, visit);
    };

    return (
        <MaintenanceContext.Provider value={{
            contracts, tickets, visits,
            addContract, updateContract, deleteContract,
            addTicket, updateTicket, deleteTicket,
            updateVisit, addVisit,
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
