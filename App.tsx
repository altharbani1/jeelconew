import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { DataProvider } from './contexts/DataContext.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
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

import { SystemView } from './types.ts';
import { useData } from './contexts/DataContext.tsx';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const { syncStatus } = useData();
  const [currentView, setCurrentView] = useState<SystemView>('dashboard');

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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <ProjectProvider>
          <SalesProvider>
            <InventoryProvider>
              <HRProvider>
                <PurchaseProvider>
                  <ElevatorProvider>
                    <LanguageProvider>
                      <MainApp />
                    </LanguageProvider>
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
