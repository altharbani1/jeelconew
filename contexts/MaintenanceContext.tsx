import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MaintenanceContract, MaintenanceTicket, MaintenanceTicketEvent, MaintenanceVisit, MaintenancePartUsage, TicketEventType } from '../types';
import { useCloudSync } from '../lib/useCloudSync';

interface MaintenanceContextType {
    contracts: MaintenanceContract[];
    tickets: MaintenanceTicket[];
    ticketEvents: MaintenanceTicketEvent[];
    partUsages: MaintenancePartUsage[];
    visits: MaintenanceVisit[];
    addContract: (contract: MaintenanceContract) => Promise<void>;
    updateContract: (id: string, contract: Partial<MaintenanceContract>) => Promise<void>;
    deleteContract: (id: string) => Promise<void>;
    addTicket: (ticket: MaintenanceTicket) => Promise<void>;
    updateTicket: (id: string, ticket: Partial<MaintenanceTicket>) => Promise<void>;
    deleteTicket: (id: string) => Promise<void>;
    getTicketEvents: (ticketId: string) => MaintenanceTicketEvent[];
    addPartUsage: (usage: MaintenancePartUsage, target: { ticketId?: string; visitId?: string }) => Promise<void>;
    updateVisit: (id: string, visit: Partial<MaintenanceVisit>) => Promise<void>;
    addVisit: (visit: MaintenanceVisit) => Promise<void>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

const overlaps = (a: MaintenanceVisit, b: MaintenanceVisit) => {
    if (a.scheduledDate !== b.scheduledDate || !a.technicianId || a.technicianId !== b.technicianId) return false;
    // Date-only legacy visits remain compatible because their duration is unknown.
    if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
    return a.startTime < b.endTime && b.startTime < a.endTime;
};

const assertNoTechnicianConflict = (candidate: MaintenanceVisit, visits: MaintenanceVisit[]) => {
    if ((candidate.startTime && !candidate.endTime) || (!candidate.startTime && candidate.endTime)) {
        throw new Error('يجب إدخال وقت البداية والنهاية معًا أو تركهما فارغين');
    }
    if (candidate.startTime && candidate.endTime && candidate.startTime >= candidate.endTime) {
        throw new Error('وقت نهاية الموعد يجب أن يكون بعد وقت البداية');
    }
    const conflict = visits.find(existing => existing.id !== candidate.id
        && !['completed', 'missed', 'cancelled'].includes(existing.status)
        && existing.workOrderStatus !== 'cancelled'
        && overlaps(candidate, existing));
    if (conflict) throw new Error(`الفني مرتبط بموعد متعارض في ${conflict.scheduledDate} من ${conflict.startTime} إلى ${conflict.endTime}`);
};

export const MaintenanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
    const [ticketEvents, setTicketEvents] = useState<MaintenanceTicketEvent[]>([]);
    const [partUsages, setPartUsages] = useState<MaintenancePartUsage[]>([]);
    const [visits, setVisits] = useState<MaintenanceVisit[]>([]);

    // Keep the existing localStorage keys as a fast offline cache while syncing
    // the same records through the shared Supabase-backed cloud store.
    const normalizeVisit = (visit: MaintenanceVisit): MaintenanceVisit => ({
        ...visit,
        // These defaults make old date-only rows participate in the new ERP model
        // without changing their historical status or scheduled date.
        visitType: visit.visitType || (visit.ticketId ? 'corrective' : 'preventive'),
        workOrderStatus: visit.workOrderStatus || (visit.status === 'completed' ? 'completed' : 'not_started'),
        plannedDurationMinutes: visit.plannedDurationMinutes || 60,
        priority: visit.priority || (visit.ticketId ? 'high' : 'medium')
    });
    const setNormalizedVisits: React.Dispatch<React.SetStateAction<any[]>> = action => {
        setVisits(previous => {
            const next = typeof action === 'function' ? action(previous) : action;
            return next.map(normalizeVisit);
        });
    };
    const modules = [
        { collection: 'jilco_maintenance_contracts', stateSetter: setContracts as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_tickets', stateSetter: setTickets as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_ticket_events', stateSetter: setTicketEvents as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_part_usages', stateSetter: setPartUsages as React.Dispatch<React.SetStateAction<any[]>> },
        { collection: 'jilco_maintenance_visits', stateSetter: setNormalizedVisits }
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
                sequenceNumber: i,
                recurrenceKey: `${contract.id}:${i}`,
                visitType: 'preventive',
                plannedDurationMinutes: 60,
                priority: 'medium',
                status: 'pending',
                workOrderStatus: 'not_started'
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
                    sequenceNumber: index + 1,
                    recurrenceKey: `${contract.id}:${index + 1}`,
                    visitType: 'preventive',
                    plannedDurationMinutes: 60,
                    priority: 'medium',
                    status: 'pending',
                    workOrderStatus: 'not_started'
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

    const saveTicketEvent = async (ticketId: string, type: TicketEventType, description: string, details: Partial<MaintenanceTicketEvent> = {}) => {
        const event: MaintenanceTicketEvent = {
            id: `TKE-${ticketId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ticketId,
            type,
            description,
            createdAt: new Date().toISOString(),
            ...details
        };
        await saveRecord('jilco_maintenance_ticket_events', event.id, event);
    };

    const addTicket = async (ticket: MaintenanceTicket) => {
        const normalized: MaintenanceTicket = {
            ...ticket,
            lastUpdatedAt: ticket.lastUpdatedAt || new Date().toISOString(),
            slaResolutionDueDate: ticket.slaResolutionDueDate || ticket.slaDueDate
        };
        setTickets(prev => [...prev, normalized]);
        const saved = await saveRecord('jilco_maintenance_tickets', normalized.id, normalized);
        if (!saved) throw new Error('تعذر حفظ تذكرة الصيانة');
        await saveTicketEvent(normalized.id, 'created', 'تم إنشاء التذكرة', { toStatus: normalized.status });
    };

    const updateTicket = async (id: string, updatedFields: Partial<MaintenanceTicket>) => {
        const current = tickets.find(ticket => ticket.id === id);
        if (!current) return;
        const updated: MaintenanceTicket = {
            ...current,
            ...updatedFields,
            lastUpdatedAt: new Date().toISOString(),
            slaResolutionDueDate: updatedFields.slaResolutionDueDate || current.slaResolutionDueDate || updatedFields.slaDueDate || current.slaDueDate
        };
        setTickets(prev => prev.map(t => t.id === id ? updated : t));
        const saved = await saveRecord('jilco_maintenance_tickets', id, updated);
        if (!saved) throw new Error('تعذر تحديث تذكرة الصيانة');
        const changedStatus = updated.status !== current.status;
        await saveTicketEvent(id, changedStatus ? 'status_changed' : 'updated', changedStatus ? `تغيرت حالة التذكرة إلى ${updated.status}` : 'تم تحديث بيانات التذكرة', {
            fromStatus: current.status,
            toStatus: updated.status,
            metadata: { changedFields: Object.keys(updatedFields) }
        });
    };

    const deleteTicket = async (id: string) => {
        const current = tickets.find(t => t.id === id);
        if (current) await saveTicketEvent(id, 'deleted', 'تم حذف التذكرة', { fromStatus: current.status });
        setTickets(prev => prev.filter(t => t.id !== id));
        await deleteRecord('jilco_maintenance_tickets', id);
    };

    const getTicketEvents = (ticketId: string) => ticketEvents
        .filter(event => event.ticketId === ticketId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const addPartUsage = async (usage: MaintenancePartUsage, target: { ticketId?: string; visitId?: string }) => {
        const record = { ...usage, ...target } as MaintenancePartUsage;
        const saved = await saveRecord('jilco_maintenance_part_usages', usage.id, record);
        if (!saved) throw new Error('تعذر حفظ صرف قطعة الغيار');
    };

    const updateVisit = async (id: string, updatedFields: Partial<MaintenanceVisit>) => {
        const current = visits.find(visit => visit.id === id);
        if (!current) return;
        const nextStatus = updatedFields.status ?? current.status;
        const updated: MaintenanceVisit = {
            ...current,
            ...updatedFields,
            ...normalizeVisit({ ...current, ...updatedFields }),
            completedDate: nextStatus === 'completed'
                ? (updatedFields.completedDate || current.completedDate || new Date().toISOString().split('T')[0])
                : updatedFields.status ? undefined : (updatedFields.completedDate ?? current.completedDate)
        };
        assertNoTechnicianConflict(updated, visits);
        setVisits(prev => prev.map(v => v.id === id ? updated : v));
        const saved = await saveRecord('jilco_maintenance_visits', id, updated);
        if (!saved) throw new Error('تعذر تحديث موعد الصيانة');
    };

    const addVisit = async (visit: MaintenanceVisit) => {
        const normalized = normalizeVisit(visit);
        assertNoTechnicianConflict(normalized, visits);
        setVisits(prev => [...prev, normalized]);
        const saved = await saveRecord('jilco_maintenance_visits', normalized.id, normalized);
        if (!saved) {
            setVisits(prev => prev.filter(existing => existing.id !== normalized.id));
            throw new Error('تعذر حفظ موعد الصيانة');
        }
    };

    return (
        <MaintenanceContext.Provider value={{
            contracts, tickets, ticketEvents, partUsages, visits,
            addContract, updateContract, deleteContract,
            addTicket, updateTicket, deleteTicket, getTicketEvents, addPartUsage,
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
