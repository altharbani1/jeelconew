-- Save a quote and its replaceable child records in one transaction.
-- SECURITY INVOKER preserves the caller's grants and row-level security policies.
create or replace function public.save_quote_with_items(
  p_quote jsonb,
  p_items jsonb,
  p_specs jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_company_id uuid;
begin
  select au.company_id
    into v_company_id
  from public.app_users as au
  where au.id = (select auth.uid());

  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;

  insert into public.quotes (
    company_id, legacy_id, number, date, customer_name, customer_address,
    project_name, validity, tax_rate, warranty_installation, warranty_motor,
    payment_terms, terms_and_conditions, features, handover_and_warranty,
    first_party_obligations, second_party_obligations, works_duration,
    show_gallery, gallery_images, total
  ) values (
    v_company_id,
    p_quote->>'legacy_id',
    p_quote->>'number',
    nullif(p_quote->>'date', '')::date,
    p_quote->>'customer_name',
    p_quote->>'customer_address',
    p_quote->>'project_name',
    p_quote->>'validity',
    coalesce(nullif(p_quote->>'tax_rate', '')::numeric, 0),
    p_quote->>'warranty_installation',
    p_quote->>'warranty_motor',
    coalesce(p_quote->'payment_terms', '[]'::jsonb),
    p_quote->>'terms_and_conditions',
    coalesce(p_quote->'features', '[]'::jsonb),
    p_quote->>'handover_and_warranty',
    p_quote->>'first_party_obligations',
    p_quote->>'second_party_obligations',
    p_quote->>'works_duration',
    coalesce(nullif(p_quote->>'show_gallery', '')::boolean, false),
    coalesce(p_quote->'gallery_images', '{}'::jsonb),
    coalesce(nullif(p_quote->>'total', '')::numeric, 0)
  )
  on conflict (legacy_id) do update set
    number = excluded.number,
    date = excluded.date,
    customer_name = excluded.customer_name,
    customer_address = excluded.customer_address,
    project_name = excluded.project_name,
    validity = excluded.validity,
    tax_rate = excluded.tax_rate,
    warranty_installation = excluded.warranty_installation,
    warranty_motor = excluded.warranty_motor,
    payment_terms = excluded.payment_terms,
    terms_and_conditions = excluded.terms_and_conditions,
    features = excluded.features,
    handover_and_warranty = excluded.handover_and_warranty,
    first_party_obligations = excluded.first_party_obligations,
    second_party_obligations = excluded.second_party_obligations,
    works_duration = excluded.works_duration,
    show_gallery = excluded.show_gallery,
    gallery_images = excluded.gallery_images,
    total = excluded.total
  returning id into v_quote_id;

  delete from public.quote_items
  where quote_id = v_quote_id;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Quote items must be an array' using errcode = '22023';
  end if;

  insert into public.quote_items (
    legacy_id, quote_id, quote_legacy_id, description, details,
    quantity, unit_price, total
  )
  select item.legacy_id, v_quote_id, item.quote_legacy_id, item.description,
         item.details, coalesce(item.quantity, 0), coalesce(item.unit_price, 0),
         coalesce(item.total, 0)
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    legacy_id text,
    quote_legacy_id text,
    description text,
    details text,
    quantity integer,
    unit_price numeric,
    total numeric
  );

  if p_specs is not null then
    delete from public.quote_specs
    where quote_id = v_quote_id;

    insert into public.quote_specs (
      quote_id, quote_legacy_id, elevator_type, capacity, speed, stops,
      drive_type, control_system, power_supply, cabin, doors, external_doors,
      machine_room, rails, ropes, safety, emergency
    ) values (
      v_quote_id,
      p_specs->>'quote_legacy_id',
      p_specs->>'elevator_type',
      p_specs->>'capacity',
      p_specs->>'speed',
      p_specs->>'stops',
      p_specs->>'drive_type',
      p_specs->>'control_system',
      p_specs->>'power_supply',
      p_specs->>'cabin',
      p_specs->>'doors',
      p_specs->>'external_doors',
      p_specs->>'machine_room',
      p_specs->>'rails',
      p_specs->>'ropes',
      p_specs->>'safety',
      p_specs->>'emergency'
    );
  end if;

  return v_quote_id;
end;
$$;

revoke all on function public.save_quote_with_items(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_with_items(jsonb, jsonb, jsonb) to authenticated;
