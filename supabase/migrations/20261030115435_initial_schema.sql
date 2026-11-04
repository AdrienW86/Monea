-- Une seule ressource : toutes les allocations partagent la même exclusion GiST.
create table public.admin_users (user_id uuid primary key references auth.users(id), singleton boolean not null default true unique check(singleton));
create table public.site_settings (id integer primary key check(id=1), value jsonb not null default '{}', updated_at timestamptz not null default now());
insert into public.site_settings(id) values(1);
create table public.services (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, category text not null, description text not null default '',
 qualification_requirement text not null check(qualification_requirement in ('none','professional','procedure','equipment')),
 qualification_verified_at timestamptz, procedure_verified_at timestamptz,
 operational_status text not null default 'coming_soon' check(operational_status in ('active','coming_soon','study')),
 bookable boolean not null default false, visibility boolean not null default true,
 price_cents integer check(price_cents between 100 and 1000000), duration_minutes integer not null default 60 check(duration_minutes between 15 and 480),
 sort_order integer not null default 0, image text check(image is null or image ~ '^/assets/[a-zA-Z0-9/_.-]+\.(png|jpg|webp)$'), updated_at timestamptz not null default now(),
 check(qualification_requirement <> 'equipment' or (operational_status='study' and not bookable and price_cents is null))
);
create table public.clients (id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null, email text not null, phone text not null, consent_at timestamptz not null default now(), created_at timestamptz not null default now());
create table public.time_allocations (
 id uuid primary key default gen_random_uuid(), start_at timestamptz not null, end_at timestamptz not null,
 kind text not null check(kind in ('hold','booking','manual','block')), state text not null check(state in ('active','expired','cancelled')) default 'active',
 expires_at timestamptz, reason text, created_at timestamptz not null default now(), check(start_at < end_at),
 exclude using gist (tstzrange(start_at,end_at,'[)') with &&) where(state='active')
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), public_token uuid not null default gen_random_uuid() unique,
 request_id uuid not null unique, allocation_id uuid not null unique references public.time_allocations(id), client_id uuid not null references public.clients(id), service_id uuid not null references public.services(id),
 service_name text not null, price_cents integer not null check(price_cents>0), duration_minutes integer not null check(duration_minutes>0),
 status text not null check(status in ('pending','confirmed','expired','cancelled','reconciliation')),
 source text not null check(source in ('online','manual')), offline_status text check(offline_status in ('paid_offline','unpaid')), notes text not null default '', created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id), stripe_session_id text unique, stripe_payment_intent text unique, idempotency_key text not null unique,
 amount_cents integer not null check(amount_cents>0), currency text not null default 'eur' check(currency='eur'), status text not null default 'pending' check(status in ('pending','paid','failed','expired','refund_pending','refunded','partial_refund','reconciliation')),
 refunded_cents integer not null default 0 check(refunded_cents>=0), refund_id text unique, refund_request_id uuid unique, created_at timestamptz not null default now()
);
create table public.business_hours (id uuid primary key default gen_random_uuid(), weekday integer not null check(weekday between 0 and 6), opens time not null, closes time not null, check(opens<closes), unique(weekday,opens));
-- Les horaires spéciaux remplacent intégralement les horaires récurrents du jour ; zéro intervalle = fermeture.
create table public.special_hours (date date primary key, intervals jsonb not null default '[]', reason text);
create table public.contact_messages (id uuid primary key default gen_random_uuid(), first_name text not null, email text not null, phone text, subject text not null, message text not null, consent_at timestamptz not null default now(), status text not null default 'new' check(status in ('new','processed')), created_at timestamptz not null default now());
create table public.notification_outbox (id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id), contact_id uuid references public.contact_messages(id), transport text not null check(transport in ('whatsapp','email')), status text not null default 'pending' check(status in ('pending','processing','sent','failed','unconfigured','uncertain')), attempts integer not null default 0, last_error text, next_attempt_at timestamptz not null default now(), locked_at timestamptz, idempotency_key text not null unique, provider_id text, created_at timestamptz not null default now());
create table public.webhook_events (id text primary key, event_type text not null, created_at timestamptz not null default now());
create table public.admin_audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null, entity_id text, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.rate_limits (key text primary key, window_at timestamptz not null, count integer not null);
create index bookings_created_idx on public.bookings(created_at);
create index outbox_due_idx on public.notification_outbox(status,next_attempt_at);
create index allocations_expiry_idx on public.time_allocations(expires_at) where state='active' and kind='hold';

alter table public.admin_users enable row level security;
create policy admin_self on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
do $$ declare t text; begin
 foreach t in array array['site_settings','services','clients','time_allocations','bookings','payments','business_hours','special_hours','contact_messages','notification_outbox','webhook_events','admin_audit_log','rate_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_read on public.%I for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))',t);
 end loop;
end $$;
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

create function public.assert_admin(p_actor uuid) returns void language plpgsql set search_path='' as $$ begin
 if p_actor is null or not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'UNAUTHORIZED'; end if;
end $$;
create function public.service_eligible(p_service uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select visibility and bookable and operational_status='active' and price_cents is not null and qualification_requirement<>'equipment'
 and (qualification_requirement='none' or qualification_verified_at is not null)
 and (qualification_requirement<>'procedure' or procedure_verified_at is not null) from public.services where id=p_service),false);
$$;
create function public.is_open(p_start timestamptz,p_end timestamptz) returns boolean language plpgsql stable set search_path='' as $$
declare d date := (p_start at time zone 'Europe/Paris')::date; a time := (p_start at time zone 'Europe/Paris')::time; b time := (p_end at time zone 'Europe/Paris')::time;
begin
 if (p_end at time zone 'Europe/Paris')::date<>d or p_end<=p_start then return false; end if;
 if exists(select 1 from public.special_hours where date=d) then
  return exists(select 1 from public.special_hours s, jsonb_array_elements(s.intervals) i where s.date=d and a>=(i->>'opens')::time and b<=(i->>'closes')::time);
 end if;
 return exists(select 1 from public.business_hours where weekday=extract(dow from d) and a>=opens and b<=closes);
end $$;
create function public.expire_holds() returns void language plpgsql set search_path='' as $$ begin
 -- Ordre de verrouillage commun à l'unique ressource, évite un deadlock expiration/webhook.
 perform pg_catalog.pg_advisory_xact_lock(748201);
 with expired as (update public.time_allocations set state='expired' where state='active' and kind='hold' and expires_at<=now() returning id)
 update public.bookings set status='expired' where allocation_id in(select id from expired) and status='pending';
 update public.payments p set status='expired' from public.bookings b where p.booking_id=b.id and b.status='expired' and p.status='pending';
end $$;
create function public.take_rate_limit(p_key text,p_max integer) returns boolean language plpgsql set search_path='' as $$
declare n integer; begin
 insert into public.rate_limits(key,window_at,count) values(p_key,now(),1) on conflict(key) do update set
 count=case when public.rate_limits.window_at<now()-interval '15 minutes' then 1 else public.rate_limits.count+1 end,
 window_at=case when public.rate_limits.window_at<now()-interval '15 minutes' then now() else public.rate_limits.window_at end returning count into n;
 return n<=p_max;
end $$;
create function public.availability(p_service uuid,p_date date) returns table(start_at timestamptz,end_at timestamptz,available boolean) language plpgsql set search_path='' as $$
declare duration integer; cfg jsonb; begin
 perform public.expire_holds();
 select duration_minutes into duration from public.services where id=p_service;
 select value into cfg from public.site_settings where id=1;
 if not public.service_eligible(p_service) or duration is null or p_date<(now() at time zone 'Europe/Paris')::date or p_date>(now() at time zone 'Europe/Paris')::date+coalesce((cfg->>'horizonDays')::int,60) then return; end if;
 return query select t, t+make_interval(mins=>duration),
 t>=now()+make_interval(hours=>coalesce((cfg->>'noticeHours')::int,24)) and t<=now()+make_interval(days=>coalesce((cfg->>'horizonDays')::int,60)) and not exists(select 1 from public.time_allocations a where a.state='active' and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(t,t+make_interval(mins=>duration),'[)'))
 from generate_series(p_date::timestamp at time zone 'Europe/Paris', (p_date+1)::timestamp at time zone 'Europe/Paris'-interval '30 minutes', interval '30 minutes') t
 where public.is_open(t,t+make_interval(mins=>duration));
end $$;
create function public.create_booking(p_service uuid,p_start timestamptz,p_client jsonb,p_request uuid,p_actor uuid default null,p_offline text default null) returns jsonb language plpgsql set search_path='' as $$
declare s public.services; cfg jsonb; aid uuid; cid uuid; bid uuid; tok uuid; finish timestamptz; existing public.bookings;
begin
 perform public.expire_holds();
 if p_actor is not null then perform public.assert_admin(p_actor); end if;
 select * into existing from public.bookings where request_id=p_request;
 if found then raise exception 'Demande déjà reçue'; end if;
 select * into s from public.services where id=p_service for share;
 if not public.service_eligible(p_service) then raise exception 'Service indisponible'; end if;
 select value into cfg from public.site_settings where id=1 for share;
 finish:=p_start+make_interval(mins=>s.duration_minutes);
 if not public.is_open(p_start,finish) or p_start<=now() then raise exception 'Créneau indisponible'; end if;
 if p_actor is null then
  if not coalesce((cfg->>'bookingEnabled')::boolean,false) or not coalesce((cfg->>'legalReady')::boolean,false) or not coalesce((cfg->>'privacyReady')::boolean,false) or not coalesce((cfg->>'pricesValidated')::boolean,false) then raise exception 'Service indisponible'; end if;
  if p_start<now()+make_interval(hours=>coalesce((cfg->>'noticeHours')::int,24)) or p_start>now()+make_interval(days=>coalesce((cfg->>'horizonDays')::int,60)) or (p_start at time zone 'Europe/Paris')::time::text !~ ':(00|30):00$' then raise exception 'Créneau indisponible'; end if;
 else
  if p_offline not in ('paid_offline','unpaid') or p_offline is null then raise exception 'État hors ligne requis'; end if;
 end if;
 if length(p_client->>'first_name') not between 1 and 80 or length(p_client->>'last_name') not between 1 and 80 or coalesce(p_client->>'email','') !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' or coalesce(p_client->>'phone','') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Cliente invalide'; end if;
 insert into public.time_allocations(start_at,end_at,kind,expires_at) values(p_start,finish,case when p_actor is null then 'hold' else 'manual' end,case when p_actor is null then now()+make_interval(mins=>coalesce((cfg->>'holdMinutes')::integer,35)) end) returning id into aid;
 insert into public.clients(first_name,last_name,email,phone) values(p_client->>'first_name',p_client->>'last_name',p_client->>'email',p_client->>'phone') returning id into cid;
 insert into public.bookings(request_id,allocation_id,client_id,service_id,service_name,price_cents,duration_minutes,status,source,offline_status) values(p_request,aid,cid,s.id,s.name,s.price_cents,s.duration_minutes,case when p_actor is null then 'pending' else 'confirmed' end,case when p_actor is null then 'online' else 'manual' end,p_offline) returning id,public_token into bid,tok;
 if p_actor is null then insert into public.payments(booking_id,amount_cents,idempotency_key) values(bid,s.price_cents,p_request::text); else insert into public.admin_audit_log(actor_id,action,entity_id) values(p_actor,'manual_booking',bid::text); end if;
 return jsonb_build_object('id',bid,'token',tok,'price_cents',s.price_cents,'service_name',s.name,'start_at',p_start,'end_at',finish,'checkout_minutes',coalesce((cfg->>'checkoutMinutes')::integer,30));
end $$;
create function public.attach_checkout(p_booking uuid,p_session text) returns void language plpgsql set search_path='' as $$ begin
 update public.payments set stripe_session_id=p_session where booking_id=p_booking and status='pending' and stripe_session_id is null;
 if not found then raise exception 'Session non attachée'; end if;
end $$;
create function public.process_payment_event(p_event text,p_type text,p_session text,p_intent text,p_amount integer,p_currency text,p_state text,p_refunded integer default 0,p_booking uuid default null,p_request uuid default null) returns text language plpgsql set search_path='' as $$
declare p public.payments; b public.bookings; a public.time_allocations;
begin
 perform pg_catalog.pg_advisory_xact_lock(748201);
 insert into public.webhook_events(id,event_type) values(p_event,p_type) on conflict do nothing;
 if not found then return 'duplicate'; end if;
 select * into p from public.payments where (stripe_session_id=p_session and p_session is not null) or (stripe_payment_intent=p_intent and p_intent is not null) for update;
 if not found and p_session is not null and p_booking is not null and p_request is not null then
  -- Récupération après crash entre création Checkout et attach_checkout : métadonnées signées uniquement.
  update public.payments set stripe_session_id=p_session where booking_id=p_booking and idempotency_key=p_request::text and stripe_session_id is null returning * into p;
 end if;
 if not found then raise exception 'Paiement inconnu : réessayer'; end if;
 select * into b from public.bookings where id=p.booking_id for update;
 select * into a from public.time_allocations where id=b.allocation_id for update;
 if p_currency<>'eur' or p_amount<>p.amount_cents then raise exception 'Montant incohérent'; end if;
 if p_state='refunded' then
  update public.payments set refunded_cents=greatest(refunded_cents,p_refunded),status=case when greatest(refunded_cents,p_refunded)>=amount_cents then 'refunded' else 'partial_refund' end where id=p.id;
  return 'refunded';
 end if;
 if p_state='paid' then
  if p.status in ('paid','refund_pending','refunded','partial_refund','reconciliation') then return 'already_paid'; end if;
  if b.status='cancelled' then
   update public.payments set status='reconciliation',stripe_payment_intent=p_intent where id=p.id;
   insert into public.admin_audit_log(action,entity_id,detail) values('late_payment',b.id::text,'{"refund_required":true}'); return 'reconciliation';
  end if;
  begin
   update public.time_allocations set state='active',kind='booking',expires_at=null where id=a.id;
  exception when exclusion_violation then
   update public.bookings set status='reconciliation' where id=b.id;
   update public.payments set status='reconciliation',stripe_payment_intent=p_intent where id=p.id;
   insert into public.admin_audit_log(action,entity_id,detail) values('late_payment_conflict',b.id::text,'{"refund_required":true}');
   return 'reconciliation';
  end;
  update public.bookings set status='confirmed' where id=b.id;
  update public.payments set status='paid',stripe_payment_intent=p_intent where id=p.id;
  insert into public.notification_outbox(booking_id,transport,idempotency_key) values(b.id,'whatsapp','booking-wa-'||b.id),(b.id,'email','booking-email-'||b.id) on conflict do nothing;
 elsif p_state in ('failed','expired') and p.status='pending' then
  update public.time_allocations set state='expired' where id=a.id;
  update public.bookings set status='expired' where id=b.id and status='pending';
  update public.payments set status=p_state where id=p.id;
 end if;
 return p_state;
end $$;
create function public.admin_mutate(p_actor uuid,p_action text,p_data jsonb) returns jsonb language plpgsql set search_path='' as $$
declare aid uuid; b public.bookings; r public.payments; finish timestamptz; s public.services; item jsonb; begin
 perform pg_catalog.pg_advisory_xact_lock(748201);
 perform public.assert_admin(p_actor);
 if p_action='block' then
  insert into public.time_allocations(start_at,end_at,kind,reason) values((p_data->>'start_at')::timestamptz,(p_data->>'end_at')::timestamptz,'block',left(p_data->>'reason',500)) returning id into aid;
 elsif p_action='unblock' then
  update public.time_allocations set state='cancelled' where id=(p_data->>'id')::uuid and kind='block' returning id into aid;
 elsif p_action in ('cancel','move','notes') then
  select * into strict b from public.bookings where id=(p_data->>'id')::uuid for update;
  aid:=b.id;
  if p_action='cancel' then
   if b.status='pending' then raise exception 'Attendre expiration ou règlement du paiement'; end if;
   update public.bookings set status='cancelled',notes=notes||E'\n'||coalesce(p_data->>'reason','') where id=b.id;
   update public.time_allocations set state='cancelled' where id=b.allocation_id;
  elsif p_action='move' then
   if b.status<>'confirmed' or not public.service_eligible(b.service_id) then raise exception 'Modification refusée'; end if;
   finish:=(p_data->>'start_at')::timestamptz+make_interval(mins=>b.duration_minutes);
   if (p_data->>'start_at')::timestamptz<=now() or not public.is_open((p_data->>'start_at')::timestamptz,finish) then raise exception 'Créneau indisponible'; end if;
   update public.time_allocations set start_at=(p_data->>'start_at')::timestamptz,end_at=finish where id=b.allocation_id;
  else update public.bookings set notes=left(p_data->>'notes',4000) where id=b.id; end if;
 elsif p_action='service' then
  update public.services set name=p_data->>'name',category=p_data->>'category',description=p_data->>'description',price_cents=nullif(p_data->>'price_cents','')::integer,duration_minutes=(p_data->>'duration_minutes')::integer,sort_order=(p_data->>'sort_order')::integer,operational_status=p_data->>'operational_status',bookable=(p_data->>'bookable')::boolean,visibility=(p_data->>'visibility')::boolean,image=nullif(p_data->>'image',''),updated_at=now() where id=(p_data->>'id')::uuid returning id into aid;
 elsif p_action='verify_qualification' then
  if coalesce(p_data->>'attestation','')<>'QUALIFICATION VÉRIFIÉE' or length(coalesce(p_data->>'evidence',''))<10 then raise exception 'Attestation requise'; end if;
  update public.services set qualification_verified_at=now() where id=(p_data->>'id')::uuid and qualification_requirement in ('professional','procedure') returning id into aid;
 elsif p_action='verify_procedure' then
  if coalesce(p_data->>'attestation','')<>'PROCÉDÉ VÉRIFIÉ' or length(coalesce(p_data->>'evidence',''))<10 then raise exception 'Attestation requise'; end if;
  update public.services set procedure_verified_at=now() where id=(p_data->>'id')::uuid and qualification_requirement='procedure' returning id into aid;
 elsif p_action='hours' then
  delete from public.business_hours;
  for item in select * from jsonb_array_elements(p_data->'hours') loop
   insert into public.business_hours(weekday,opens,closes) values((item->>'weekday')::integer,(item->>'opens')::time,(item->>'closes')::time);
  end loop;
 elsif p_action='special_hours' then
  for item in select * from jsonb_array_elements(p_data->'intervals') loop
   if (item->>'opens')::time >= (item->>'closes')::time then raise exception 'Intervalle invalide'; end if;
  end loop;
  insert into public.special_hours(date,intervals,reason) values((p_data->>'date')::date,p_data->'intervals',p_data->>'reason') on conflict(date) do update set intervals=excluded.intervals,reason=excluded.reason;
 elsif p_action='delete_special_hours' then delete from public.special_hours where date=(p_data->>'date')::date;
 elsif p_action='settings' then update public.site_settings set value=value||p_data,updated_at=now() where id=1;
 elsif p_action='anonymize' then
  if exists(select 1 from public.bookings b join public.time_allocations a on a.id=b.allocation_id where b.client_id=(p_data->>'id')::uuid and (b.status in ('pending','reconciliation') or a.end_at>now() or b.created_at>now()-make_interval(days=>coalesce((select (value->>'retentionDays')::integer from public.site_settings where id=1),365)))) then raise exception 'Conservation ou rendez-vous actif'; end if;
  update public.clients set first_name='Anonymisée',last_name='',email='',phone='' where id=(p_data->>'id')::uuid returning id into aid;
  update public.bookings set notes='' where client_id=aid;
 elsif p_action='process_contact' then update public.contact_messages set status='processed' where id=(p_data->>'id')::uuid returning id into aid;
 elsif p_action='retry_notification' then
  update public.notification_outbox set status='pending',next_attempt_at=now(),last_error=null where id=(p_data->>'id')::uuid and status in ('failed','unconfigured') and attempts<5 returning id into aid;
 elsif p_action='prepare_refund' then
  select * into strict r from public.payments where booking_id=(p_data->>'id')::uuid for update;
  if r.status not in ('paid','partial_refund','reconciliation','refund_pending') then raise exception 'Remboursement impossible'; end if;
  update public.payments set status='refund_pending',refund_request_id=coalesce(refund_request_id,gen_random_uuid()) where id=r.id returning * into r;
  insert into public.admin_audit_log(actor_id,action,entity_id) values(p_actor,p_action,r.booking_id::text);
  return to_jsonb(r);
 else raise exception 'Action inconnue'; end if;
 insert into public.admin_audit_log(actor_id,action,entity_id,detail) values(p_actor,p_action,aid::text,case when p_action in ('verify_qualification','verify_procedure') then p_data else '{}'::jsonb end);
 return jsonb_build_object('id',aid);
end $$;
create function public.store_contact(p_data jsonb) returns uuid language plpgsql set search_path='' as $$ declare cid uuid; begin
 insert into public.contact_messages(first_name,email,phone,subject,message) values(p_data->>'first_name',p_data->>'email',p_data->>'phone',p_data->>'subject',p_data->>'message') returning id into cid;
 insert into public.notification_outbox(contact_id,transport,idempotency_key) values(cid,'email','contact-'||cid);
 return cid;
end $$;
create function public.claim_notifications() returns setof public.notification_outbox language plpgsql set search_path='' as $$ begin
 -- Un crash après un envoi laisse un résultat ambigu : jamais de relance automatique risquant un doublon Meta.
 update public.notification_outbox set status='uncertain',last_error='Interruption : vérifier le fournisseur avant toute reprise.' where status='processing' and locked_at<now()-interval '10 minutes';
 return query with due as (select id from public.notification_outbox where status='pending' and attempts<5 and next_attempt_at<=now() order by created_at for update skip locked limit 10)
 update public.notification_outbox o set status='processing',locked_at=now(),attempts=attempts+1 from due where o.id=due.id returning o.*;
end $$;
-- Aucun RPC métier accessible directement par une cliente ni par une session authentifiée.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
