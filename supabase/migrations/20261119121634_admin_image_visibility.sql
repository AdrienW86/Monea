-- A removed image must stay hidden instead of restoring the generated illustration.
alter table public.services drop constraint services_image_check;
alter table public.services add constraint services_image_check
  check(image is null or image = 'none'
    or image ~ '^/(assets|images/beauty)/[a-zA-Z0-9/_.-]+\.(svg|png|jpg|webp)$');

-- Uploads are authorized by /api/admin/media; files are served by the existing
-- application route. No direct anonymous Storage write access is granted.
-- Plain PostgreSQL contract tests have no Storage schema.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('monea-media', 'monea-media', false, 5242880, array['image/webp'])
    on conflict (id) do nothing;
  end if;
end;
$$;
