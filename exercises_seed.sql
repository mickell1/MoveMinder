-- MoveMinder Exercise Seed
-- Run in Supabase SQL Editor. Safe to re-run — skips existing names.

INSERT INTO exercises (name, description, muscle_group, equipment, difficulty)
SELECT name, description, muscle_group, equipment, difficulty
FROM (VALUES
  -- ── CHEST ──────────────────────────────────────────────────────────────
  ('Barbell Bench Press',       'Lie on a flat bench and press a barbell from chest to full arm extension.',                                    'chest', 'barbell',    'intermediate'),
  ('Incline Barbell Bench Press','Press a barbell from upper chest on an inclined bench at 30–45 degrees.',                                     'chest', 'barbell',    'intermediate'),
  ('Decline Barbell Bench Press','Press a barbell from lower chest on a declined bench.',                                                       'chest', 'barbell',    'intermediate'),
  ('Dumbbell Bench Press',      'Press two dumbbells from chest to full extension on a flat bench.',                                            'chest', 'dumbbell',   'beginner'),
  ('Incline Dumbbell Press',    'Press dumbbells on an incline bench targeting the upper chest.',                                               'chest', 'dumbbell',   'beginner'),
  ('Dumbbell Fly',              'Open arms wide with a slight elbow bend, stretch chest, and bring dumbbells together above chest.',            'chest', 'dumbbell',   'beginner'),
  ('Cable Fly',                 'Use cable machine to bring handles together in front of chest with a hugging motion.',                         'chest', 'cable',      'intermediate'),
  ('Push-Up',                   'Lower chest to floor and push back up, keeping body straight.',                                               'chest', 'bodyweight',  'beginner'),
  ('Wide Push-Up',              'Push-up with hands wider than shoulder-width to emphasise outer chest.',                                      'chest', 'bodyweight',  'beginner'),
  ('Diamond Push-Up',           'Push-up with thumbs and index fingers touching to target triceps and inner chest.',                           'chest', 'bodyweight',  'intermediate'),
  ('Chest Dip',                 'Lean forward on parallel bars and lower yourself, pressing back up to target lower chest.',                   'chest', 'bodyweight',  'intermediate'),
  ('Pec Deck Machine',          'Seated machine fly pressing pads together in front of chest.',                                                'chest', 'machine',    'beginner'),
  ('Chest Press Machine',       'Seated machine that mimics bench press motion.',                                                              'chest', 'machine',    'beginner'),

  -- ── BACK ───────────────────────────────────────────────────────────────
  ('Deadlift',                  'Hinge at the hips to lift a barbell from the floor to hip height with a neutral spine.',                      'back',  'barbell',    'intermediate'),
  ('Romanian Deadlift',         'Hinge at hips keeping legs nearly straight to target hamstrings and lower back.',                             'back',  'barbell',    'intermediate'),
  ('Sumo Deadlift',             'Wide-stance deadlift with feet turned out and hands inside legs.',                                            'back',  'barbell',    'intermediate'),
  ('Bent Over Barbell Row',     'Hinge at hips and pull barbell to lower chest or belly button.',                                              'back',  'barbell',    'intermediate'),
  ('Dumbbell Row',              'Place one knee on bench and row a dumbbell to hip.',                                                          'back',  'dumbbell',   'beginner'),
  ('T-Bar Row',                 'Load one end of a barbell and row the loaded end to chest.',                                                  'back',  'barbell',    'intermediate'),
  ('Seated Cable Row',          'Pull a cable handle to your torso while seated, keeping back straight.',                                      'back',  'cable',      'beginner'),
  ('Lat Pulldown',              'Pull a wide bar down to upper chest on a cable machine.',                                                     'back',  'cable',      'beginner'),
  ('Pull-Up',                   'Hang from a bar with overhand grip and pull chin above the bar.',                                             'back',  'bodyweight',  'intermediate'),
  ('Chin-Up',                   'Hang from a bar with underhand grip and pull chin above the bar.',                                            'back',  'bodyweight',  'intermediate'),
  ('Face Pull',                 'Pull a rope attachment to face height to target rear deltoids and upper back.',                               'back',  'cable',      'beginner'),
  ('Good Morning',              'Hinge at hips with a barbell on back, keeping spine neutral.',                                                'back',  'barbell',    'intermediate'),
  ('Hyperextension',            'Lower and raise torso on a 45-degree back extension bench.',                                                  'back',  'bodyweight',  'beginner'),
  ('Meadows Row',               'Landmine row with a staggered stance, pulling from a low position to hip.',                                   'back',  'barbell',    'advanced'),
  ('Inverted Row',              'Lie under a bar or rings and pull chest up to meet them.',                                                    'back',  'bodyweight',  'beginner'),

  -- ── LEGS ───────────────────────────────────────────────────────────────
  ('Barbell Back Squat',        'Bar on upper back, squat until thighs are parallel to floor and drive back up.',                              'legs',  'barbell',    'intermediate'),
  ('Front Squat',               'Bar rests on front deltoids as you squat down with an upright torso.',                                        'legs',  'barbell',    'advanced'),
  ('Goblet Squat',              'Hold a dumbbell or kettlebell at chest and squat with an upright torso.',                                     'legs',  'dumbbell',   'beginner'),
  ('Leg Press',                 'Push a weighted platform away with feet on a 45-degree sled machine.',                                        'legs',  'machine',    'beginner'),
  ('Hack Squat',                'Squat with a machine supporting the weight on your back.',                                                    'legs',  'machine',    'intermediate'),
  ('Bulgarian Split Squat',     'Rear foot elevated on bench, lower front knee toward floor.',                                                 'legs',  'dumbbell',   'intermediate'),
  ('Walking Lunge',             'Step forward into a lunge, alternate legs while walking.',                                                    'legs',  'dumbbell',   'beginner'),
  ('Reverse Lunge',             'Step backward into a lunge to reduce knee stress.',                                                           'legs',  'dumbbell',   'beginner'),
  ('Leg Extension',             'Straighten legs against resistance on a machine to isolate quads.',                                           'legs',  'machine',    'beginner'),
  ('Leg Curl',                  'Curl legs against resistance on a machine to isolate hamstrings.',                                             'legs',  'machine',    'beginner'),
  ('Nordic Hamstring Curl',     'Anchor feet and slowly lower torso forward, catching yourself with hands.',                                   'legs',  'bodyweight',  'advanced'),
  ('Hip Thrust',                'Drive hips up with a barbell across the hips while upper back is on a bench.',                                'legs',  'barbell',    'intermediate'),
  ('Glute Bridge',              'Lie on back and drive hips toward ceiling.',                                                                  'legs',  'bodyweight',  'beginner'),
  ('Standing Calf Raise',       'Rise up on toes to target calf muscles.',                                                                    'legs',  'machine',    'beginner'),
  ('Seated Calf Raise',         'Seated calf raise to target soleus muscle.',                                                                 'legs',  'machine',    'beginner'),
  ('Box Jump',                  'Explosively jump onto a box or platform and step back down.',                                                 'legs',  'bodyweight',  'intermediate'),
  ('Step-Up',                   'Step onto a box or bench, driving through the heel.',                                                         'legs',  'dumbbell',   'beginner'),
  ('Pistol Squat',              'Single-leg squat with the other leg extended forward.',                                                       'legs',  'bodyweight',  'advanced'),

  -- ── SHOULDERS ──────────────────────────────────────────────────────────
  ('Barbell Overhead Press',    'Press a barbell from shoulders to full arm extension overhead.',                                              'shoulders', 'barbell',   'intermediate'),
  ('Dumbbell Shoulder Press',   'Press dumbbells overhead from shoulder height.',                                                              'shoulders', 'dumbbell',  'beginner'),
  ('Arnold Press',              'Dumbbell press with a rotation from palms-in at bottom to palms-out at top.',                                 'shoulders', 'dumbbell',  'intermediate'),
  ('Lateral Raise',             'Raise dumbbells out to the sides to shoulder height.',                                                        'shoulders', 'dumbbell',  'beginner'),
  ('Front Raise',               'Raise dumbbells forward to shoulder height.',                                                                 'shoulders', 'dumbbell',  'beginner'),
  ('Rear Delt Fly',             'Bend over and raise dumbbells out to the sides to target rear deltoids.',                                     'shoulders', 'dumbbell',  'beginner'),
  ('Cable Lateral Raise',       'Lateral raise using a low cable pulley for constant tension.',                                                'shoulders', 'cable',     'intermediate'),
  ('Upright Row',               'Pull barbell or dumbbells vertically to chin height.',                                                        'shoulders', 'barbell',   'intermediate'),
  ('Shoulder Press Machine',    'Seated overhead press on a machine.',                                                                         'shoulders', 'machine',   'beginner'),
  ('Pike Push-Up',              'Inverted V position push-up to target shoulders.',                                                            'shoulders', 'bodyweight', 'beginner'),
  ('Landmine Press',            'Press the end of a loaded barbell at an angle, great for shoulder health.',                                   'shoulders', 'barbell',   'intermediate'),

  -- ── ARMS ───────────────────────────────────────────────────────────────
  ('Barbell Curl',              'Curl a barbell from full extension to chin height.',                                                          'arms', 'barbell',    'beginner'),
  ('Dumbbell Curl',             'Alternate or simultaneously curl dumbbells.',                                                                 'arms', 'dumbbell',   'beginner'),
  ('Hammer Curl',               'Curl dumbbells with a neutral (thumbs-up) grip to target brachialis.',                                       'arms', 'dumbbell',   'beginner'),
  ('Incline Dumbbell Curl',     'Curl dumbbells on an inclined bench for full bicep stretch.',                                                 'arms', 'dumbbell',   'intermediate'),
  ('Cable Curl',                'Curl using a low cable pulley for constant tension throughout the range.',                                    'arms', 'cable',      'beginner'),
  ('Preacher Curl',             'Curl over a preacher bench to isolate the biceps.',                                                           'arms', 'barbell',    'intermediate'),
  ('Concentration Curl',        'Seated single-arm curl with elbow braced on inner thigh.',                                                   'arms', 'dumbbell',   'beginner'),
  ('Skull Crusher',             'Lower a barbell or EZ bar toward the forehead while lying on a bench.',                                       'arms', 'barbell',    'intermediate'),
  ('Tricep Pushdown',           'Push a cable bar or rope down to full arm extension.',                                                        'arms', 'cable',      'beginner'),
  ('Overhead Tricep Extension', 'Hold dumbbell behind head and extend arms overhead.',                                                         'arms', 'dumbbell',   'beginner'),
  ('Close-Grip Bench Press',    'Bench press with hands narrow to target triceps.',                                                            'arms', 'barbell',    'intermediate'),
  ('Tricep Dip',                'Lower and press on parallel bars to target triceps.',                                                         'arms', 'bodyweight',  'intermediate'),
  ('Diamond Push-Up',           'Push-up with hands close together in a diamond shape.',                                                      'arms', 'bodyweight',  'intermediate'),
  ('Wrist Curl',                'Curl a barbell or dumbbell using only the wrists.',                                                           'arms', 'dumbbell',   'beginner'),

  -- ── CORE ───────────────────────────────────────────────────────────────
  ('Plank',                     'Hold a forearm or straight-arm plank position with core braced.',                                             'core', 'bodyweight',  'beginner'),
  ('Side Plank',                'Lateral plank on one forearm, keeping hips raised.',                                                          'core', 'bodyweight',  'beginner'),
  ('Crunch',                    'Curl upper body up from a lying position to target upper abs.',                                               'core', 'bodyweight',  'beginner'),
  ('Bicycle Crunch',            'Alternate touching elbow to opposite knee while cycling legs.',                                               'core', 'bodyweight',  'beginner'),
  ('Leg Raise',                 'Lie flat and raise straight legs to vertical then lower with control.',                                       'core', 'bodyweight',  'intermediate'),
  ('Hanging Knee Raise',        'Hang from a bar and bring knees to chest.',                                                                   'core', 'bodyweight',  'intermediate'),
  ('Hanging Leg Raise',         'Hang from a bar and raise straight legs to horizontal.',                                                      'core', 'bodyweight',  'advanced'),
  ('Russian Twist',             'Seated with feet raised, rotate a weight from side to side.',                                                 'core', 'dumbbell',   'beginner'),
  ('Ab Wheel Rollout',          'Roll an ab wheel forward from knees and back in.',                                                            'core', 'various',    'intermediate'),
  ('Mountain Climber',          'In plank position, rapidly alternate driving knees toward chest.',                                            'core', 'bodyweight',  'beginner'),
  ('Dragon Flag',               'Lower straight body from bench while supporting at shoulders.',                                               'core', 'bodyweight',  'advanced'),
  ('Hollow Body Hold',          'Lying flat, raise arms, head, and legs slightly off ground and hold.',                                        'core', 'bodyweight',  'intermediate'),
  ('V-Up',                      'Simultaneously raise upper and lower body to form a V shape.',                                                'core', 'bodyweight',  'intermediate'),
  ('Cable Crunch',              'Kneel facing a cable machine and crunch down with a rope attachment.',                                        'core', 'cable',      'intermediate'),
  ('Dead Bug',                  'Lying on back, extend opposite arm and leg while keeping lower back pressed to floor.',                       'core', 'bodyweight',  'beginner'),

  -- ── FULL BODY / CARDIO ─────────────────────────────────────────────────
  ('Burpee',                    'Jump down to push-up, press back up, jump feet to hands, then jump up.',                                     'core', 'bodyweight',  'intermediate'),
  ('Kettlebell Swing',          'Hinge and drive hips forward to swing a kettlebell to shoulder height.',                                      'legs', 'kettlebell',  'intermediate'),
  ('Kettlebell Clean',          'Pull a kettlebell from the floor to rack position in one fluid motion.',                                      'back', 'kettlebell',  'intermediate'),
  ('Thruster',                  'Front squat into an overhead press in one continuous movement.',                                              'legs', 'barbell',    'intermediate'),
  ('Farmer Carry',              'Walk a set distance holding heavy dumbbells or kettlebells at sides.',                                        'back', 'dumbbell',   'beginner'),
  ('Suitcase Carry',            'Walk holding a single heavy weight at one side to challenge core stability.',                                 'core', 'dumbbell',   'beginner'),
  ('Clean and Press',           'Power clean a barbell from floor to shoulders then press overhead.',                                          'back', 'barbell',    'advanced'),
  ('Jump Squat',                'Squat then explode upward into a jump.',                                                                      'legs', 'bodyweight',  'intermediate'),
  ('Battle Ropes',              'Alternate or simultaneous waves with heavy ropes for conditioning.',                                          'shoulders', 'various', 'beginner'),
  ('Sled Push',                 'Push a weighted sled across the floor.',                                                                      'legs', 'various',    'intermediate')

) AS e(name, description, muscle_group, equipment, difficulty)
WHERE NOT EXISTS (
  SELECT 1 FROM exercises WHERE LOWER(exercises.name) = LOWER(e.name)
);
