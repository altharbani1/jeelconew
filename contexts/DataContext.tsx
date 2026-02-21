import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cloudService } from '../services/cloudService';

interface DataContextType {
    quotes: any[];
    setQuotes: React.Dispatch<React.SetStateAction<any[]>>;
    saveQuote: (id: string, quote: any) => Promise<boolean>;
    deleteQuote: (id: string) => Promise<boolean>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    useEffect(() => {
        // 1. Load Initial Data Quotes
        loadQuotes();

        // 2. Subscribe to Real-Time Updates for Quotes
        const unsubscribe = cloudService.subscribeToCollection('jilco_quotes_archive', (payload) => {
            setSyncStatus('syncing');

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const updatedRecord = payload.new;
                setQuotes(prev => {
                    const exists = prev.find(q => q.id === updatedRecord.record_id);
                    if (exists) {
                        return prev.map(q => q.id === updatedRecord.record_id ? updatedRecord.data : q);
                    } else {
                        return [updatedRecord.data, ...prev];
                    }
                });
            } else if (payload.eventType === 'DELETE') {
                const deletedRecordId = payload.old.record_id;
                setQuotes(prev => prev.filter(q => q.id !== deletedRecordId));
            }

            setTimeout(() => setSyncStatus('synced'), 1000);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const loadQuotes = async () => {
        setSyncStatus('syncing');
        try {
            // First try to show local for fast loading
            const localQuotes = localStorage.getItem('jilco_quotes_archive');
            if (localQuotes) {
                setQuotes(JSON.parse(localQuotes));
            }

            // Then fetch from cloud
            const cloudData = await cloudService.loadCollection('jilco_quotes_archive');
            if (cloudData && cloudData.length > 0) {
                const parsedQuotes = cloudData.map((row: any) => row.data);
                setQuotes(parsedQuotes);
                localStorage.setItem('jilco_quotes_archive', JSON.stringify(parsedQuotes));
            }
            setSyncStatus('synced');
        } catch (error) {
            console.error('Error loading quotes:', error);
            setSyncStatus('error');
        }
    };

    const saveQuote = async (id: string, quoteData: any): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            // Optimistic update
            setQuotes(prev => {
                const exists = prev.find(q => q.id === id);
                if (exists) return prev.map(q => q.id === id ? quoteData : q);
                return [quoteData, ...prev];
            });

            // Save to cloud
            const success = await cloudService.saveRecord('jilco_quotes_archive', id, quoteData);

            // Update local storage
            const currentQuotes = JSON.parse(localStorage.getItem('jilco_quotes_archive') || '[]');
            const exists = currentQuotes.find((q: any) => q.id === id);
            let newLocalQuotes;
            if (exists) newLocalQuotes = currentQuotes.map((q: any) => q.id === id ? quoteData : q);
            else newLocalQuotes = [quoteData, ...currentQuotes];
            localStorage.setItem('jilco_quotes_archive', JSON.stringify(newLocalQuotes));

            if (success) {
                setSyncStatus('synced');
                return true;
            } else {
                setSyncStatus('error');
                return false;
            }
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    const deleteQuote = async (id: string): Promise<boolean> => {
        setSyncStatus('syncing');
        try {
            // Optimistic update
            setQuotes(prev => prev.filter(q => q.id !== id));

            // Update local storage
            const currentQuotes = JSON.parse(localStorage.getItem('jilco_quotes_archive') || '[]');
            localStorage.setItem('jilco_quotes_archive', JSON.stringify(currentQuotes.filter((q: any) => q.id !== id)));

            // Delete from cloud
            const success = await cloudService.deleteRecord('jilco_quotes_archive', id);

            if (success) {
                setSyncStatus('synced');
                return true;
            } else {
                setSyncStatus('error');
                return false;
            }
        } catch (e) {
            setSyncStatus('error');
            return false;
        }
    };

    return (
        <DataContext.Provider value={{ quotes, setQuotes, saveQuote, deleteQuote, syncStatus }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
