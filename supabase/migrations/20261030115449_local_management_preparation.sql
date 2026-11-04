-- Préparation seulement : aucune connexion distante ni import automatique.
-- Les paiements fictifs restent dans une archive séparée, jamais public.payments.
create table public.categories (
 id uuid primary key default gen_random_uuid(),name text not null unique,
 description text not null default '',image text not null default '',sort_order integer not null default 0,
 active boolean not null default true
);
alter table public.services add column category_id uuid references public.categories(id);
insert into public.categories(name) select distinct category from public.services;
update public.services s set category_id=c.id from public.categories c where c.name=s.category;
create function public.assign_service_category() returns trigger language plpgsql set search_path='' as $$
begin
 if new.category_id is null then
  insert into public.categories(name) values(new.category) on conflict(name) do nothing;
  select id into new.category_id from public.categories where name=new.category;
 else
  select name into new.category from public.categories where id=new.category_id;
 end if;
 return new;
end $$;
create trigger assign_service_category before insert or update of category_id,category on public.services for each row execute function public.assign_service_category();
create table public.products (
 id uuid primary key default gen_random_uuid(),name text not null,description text not null default '',
 category_id uuid not null references public.categories(id),price_cents integer not null check(price_cents between 0 and 1000000),
 image text not null default '',status text not null default 'active' check(status in('active','archived')),stock integer check(stock>=0)
);
alter table public.clients add column notes text not null default '';
alter table public.time_allocations add column series_id uuid;
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check check(status in('pending','confirmed','completed','no_show','expired','cancelled','reconciliation'));
create table public.booking_lines (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id),
 service_id uuid not null references public.services(id),position integer not null default 0,
 service_name text not null,price_cents integer not null check(price_cents>0),duration_minutes integer not null check(duration_minutes>0),
 unique(booking_id,position)
);
insert into public.booking_lines(booking_id,service_id,service_name,price_cents,duration_minutes)
 select id,service_id,service_name,price_cents,duration_minutes from public.bookings;
create function public.snapshot_initial_booking_line() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.booking_lines(booking_id,service_id,service_name,price_cents,duration_minutes)
 values(new.id,new.service_id,new.service_name,new.price_cents,new.duration_minutes);
 return new;
end $$;
create trigger snapshot_initial_booking_line after insert on public.bookings for each row execute function public.snapshot_initial_booking_line();
-- Conserver intégralement l'export source avant toute promotion validée des données utiles.
create table public.local_import_archives (
 id uuid primary key default gen_random_uuid(),source text not null check(source='local'),
 schema_version integer not null,sha256 text not null unique,payload jsonb not null,
 imported_at timestamptz not null default now(),promoted_at timestamptz,
 check(payload->>'source'='local')
);
do $$ declare t text; begin
 foreach t in array array['categories','products','booking_lines','local_import_archives'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_read on public.%I for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke execute on function public.assign_service_category(),public.snapshot_initial_booking_line() from public,anon,authenticated;
grant execute on function public.assign_service_category(),public.snapshot_initial_booking_line() to service_role;
-- L'exclusion GiST de time_allocations, les RPC et les droits existants restent en place.
