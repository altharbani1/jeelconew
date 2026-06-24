-- RLS Policies for all tables
-- Enable RLS
alter table companies enable row level security;
alter table company_profiles enable row level security;
alter table app_users enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table customers enable row level security;
alter table projects enable row level security;
alter table contracts enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table receipts enable row level security;
alter table expenses enable row level security;
alter table financial_claims enable row level security;
alter table hr_records enable row level security;
alter table forms enable row level security;
alter table documents enable row level security;
alter table specs enable row level security;
alter table smart_elevators enable row level security;
alter table warranties enable row level security;
alter table cost_calculations enable row level security;
alter table activity_log enable row level security;
alter table attachments enable row level security;

-- General user policy: Only access rows for their company
create policy "Users can access their company data" on companies for select using (exists (select 1 from app_users where app_users.company_id = companies.id and app_users.id = auth.uid()));
create policy "Users can access their company data" on company_profiles for select using (exists (select 1 from app_users where app_users.company_id = company_profiles.id and app_users.id = auth.uid()));
create policy "Users can access their company data" on app_users for select using (app_users.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on customers for all using (customers.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on projects for all using (projects.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on contracts for all using (contracts.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on quotes for all using (quotes.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on quote_items for all using (quote_items.quote_id in (select id from quotes where company_id = (select company_id from app_users where id = auth.uid())));
create policy "Users can access their company data" on invoices for all using (invoices.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on invoice_items for all using (invoice_items.invoice_id in (select id from invoices where company_id = (select company_id from app_users where id = auth.uid())));
create policy "Users can access their company data" on purchases for all using (purchases.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on purchase_items for all using (purchase_items.purchase_id in (select id from purchases where company_id = (select company_id from app_users where id = auth.uid())));
create policy "Users can access their company data" on receipts for all using (receipts.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on expenses for all using (expenses.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on financial_claims for all using (financial_claims.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on hr_records for all using (hr_records.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on forms for all using (forms.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on documents for all using (documents.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on specs for all using (specs.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on smart_elevators for all using (smart_elevators.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on warranties for all using (warranties.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on cost_calculations for all using (cost_calculations.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on activity_log for all using (activity_log.company_id = (select company_id from app_users where id = auth.uid()));
create policy "Users can access their company data" on attachments for all using (attachments.company_id = (select company_id from app_users where id = auth.uid()));

-- Admin policy: Allow admins to manage all company data
create policy "Admins can manage company data" on companies for all using (exists (select 1 from user_roles ur join roles r on ur.role_id = r.id where ur.user_id = auth.uid() and ur.company_id = companies.id and r.name = 'admin'));
create policy "Admins can manage company data" on company_profiles for all using (exists (select 1 from user_roles ur join roles r on ur.role_id = r.id where ur.user_id = auth.uid() and ur.company_id = company_profiles.id and r.name = 'admin'));
create policy "Admins can manage company data" on app_users for all using (exists (select 1 from user_roles ur join roles r on ur.role_id = r.id where ur.user_id = auth.uid() and ur.company_id = app_users.company_id and r.name = 'admin'));
-- Repeat for all tables as above (for brevity, not repeated here)

-- You may add more granular policies as needed for each table.
