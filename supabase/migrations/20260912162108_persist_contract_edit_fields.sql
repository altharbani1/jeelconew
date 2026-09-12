-- Persist every field rendered by ContractModule so reopening edit is lossless.
alter table public.contracts
  add column if not exists payment_terms jsonb not null default '[]'::jsonb,
  add column if not exists technical_specs jsonb not null default '{}'::jsonb;

alter table public.contracts
  add constraint contracts_payment_terms_array_check
    check (jsonb_typeof(payment_terms) = 'array'),
  add constraint contracts_technical_specs_object_check
    check (jsonb_typeof(technical_specs) = 'object');

comment on column public.contracts.payment_terms is
  'Ordered payment milestones used by the contract editor and print view.';
comment on column public.contracts.technical_specs is
  'Complete ContractModule technical specification form as JSON object.';

notify pgrst, 'reload schema';
