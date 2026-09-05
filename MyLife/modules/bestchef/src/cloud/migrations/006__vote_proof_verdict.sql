alter table public.bc_vote_proofs
  add column if not exists verdict text check (verdict in ('liked','loved','mixed','disliked')),
  add column if not exists rating int check (rating between 1 and 5),
  add column if not exists notes text;
