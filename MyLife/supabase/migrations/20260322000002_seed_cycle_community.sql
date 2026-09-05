-- Seed the MyCycle community in MyForums with rules and tags.
-- Uses a fixed UUID so the community can be referenced deterministically.

do $$
begin
  if to_regclass('public.fr_communities') is null
    or to_regclass('public.fr_community_rules') is null
    or to_regclass('public.fr_tags') is null
  then
    raise notice 'Skipping MyCycle community seed because forum tables are not present.';
    return;
  end if;

  INSERT INTO fr_communities (id, creator_id, name, display_name, description, community_type, linked_module_id, member_count, thread_count, created_at, updated_at)
  VALUES (
    '00000000-0000-0000-0000-000000000cy1',
    '00000000-0000-0000-0000-000000000000',
    'mycycle',
    'MyCycle Community',
    'Discuss periods, fertility, symptoms, and reproductive health with fellow MyCycle users. Anonymous posting supported.',
    'public',
    'cycle',
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Community rules
  INSERT INTO fr_community_rules (id, community_id, title, description, position) VALUES
    ('00000000-0000-0000-0000-00000cy1rl01', '00000000-0000-0000-0000-000000000cy1', 'Be respectful', 'Treat everyone with kindness. No shaming, judgment, or dismissive language about anyone''s body or experience.', 0),
    ('00000000-0000-0000-0000-00000cy1rl02', '00000000-0000-0000-0000-000000000cy1', 'No medical advice', 'Share experiences, not diagnoses. Encourage professional consultation for medical concerns.', 1),
    ('00000000-0000-0000-0000-00000cy1rl03', '00000000-0000-0000-0000-000000000cy1', 'Protect privacy', 'Do not share others'' personal information. Use anonymous mode for sensitive topics.', 2),
    ('00000000-0000-0000-0000-00000cy1rl04', '00000000-0000-0000-0000-000000000cy1', 'Stay on topic', 'Discussions should relate to menstrual health, fertility, pregnancy, or cycle tracking.', 3)
  ON CONFLICT (id) DO NOTHING;

  -- Tags
  INSERT INTO fr_tags (id, community_id, name, color) VALUES
    ('00000000-0000-0000-0000-00000cy1tg01', '00000000-0000-0000-0000-000000000cy1', 'periods', '#F472B6'),
    ('00000000-0000-0000-0000-00000cy1tg02', '00000000-0000-0000-0000-000000000cy1', 'fertility', '#A78BFA'),
    ('00000000-0000-0000-0000-00000cy1tg03', '00000000-0000-0000-0000-000000000cy1', 'ttc', '#34D399'),
    ('00000000-0000-0000-0000-00000cy1tg04', '00000000-0000-0000-0000-000000000cy1', 'pregnancy', '#FB923C'),
    ('00000000-0000-0000-0000-00000cy1tg05', '00000000-0000-0000-0000-000000000cy1', 'pcos', '#F87171'),
    ('00000000-0000-0000-0000-00000cy1tg06', '00000000-0000-0000-0000-000000000cy1', 'symptoms', '#60A5FA'),
    ('00000000-0000-0000-0000-00000cy1tg07', '00000000-0000-0000-0000-000000000cy1', 'question', '#FBBF24')
  ON CONFLICT (id) DO NOTHING;
end;
$$;
