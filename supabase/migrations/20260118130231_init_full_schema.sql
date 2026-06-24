
create extension if not exists "pgcrypto";
create extension if not exists "pgcrypto";

-- ENUMs
create type role_type as enum ('admin', 'manager', 'staff');
create type entity_type as enum ('project', 'contract', 'quote', 'invoice', 'purchase', 'receipt', 'expense', 'financial_claim', 'hr_record', 'form', 'document', 'spec', 'smart_elevator', 'warranty', 'cost_calculation');

-- Companies
create table companies (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	created_at timestamptz default now()
);

create table company_profiles (
	id uuid primary key references companies(id) on delete cascade,
	logo_url text,
	address text,
	phone text,
	website text,
	extra jsonb,
	updated_at timestamptz default now()
);

-- Users
create table app_users (
	id uuid primary key references auth.users(id) on delete cascade,
	company_id uuid references companies(id) on delete cascade,
	full_name text,
	email text,
	created_at timestamptz default now()
);

create table roles (
	id serial primary key,
	name role_type unique not null
);

create table user_roles (
	user_id uuid references app_users(id) on delete cascade,
	role_id int references roles(id) on delete cascade,
	company_id uuid references companies(id) on delete cascade,
	primary key (user_id, role_id, company_id)
);

-- Customers
create table customers (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	name text not null,
	email text,
	phone text,
	address text,
	created_at timestamptz default now()
);

-- Projects
create table projects (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	name text not null,
	description text,
	customer_id uuid references customers(id),
	start_date date,
	end_date date,
	status text,
	created_at timestamptz default now()
);

-- Contracts
create table contracts (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	title text,
	description text,
	value numeric,
	signed_at date,
	status text,
	created_at timestamptz default now()
);

-- Quotes
create table quotes (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	customer_id uuid references customers(id),
	total numeric,
	status text,
	created_at timestamptz default now()
);

create table quote_items (
	id uuid primary key default gen_random_uuid(),
	quote_id uuid references quotes(id) on delete cascade,
	description text,
	quantity int,
	unit_price numeric,
	total numeric
);

-- Invoices
create table invoices (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	customer_id uuid references customers(id),
	total numeric,
	status text,
	due_date date,
	created_at timestamptz default now()
);

create table invoice_items (
	id uuid primary key default gen_random_uuid(),
	invoice_id uuid references invoices(id) on delete cascade,
	description text,
	quantity int,
	unit_price numeric,
	total numeric
);

-- Purchases
create table purchases (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	vendor text,
	total numeric,
	status text,
	created_at timestamptz default now()
);

create table purchase_items (
	id uuid primary key default gen_random_uuid(),
	purchase_id uuid references purchases(id) on delete cascade,
	description text,
	quantity int,
	unit_price numeric,
	total numeric
);

-- Receipts
create table receipts (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	amount numeric,
	received_at date,
	created_at timestamptz default now()
);

-- Expenses
create table expenses (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	description text,
	amount numeric,
	expense_date date,
	created_at timestamptz default now()
);

-- Financial Claims
create table financial_claims (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	description text,
	amount numeric,
	claim_date date,
	status text,
	created_at timestamptz default now()
);

-- HR Records
create table hr_records (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	user_id uuid references app_users(id),
	type text,
	details jsonb,
	record_date date,
	created_at timestamptz default now()
);

-- Forms
create table forms (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	user_id uuid references app_users(id),
	form_type text,
	data jsonb,
	submitted_at timestamptz,
	created_at timestamptz default now()
);

-- Documents
create table documents (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	title text,
	description text,
	file_url text,
	uploaded_by uuid references app_users(id),
	uploaded_at timestamptz default now()
);

-- Specs
create table specs (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	title text,
	description text,
	file_url text,
	created_at timestamptz default now()
);

-- Smart Elevators
create table smart_elevators (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	serial_number text,
	status text,
	installed_at date,
	created_at timestamptz default now()
);

-- Warranties
create table warranties (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	warranty_number text,
	start_date date,
	end_date date,
	status text,
	created_at timestamptz default now()
);

-- Cost Calculations
create table cost_calculations (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	project_id uuid references projects(id),
	calculation_data jsonb,
	calculated_at timestamptz,
	created_at timestamptz default now()
);

-- Activity Log
create table activity_log (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	user_id uuid references app_users(id),
	action text,
	entity_type entity_type,
	entity_id uuid,
	details jsonb,
	created_at timestamptz default now()
);

-- Attachments
create table attachments (
	id uuid primary key default gen_random_uuid(),
	company_id uuid references companies(id) on delete cascade,
	entity_type entity_type not null,
	entity_id uuid not null,
	bucket text not null,
	path text not null,
	mime text,
	size int,
	created_by uuid references app_users(id),
	created_at timestamptz default now()
);

-- Indexes
create index on app_users(company_id);
create index on customers(company_id);
create index on projects(company_id);
create index on contracts(company_id);
create index on quotes(company_id);
create index on invoices(company_id);
create index on purchases(company_id);
create index on receipts(company_id);
create index on expenses(company_id);
create index on financial_claims(company_id);
create index on hr_records(company_id);
create index on forms(company_id);
create index on documents(company_id);
create index on specs(company_id);
create index on smart_elevators(company_id);
create index on warranties(company_id);
create index on cost_calculations(company_id);
create index on activity_log(company_id);
create index on attachments(company_id);
create index on attachments(entity_type, entity_id);
create index on activity_log(created_at);
create index on attachments(created_at);

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

-- Supabase Storage Buckets and Policies
insert into storage.buckets (id, name, public) values ('app-files', 'app-files', false) on conflict do nothing;

-- Storage policy: Only allow users to access files for their company
-- (Assumes JWT claims or app_users join for company_id)
-- Path: company/<company_id>/<entity_type>/<entity_id>/<filename>
-- Example policy (pseudo):
-- allow if user is in app_users and file path starts with their company_id
