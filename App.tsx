
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { SystemNav } from './components/SystemNav.tsx';
import { QuoteModule } from './components/QuoteModule.tsx';
import { InstallationQuoteModule } from './components/InstallationQuoteModule.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { ReceiptModule } from './components/ReceiptModule.tsx';
import { InvoiceModule } from './components/InvoiceModule.tsx';
import { ContractModule } from './components/ContractModule.tsx';
import { ProjectModule } from './components/ProjectModule.tsx';
import { CompanyProfileModule } from './components/CompanyProfileModule.tsx';
import { SpecsManagerModule } from './components/SpecsManagerModule.tsx';
import { CustomerModule } from './components/CustomerModule.tsx';
import { PurchaseModule } from './components/PurchaseModule.tsx';
import { WarrantyModule } from './components/WarrantyModule.tsx';
import { CostCalculatorModule } from './components/CostCalculatorModule.tsx';
import { FinancialClaimModule } from './components/FinancialClaimModule.tsx';
import { ExpenseModule } from './components/ExpenseModule.tsx';
import { HRModule } from './components/HRModule.tsx';
import { SmartElevatorModule } from './components/SmartElevatorModule.tsx';
import { UserManagementModule } from './components/UserManagementModule.tsx';
import { FormsModule } from './components/FormsModule.tsx';
import { DocumentsModule } from './components/DocumentsModule.tsx';
import { ActivityLogModule } from './components/ActivityLogModule.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { SystemView } from './types.ts';
import { cloudService } from './services/cloudService.ts';

// Default Connection String (Auto-injected)
const DEFAULT_NEON_CONN = 'postgresql://neondb_owner:npg_daR6gtonfr7V@ep-blue-butterfly-aebejil8-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentView, setCurrentView] = useState<SystemView>('dashboard');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // --- Auto Sync Logic ---
  useEffect(() => {
    // 1. Ensure connection string exists
    let conn = localStorage.getItem('jilco_neon_connection');
    if (!conn) {
        localStorage.setItem('jilco_neon_connection', DEFAULT_NEON_CONN);
        conn = DEFAULT_NEON_CONN;
    }

    // 2. Initial DB Init (Silent)
    cloudService.initDb(conn).catch(console.error);

    // 3. Background Sync Loop
    const syncInterval = setInterval(async () => {
        if (!currentUser) return; // Don't sync if not logged in
        
        try {
            const currentData = cloudService.getLocalData();
            // Simple check: In a real app, verify hash. Here we just upload periodically to ensure safety.
            // Only upload if data exists
            if (Object.keys(currentData).length > 0) {
                setSyncStatus('syncing');
                await cloudService.uploadData(conn!, currentData);
                setSyncStatus('synced');
                // Reset status after a few seconds
                setTimeout(() => setSyncStatus('idle'), 2000);
            }
        } catch (e) {
            console.error("Auto-sync failed:", e);
            setSyncStatus('error');
        }
    }, 30000); // Run every 30 seconds

    return () => clearInterval(syncInterval);
  }, [currentUser]);

  if (!currentUser) {
      return <LoginScreen />;
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-100 print:h-auto print:overflow-visible">
      <SystemNav currentView={currentView} setView={setCurrentView} syncStatus={syncStatus} />
      <main className="flex-1 relative flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
        {currentView === 'dashboard' && <Dashboard setView={setCurrentView} />}
        {currentView === 'users' && <UserManagementModule />}
        {currentView === 'activity_log' && <ActivityLogModule />}
        {currentView === 'company_profile' && <CompanyProfileModule />}
        {currentView === 'specs_manager' && <SpecsManagerModule />}
        {currentView === 'customers' && <CustomerModule />}
        {currentView === 'calculator' && <CostCalculatorModule />}
        {currentView === 'quotes' && <QuoteModule />}
        {currentView === 'installation_quotes' && <InstallationQuoteModule />}
        {currentView === 'invoices' && <InvoiceModule />}
        {currentView === 'claims' && <FinancialClaimModule />}
        {currentView === 'receipts' && <ReceiptModule />}
        {currentView === 'expenses' && <ExpenseModule />}
        {currentView === 'contracts' && <ContractModule />}
        {currentView === 'projects' && <ProjectModule />}
        {currentView === 'purchases' && <PurchaseModule />}
        {currentView === 'warranties' && <WarrantyModule />}
        {currentView === 'hr' && <HRModule />}
        {currentView === 'smart_elevator' && <SmartElevatorModule />}
        {currentView === 'forms' && <FormsModule />}
        {currentView === 'documents' && <DocumentsModule />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <MainApp />
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
