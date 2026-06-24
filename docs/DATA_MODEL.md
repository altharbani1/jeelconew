# Data Model

## Main Tables
- companies
- company_profiles
- app_users (linked to auth.users)
- roles, user_roles
- customers
- projects
- contracts
- quotes, quote_items
- invoices, invoice_items
- purchases, purchase_items
- receipts
- expenses
- financial_claims
- hr_records
- forms
- documents
- specs
- smart_elevators
- warranties
- cost_calculations
- activity_log
- attachments

## Relationships
- companies 1--N app_users
- companies 1--1 company_profiles
- companies 1--N customers/projects/contracts/quotes/invoices/purchases/receipts/expenses/financial_claims/hr_records/forms/documents/specs/smart_elevators/warranties/cost_calculations/activity_log/attachments
- app_users N--M roles (via user_roles)
- projects 1--N contracts/quotes/invoices/purchases/receipts/expenses/financial_claims/specs/smart_elevators/warranties/cost_calculations
- customers 1--N projects/quotes/invoices
- quotes 1--N quote_items
- invoices 1--N invoice_items
- purchases 1--N purchase_items

## ENUMs
- role_type: admin, manager, staff
- entity_type: project, contract, quote, invoice, purchase, receipt, expense, financial_claim, hr_record, form, document, spec, smart_elevator, warranty, cost_calculation

## Indexes & Constraints
- All tables indexed on company_id
- Foreign keys with ON DELETE CASCADE where needed
