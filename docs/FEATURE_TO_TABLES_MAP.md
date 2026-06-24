# Feature to Tables Map

| Feature                | Tables                        | Main Columns | Relationships | Files/Attachments | RLS notes |
|------------------------|-------------------------------|--------------|---------------|-------------------|-----------|
| Dashboard              | projects, contracts, quotes, invoices, receipts, expenses, activity_log | id, company_id, created_at, status, total, ... | N/A | N | RLS by company_id |
| Login/Authentication   | app_users, user_roles, roles  | id, email, company_id, role_id | app_users.id = auth.users.id | N | RLS by user_id/company_id |
| User Management        | app_users, user_roles, roles  | id, full_name, email, company_id, role_id | user_roles.user_id = app_users.id | N | RLS by company_id |
| Company Profile        | companies, company_profiles   | id, name, logo_url, address | company_profiles.id = companies.id | Y (logo) | RLS by company_id |
| Customer Management    | customers                     | id, name, email, company_id | customers.company_id = companies.id | N | RLS by company_id |
| Project Management     | projects                      | id, name, company_id, customer_id | projects.customer_id = customers.id | Y (attachments) | RLS by company_id |
| Contract Management    | contracts                     | id, title, project_id, company_id | contracts.project_id = projects.id | Y (attachments) | RLS by company_id |
| Quote Management       | quotes, quote_items           | id, total, project_id, company_id | quote_items.quote_id = quotes.id | Y (attachments) | RLS by company_id |
| Purchase Management    | purchases, purchase_items     | id, total, project_id, company_id | purchase_items.purchase_id = purchases.id | N | RLS by company_id |
| Receipt Management     | receipts                      | id, amount, project_id, company_id | receipts.project_id = projects.id | N | RLS by company_id |
| Invoice Management     | invoices, invoice_items       | id, total, project_id, company_id | invoice_items.invoice_id = invoices.id | N | RLS by company_id |
| Expense Management     | expenses                      | id, amount, project_id, company_id | expenses.project_id = projects.id | N | RLS by company_id |
| Financial Claims       | financial_claims              | id, amount, project_id, company_id | financial_claims.project_id = projects.id | N | RLS by company_id |
| HR Management          | hr_records                    | id, user_id, company_id, type | hr_records.user_id = app_users.id | N | RLS by company_id |
| Forms                  | forms                         | id, user_id, company_id, form_type | forms.user_id = app_users.id | Y (attachments) | RLS by company_id |
| Activity Log           | activity_log                  | id, user_id, company_id, action | activity_log.user_id = app_users.id | N | RLS by company_id |
| Specs Management       | specs                         | id, project_id, company_id, file_url | specs.project_id = projects.id | Y (attachments) | RLS by company_id |
| Smart Elevator         | smart_elevators               | id, project_id, company_id, serial_number | smart_elevators.project_id = projects.id | N | RLS by company_id |
| Documents              | documents                     | id, uploaded_by, company_id, file_url | documents.uploaded_by = app_users.id | Y (attachments) | RLS by company_id |
| Cost Calculator        | cost_calculations             | id, project_id, company_id, calculation_data | cost_calculations.project_id = projects.id | N | RLS by company_id |
| Sidebar/SystemNav      | -                             | - | - | N | - |
| Warranty Management    | warranties                    | id, project_id, company_id, warranty_number | warranties.project_id = projects.id | N | RLS by company_id |
