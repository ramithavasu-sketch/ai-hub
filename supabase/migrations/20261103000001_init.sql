-- AnywhereWorks AI Hub: tables, read rules (row-level security) and write functions.
-- Mirrors src/lib/server.ts. Every write goes through a function below, which checks
-- the signed-in person's permissions; nobody can write to a table directly.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.departments (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  description text not null default '',
  hue int not null default 200,
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  title text not null default '',
  department_id text references public.departments,
  bio text not null default '',
  interests text[] not null default '{}',
  access_role text not null default 'viewer' check (access_role in ('admin', 'contributor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  problem text not null default '',
  solution text not null default '',
  benefits text not null default '',
  owner_id uuid not null references public.people,
  contributor_ids uuid[] not null default '{}',
  department_id text not null references public.departments,
  status text not null default 'idea' check (status in ('idea','discussion','research','prototype','in_progress','testing','completed','on_hold','archived')),
  visibility text not null default 'published' check (visibility in ('published','draft','restricted')),
  allowed_ids uuid[] not null default '{}',
  technologies text[] not null default '{}',
  tags text[] not null default '{}',
  featured boolean not null default false,
  journey jsonb not null default '{}',
  notes text not null default '',
  proposed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects on delete cascade,
  title text not null,
  type text not null default 'other' check (type in ('confluence','figma','prototype','github','live','drive','slides','video','screenshot','file','notes','other')),
  description text not null default '',
  url text not null check (url ~* '^https?://'),
  added_by uuid not null references public.people,
  added_at timestamptz not null default now()
);

create table public.updates (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects on delete cascade,
  author_id uuid not null references public.people,
  date timestamptz not null default now(),
  title text not null,
  body text not null default ''
);

create table public.comments (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects on delete cascade,
  author_id uuid not null references public.people,
  date timestamptz not null default now(),
  body text not null
);

create table public.activity (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects on delete cascade,
  actor_id uuid not null references public.people,
  date timestamptz not null default now(),
  action text not null
);

create index on public.resources (project_id);
create index on public.updates (project_id);
create index on public.comments (project_id);
create index on public.activity (project_id);

-- ---------- permission helpers ----------

-- Role of the signed-in person, or null if they are not an active member.
create function public.me_role() returns text
language sql stable security definer set search_path = public as $$
  select access_role from people where id = auth.uid() and active
$$;

create function public.can_view(p public.projects) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when me_role() is null then false
    when me_role() = 'admin' or p.owner_id = auth.uid() or auth.uid() = any(p.contributor_ids) then true
    when p.visibility = 'draft' then false
    when p.visibility = 'restricted' then auth.uid() = any(p.allowed_ids)
    else true
  end
$$;

create function public.can_edit(p public.projects) returns boolean
language sql stable security definer set search_path = public as $$
  select me_role() is not null and (
    me_role() = 'admin' or p.owner_id = auth.uid()
    or (me_role() <> 'viewer' and auth.uid() = any(p.contributor_ids))
  )
$$;

-- ---------- read rules ----------

alter table public.departments enable row level security;
alter table public.people enable row level security;
alter table public.projects enable row level security;
alter table public.resources enable row level security;
alter table public.updates enable row level security;
alter table public.comments enable row level security;
alter table public.activity enable row level security;

create policy "members read departments" on public.departments for select to authenticated using (me_role() is not null);
create policy "members read people" on public.people for select to authenticated using (me_role() is not null);
create policy "read visible projects" on public.projects for select to authenticated using (can_view(projects));
create policy "read visible resources" on public.resources for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and can_view(p)));
create policy "read visible updates" on public.updates for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and can_view(p)));
create policy "read visible comments" on public.comments for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and can_view(p)));
create policy "read visible activity" on public.activity for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and can_view(p)));

revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;

-- ---------- internal helpers (not callable by users) ----------

create function public._fail(msg text) returns void language plpgsql as $$
begin raise exception using message = msg, errcode = 'P0001'; end $$;

create function public._must(ok boolean, msg text default 'You do not have permission to do that.') returns void
language plpgsql as $$ begin if not coalesce(ok, false) then perform _fail(msg); end if; end $$;

create function public._clean(s text, max int default 4000) returns text
language sql immutable as $$ select left(btrim(coalesce(s, '')), max) $$;

create function public._actor() returns public.people
language plpgsql stable security definer set search_path = public as $$
declare a people;
begin
  select * into a from people where id = auth.uid() and active;
  if not found then perform _fail('Please sign in again. Your access may have been turned off.'); end if;
  return a;
end $$;

create function public._project(pid text) returns public.projects
language plpgsql stable security definer set search_path = public as $$
declare p projects;
begin
  select * into p from projects where id = pid;
  if not found or not can_view(p) then perform _fail('Project not found or not shared with you.'); end if;
  return p;
end $$;

create function public._log(pid text, action text) returns void
language sql security definer set search_path = public as $$
  insert into activity (project_id, actor_id, action) values (pid, auth.uid(), action)
$$;

-- Matches stageIndex() in src/lib/meta.ts; completed maps to the last stage.
create function public._stage_key(status text) returns text
language sql immutable as $$
  select case status
    when 'idea' then 'idea'
    when 'discussion' then 'research' when 'research' then 'research'
    when 'prototype' then 'prototype'
    when 'in_progress' then 'testing' when 'testing' then 'testing'
    when 'completed' then 'launch'
  end
$$;

-- When status moves forward, stamp the matching journey stage if it is empty.
create function public._record_stage(journey jsonb, status text) returns jsonb
language sql stable as $$
  select case
    when _stage_key(status) is null or journey ? _stage_key(status) then journey
    else journey || jsonb_build_object(_stage_key(status), jsonb_build_object('note', '', 'date', now()))
  end
$$;

create function public._status_label(s text) returns text
language sql immutable as $$ select replace(s, '_', ' ') $$;

create function public._text_list(j jsonb, max int default 40, lower_case boolean default false) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct v), '{}') from (
    select case when lower_case then lower(_clean(x, max)) else _clean(x, max) end as v
    from jsonb_array_elements_text(coalesce(j, '[]')) x
  ) t where v <> ''
$$;

create function public._people_list(j jsonb, exclude uuid default null) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p.id), '{}') from people p
  where p.id::text in (select jsonb_array_elements_text(coalesce(j, '[]')))
    and p.id is distinct from exclude
$$;

-- ---------- who am I ----------

-- Returns the caller's own profile even when deactivated, so the app can explain why.
create function public.whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) from people p where id = auth.uid()
$$;

-- ---------- projects ----------

create function public.save_project(p_input jsonb, p_id text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  a people := _actor();
  v_draft boolean := p_input->>'visibility' = 'draft';
  v_name text := _clean(p_input->>'name', 120);
  v_owner uuid;
  v_dept text := nullif(p_input->>'departmentId', '');
  v_status text := coalesce(nullif(p_input->>'status', ''), 'idea');
  p projects;
  v_changed boolean;
begin
  if v_name = '' then perform _fail('Give the project a name.'); end if;
  if not v_draft then
    if _clean(p_input->>'description') = '' then perform _fail('Add a short description, or save as a draft for now.'); end if;
    if _clean(p_input->>'problem') = '' then perform _fail('Add the problem being addressed, or save as a draft for now.'); end if;
    if _clean(p_input->>'solution') = '' then perform _fail('Add the proposed solution, or save as a draft for now.'); end if;
    if v_dept is null then perform _fail('Choose a department.'); end if;
  end if;
  select id into v_owner from people where id::text = p_input->>'ownerId';
  if v_owner is null then perform _fail('Choose a project owner.'); end if;
  if v_dept is null then select id into v_dept from departments order by name limit 1; end if;
  if not exists (select 1 from departments where id = v_dept) then perform _fail('Choose a department.'); end if;

  if p_id is not null then
    p := _project(p_id);
    perform _must(can_edit(p));
    -- Only the owner or an admin can hand the project to someone else.
    if v_owner <> p.owner_id then
      perform _must(a.access_role = 'admin' or p.owner_id = a.id, 'Only the owner or an admin can change the owner.');
    end if;
    v_changed := p.status <> v_status;
    update projects set
      name = v_name,
      tagline = _clean(p_input->>'tagline', 140),
      description = _clean(p_input->>'description'),
      problem = _clean(p_input->>'problem'),
      solution = _clean(p_input->>'solution'),
      benefits = _clean(p_input->>'benefits'),
      department_id = v_dept,
      status = v_status,
      technologies = _text_list(p_input->'technologies'),
      tags = _text_list(p_input->'tags', 40, true),
      notes = _clean(p_input->>'notes'),
      visibility = coalesce(nullif(p_input->>'visibility', ''), 'published'),
      allowed_ids = _people_list(p_input->'allowedIds'),
      owner_id = v_owner,
      contributor_ids = _people_list(p_input->'contributorIds', v_owner),
      journey = case when v_changed then _record_stage(journey, v_status) else journey end,
      updated_at = now()
    where id = p_id;
    perform _log(p_id, case when v_changed then 'moved the project to “' || _status_label(v_status) || '”' else 'edited project details' end);
    return p_id;
  end if;

  perform _must(a.access_role <> 'viewer', 'Viewers cannot create projects. Ask an admin for contributor access.');
  -- Non-admins always own what they create.
  if a.access_role <> 'admin' then v_owner := a.id; end if;
  insert into projects (name, tagline, description, problem, solution, benefits, owner_id, contributor_ids,
    department_id, status, visibility, allowed_ids, technologies, tags, notes, journey)
  values (v_name, _clean(p_input->>'tagline', 140), _clean(p_input->>'description'), _clean(p_input->>'problem'),
    _clean(p_input->>'solution'), _clean(p_input->>'benefits'), v_owner, _people_list(p_input->'contributorIds', v_owner),
    v_dept, v_status, coalesce(nullif(p_input->>'visibility', ''), 'published'), _people_list(p_input->'allowedIds'),
    _text_list(p_input->'technologies'), _text_list(p_input->'tags', 40, true), _clean(p_input->>'notes'),
    _record_stage(jsonb_build_object('idea', jsonb_build_object('note', 'Idea proposed', 'date', now())), v_status))
  returning id into p_id;
  perform _log(p_id, case when v_draft then 'started a draft' else 'created the project' end);
  return p_id;
end $$;

create function public.set_journey_note(p_id text, p_stage text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare p projects := _project(p_id);
begin
  perform _actor();
  perform _must(can_edit(p));
  if p_stage not in ('idea','research','prototype','testing','launch') then perform _fail('Unknown stage.'); end if;
  update projects set
    journey = journey || jsonb_build_object(p_stage, jsonb_build_object('note', _clean(p_note, 600), 'date', coalesce(journey->p_stage->>'date', now()::text))),
    updated_at = now()
  where id = p_id;
  perform _log(p_id, 'updated the journey: ' || case p_stage
    when 'idea' then 'Idea Proposed' when 'research' then 'Research & Discussion' when 'prototype' then 'Prototype Created'
    when 'testing' then 'Testing' else 'Final Implementation' end);
end $$;

create function public.set_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare p projects := _project(p_id);
begin
  perform _actor();
  perform _must(can_edit(p));
  update projects set status = p_status, journey = _record_stage(journey, p_status), updated_at = now() where id = p_id;
  perform _log(p_id, 'moved the project to “' || _status_label(p_status) || '”');
end $$;

create function public.publish_project(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p projects := _project(p_id);
begin
  perform _actor();
  perform _must(can_edit(p));
  if p.description = '' or p.problem = '' or p.solution = '' then
    perform _fail('Fill in the description, problem and solution before publishing.');
  end if;
  update projects set visibility = 'published', updated_at = now() where id = p_id;
  perform _log(p_id, 'published the project');
end $$;

create function public.delete_project(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor(); p projects := _project(p_id);
begin
  -- Published work is archived, not deleted; only drafts can be removed by their owner.
  perform _must(a.access_role = 'admin' or (p.owner_id = a.id and p.visibility = 'draft'),
    'Only drafts can be deleted. Archive published projects instead.');
  delete from projects where id = p_id;
end $$;

create function public.toggle_featured(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor();
begin
  perform _must(a.access_role = 'admin', 'Only admins can feature projects.');
  perform _project(p_id);
  update projects set featured = not featured where id = p_id;
end $$;

-- ---------- resources ----------

create function public.save_resource(p_project text, p_input jsonb, p_id text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  p projects := _project(p_project);
  v_title text := _clean(p_input->>'title', 120);
  v_url text := btrim(coalesce(p_input->>'url', ''));
begin
  perform _actor();
  perform _must(can_edit(p), 'Only the owner and contributors can manage resources.');
  if v_title = '' then perform _fail('Give the resource a title.'); end if;
  if v_url !~* '^https?://[^\s/]+' then perform _fail('Enter a full link that starts with https://'); end if;
  if p_id is not null then
    update resources set title = v_title, type = coalesce(nullif(p_input->>'type', ''), 'other'),
      description = _clean(p_input->>'description', 300), url = v_url
    where id = p_id and project_id = p_project;
    if not found then perform _fail('Resource not found.'); end if;
    perform _log(p_project, 'edited a resource: ' || v_title);
  else
    insert into resources (project_id, title, type, description, url, added_by)
    values (p_project, v_title, coalesce(nullif(p_input->>'type', ''), 'other'), _clean(p_input->>'description', 300), v_url, auth.uid());
    perform _log(p_project, 'added a resource: ' || v_title);
  end if;
  update projects set updated_at = now() where id = p_project;
end $$;

create function public.delete_resource(p_project text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p projects := _project(p_project); v_title text;
begin
  perform _actor();
  perform _must(can_edit(p));
  delete from resources where id = p_id and project_id = p_project returning title into v_title;
  if v_title is null then return; end if;
  perform _log(p_project, 'removed a resource: ' || v_title);
  update projects set updated_at = now() where id = p_project;
end $$;

-- ---------- updates & comments ----------

create function public.add_update(p_project text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare p projects := _project(p_project);
begin
  perform _actor();
  perform _must(can_edit(p), 'Only the owner and contributors can post updates.');
  if _clean(p_title) = '' then perform _fail('Give the update a short title.'); end if;
  insert into updates (project_id, author_id, title, body) values (p_project, auth.uid(), _clean(p_title, 140), _clean(p_body, 2000));
  perform _log(p_project, 'posted an update: ' || _clean(p_title, 140));
  update projects set updated_at = now() where id = p_project;
end $$;

-- Anyone who can see the project may comment.
create function public.add_comment(p_project text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _actor();
  perform _project(p_project);
  if _clean(p_body) = '' then perform _fail('Write something first.'); end if;
  insert into comments (project_id, author_id, body) values (p_project, auth.uid(), _clean(p_body, 2000));
end $$;

create function public.delete_comment(p_project text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor(); c comments;
begin
  perform _project(p_project);
  select * into c from comments where id = p_id and project_id = p_project;
  if not found then return; end if;
  perform _must(c.author_id = a.id or a.access_role = 'admin');
  delete from comments where id = p_id;
end $$;

-- ---------- admin ----------

create function public.set_access(p_person uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor();
begin
  perform _must(a.access_role = 'admin', 'Only admins can change access.');
  if p_person = a.id and p_role <> 'admin' then perform _fail('You cannot remove your own admin access.'); end if;
  update people set access_role = p_role where id = p_person;
end $$;

create function public.set_active(p_person uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor();
begin
  perform _must(a.access_role = 'admin', 'Only admins can change access.');
  if p_person = a.id then perform _fail('You cannot deactivate yourself.'); end if;
  update people set active = p_active where id = p_person;
end $$;

create function public.add_department(p_name text, p_description text) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor(); v_name text := _clean(p_name, 60);
begin
  perform _must(a.access_role = 'admin', 'Only admins can manage departments.');
  if v_name = '' then perform _fail('Name the department.'); end if;
  if exists (select 1 from departments where lower(name) = lower(v_name)) then perform _fail('That department already exists.'); end if;
  insert into departments (name, description, hue) values (v_name, _clean(p_description, 200), floor(random() * 360));
end $$;

-- Everyone edits their own profile; title and department are asked for on first sign-in.
create function public.update_profile(p_input jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a people := _actor();
begin
  if p_input ? 'departmentId' and not exists (select 1 from departments where id = p_input->>'departmentId') then
    perform _fail('Choose your department.');
  end if;
  update people set
    name = coalesce(nullif(_clean(p_input->>'name', 80), ''), name),
    title = case when p_input ? 'title' then _clean(p_input->>'title', 80) else title end,
    department_id = coalesce(p_input->>'departmentId', department_id),
    bio = case when p_input ? 'bio' then _clean(p_input->>'bio', 600) else bio end,
    interests = case when p_input ? 'interests' then (_text_list(p_input->'interests'))[1:8] else interests end
  where id = a.id;
end $$;

-- ---------- new sign-ins ----------

-- Only Anywhere.co Google accounts may join. Test accounts created by Claude for checks
-- carry app_metadata.aihub_test, which users cannot set themselves.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_test boolean := coalesce((new.raw_app_meta_data->>'aihub_test')::boolean, false);
begin
  if not v_test and not (lower(new.email) like '%@anywhere.co' and new.raw_app_meta_data->>'provider' = 'google') then
    raise exception 'Only Anywhere.co Google accounts can join the AI Hub.';
  end if;
  insert into people (id, name, email)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    lower(new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- function access ----------

revoke execute on all functions in schema public from public, anon;
revoke execute on function public._fail, public._must, public._clean, public._actor, public._project, public._log,
  public._stage_key, public._record_stage, public._status_label, public._text_list, public._people_list,
  public.handle_new_user from authenticated;
grant execute on function public.me_role, public.can_view, public.can_edit, public.whoami, public.save_project,
  public.set_journey_note, public.set_status, public.publish_project, public.delete_project, public.toggle_featured,
  public.save_resource, public.delete_resource, public.add_update, public.add_comment, public.delete_comment,
  public.set_access, public.set_active, public.add_department, public.update_profile to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------- starting departments ----------

insert into public.departments (name, description, hue) values
  ('Customer Success', 'Support, call quality and customer experience', 168),
  ('Product & Engineering', 'Platform, apps and internal tooling', 222),
  ('Design', 'Product design, brand and research', 262),
  ('Marketing', 'Content, campaigns and growth', 28),
  ('Sales', 'Pipeline, partnerships and onboarding', 340),
  ('People & Culture', 'Hiring, learning and wellbeing', 48),
  ('Finance & Operations', 'Billing, planning and process', 195);
