import React, { createContext, useContext, useState, useEffect } from 'react';
import { Subcontractor, Subcontract, Attachment } from '../types';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { useCloudSync } from '../lib/useCloudSync';

interface SubcontractContextType {
    subcontractors: Subcontractor[];
    subcontracts: Subcontract[];
    syncStatus: 'synced' | 'syncing' | 'error';
    addSubcontractor: (subcontractor: Omit<Subcontractor, 'id' | 'createdAt'>) => Promise<void>;
    updateSubcontractor: (id: string, updates: Partial<Subcontractor>) => Promise<void>;
    deleteSubcontractor: (id: string) => Promise<void>;
    addSubcontract: (subcontract: Omit<Subcontract, 'id'>) => Promise<void>;
    updateSubcontract: (id: string, updates: Partial<Subcontract>) => Promise<void>;
    deleteSubcontract: (id: string) => Promise<void>;
    uploadSubcontractAttachment: (subcontractId: string, file: File, type: 'image' | 'pdf') => Promise<void>;
    deleteSubcontractAttachment: (subcontractId: string, attachmentId: string) => Promise<void>;
}

const SubcontractContext = createContext<SubcontractContextType | null>(null);

export const useSubcontract = () => {
    const context = useContext(SubcontractContext);
    if (!context) {
        throw new Error('useSubcontract must be used within a SubcontractProvider');
    }
    return context;
};

export const SubcontractProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const { logActivity } = useData();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);

    // We reuse the generic Cloud Sync hook for our two new tables
    // In a real database (Supabase), you'd need to create "subcontractors" and "subcontracts" tables.
    const { syncStatus, saveRecord, deleteRecord } = useCloudSync([
        { collection: 'subcontractors', stateSetter: setSubcontractors as any },
        { collection: 'subcontracts', stateSetter: setSubcontracts as any }
    ]);

    const addSubcontractor = async (subcontractorData: Omit<Subcontractor, 'id' | 'createdAt'>) => {
        const newSubcontractor: Subcontractor = {
            ...subcontractorData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        };
        await saveRecord('subcontractors', newSubcontractor.id, newSubcontractor);
        await logActivity('إضافة', `إضافة مقاول باطن جديد: ${newSubcontractor.name}`, 'عقود مقاولي الباطن');
    };

    const updateSubcontractor = async (id: string, updates: Partial<Subcontractor>) => {
        const subcontractor = subcontractors.find(s => s.id === id);
        if (!subcontractor) return;

        const updated = { ...subcontractor, ...updates };
        await saveRecord('subcontractors', id, updated);
        await logActivity('تعديل', `تعديل بيانات مقاول الباطن: ${updated.name}`, 'عقود مقاولي الباطن');
    };

    const deleteSubcontractor = async (id: string) => {
        const deleted = subcontractors.find(s => s.id === id);
        if (deleted) {
            await deleteRecord('subcontractors', id);
            await logActivity('حذف', `حذف مقاول الباطن: ${deleted.name}`, 'عقود مقاولي الباطن');
        }
    };

    const addSubcontract = async (subcontractData: Omit<Subcontract, 'id'>) => {
        const newSubcontract: Subcontract = {
            ...subcontractData,
            id: crypto.randomUUID()
        };
        await saveRecord('subcontracts', newSubcontract.id, newSubcontract);
        await logActivity('إضافة', `إضافة عقد باطن جديد: ${newSubcontract.number}`, 'عقود مقاولي الباطن');
    };

    const updateSubcontract = async (id: string, updates: Partial<Subcontract>) => {
        const subcontract = subcontracts.find(s => s.id === id);
        if (!subcontract) return;

        const updated = { ...subcontract, ...updates };
        await saveRecord('subcontracts', id, updated);
        await logActivity('تعديل', `تعديل عقد باطن: ${updated.number}`, 'عقود مقاولي الباطن');
    };

    const deleteSubcontract = async (id: string) => {
        const deleted = subcontracts.find(s => s.id === id);
        if (deleted) {
            await deleteRecord('subcontracts', id);
            await logActivity('حذف', `حذف عقد باطن: ${deleted.number}`, 'عقود مقاولي الباطن');
        }
    };

    const uploadSubcontractAttachment = async (subcontractId: string, file: File, type: 'image' | 'pdf') => {
        // In a real local-first/Supabase setup, upload the file to storage here and get the URL.
        // For local mockup, we'll create an object URL.
        const fakeUrl = URL.createObjectURL(file);

        const newAttachment: Attachment = {
            id: crypto.randomUUID(),
            name: file.name,
            url: fakeUrl,
            type,
            date: new Date().toISOString()
        };

        const subcontract = subcontracts.find(s => s.id === subcontractId);
        if (subcontract) {
            const currentAttachments = subcontract.attachments || [];
            await updateSubcontract(subcontractId, { attachments: [...currentAttachments, newAttachment] });
            await logActivity('إضافة مرفق', `إضافة مرفق لعقد الباطن: ${subcontract.number}`, 'عقود مقاولي الباطن');
        }
    };

    const deleteSubcontractAttachment = async (subcontractId: string, attachmentId: string) => {
        const subcontract = subcontracts.find(s => s.id === subcontractId);
        if (subcontract && subcontract.attachments) {
            const updatedAttachments = subcontract.attachments.filter(a => a.id !== attachmentId);
            await updateSubcontract(subcontractId, { attachments: updatedAttachments });
            await logActivity('حذف مرفق', `حذف مرفق من عقد الباطن: ${subcontract.number}`, 'عقود مقاولي الباطن');
        }
    };

    const value = {
        subcontractors,
        subcontracts,
        syncStatus,
        addSubcontractor,
        updateSubcontractor,
        deleteSubcontractor,
        addSubcontract,
        updateSubcontract,
        deleteSubcontract,
        uploadSubcontractAttachment,
        deleteSubcontractAttachment
    };

    return (
        <SubcontractContext.Provider value={value}>
            {children}
        </SubcontractContext.Provider>
    );
};
