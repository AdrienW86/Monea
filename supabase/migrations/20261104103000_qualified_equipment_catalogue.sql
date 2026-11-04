-- Keep recorded readiness requirements; a qualified device can be priced and opened.
-- No qualifications, prices or commercial settings are changed by this migration.
do $$
declare rule record;
begin
  for rule in
    select conname from pg_constraint
    where conrelid='public.services'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%qualification_requirement%equipment%'
      and pg_get_constraintdef(oid) like '%operational_status%'
  loop
    execute format('alter table public.services drop constraint %I', rule.conname);
  end loop;
end $$;
alter table public.services add constraint services_equipment_readiness_check
  check (qualification_requirement <> 'equipment'
    or qualification_verified_at is not null
    or (operational_status='study' and not bookable and price_cents is null));

create or replace function public.service_eligible(p_service uuid)
returns boolean language sql stable set search_path='' as $$
  select coalesce((select s.visibility and s.bookable
    and s.operational_status='active' and s.price_cents is not null and c.active
    and (s.qualification_requirement='none' or s.qualification_verified_at is not null)
    and (s.qualification_requirement<>'procedure' or s.procedure_verified_at is not null)
    from public.services s join public.categories c on c.id=s.category_id
    where s.id=p_service), false);
$$;
