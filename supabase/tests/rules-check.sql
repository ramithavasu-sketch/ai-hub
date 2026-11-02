-- Dry-run check of the AI Hub rules. Everything happens inside one block that ends by
-- raising its report as an error, so all test data is rolled back automatically.
-- Run: npx supabase db query --remote --yes -f supabase/tests/rules-check.sql

create function pg_temp.act_as(u uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.back() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.mk(email text, test boolean) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
    case when test then '{"provider":"email","aihub_test":true}' else '{"provider":"email"}' end::jsonb,
    json_build_object('full_name', split_part(email, '@', 1))::jsonb, now(), now());
  return u;
end $$;

do $t$
declare
  adm uuid; c1 uuid; c2 uuid; v uuid;
  dept text := (select id from departments order by name limit 1);
  pub text; dr text; rs text; cm text;
  n int; r text := ''; pass int := 0; fail int := 0;
  base jsonb;
  procedure_ok boolean;
begin
  -- 1. Non-Anywhere / non-Google sign-ups are refused
  begin
    perform pg_temp.mk('outsider@gmail.com', false);
    fail := fail + 1; r := r || E'\nFAIL outsider was allowed to join';
  exception when others then pass := pass + 1; end;
  begin
    perform pg_temp.mk('someone@anywhere.co', false);  -- right domain but not Google
    fail := fail + 1; r := r || E'\nFAIL non-Google anywhere.co account joined';
  exception when others then pass := pass + 1; end;

  adm := pg_temp.mk('t-admin@aihub.test', true);
  c1 := pg_temp.mk('t-c1@aihub.test', true);
  c2 := pg_temp.mk('t-c2@aihub.test', true);
  v := pg_temp.mk('t-viewer@aihub.test', true);
  select count(*) into n from people where id in (adm, c1, c2, v) and access_role = 'viewer';
  if n = 4 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL new people should start as viewers'; end if;
  update people set access_role = 'admin' where id = adm;
  update people set access_role = 'contributor' where id in (c1, c2);

  base := jsonb_build_object('name', 'Test project', 'description', 'd', 'problem', 'p', 'solution', 's',
    'departmentId', dept, 'status', 'idea', 'visibility', 'published', 'ownerId', adm,
    'contributorIds', '[]'::jsonb, 'allowedIds', '[]'::jsonb, 'technologies', '["Claude"]'::jsonb, 'tags', '["Test"]'::jsonb);

  -- 2. Viewer cannot create
  perform pg_temp.act_as(v);
  begin perform save_project(base); fail := fail + 1; r := r || E'\nFAIL viewer created a project';
  exception when others then pass := pass + 1; end;

  -- 3. Contributor creates published, draft, restricted; always owns them
  perform pg_temp.act_as(c1);
  pub := save_project(base);
  dr := save_project(base || '{"name":"Draft","visibility":"draft","description":""}');
  rs := save_project(base || jsonb_build_object('name', 'Secret', 'visibility', 'restricted', 'allowedIds', jsonb_build_array(v)));
  if (select owner_id from projects where id = pub) = c1 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL contributor did not become owner'; end if;
  begin perform save_project(base || '{"description":""}'); fail := fail + 1; r := r || E'\nFAIL published project without description';
  exception when others then pass := pass + 1; end;

  -- 4. Another contributor sees only the published one and cannot edit it
  perform pg_temp.act_as(c2);
  select count(*) into n from projects;
  if n = 1 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL c2 sees ' || n || ' projects (want 1)'; end if;
  begin perform set_status(pub, 'testing'); fail := fail + 1; r := r || E'\nFAIL non-member changed status';
  exception when others then pass := pass + 1; end;
  begin perform save_resource(pub, '{"title":"x","url":"https://x.com"}'); fail := fail + 1; r := r || E'\nFAIL non-member added resource';
  exception when others then pass := pass + 1; end;
  begin perform add_comment(dr, 'hi'); fail := fail + 1; r := r || E'\nFAIL commented on hidden draft';
  exception when others then pass := pass + 1; end;
  perform add_comment(pub, 'Looks great');
  select count(*) into n from comments where project_id = pub;
  if n = 1 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL comment not saved'; end if;
  select count(*) into n from resources where project_id = rs;
  if n = 0 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL restricted resources leaked'; end if;

  -- 5. Viewer on the allowed list sees the restricted project
  perform pg_temp.act_as(v);
  select count(*) into n from projects;
  if n = 2 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL viewer sees ' || n || ' (want 2)'; end if;
  select id into cm from comments where project_id = pub limit 1;
  begin perform delete_comment(pub, cm); fail := fail + 1; r := r || E'\nFAIL deleted someone else''s comment';
  exception when others then pass := pass + 1; end;

  -- 6. Owner adds c2 as contributor; c2 can now edit but not change the owner
  perform pg_temp.act_as(c1);
  perform save_project(base || jsonb_build_object('ownerId', c1, 'contributorIds', jsonb_build_array(c2)), pub);
  perform pg_temp.act_as(c2);
  perform set_status(pub, 'prototype');
  if (select journey ? 'prototype' from projects where id = pub) then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL journey stage not stamped'; end if;
  begin perform save_project(base || jsonb_build_object('ownerId', c2, 'contributorIds', jsonb_build_array(c2)), pub);
    fail := fail + 1; r := r || E'\nFAIL contributor took ownership';
  exception when others then pass := pass + 1; end;

  -- 7. Links must be http(s)
  begin perform save_resource(pub, '{"title":"bad","url":"javascript:alert(1)"}'); fail := fail + 1; r := r || E'\nFAIL javascript: link accepted';
  exception when others then pass := pass + 1; end;
  perform save_resource(pub, '{"title":"Repo","type":"github","url":"https://github.com/x"}');
  select count(*) into n from resources where project_id = pub;
  if n = 1 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL resource not saved'; end if;

  -- 8. Deleting: published refused for owner, draft allowed
  perform pg_temp.act_as(c1);
  begin perform delete_project(pub); fail := fail + 1; r := r || E'\nFAIL owner deleted a published project';
  exception when others then pass := pass + 1; end;
  perform delete_project(dr);
  begin perform toggle_featured(pub); fail := fail + 1; r := r || E'\nFAIL contributor featured a project';
  exception when others then pass := pass + 1; end;

  -- 9. Nobody writes tables directly
  begin
    insert into projects (name, owner_id, department_id) values ('sneaky', c1, dept);
    fail := fail + 1; r := r || E'\nFAIL direct insert allowed';
  exception when others then pass := pass + 1; end;
  begin
    update people set access_role = 'admin' where id = c1;
    get diagnostics n = row_count;
    if n = 0 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL self-promotion worked'; end if;
  exception when others then pass := pass + 1; end;

  -- 10. Admin sees everything, features, cannot demote self, deactivates the viewer
  perform save_project(base || '{"name":"Draft 2","visibility":"draft"}');
  perform pg_temp.act_as(adm);
  select count(*) into n from projects;
  if n = 3 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL admin sees ' || n || ' (want 3)'; end if;
  perform toggle_featured(pub);
  begin perform set_access(adm, 'viewer'); fail := fail + 1; r := r || E'\nFAIL admin demoted self';
  exception when others then pass := pass + 1; end;
  perform set_active(v, false);

  -- 11. Deactivated person sees nothing and cannot act, but whoami explains
  perform pg_temp.act_as(v);
  select count(*) into n from projects;
  if n = 0 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL deactivated person sees projects'; end if;
  if (whoami()->>'active')::boolean = false then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL whoami wrong'; end if;
  begin perform add_comment(pub, 'still here?'); fail := fail + 1; r := r || E'\nFAIL deactivated person commented';
  exception when others then pass := pass + 1; end;

  -- 12. Profile edit
  perform pg_temp.act_as(c2);
  perform update_profile(jsonb_build_object('title', 'Engineer', 'departmentId', dept, 'bio', 'Hi', 'interests', '["RAG","RAG","Evals"]'::jsonb));
  if (select title = 'Engineer' and cardinality(interests) = 2 from people where id = c2) then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL profile update'; end if;

  -- 13. Signed-out visitors get nothing
  perform pg_temp.back();
  perform set_config('role', 'anon', true);
  begin
    select count(*) into n from projects;
    if n = 0 then pass := pass + 1; else fail := fail + 1; r := r || E'\nFAIL anon read projects'; end if;
  exception when others then pass := pass + 1; end;
  begin perform add_comment(pub, 'anon'); fail := fail + 1; r := r || E'\nFAIL anon called a function';
  exception when others then pass := pass + 1; end;

  perform pg_temp.back();
  raise exception 'RULES CHECK: % passed, % failed%', pass, fail, r;
end $t$;
