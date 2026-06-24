-- Supabase Schema: Multi-tenant App
-- Extensions
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
