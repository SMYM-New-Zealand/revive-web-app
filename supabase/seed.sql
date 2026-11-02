insert into public.competition_config (id, name, starts_on, ends_on, timezone)
values (1, 'Revive', '2026-11-02', '2026-12-01', 'Pacific/Auckland')
on conflict (id) do update set
  name = excluded.name,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  timezone = excluded.timezone;

insert into public.challenges
  (tier, title, points, starts_on, ends_on, sort_order, active)
values
  ('novice', 'Complete 20 bodyweight squats', 10, null, null, 10, true),
  ('novice', 'Make your bed and tidy your room', 10, null, null, 20, true),
  ('novice', 'Complete 10 minutes of stretching', 10, null, null, 30, true),
  ('novice', 'Eat 5+ a day of fruits & veg', 10, null, null, 40, true),
  ('novice', '15 min walk or bike ride', 10, null, null, 50, true),
  ('novice', '20 jumping jacks', 10, null, null, 60, true),
  ('novice', 'Read a book for 10 minutes', 10, null, null, 70, true),
  ('challenger', 'Complete 25 pushups', 25, null, null, 10, true),
  ('challenger', '30 mins of a new activity (anything)', 25, null, null, 20, true),
  ('challenger', 'Complete a Daily Examen', 25, null, null, 30, true),
  ('challenger', 'Drink 1L per 35kg of body weight', 25, null, null, 40, true),
  ('challenger', '45s Plank', 25, null, null, 50, true),
  ('challenger', '45 second dead hang', 25, null, null, 60, true),
  ('challenger', 'Read Hebrews 1-7 and write a reflection', 25, null, null, 70, true),
  ('elite', 'Walk 10k steps', 50, null, null, 10, true),
  ('elite', 'Learn about a male Saint and share', 50, null, null, 20, true),
  ('elite', 'No screentime from 11pm-8am', 50, null, null, 30, true),
  ('elite', 'Eat 1.5g of protein per 1kg of body weight', 50, null, null, 40, true),
  ('elite', 'No sugary drinks', 50, null, null, 50, true),
  ('elite', '1 minute dead hang', 50, null, null, 60, true),
  ('elite', 'Complete a Rosary', 50, null, null, 70, true),
  ('bonus', 'Attend daily Mass/Qurbana for the next six days', 100, '2026-11-02', '2026-11-08', 10, true),
  ('bonus', 'Go for confession once in the next five days', 100, '2026-11-02', '2026-11-08', 20, true),
  ('bonus', 'Pray 33 prayers for the souls in purgatory for the next six days', 100, '2026-11-02', '2026-11-08', 30, true),
  ('bonus', 'Complete 150 Pushups', 100, '2026-11-02', '2026-11-08', 40, true)
on conflict (tier, title) do update set
  points = excluded.points,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  sort_order = excluded.sort_order,
  active = excluded.active;
