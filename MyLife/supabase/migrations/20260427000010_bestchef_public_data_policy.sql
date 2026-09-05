-- BestChef public data policy hardening.
-- Public bc_* media URL columns must never persist local device URIs.

alter table bc_dishes
  drop constraint if exists bc_dishes_photo_url_https;
alter table bc_dishes
  add constraint bc_dishes_photo_url_https
  check (photo_url is null or photo_url ~ '^https://');

alter table bc_submissions
  drop constraint if exists bc_submissions_photo_url_https;
alter table bc_submissions
  add constraint bc_submissions_photo_url_https
  check (photo_url is null or photo_url ~ '^https://');

alter table bc_comments
  drop constraint if exists bc_comments_photo_url_https;
alter table bc_comments
  add constraint bc_comments_photo_url_https
  check (photo_url is null or photo_url ~ '^https://');
