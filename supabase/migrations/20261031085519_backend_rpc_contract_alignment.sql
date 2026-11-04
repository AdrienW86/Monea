-- MONÉA: additive repair for the existing Next.js repository contracts.
-- Already recorded remotely: 20261030115435, 20261030115449, 20261030115458.
-- Apply ONLY this new migration after review. No seed/import/history repair.
-- No application data is updated by applying this file.
begin;

alter table public.payments
  add column if not exists checkout_expires_at timestamptz;

-- Refuse incompatible existing objects rather than dropping/coercing them.
do $preconditions$
declare
  v_name text;
  v_signature text;
begin
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.payments'::regclass
      and attname = 'checkout_expires_at' and not attisdropped
      and atttypid = 'timestamp with time zone'::regtype and not attnotnull
  ) then
    raise exception 'payments.checkout_expires_at must be nullable timestamptz';
  end if;
  for v_name, v_signature in
    select * from (values
      ('management_snapshot', 'public.management_snapshot(uuid,jsonb)'),
      ('repository_catalogue', 'public.repository_catalogue()'),
      ('repository_booking_status', 'public.repository_booking_status(uuid)')
    ) expected(name, signature)
  loop
    if exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
        and (p.oid is distinct from pg_catalog.to_regprocedure(v_signature)
             or p.prorettype <> 'jsonb'::regtype or p.proretset)
    ) then
      raise exception 'Unexpected existing signature/return type for public.%', v_name;
    end if;
  end loop;
end
$preconditions$;

create or replace function public.management_snapshot(
  p_actor uuid,
  p_query jsonb default '{}'::jsonb
) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  v_section text := coalesce(p_query->>'section', 'all');
  v_page integer := greatest(0, coalesce((p_query->>'page')::integer, 0));
  v_size constant integer := 50;
  v_term text := lower(coalesce(p_query->>'search', ''));
  v_first timestamptz := coalesce(
    (p_query->>'from')::date, (now() at time zone 'Europe/Paris')::date - 31
  )::timestamp at time zone 'Europe/Paris';
  v_last timestamptz := (coalesce(
    (p_query->>'to')::date, (now() at time zone 'Europe/Paris')::date + 62
  ) + 1)::timestamp at time zone 'Europe/Paris';
  v_booking_ids uuid[];
  v_client_ids uuid[];
  v_client_total integer;
  v_booking_total integer;
  v_result jsonb;
begin
  -- The backend must obtain p_actor from requireAdmin(), never from a form.
  -- Validate the actor BEFORE expiring holds or reading private data.
  perform public.assert_admin(p_actor);
  perform public.expire_holds();
  if v_page > 100000 or (
    v_section = 'planning' and
    (v_last at time zone 'Europe/Paris')::date -
    (v_first at time zone 'Europe/Paris')::date > 94
  ) then
    raise exception 'Période de consultation trop large';
  end if;

  with matching_clients as (
    select c.* from public.clients c
    where (p_query->>'clientId' is null or c.id = (p_query->>'clientId')::uuid)
      and (v_term = '' or strpos(lower(
        c.first_name || ' ' || c.last_name || ' ' || c.email || ' ' || c.phone
      ), v_term) > 0)
  )
  select (select count(*) from matching_clients),
    (select array_agg(selected.id) from (
      select c.id from matching_clients c order by c.last_name, c.first_name, c.id
      limit case when v_section = 'all' then null else v_size end
      offset case when v_section = 'all' or p_query->>'clientId' is not null
                  then 0 else v_page * v_size end
    ) selected)
  into v_client_total, v_client_ids;

  with matching_bookings as (
    select b.id, a.start_at from public.bookings b
    join public.time_allocations a on a.id = b.allocation_id
    join public.clients c on c.id = b.client_id
    where
      (v_section <> 'rendez-vous' or (
        (coalesce(p_query->>'status', '') = '' or b.status = p_query->>'status')
        and (p_query->>'date' is null or
          (a.start_at at time zone 'Europe/Paris')::date = (p_query->>'date')::date)
      ))
      and (v_section <> '' or b.status = 'pending' or
        (b.status = 'confirmed' and a.start_at > now()))
      and (
        v_section = 'all'
        or (v_section in ('', 'planning', 'rendez-vous')
          and (p_query->>'bookingId' is null or b.id = (p_query->>'bookingId')::uuid)
          and (v_section <> 'planning' or (a.start_at < v_last and a.end_at > v_first))
          and (v_section = '' or v_term = '' or strpos(lower(
            c.first_name || ' ' || c.last_name || ' ' || c.email || ' ' ||
            c.phone || ' ' || b.service_name
          ), v_term) > 0))
        or (v_section = 'clientes' and p_query->>'clientId' is not null
          and b.client_id = (p_query->>'clientId')::uuid)
      )
  )
  select (select count(*) from matching_bookings),
    (select array_agg(selected.id) from (
      select b.id from matching_bookings b
      order by case when v_section = '' then b.start_at end asc, b.start_at desc, b.id
      limit case when v_section in ('all', 'planning') then null else v_size end
      offset case when v_section in ('all', 'planning') then 0 else v_page * v_size end
    ) selected)
  into v_booking_total, v_booking_ids;

  select jsonb_build_object(
    'provider', 'supabase',
    'settings', (select value from public.site_settings where id = 1),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order, c.id) from public.categories c
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'category', c.name, 'category_active', c.active
      ) order by c.sort_order, s.sort_order, s.id)
      from public.services s join public.categories c on c.id = s.category_id
    ), '[]'::jsonb),
    'products', case when v_section in ('all', 'catalogue', 'categories') then
      coalesce((select jsonb_agg(to_jsonb(p) order by p.name, p.id) from public.products p), '[]'::jsonb)
      else '[]'::jsonb end,
    'clients', case when v_section in ('all', 'clientes', '', 'planning', 'rendez-vous', 'lookup') then
      coalesce((select jsonb_agg((case when v_section in ('all', 'clientes') then to_jsonb(c)
        else (to_jsonb(c) - 'notes') || jsonb_build_object('notes', '') end)
        || jsonb_build_object('booking_count', (
          select count(*) from public.bookings b where b.client_id = c.id
        )) order by c.last_name, c.first_name, c.id)
        from public.clients c where c.id = any(v_client_ids)), '[]'::jsonb)
      else '[]'::jsonb end,
    -- Inline the existing DTO contract: no dependency on a possibly older JSON helper.
    'bookings', coalesce((
      select jsonb_agg((to_jsonb(b) - 'request_hash') || jsonb_build_object(
        'client', case when v_section = 'all' then to_jsonb(c)
          else jsonb_set(to_jsonb(c), '{notes}', '""'::jsonb) end,
        'allocation', to_jsonb(a),
        'payment', case when p.id is null then null else to_jsonb(p) end,
        'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.position)
          from public.booking_lines l where l.booking_id = b.id), '[]'::jsonb)
      ) order by a.start_at, b.id)
      from public.bookings b join public.clients c on c.id = b.client_id
      join public.time_allocations a on a.id = b.allocation_id
      left join public.payments p on p.booking_id = b.id
      where b.id = any(v_booking_ids)
    ), '[]'::jsonb),
    'allocations', coalesce((select jsonb_agg(to_jsonb(a) order by a.start_at, a.id) from (
      select allocation.* from public.time_allocations allocation
      where v_section = 'all'
        or allocation.id in (select allocation_id from public.bookings where id = any(v_booking_ids))
        or (v_section = 'indisponibilites' and allocation.kind = 'block')
        or (v_section in ('', 'planning', 'horaires') and allocation.kind = 'block'
          and allocation.start_at < v_last and allocation.end_at > v_first)
      order by allocation.start_at, allocation.id
      limit case when v_section = 'indisponibilites' then v_size else null end
      offset case when v_section = 'indisponibilites' then v_page * v_size else 0 end
    ) a), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(to_jsonb(h) order by h.weekday, h.opens)
      from public.business_hours h), '[]'::jsonb),
    'special', coalesce((select jsonb_agg(to_jsonb(s) order by s.date)
      from public.special_hours s), '[]'::jsonb),
    'messages', case when v_section in ('all', 'messages') then coalesce((
      select jsonb_agg(to_jsonb(m)) from (
        select * from public.contact_messages order by created_at desc, id
        limit case when v_section = 'all' then null else v_size end offset v_page * v_size
      ) m), '[]'::jsonb) else '[]'::jsonb end,
    'notifications', case when v_section in ('all', '', 'notifications') then coalesce((
      select jsonb_agg(n.value order by n.created_at desc, n.id) from (
        select id, created_at, to_jsonb(internal) as value from public.management_notifications internal
        union all
        select id, created_at, jsonb_build_object(
          'id', id, 'created_at', created_at, 'kind', 'outbox',
          'entity_id', coalesce(booking_id, contact_id)::text,
          'title', 'MONÉA · Notification',
          'message', coalesce(last_error, 'Transport : ' || transport || ' · ' || status),
          'status', case when read_at is null then 'unread' else 'read' end,
          'transport', transport, 'delivery_status', status
        ) from public.notification_outbox
        order by created_at desc, id
        limit case when v_section = 'all' then null else v_size end offset v_page * v_size
      ) n), '[]'::jsonb) else '[]'::jsonb end,
    'audit', case when v_section in ('all', 'parametres', 'planning', 'rendez-vous') then coalesce((
      select jsonb_agg(to_jsonb(a)) from (
        select * from public.admin_audit_log
        where v_section in ('all', 'parametres')
          or entity_id in (select unnest(v_booking_ids)::text)
        order by created_at desc, id
        limit case when v_section = 'all' or p_query->>'bookingId' is not null then null else v_size end
        offset case when v_section = 'parametres' then v_page * v_size else 0 end
      ) a), '[]'::jsonb) else '[]'::jsonb end,
    'pagination', jsonb_build_object('page', v_page, 'pageSize', v_size, 'total', case
      when v_section = 'clientes' and p_query->>'clientId' is not null then v_booking_total
      when v_section in ('clientes', 'lookup') then v_client_total
      when v_section = 'indisponibilites' then (select count(*) from public.time_allocations where kind = 'block')
      when v_section = 'messages' then (select count(*) from public.contact_messages)
      when v_section = 'notifications' then (select count(*) from public.management_notifications) + (select count(*) from public.notification_outbox)
      when v_section = 'parametres' then (select count(*) from public.admin_audit_log)
      else v_booking_total end),
    'summary', jsonb_build_object(
      'clients', (select count(*) from public.clients),
      'upcoming', (select count(*) from public.bookings b join public.time_allocations a on a.id = b.allocation_id
        where b.status = 'confirmed' and a.start_at > now()),
      'pending', (select count(*) from public.bookings where status = 'pending'),
      'received', (select coalesce(sum(case
        when p.provider = 'stripe' and p.status in ('paid', 'partial_refund', 'refunded', 'refund_pending', 'reconciliation')
          then p.amount_cents - p.refunded_cents
        when p.id is null and b.offline_status = 'paid_offline' then b.price_cents
        else 0 end), 0)
        from public.bookings b left join public.payments p on p.booking_id = b.id)
    )
  ) into v_result;
  return v_result;
end
$function$;

create or replace function public.repository_catalogue()
returns jsonb language sql stable security invoker set search_path = ''
as $function$
  select jsonb_build_object(
    'settings', (select value from public.site_settings where id = 1),
    'services', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'category', c.name, 'category_active', c.active
      ) order by c.sort_order, s.sort_order, s.id)
      from public.services s join public.categories c on c.id = s.category_id
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order, c.id) from public.categories c
    ), '[]'::jsonb)
  );
$function$;

create or replace function public.repository_booking_status(p_token uuid)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform public.expire_holds();
  -- Exact public projection. Never return client/notes/Stripe IDs or the request hash.
  select jsonb_build_object(
    'id', b.id, 'public_token', b.public_token, 'service_name', b.service_name,
    'price_cents', b.price_cents, 'status', b.status,
    'start_at', a.start_at, 'end_at', a.end_at,
    'payment_status', p.status, 'payment_provider', p.provider
  ) into v_result
  from public.bookings b join public.time_allocations a on a.id = b.allocation_id
  left join public.payments p on p.booking_id = b.id
  cross join public.site_settings cfg
  where b.public_token = p_token and cfg.id = 1;
  return v_result;
end
$function$;

-- ACLs are the backend permission check for all three RPCs.
-- Only management_snapshot additionally requires an authenticated admin actor.
revoke all on function public.management_snapshot(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.repository_catalogue() from public, anon, authenticated;
revoke all on function public.repository_booking_status(uuid) from public, anon, authenticated;
grant execute on function public.management_snapshot(uuid, jsonb) to service_role;
grant execute on function public.repository_catalogue() to service_role;
grant execute on function public.repository_booking_status(uuid) to service_role;

-- Explicitly refresh the Data API schema after the transaction commits.
notify pgrst, 'reload schema';
commit;
