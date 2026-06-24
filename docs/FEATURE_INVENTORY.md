# Feature Inventory

| Feature                | Path/Files                                 | User Actions                | Data Entities         | CRUD (C/R/U/D) | Needs Files? (Y/N) | Notes |
|------------------------|--------------------------------------------|-----------------------------|-----------------------|----------------|--------------------|-------|
| Dashboard              | components/Dashboard.tsx                   | View stats, quick links     | -                     | R              | N                  |       |
| Login/Authentication   | components/LoginScreen.tsx, contexts/AuthContext.tsx | Login, logout, session mgmt | User                  | C/R/U/D        | N                  |       |
| User Management        | components/UserManagementModule.tsx         | Add/edit/delete users       | User                  | C/R/U/D        | N                  |       |
| Company Profile        | components/CompanyProfileModule.tsx         | Edit company info           | CompanyProfile        | R/U            | Y                  | Logo, docs |
| Customer Management    | components/CustomerModule.tsx               | Add/edit/delete customers   | Customer              | C/R/U/D        | N                  |       |
| Project Management     | components/ProjectModule.tsx                | Add/edit/delete projects    | Project               | C/R/U/D        | Y                  | Attachments |
| Contract Management    | components/ContractModule.tsx               | Add/edit/delete contracts   | Contract              | C/R/U/D        | Y                  | PDF, docs |
| Quote Management       | components/QuoteModule.tsx, QuotePreview.tsx| Create/edit/preview quotes  | Quote                 | C/R/U/D        | Y                  | PDF export |
| Purchase Management    | components/PurchaseModule.tsx               | Add/edit/delete purchases   | Purchase              | C/R/U/D        | N                  |       |
| Receipt Management     | components/ReceiptModule.tsx                | Add/edit/delete receipts    | Receipt               | C/R/U/D        | N                  |       |
| Invoice Management     | components/InvoiceModule.tsx                | Add/edit/delete invoices    | Invoice               | C/R/U/D        | N                  |       |
| Expense Management     | components/ExpenseModule.tsx                | Add/edit/delete expenses    | Expense               | C/R/U/D        | N                  |       |
| Financial Claims       | components/FinancialClaimModule.tsx         | Add/edit/delete claims      | FinancialClaim        | C/R/U/D        | N                  |       |
| HR Management          | components/HRModule.tsx                     | Add/edit/delete HR records  | HRRecord              | C/R/U/D        | N                  |       |
| Forms                  | components/FormsModule.tsx                  | Submit/view forms           | Form                  | C/R/U/D        | Y                  | Attachments |
| Activity Log           | components/ActivityLogModule.tsx            | View activity log           | ActivityLog           | R              | N                  |       |
| Specs Management       | components/SpecsManagerModule.tsx           | Add/edit/delete specs       | Spec                  | C/R/U/D        | Y                  | Files |
| Smart Elevator         | components/SmartElevatorModule.tsx          | Manage elevator data        | SmartElevator         | C/R/U/D        | N                  |       |
| Documents              | components/DocumentsModule.tsx              | Upload/view documents       | Document              | C/R/U/D        | Y                  | Files |
| Cost Calculator        | components/CostCalculatorModule.tsx         | Calculate costs             | CostCalculation       | C/R            | N                  |       |
| Sidebar/SystemNav      | components/Sidebar.tsx, SystemNav.tsx       | Navigation                  | -                     | -              | N                  |       |
| Warranty Management    | components/WarrantyModule.tsx               | Add/edit/delete warranties  | Warranty              | C/R/U/D        | N                  |       |
