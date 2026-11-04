-- Additive parity migration. Apply only to an explicitly selected database.
alter table public.bookings add column request_hash text;
alter table public.payments add column checkout_expires_at timestamptz;
alter table public.bookings add column demo boolean not null default false;
alter table public.clients add column demo boolean not null default false;
alter table public.services add column demo boolean not null default false;
alter table public.categories add column demo boolean not null default false;
alter table public.products add column demo boolean not null default false;
alter table public.time_allocations add column demo boolean not null default false;
alter table public.payments add column provider text not null default 'stripe' check(provider in ('stripe','mock'));
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('pending','paid','mock_paid','failed','expired','refund_pending','refunded','partial_refund','reconciliation'));
alter table public.payments add constraint payment_mock_separation check((provider='mock' and stripe_session_id is null and stripe_payment_intent is null and status not in ('paid','refund_pending','refunded','partial_refund')) or (provider='stripe' and status<>'mock_paid'));
alter table public.services drop constraint services_image_check;
alter table public.services add constraint services_image_check check(image is null or image ~ '^/(assets|images/beauty)/[a-zA-Z0-9/_.-]+\.(svg|png|jpg|webp)$');
alter table public.notification_outbox add column read_at timestamptz;
create table public.management_notifications(id uuid primary key default gen_random_uuid(),kind text not null,entity_id text not null,title text not null,message text not null,status text not null default 'unread' check(status in ('unread','read')),transport text not null default 'local' check(transport='local'),created_at timestamptz not null default now());
create table public.generated_days(id text primary key,date date not null,service_id uuid not null references public.services(id),generated_at timestamptz not null default now(),slots jsonb not null);
create table public.local_import_runs(sha256 text primary key references public.local_import_archives(sha256),counts jsonb not null,completed_at timestamptz not null default now());
create index clients_lookup on public.clients(lower(last_name),lower(first_name));
create index bookings_client_idx on public.bookings(client_id);
create index allocations_start_idx on public.time_allocations(start_at);
do $$ declare t text; begin
 foreach t in array array['management_notifications','generated_days','local_import_runs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_read on public.%I for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

-- Promotion is explicit, atomic and never performed by an application startup.
create function public.management_import_archive(p_actor uuid,p_sha text) returns jsonb language plpgsql set search_path='' as $$
declare envelope jsonb; d jsonb; r jsonb; line jsonb; pay jsonb; result jsonb; n integer; begin
 perform pg_catalog.pg_advisory_xact_lock(748201); perform public.assert_admin(p_actor);
 select counts into result from public.local_import_runs where sha256=p_sha;
 if found then return jsonb_build_object('replayed',true,'counts',result); end if;
 select payload into strict envelope from public.local_import_archives where sha256=p_sha for update;
 if envelope->>'source'<>'local' or (envelope->>'schema_version')::integer<>2 then raise exception 'Archive locale version 2 requise'; end if;
 d:=envelope->'data';
 for r in select * from jsonb_array_elements(d->'categories') loop
  insert into public.categories(id,name,description,image,sort_order,active,demo) values((r->>'id')::uuid,r->>'name',coalesce(r->>'description',''),coalesce(r->>'image',''),(r->>'sort_order')::integer,(r->>'active')::boolean,coalesce((r->>'demo')::boolean,false));
 end loop;
 for r in select * from jsonb_array_elements(d->'services') loop
  insert into public.services(id,slug,name,category,category_id,description,qualification_requirement,qualification_verified_at,procedure_verified_at,operational_status,bookable,visibility,price_cents,duration_minutes,sort_order,image,demo)
  values((r->>'id')::uuid,r->>'slug',r->>'name',r->>'category',(r->>'category_id')::uuid,r->>'description',r->>'qualification_requirement',(r->>'qualification_verified_at')::timestamptz,(r->>'procedure_verified_at')::timestamptz,r->>'operational_status',(r->>'bookable')::boolean,(r->>'visibility')::boolean,(r->>'price_cents')::integer,(r->>'duration_minutes')::integer,(r->>'sort_order')::integer,nullif(r->>'image',''),coalesce((r->>'demo')::boolean,false));
 end loop;
 for r in select * from jsonb_array_elements(d->'products') loop
  insert into public.products(id,name,description,category_id,price_cents,image,status,stock,demo) values((r->>'id')::uuid,r->>'name',r->>'description',(r->>'category_id')::uuid,(r->>'price_cents')::integer,coalesce(r->>'image',''),r->>'status',(r->>'stock')::integer,coalesce((r->>'demo')::boolean,false));
 end loop;
 for r in select * from jsonb_array_elements(d->'clients') loop
  insert into public.clients(id,first_name,last_name,email,phone,notes,created_at,demo) values((r->>'id')::uuid,r->>'first_name',r->>'last_name',r->>'email',r->>'phone',coalesce(r->>'notes',''),coalesce((r->>'created_at')::timestamptz,now()),coalesce((r->>'demo')::boolean,false));
 end loop;
 for r in select * from jsonb_array_elements(d->'allocations') loop
  insert into public.time_allocations(id,start_at,end_at,kind,state,expires_at,reason,series_id,demo) values((r->>'id')::uuid,(r->>'start_at')::timestamptz,(r->>'end_at')::timestamptz,r->>'kind',r->>'state',(r->>'expires_at')::timestamptz,coalesce(r->>'reason',''),(r->>'series_id')::uuid,coalesce((r->>'demo')::boolean,false));
 end loop;
 for r in select * from jsonb_array_elements(d->'bookings') loop
  insert into public.bookings(id,public_token,request_id,allocation_id,client_id,service_id,service_name,price_cents,duration_minutes,status,source,offline_status,notes,created_at,demo) values((r->>'id')::uuid,(r->>'public_token')::uuid,(r->>'request_id')::uuid,(r->>'allocation_id')::uuid,(r->>'client_id')::uuid,(r->'lines'->0->>'service_id')::uuid,r->>'service_name',(r->>'price_cents')::integer,(r->>'duration_minutes')::integer,r->>'status',r->>'source',r->>'offline_status',coalesce(r->>'notes',''),(r->>'created_at')::timestamptz,coalesce((r->>'demo')::boolean,false));
  delete from public.booking_lines where booking_id=(r->>'id')::uuid; n:=0;
  for line in select * from jsonb_array_elements(r->'lines') loop
   insert into public.booking_lines(id,booking_id,service_id,position,service_name,price_cents,duration_minutes) values((line->>'id')::uuid,(r->>'id')::uuid,(line->>'service_id')::uuid,n,line->>'service_name',(line->>'price_cents')::integer,(line->>'duration_minutes')::integer); n:=n+1;
  end loop;
  pay:=r->'payment';
  if pay is not null and pay<>'null'::jsonb then
   if pay->>'provider'<>'mock' then raise exception 'Un paiement local doit rester fictif'; end if;
   insert into public.payments(id,booking_id,idempotency_key,amount_cents,status,provider,created_at) values((pay->>'id')::uuid,(r->>'id')::uuid,'legacy-mock-'||(pay->>'id'),(pay->>'amount_cents')::integer,pay->>'status','mock',(pay->>'created_at')::timestamptz);
  end if;
 end loop;
 for r in select * from jsonb_array_elements(d->'hours') loop insert into public.business_hours(id,weekday,opens,closes) values((r->>'id')::uuid,(r->>'weekday')::integer,(r->>'opens')::time,(r->>'closes')::time); end loop;
 for r in select * from jsonb_array_elements(d->'special') loop insert into public.special_hours(date,intervals,reason) values((r->>'date')::date,r->'intervals',r->>'reason'); end loop;
 for r in select * from jsonb_array_elements(d->'notifications') loop insert into public.management_notifications(id,kind,entity_id,title,message,status,created_at) values((r->>'id')::uuid,r->>'kind',r->>'entity_id',r->>'title',r->>'message',r->>'status',(r->>'created_at')::timestamptz); end loop;
 for r in select * from jsonb_array_elements(d->'messages') loop insert into public.contact_messages(id,first_name,email,phone,subject,message,status,created_at) values((r->>'id')::uuid,r->>'first_name',r->>'email',r->>'phone',r->>'subject',r->>'message',r->>'status',(r->>'created_at')::timestamptz); end loop;
 for r in select * from jsonb_array_elements(d->'audit') loop insert into public.admin_audit_log(id,actor_id,action,entity_id,detail,created_at) values((r->>'id')::uuid,null,r->>'action',r->>'entity_id',coalesce(r->'detail','{}')||jsonb_build_object('legacy_actor_id',r->>'actor_id'),(r->>'created_at')::timestamptz); end loop;
 for r in select * from jsonb_array_elements(coalesce(d->'generated','[]')) loop insert into public.generated_days(id,date,service_id,generated_at,slots) values(r->>'id',(r->>'date')::date,(r->>'service_id')::uuid,(r->>'generated_at')::timestamptz,r->'slots'); end loop;
 update public.site_settings set value=value||(d->'settings')||'{"bookingEnabled":false}'::jsonb where id=1;
 if exists(select 1 from public.bookings b where b.id in (select (x->>'id')::uuid from jsonb_array_elements(d->'bookings') x) and (b.price_cents<>(select sum(price_cents) from public.booking_lines where booking_id=b.id) or b.duration_minutes<>(select sum(duration_minutes) from public.booking_lines where booking_id=b.id))) then raise exception 'Historique non conforme'; end if;
 select jsonb_object_agg(key,jsonb_array_length(value)) into result from jsonb_each(d) where jsonb_typeof(value)='array';
 insert into public.local_import_runs(sha256,counts) values(p_sha,result);
 update public.local_import_archives set promoted_at=now() where sha256=p_sha;
 return jsonb_build_object('replayed',false,'counts',result);
end $$;
revoke execute on function public.management_import_archive(uuid,text) from public,anon,authenticated;
grant execute on function public.management_import_archive(uuid,text) to service_role;

create or replace function public.service_eligible(p_service uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select s.visibility and s.bookable and s.operational_status='active' and s.price_cents is not null and c.active
 and s.qualification_requirement<>'equipment' and (s.qualification_requirement='none' or s.qualification_verified_at is not null)
 and (s.qualification_requirement<>'procedure' or s.procedure_verified_at is not null)
 from public.services s join public.categories c on c.id=s.category_id where s.id=p_service),false);
$$;
create or replace function public.availability(p_service uuid,p_date date) returns table(start_at timestamptz,end_at timestamptz,available boolean) language plpgsql set search_path='' as $$
declare duration integer; cfg jsonb; step integer; begin
 perform public.expire_holds();
 select duration_minutes into duration from public.services where id=p_service;
 select value into cfg from public.site_settings where id=1;
 step:=coalesce((cfg->>'slotStepMinutes')::integer,30);
 if not public.service_eligible(p_service) or duration is null or p_date<(now() at time zone 'Europe/Paris')::date or p_date>(now() at time zone 'Europe/Paris')::date+coalesce((cfg->>'horizonDays')::integer,60) then return; end if;
 return query select t,t+make_interval(mins=>duration),
 t>=now()+make_interval(hours=>coalesce((cfg->>'noticeHours')::integer,24)) and t<=now()+make_interval(days=>coalesce((cfg->>'horizonDays')::integer,60)) and not exists(select 1 from public.time_allocations a where a.state='active' and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(t,t+make_interval(mins=>duration),'[)'))
 from generate_series(p_date::timestamp at time zone 'Europe/Paris',(p_date+1)::timestamp at time zone 'Europe/Paris'-interval '1 minute',interval '1 minute') t
 where (extract(hour from t at time zone 'Europe/Paris')::integer*60+extract(minute from t at time zone 'Europe/Paris')::integer)%step=0 and public.is_open(t,t+make_interval(mins=>duration));
end $$;

create function public.management_conflicts(p_start timestamptz,p_end timestamptz,p_ignore uuid default null) returns void language plpgsql set search_path='' as $$
declare conflicts jsonb; begin
 select jsonb_agg(jsonb_build_object('id',id,'start_at',start_at,'end_at',end_at,'kind',kind)) into conflicts from public.time_allocations where state='active' and id is distinct from p_ignore and start_at<p_end and end_at>p_start;
 if conflicts is not null then raise exception using errcode='23P01',message='Créneau indisponible.',detail=jsonb_build_object('conflicts',conflicts)::text; end if;
end $$;
create function public.management_public_booking(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',b.id,'token',b.public_token,'public_token',b.public_token,'service_name',b.service_name,'price_cents',b.price_cents,'status',b.status,'start_at',a.start_at,'end_at',a.end_at,'payment_status',p.status,'payment_provider',p.provider,'stripe_session_id',p.stripe_session_id,'checkout_expires_at',p.checkout_expires_at,'checkout_minutes',coalesce((cfg.value->>'checkoutMinutes')::integer,30),'hold_expires_at',a.expires_at)
 from public.bookings b join public.time_allocations a on a.id=b.allocation_id left join public.payments p on p.booking_id=b.id cross join public.site_settings cfg where b.id=p_id and cfg.id=1;
$$;
create function public.management_booking_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(b)-'request_hash' || jsonb_build_object('client',to_jsonb(c),'allocation',to_jsonb(a),'payment',case when p.id is null then null else to_jsonb(p) end,'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.position) from public.booking_lines l where l.booking_id=b.id),'[]'::jsonb))
 from public.bookings b join public.clients c on c.id=b.client_id join public.time_allocations a on a.id=b.allocation_id left join public.payments p on p.booking_id=b.id where b.id=p_id;
$$;

create function public.management_save_booking(p_input jsonb,p_actor uuid default null,p_existing uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare b public.bookings; old public.bookings; a public.time_allocations; s public.services; cfg jsonb; cid uuid; bid uuid; aid uuid; item jsonb; lines jsonb:='[]'; same_services boolean:=false; paid boolean:=false; start_time timestamptz:=(p_input->>'start_at')::timestamptz; finish timestamptz; ids uuid[]; old_ids uuid[]; duration integer:=0; price integer:=0; state text; hash text; pos integer:=0; customer jsonb:=p_input->'client'; begin
 perform pg_catalog.pg_advisory_xact_lock(748201); perform public.expire_holds();
 if p_actor is not null then perform public.assert_admin(p_actor); end if;
 select array_agg(value::uuid order by ord) into ids from jsonb_array_elements_text(p_input->'service_ids') with ordinality x(value,ord);
 if cardinality(ids) is null or cardinality(ids) not between 1 and 8 then raise exception 'Prestations requises'; end if;
 hash:=md5(jsonb_build_object('ids',ids,'start',start_time,'client_id',p_input->>'client_id','client',case when customer is null then null else jsonb_build_object('first_name',customer->>'first_name','last_name',customer->>'last_name','email',customer->>'email','phone',customer->>'phone') end)::text);
 select value into cfg from public.site_settings where id=1 for share;
 if p_existing is null then
  select * into b from public.bookings where request_id=(p_input->>'request_id')::uuid;
  if found then
   if b.request_hash is distinct from hash then raise exception 'Identifiant de demande déjà utilisé avec un autre contenu'; end if;
   return public.management_public_booking(b.id);
  end if;
 else
  if p_actor is null then raise exception 'UNAUTHORIZED'; end if;
  select * into strict old from public.bookings where id=p_existing for update;
  select * into a from public.time_allocations where id=old.allocation_id;
  if old.source='online' and old.status='pending' then raise exception 'Attendre le résultat du paiement avant modification'; end if;
  select array_agg(service_id order by position) into old_ids from public.booking_lines where booking_id=old.id;
  same_services:=ids=old_ids;
  select coalesce(bool_or(status in ('paid','mock_paid','partial_refund','refund_pending','refunded')),false) into paid from public.payments where booking_id=old.id;
  if paid and not same_services then raise exception 'Les prestations d’un paiement reçu sont figées'; end if;
 end if;
 foreach aid in array ids loop
  select * into strict s from public.services where id=aid for share;
  if not same_services and not public.service_eligible(aid) then raise exception 'Prestation non autorisée : état ou qualification'; end if;
  if same_services then
   select to_jsonb(l) into item from public.booking_lines l where booking_id=old.id and position=pos;
  else item:=jsonb_build_object('id',gen_random_uuid(),'service_id',s.id,'service_name',s.name,'price_cents',s.price_cents,'duration_minutes',s.duration_minutes); end if;
  lines:=lines||jsonb_build_array(item); duration:=duration+(item->>'duration_minutes')::integer; price:=price+(item->>'price_cents')::integer; pos:=pos+1;
 end loop;
 finish:=start_time+make_interval(mins=>duration);
 state:=case when p_actor is null then 'pending' else coalesce(p_input->>'status',old.status,'confirmed') end;
 if state not in ('pending','confirmed','completed','cancelled','no_show') then raise exception 'État invalide'; end if;
 if old.source='online' and state<>'cancelled' and (not paid or state='pending') then raise exception 'La confirmation nécessite un paiement reçu'; end if;
 if state<>'cancelled' and (p_existing is null or a.start_at<>start_time or a.end_at<>finish) and (not public.is_open(start_time,finish) or start_time<now()-case when p_existing is null then interval '0 days' else interval '3650 days' end) then raise exception 'Créneau indisponible : horaires ou date'; end if;
 if p_actor is null then
  if p_input ? 'client_id' then raise exception 'Coordonnées requises'; end if;
  if not coalesce((cfg->>'bookingEnabled')::boolean,false) or not coalesce((cfg->>'legalReady')::boolean,false) or not coalesce((cfg->>'privacyReady')::boolean,false) or not coalesce((cfg->>'pricesValidated')::boolean,false) then raise exception 'Réservation désactivée'; end if;
  if start_time<now()+make_interval(hours=>coalesce((cfg->>'noticeHours')::integer,24)) or start_time>now()+make_interval(days=>coalesce((cfg->>'horizonDays')::integer,60)) or extract(second from start_time)<>0 or (extract(hour from start_time at time zone 'Europe/Paris')::integer*60+extract(minute from start_time at time zone 'Europe/Paris')::integer)%coalesce((cfg->>'slotStepMinutes')::integer,30)<>0 then raise exception 'Créneau indisponible : préavis ou fenêtre'; end if;
 end if;
 if state<>'cancelled' then perform public.management_conflicts(start_time,finish,old.allocation_id); end if;
 if p_input->>'client_id' is not null then
  select id into strict cid from public.clients where id=(p_input->>'client_id')::uuid;
 else
  if coalesce(customer->>'first_name','')='' or coalesce(customer->>'last_name','')='' or coalesce(customer->>'email','') !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' or coalesce(customer->>'phone','') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Cliente invalide'; end if;
  select id into cid from public.clients where lower(email)=lower(customer->>'email') and phone=customer->>'phone' order by created_at limit 1;
  if cid is null then insert into public.clients(first_name,last_name,email,phone) values(customer->>'first_name',customer->>'last_name',customer->>'email',customer->>'phone') returning id into cid; end if;
 end if;
 aid:=coalesce(old.allocation_id,gen_random_uuid()); bid:=coalesce(old.id,gen_random_uuid());
 insert into public.time_allocations(id,start_at,end_at,kind,state,expires_at) values(aid,start_time,finish,case when p_actor is null then 'hold' when a.kind='booking' then 'booking' else 'manual' end,case when state='cancelled' then 'cancelled' else 'active' end,case when p_actor is null then now()+make_interval(mins=>coalesce((cfg->>'holdMinutes')::integer,35)) end)
 on conflict(id) do update set start_at=excluded.start_at,end_at=excluded.end_at,kind=excluded.kind,state=excluded.state,expires_at=excluded.expires_at;
 insert into public.bookings(id,request_id,request_hash,allocation_id,client_id,service_id,service_name,price_cents,duration_minutes,status,source,offline_status,notes) values(bid,coalesce(old.request_id,(p_input->>'request_id')::uuid),coalesce(old.request_hash,hash),aid,cid,ids[1],(select string_agg(x->>'service_name',' + ') from jsonb_array_elements(lines) x),price,duration,state,coalesce(old.source,case when p_actor is null then 'online' else 'manual' end),case when old.source='online' then old.offline_status when p_actor is not null then coalesce(p_input->>'offline_status',old.offline_status,'unpaid') end,coalesce(p_input->>'notes',old.notes,''))
 on conflict(id) do update set client_id=excluded.client_id,service_id=excluded.service_id,service_name=excluded.service_name,price_cents=excluded.price_cents,duration_minutes=excluded.duration_minutes,status=excluded.status,offline_status=excluded.offline_status,notes=excluded.notes;
 -- The original insert trigger creates one line. Replace it with the complete immutable snapshot.
 if not same_services then
  delete from public.booking_lines where booking_id=bid; pos:=0;
  for item in select * from jsonb_array_elements(lines) loop
   insert into public.booking_lines(id,booking_id,service_id,position,service_name,price_cents,duration_minutes) values((item->>'id')::uuid,bid,(item->>'service_id')::uuid,pos,item->>'service_name',(item->>'price_cents')::integer,(item->>'duration_minutes')::integer); pos:=pos+1;
  end loop;
 end if;
 if p_actor is null then insert into public.payments(booking_id,amount_cents,idempotency_key,checkout_expires_at) values(bid,price,p_input->>'request_id',to_timestamp(ceil(extract(epoch from now())))+make_interval(mins=>coalesce((cfg->>'checkoutMinutes')::integer,30))+interval '5 seconds'); end if;
 insert into public.admin_audit_log(actor_id,action,entity_id,detail) values(p_actor,case when p_existing is null then 'booking_created' else 'booking_updated' end,bid::text,jsonb_build_object('before_start',a.start_at,'after_start',start_time,'status',state));
 insert into public.management_notifications(kind,entity_id,title,message) values('booking',bid::text,'MONÉA · Rendez-vous enregistré',(select service_name from public.bookings where id=bid));
 return public.management_public_booking(bid);
end $$;
create or replace function public.create_booking(p_service uuid,p_start timestamptz,p_client jsonb,p_request uuid,p_actor uuid default null,p_offline text default null) returns jsonb language sql set search_path='' as $$
 select public.management_save_booking(jsonb_build_object('service_ids',jsonb_build_array(p_service),'start_at',p_start,'client',p_client,'request_id',p_request,'offline_status',p_offline),p_actor);
$$;
create or replace function public.attach_checkout(p_booking uuid,p_session text) returns void language plpgsql set search_path='' as $$ begin
 update public.payments set stripe_session_id=p_session where booking_id=p_booking and provider='stripe' and (stripe_session_id is null or stripe_session_id=p_session);
 if not found then raise exception 'Session non attachée'; end if;
end $$;

create function public.management_mutate(p_actor uuid,p_command jsonb) returns jsonb language plpgsql set search_path='' as $$
declare action text:=p_command->>'action'; d jsonb:=p_command->'data'; entity uuid:=coalesce(nullif(p_command->'data'->>'id','')::uuid,gen_random_uuid()); old public.services; b public.bookings; old_block public.time_allocations; cat text; pos integer; v jsonb; a timestamptz; z timestamptz; delta integer; sid uuid; output jsonb; periods integer:=1; begin
 perform pg_catalog.pg_advisory_xact_lock(748201); perform public.assert_admin(p_actor); perform public.expire_holds();
 if action in ('category_delete','product_delete','client_delete','booking_cancel','booking_delete','block_delete','contact_delete') and coalesce((d->>'confirmed')::boolean,false) is not true then raise exception 'Confirmation requise'; end if;
 if action='category_save' then
  insert into public.categories(id,name,description,image,sort_order,active) values(entity,d->>'name',d->>'description',d->>'image',(d->>'sort_order')::integer,(d->>'active')::boolean) on conflict(id) do update set name=excluded.name,description=excluded.description,image=excluded.image,sort_order=excluded.sort_order,active=excluded.active;
  update public.services set category=d->>'name' where category_id=entity;
 elsif action='category_delete' then delete from public.categories where id=entity;
 elsif action='service_save' then
  select * into old from public.services where id=entity;
  if found and old.qualification_requirement<>d->>'qualification_requirement' then raise exception 'L’exigence de qualification ne peut pas être abaissée'; end if;
  select name into strict cat from public.categories where id=(d->>'category_id')::uuid;
  insert into public.services(id,name,slug,category,category_id,description,price_cents,duration_minutes,image,sort_order,visibility,bookable,operational_status,qualification_requirement)
  values(entity,d->>'name',coalesce(d->>'slug',old.slug,trim(both '-' from lower(regexp_replace(translate(d->>'name','àâäéèêëîïôöùûüç','aaaeeeeiioouuuc'),'[^a-zA-Z0-9]+','-','g')))),cat,(d->>'category_id')::uuid,d->>'description',(d->>'price_cents')::integer,(d->>'duration_minutes')::integer,nullif(d->>'image',''),(d->>'sort_order')::integer,(d->>'visibility')::boolean,(d->>'bookable')::boolean,d->>'operational_status',d->>'qualification_requirement')
  on conflict(id) do update set name=excluded.name,slug=excluded.slug,category_id=excluded.category_id,category=excluded.category,description=excluded.description,price_cents=excluded.price_cents,duration_minutes=excluded.duration_minutes,image=excluded.image,sort_order=excluded.sort_order,visibility=excluded.visibility,bookable=excluded.bookable,operational_status=excluded.operational_status,updated_at=now();
 elsif action='service_archive' then update public.services set visibility=false,bookable=false,operational_status=case when operational_status='study' then 'study' else 'coming_soon' end where id=entity;
 elsif action='qualification' then
  select * into strict old from public.services where id=entity;
  if length(d->>'evidence')<10 or old.qualification_requirement in ('none','equipment') then raise exception 'Attestation non applicable'; end if;
  if d->>'attestation'='QUALIFICATION VÉRIFIÉE' then update public.services set qualification_verified_at=now() where id=entity;
  elsif d->>'attestation'='PROCÉDÉ VÉRIFIÉ' and old.qualification_requirement='procedure' then update public.services set procedure_verified_at=now() where id=entity;
  else raise exception 'Attestation invalide'; end if;
 elsif action='product_save' then
  insert into public.products(id,name,description,category_id,price_cents,image,status,stock) values(entity,d->>'name',d->>'description',(d->>'category_id')::uuid,(d->>'price_cents')::integer,d->>'image',d->>'status',(d->>'stock')::integer) on conflict(id) do update set name=excluded.name,description=excluded.description,category_id=excluded.category_id,price_cents=excluded.price_cents,image=excluded.image,status=excluded.status,stock=excluded.stock;
 elsif action='product_delete' then delete from public.products where id=entity;
 elsif action='client_save' then
  insert into public.clients(id,first_name,last_name,email,phone,notes) values(entity,d->>'first_name',d->>'last_name',d->>'email',d->>'phone',d->>'notes') on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,notes=excluded.notes;
 elsif action='client_delete' then delete from public.clients where id=entity;
 elsif action='booking_save' then
  if d->>'id' is not null and coalesce((d->>'confirmed')::boolean,false) is not true then raise exception 'Confirmation requise'; end if;
  return public.management_save_booking(d,p_actor,(d->>'id')::uuid);
 elsif action='booking_cancel' then
  select * into strict b from public.bookings where id=entity for update;
  update public.time_allocations set state='cancelled' where id=b.allocation_id;
  update public.bookings set status='cancelled',notes=notes||case when coalesce(d->>'reason','')='' then '' else E'\nAnnulation : '||(d->>'reason') end where id=entity;
 elsif action='booking_delete' then
  select * into strict b from public.bookings where id=entity;
  if b.status<>'cancelled' or exists(select 1 from public.payments where booking_id=entity) then raise exception 'Seul un rendez-vous annulé sans paiement peut être supprimé'; end if;
  delete from public.booking_lines where booking_id=entity; delete from public.bookings where id=entity; delete from public.time_allocations where id=b.allocation_id;
 elsif action='block_save' then
  a:=(d->>'start_at')::timestamptz; z:=(d->>'end_at')::timestamptz;
  if z<=a then raise exception 'Période invalide'; end if;
  if d->>'id' is not null then select * into strict old_block from public.time_allocations where id=entity and kind='block'; end if;
  if d->>'repeat'='weekly' then
   if d->>'repeat_until' is null or (d->>'repeat_until')::date>(a at time zone 'Europe/Paris')::date+728 then raise exception 'Fin de récurrence requise, limitée à deux ans'; end if;
   periods:=greatest(1,((d->>'repeat_until')::date-(a at time zone 'Europe/Paris')::date)/7+1); sid:=gen_random_uuid();
  end if;
  if old_block.id is not null then update public.time_allocations set state='cancelled' where id=old_block.id; end if;
  for pos in 0..periods-1 loop
   -- Advance wall-clock dates, then convert to UTC to preserve Paris hours over DST.
   perform public.management_conflicts(((a at time zone 'Europe/Paris')+make_interval(days=>pos*7)) at time zone 'Europe/Paris',((z at time zone 'Europe/Paris')+make_interval(days=>pos*7)) at time zone 'Europe/Paris');
   insert into public.time_allocations(start_at,end_at,kind,reason,series_id) values(((a at time zone 'Europe/Paris')+make_interval(days=>pos*7)) at time zone 'Europe/Paris',((z at time zone 'Europe/Paris')+make_interval(days=>pos*7)) at time zone 'Europe/Paris','block',d->>'reason',sid) returning id into entity;
  end loop;
 elsif action='block_delete' then
  select * into strict old_block from public.time_allocations where id=entity and kind='block';
  update public.time_allocations set state='cancelled' where kind='block' and (id=entity or (coalesce((d->>'series')::boolean,false) and old_block.series_id is not null and series_id=old_block.series_id));
 elsif action='hours_save' then
  if exists(select 1 from jsonb_array_elements(d->'hours') with ordinality left_interval(v,n) join jsonb_array_elements(d->'hours') with ordinality right_interval(v,n) on left_interval.n<right_interval.n and left_interval.v->>'weekday'=right_interval.v->>'weekday' and left_interval.v->>'opens'<right_interval.v->>'closes' and left_interval.v->>'closes'>right_interval.v->>'opens') then raise exception 'Les plages d’ouverture se chevauchent'; end if;
  delete from public.business_hours;
  for v in select * from jsonb_array_elements(d->'hours') loop insert into public.business_hours(weekday,opens,closes) values((v->>'weekday')::integer,(v->>'opens')::time,(v->>'closes')::time); end loop;
 elsif action='special_save' then
  if exists(select 1 from jsonb_array_elements(d->'intervals') with ordinality left_interval(v,n) join jsonb_array_elements(d->'intervals') with ordinality right_interval(v,n) on left_interval.n<right_interval.n and left_interval.v->>'opens'<right_interval.v->>'closes' and left_interval.v->>'closes'>right_interval.v->>'opens') then raise exception 'Les plages exceptionnelles se chevauchent'; end if;
  insert into public.special_hours(date,intervals,reason) values((d->>'date')::date,d->'intervals',d->>'reason') on conflict(date) do update set intervals=excluded.intervals,reason=excluded.reason;
 elsif action='special_delete' then delete from public.special_hours where date=(d->>'date')::date;
 elsif action='settings_save' then update public.site_settings set value=value||d,updated_at=now() where id=1;
 elsif action='generate' then
  delta:=(d->>'end_date')::date-(d->>'start_date')::date;
  if delta not between 0 and 365 then raise exception 'Période limitée à 366 jours'; end if;
  output:='[]';
  for pos in 0..delta loop
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v from public.availability((d->>'service_id')::uuid,(d->>'start_date')::date+pos) x;
   insert into public.generated_days(id,date,service_id,slots) values(((d->>'start_date')::date+pos)::text||':'||(d->>'service_id'),(d->>'start_date')::date+pos,(d->>'service_id')::uuid,v) on conflict(id) do update set slots=excluded.slots,generated_at=now();
   output:=output||jsonb_build_array(jsonb_build_object('date',(d->>'start_date')::date+pos,'slots',v));
  end loop;
  return jsonb_build_object('days',output,'total',(select count(*) from jsonb_array_elements(output) x,jsonb_array_elements(x->'slots') slot where (slot->>'available')::boolean));
 elsif action='contact_processed' then update public.contact_messages set status='processed' where id=entity;
 elsif action='contact_delete' then
  update public.notification_outbox set contact_id=null,status='failed',last_error='Demande supprimée' where contact_id=entity;
  delete from public.contact_messages where id=entity;
 elsif action='notification_read' then update public.management_notifications set status='read' where id=entity; update public.notification_outbox set read_at=now() where id=entity;
 elsif action='demo_load' then raise exception 'Le jeu de démonstration est réservé à SQLite en développement';
 else raise exception 'Action inconnue'; end if;
 insert into public.admin_audit_log(actor_id,action,entity_id,detail) values(p_actor,action,entity::text,case when action='qualification' then d else '{}'::jsonb end);
 if action in ('booking_cancel','block_save') then insert into public.management_notifications(kind,entity_id,title,message) values(action,entity::text,'MONÉA · Gestion du planning','Modification enregistrée. Aucun remboursement automatique.'); end if;
 return jsonb_build_object('ok',true,'id',entity);
end $$;

-- Explicitly grant only the trusted backend. The actor is verified before every admin operation.
revoke execute on function public.management_conflicts(timestamptz,timestamptz,uuid),public.management_public_booking(uuid),public.management_booking_json(uuid),public.management_save_booking(jsonb,uuid,uuid),public.management_mutate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.management_conflicts(timestamptz,timestamptz,uuid),public.management_public_booking(uuid),public.management_booking_json(uuid),public.management_save_booking(jsonb,uuid,uuid),public.management_mutate(uuid,jsonb) to service_role;

create function public.management_snapshot(p_actor uuid,p_query jsonb default '{}') returns jsonb language plpgsql set search_path='' as $$
declare section text:=coalesce(p_query->>'section','all'); page integer:=greatest(0,coalesce((p_query->>'page')::integer,0)); size integer:=50; term text:=lower(coalesce(p_query->>'search','')); first_day timestamptz:=coalesce((p_query->>'from')::date,(now() at time zone 'Europe/Paris')::date-31)::timestamp at time zone 'Europe/Paris'; last_day timestamptz:=(coalesce((p_query->>'to')::date,(now() at time zone 'Europe/Paris')::date+62)+1)::timestamp at time zone 'Europe/Paris'; booking_ids uuid[]; client_ids uuid[]; client_total integer; booking_total integer; result jsonb; begin
 perform public.assert_admin(p_actor); perform public.expire_holds();
 if page>100000 or (section='planning' and (last_day at time zone 'Europe/Paris')::date-(first_day at time zone 'Europe/Paris')::date>94) then raise exception 'Période de consultation trop large'; end if;
 select count(*) into client_total from public.clients c where (p_query->>'clientId' is null or c.id=(p_query->>'clientId')::uuid) and (term='' or strpos(lower(c.first_name||' '||c.last_name||' '||c.email||' '||c.phone),term)>0);
 select array_agg(id) into client_ids from (select c.id from public.clients c where (p_query->>'clientId' is null or c.id=(p_query->>'clientId')::uuid) and (term='' or strpos(lower(c.first_name||' '||c.last_name||' '||c.email||' '||c.phone),term)>0) order by c.last_name,c.first_name,c.id limit case when section='all' then null else size end offset case when section='all' or p_query->>'clientId' is not null then 0 else page*size end) x;
 select count(*) into booking_total from public.bookings b join public.time_allocations a on a.id=b.allocation_id join public.clients c on c.id=b.client_id where
 (section<>'rendez-vous' or ((coalesce(p_query->>'status','')='' or b.status=p_query->>'status') and (p_query->>'date' is null or (a.start_at at time zone 'Europe/Paris')::date=(p_query->>'date')::date))) and (section<>'' or b.status='pending' or (b.status='confirmed' and a.start_at>now())) and
 (section='all' or (section in ('','planning','rendez-vous') and (p_query->>'bookingId' is null or b.id=(p_query->>'bookingId')::uuid) and (section<>'planning' or (a.start_at<last_day and a.end_at>first_day)) and (section='' or term='' or strpos(lower(c.first_name||' '||c.last_name||' '||c.email||' '||c.phone||' '||b.service_name),term)>0)) or (section='clientes' and p_query->>'clientId' is not null and b.client_id=(p_query->>'clientId')::uuid));
 select array_agg(id) into booking_ids from (select b.id from public.bookings b join public.time_allocations a on a.id=b.allocation_id join public.clients c on c.id=b.client_id where
 (section<>'rendez-vous' or ((coalesce(p_query->>'status','')='' or b.status=p_query->>'status') and (p_query->>'date' is null or (a.start_at at time zone 'Europe/Paris')::date=(p_query->>'date')::date))) and (section<>'' or b.status='pending' or (b.status='confirmed' and a.start_at>now())) and
 (section='all' or (section in ('','planning','rendez-vous') and (p_query->>'bookingId' is null or b.id=(p_query->>'bookingId')::uuid) and (section<>'planning' or (a.start_at<last_day and a.end_at>first_day)) and (section='' or term='' or strpos(lower(c.first_name||' '||c.last_name||' '||c.email||' '||c.phone||' '||b.service_name),term)>0)) or (section='clientes' and p_query->>'clientId' is not null and b.client_id=(p_query->>'clientId')::uuid))
 order by case when section='' then a.start_at end asc,a.start_at desc,b.id limit case when section in ('all','planning') then null else size end offset case when section in ('all','planning') then 0 else page*size end) x;
 select jsonb_build_object(
 'provider','supabase','settings',(select value from public.site_settings where id=1),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.id) from public.categories c),'[]'),
 'services',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('category',c.name,'category_active',c.active) order by c.sort_order,s.sort_order,s.id) from public.services s join public.categories c on c.id=s.category_id),'[]'),
 'products',case when section in ('all','catalogue','categories') then coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from public.products p),'[]') else '[]'::jsonb end,
 'clients',case when section in ('all','clientes','','planning','rendez-vous','lookup') then coalesce((select jsonb_agg((case when section in ('all','clientes') then to_jsonb(c) else to_jsonb(c)-'notes'||jsonb_build_object('notes','') end)||jsonb_build_object('booking_count',(select count(*) from public.bookings b where b.client_id=c.id)) order by c.last_name,c.first_name,c.id) from public.clients c where c.id=any(client_ids)),'[]') else '[]'::jsonb end,
 'bookings',coalesce((select jsonb_agg(case when section='all' then public.management_booking_json(b.id) else jsonb_set(public.management_booking_json(b.id),'{client,notes}','""') end order by a.start_at,b.id) from public.bookings b join public.time_allocations a on a.id=b.allocation_id where b.id=any(booking_ids)),'[]'),
 'allocations',coalesce((select jsonb_agg(to_jsonb(a) order by a.start_at,a.id) from (select * from public.time_allocations allocation where section='all' or allocation.id in (select allocation_id from public.bookings where id=any(booking_ids)) or (section='indisponibilites' and allocation.kind='block') or (section in ('','planning','horaires') and allocation.kind='block' and allocation.start_at<last_day and allocation.end_at>first_day) order by allocation.start_at,allocation.id limit case when section='indisponibilites' then size else null end offset case when section='indisponibilites' then page*size else 0 end) a),'[]'),
 'hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.weekday,h.opens) from public.business_hours h),'[]'),
 'special',coalesce((select jsonb_agg(to_jsonb(s) order by s.date) from public.special_hours s),'[]'),
 'messages',case when section in ('all','messages') then coalesce((select jsonb_agg(to_jsonb(m)) from (select * from public.contact_messages order by created_at desc,id limit case when section='all' then null else size end offset page*size) m),'[]') else '[]'::jsonb end,
 'notifications',case when section in ('all','','notifications') then coalesce((select jsonb_agg(n.value order by n.created_at desc,n.id) from (select id,created_at,to_jsonb(internal) value from public.management_notifications internal union all select id,created_at,jsonb_build_object('id',id,'created_at',created_at,'kind','outbox','entity_id',coalesce(booking_id,contact_id)::text,'title','MONÉA · Notification','message',coalesce(last_error,'Transport : '||transport||' · '||status),'status',case when read_at is null then 'unread' else 'read' end,'transport',transport,'delivery_status',status) from public.notification_outbox order by created_at desc,id limit case when section='all' then null else size end offset page*size) n),'[]') else '[]'::jsonb end,
 'audit',case when section in ('all','parametres','planning','rendez-vous') then coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.admin_audit_log where section in ('all','parametres') or entity_id in (select unnest(booking_ids)::text) order by created_at desc,id limit case when section='all' or p_query->>'bookingId' is not null then null else size end offset case when section='parametres' then page*size else 0 end) a),'[]') else '[]'::jsonb end,
 'pagination',jsonb_build_object('page',page,'pageSize',size,'total',case when section='clientes' and p_query->>'clientId' is not null then booking_total when section in ('clientes','lookup') then client_total when section='indisponibilites' then (select count(*) from public.time_allocations where kind='block') when section='messages' then (select count(*) from public.contact_messages) when section='notifications' then (select count(*) from public.management_notifications)+(select count(*) from public.notification_outbox) when section='parametres' then (select count(*) from public.admin_audit_log) else booking_total end),
 'summary',jsonb_build_object('clients',(select count(*) from public.clients),'upcoming',(select count(*) from public.bookings b join public.time_allocations a on a.id=b.allocation_id where b.status='confirmed' and a.start_at>now()),'pending',(select count(*) from public.bookings where status='pending'),'received',(select coalesce(sum(case when p.provider='stripe' and p.status in ('paid','partial_refund','refunded','refund_pending','reconciliation') then p.amount_cents-p.refunded_cents when p.id is null and b.offline_status='paid_offline' then b.price_cents else 0 end),0) from public.bookings b left join public.payments p on p.booking_id=b.id))
 ) into result;
 return result;
end $$;
revoke execute on function public.management_snapshot(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.management_snapshot(uuid,jsonb) to service_role;

create function public.repository_catalogue() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('settings',(select value from public.site_settings where id=1),
 'services',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('category',c.name,'category_active',c.active) order by c.sort_order,s.sort_order,s.id) from public.services s join public.categories c on c.id=s.category_id),'[]'),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.id) from public.categories c),'[]'));
$$;
create function public.repository_booking_status(p_token uuid) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; begin
 perform public.expire_holds();
 select public.management_public_booking(id)-'token'-'stripe_session_id'-'checkout_minutes'-'checkout_expires_at'-'hold_expires_at' into result from public.bookings where public_token=p_token;
 return result;
end $$;
revoke execute on function public.repository_catalogue(),public.repository_booking_status(uuid) from public,anon,authenticated;
grant execute on function public.repository_catalogue(),public.repository_booking_status(uuid) to service_role;

do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('monea-media','monea-media',false,5242880,array['image/webp']) on conflict(id) do nothing;
 end if;
end $$;

-- Preserve legacy commands while clearing newly added private notes on anonymisation.
alter function public.admin_mutate(uuid,text,jsonb) rename to admin_mutate_legacy;
create function public.admin_mutate(p_actor uuid,p_action text,p_data jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; begin
 perform pg_catalog.pg_advisory_xact_lock(748201); perform public.assert_admin(p_actor);
 if p_action='anonymize' then
  if exists(select 1 from public.bookings appointment join public.time_allocations allocation on allocation.id=appointment.allocation_id where appointment.client_id=(p_data->>'id')::uuid and (appointment.status in ('pending','reconciliation') or allocation.end_at>now() or appointment.created_at>now()-make_interval(days=>coalesce((select (value->>'retentionDays')::integer from public.site_settings where id=1),365)))) then raise exception 'Conservation ou rendez-vous actif'; end if;
  update public.clients set first_name='Anonymisée',last_name='',email='',phone='',notes='' where id=(p_data->>'id')::uuid;
  update public.bookings set notes='' where client_id=(p_data->>'id')::uuid;
  insert into public.admin_audit_log(actor_id,action,entity_id) values(p_actor,p_action,p_data->>'id');
  result:=jsonb_build_object('id',p_data->>'id');
 else result:=public.admin_mutate_legacy(p_actor,p_action,p_data); end if;
 return result;
end $$;
revoke execute on function public.admin_mutate(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_mutate(uuid,text,jsonb) to service_role;
