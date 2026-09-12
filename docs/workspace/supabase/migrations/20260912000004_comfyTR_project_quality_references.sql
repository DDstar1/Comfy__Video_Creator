alter table public."comfyTR_projects"
  add column if not exists quality text not null default 'draft'
  check (quality in ('draft', 'standard', 'high'));
alter table public."comfyTR_clips"
  add column if not exists suggested_references jsonb not null default '[]'::jsonb
  check (jsonb_typeof(suggested_references) = 'array');
grant update (quality) on public."comfyTR_projects" to authenticated;
grant update (suggested_references) on public."comfyTR_clips" to authenticated;

create or replace function public."comfyTR_guard_output_settings"()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.ratio is distinct from old.ratio or new.quality is distinct from old.quality)
     and exists (select 1 from public."comfyTR_clips" where project_id = old.id) then
    raise exception 'Output settings are fixed for this project''s clips';
  end if;
  return new;
end $$;
create trigger "comfyTR_guard_output_settings_trigger"
before update on public."comfyTR_projects"
for each row execute function public."comfyTR_guard_output_settings"();
