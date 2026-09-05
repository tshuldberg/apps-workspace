-- Media purge job wiring (TS-04). Rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function('public', 'bc_run_media_purge_worker', 'purge worker invoker exists');

-- The invoker respects the appeal-evidence window and the deleted fast path.
select ok(
  (select prosrc like '%interval ''183 days''%' from pg_proc where proname = 'bc_run_media_purge_worker'),
  'invoker gates rejected rows behind the 183-day appeal window'
);
select ok(
  (select prosrc like '%upload_status = ''deleted''%' from pg_proc where proname = 'bc_run_media_purge_worker'),
  'invoker purges deleted uploads without an age gate'
);
select ok(
  (select prosrc like '%media_purge_worker_secret%' from pg_proc where proname = 'bc_run_media_purge_worker'),
  'invoker reads the purge worker secret from bc_job_config'
);

-- Job health reports the purge job.
select ok(
  (select prosrc like '%media_purge_job_scheduled%' from pg_proc where proname = 'bc_job_health'),
  'bc_job_health reports the purge job schedule'
);
select ok(
  (select prosrc like '%purgeable_media_rows%' from pg_proc where proname = 'bc_job_health'),
  'bc_job_health reports the purgeable backlog'
);

select * from finish();

rollback;
