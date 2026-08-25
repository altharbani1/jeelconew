import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { DataProvider, useData } from './contexts/DataContext.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { useSales } from './contexts/SalesContext.tsx';
import { useHR } from './contexts/HRContext.tsx';
import { useProject } from './contexts/ProjectContext.tsx';
import { useInventory } from './contexts/InventoryContext.tsx';
import { usePurchase } from './contexts/PurchaseContext.tsx';
import { useMaintenance } from './contexts/MaintenanceContext.tsx';
import { useSubcontract } from './contexts/SubcontractContext.tsx';
import { SystemNav } from './components/SystemNav.tsx';
import { QuoteModule } from './components/QuoteModule.tsx';
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
import { InventoryModule } from './components/InventoryModule.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { FinancialReportModule } from './components/FinancialReportModule.tsx';
import { MaintenanceModule } from './components/MaintenanceModule.tsx';
import { SubcontractModule } from './components/SubcontractModule.tsx';
import { FirstRunSetup } from './components/FirstRunSetup.tsx';
import { useSupabaseAuth } from './contexts/SupabaseAuthContext.tsx';

import { SystemView } from './types.ts';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const { syncStatus: dataSync } = useData();
  const { syncStatus: salesSync } = useSales();
  const { syncStatus: hrSync } = useHR();
  const { syncStatus: projSync } = useProject();
  const { syncStatus: invSync } = useInventory();
  const { syncStatus: purchSync } = usePurchase();
  const { syncStatus: maintSync } = useMaintenance();
  const { syncStatus: subcSync } = useSubcontract();

  const [currentView, setCurrentView] = useState<SystemView>('dashboard');

  const activeSyncStatus = (() => {
    if (currentView === 'specs_manager' || currentView === 'company_profile') return dataSync;
    if (['quotes', 'customers', 'invoices', 'receipts'].includes(currentView)) return salesSync;
    if (currentView === 'hr') return hrSync;
    if (currentView === 'projects') return projSync;
    if (currentView === 'inventory') return invSync;
    if (currentView === 'purchases') return purchSync;
    if (currentView === 'maintenance') return maintSync;
    if (currentView === 'subcontracts') return subcSync;

    const statuses = [dataSync, salesSync, hrSync, projSync, invSync, purchSync, maintSync, subcSync];
    return statuses.includes('syncing') ? 'syncing' : statuses.every(status => status === 'error') ? 'error' : 'synced';
  })();

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-100 print:h-auto print:min-h-screen print:block print:overflow-visible">
      <SystemNav currentView={currentView} setView={setCurrentView} syncStatus={activeSyncStatus} />
      <main className="flex-1 relative flex flex-col h-screen overflow-hidden print:h-auto print:min-h-screen print:block print:overflow-visible">
        {currentView === 'dashboard' && <Dashboard setView={setCurrentView} />}
        {currentView === 'users' && <UserManagementModule />}
        {currentView === 'activity_log' && <ActivityLogModule />}
        {currentView === 'company_profile' && <CompanyProfileModule />}
        {currentView === 'specs_manager' && <SpecsManagerModule />}
        {currentView === 'customers' && <CustomerModule />}
        {currentView === 'calculator' && <CostCalculatorModule />}
        {currentView === 'quotes' && <QuoteModule />}
        {currentView === 'invoices' && <InvoiceModule />}
        {currentView === 'claims' && <FinancialClaimModule />}
        {currentView === 'receipts' && <ReceiptModule />}
        {currentView === 'expenses' && <ExpenseModule />}
        {currentView === 'contracts' && <ContractModule />}
        {currentView === 'projects' && <ProjectModule />}
        {currentView === 'purchases' && <PurchaseModule />}
        {currentView === 'inventory' && <InventoryModule />}
        {currentView === 'warranties' && <WarrantyModule />}
        {currentView === 'hr' && <HRModule />}
        {currentView === 'smart_elevator' && <SmartElevatorModule />}
        {currentView === 'forms' && <FormsModule />}
        {currentView === 'documents' && <DocumentsModule />}
        {currentView === 'financial_report' && <FinancialReportModule />}
        {currentView === 'maintenance' && <MaintenanceModule />}
        {currentView === 'subcontracts' && <SubcontractModule />}
      </main>
    </div>
  );
};

import { InventoryProvider } from './contexts/InventoryContext.tsx';
import { SalesProvider } from './contexts/SalesContext.tsx';
import { ProjectProvider } from './contexts/ProjectContext.tsx';
import { HRProvider } from './contexts/HRContext.tsx';
import { PurchaseProvider } from './contexts/PurchaseContext.tsx';
import { ElevatorProvider } from './contexts/ElevatorContext.tsx';
import { MaintenanceProvider } from './contexts/MaintenanceContext.tsx';
import { SubcontractProvider } from './contexts/SubcontractContext.tsx';

const App: React.FC = () => {
  const { user: cloudUser, loading: cloudLoading } = useSupabaseAuth();

  if (cloudLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">جاري تجهيز المزامنة السحابية...</div>;
  }

  if (!cloudUser) {
    return <FirstRunSetup />;
  }

  return (
    <AuthProvider>
      <DataProvider>
        <ProjectProvider>
          <SalesProvider>
            <InventoryProvider>
              <HRProvider>
                <PurchaseProvider>
                  <ElevatorProvider>
                    <MaintenanceProvider>
                      <SubcontractProvider>
                        <LanguageProvider>
                          <MainApp />
                        </LanguageProvider>
                      </SubcontractProvider>
                    </MaintenanceProvider>
                  </ElevatorProvider>
                </PurchaseProvider>
              </HRProvider>
            </InventoryProvider>
          </SalesProvider>
        </ProjectProvider>
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
