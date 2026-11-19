-- Extend the existing admin dispatcher while preserving its signature, grants,
-- admin check, advisory lock, audit and all previous command implementations.
do $migration$
declare
  definition text;
  marker text := 'elsif action=''service_archive'' then';
begin
  select pg_get_functiondef('public.management_mutate(uuid,jsonb)'::regprocedure) into definition;
  if strpos(definition, marker) = 0 then
    raise exception 'Management dispatcher changed: review service deletion migration';
  end if;
  definition := replace(definition, marker, $branch$
  elsif action='service_delete' then
    if coalesce((d->>'confirmed')::boolean,false) is not true then
      raise exception 'Confirmation requise';
    end if;
    if not exists(select 1 from public.services where id=entity) then
      raise exception 'Prestation introuvable';
    end if;
    if exists(select 1 from public.booking_lines where service_id=entity) then
      raise exception 'Cette prestation figure dans des rendez-vous. Archivez-la pour conserver leur historique.';
    end if;
    delete from public.services where id=entity;
  elsif action='service_archive' then
  $branch$);
  execute definition;
end;
$migration$;
