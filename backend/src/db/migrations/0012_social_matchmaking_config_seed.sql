-- SC-12: register and seed Social Matchmaking/Messaging keys (matrix §8.8-§8.9,
-- System Config Tech Design "Social Matchmaking extension", Ratings §25.5).
-- Never updates an existing SYSTEM_CONFIGS row. Defaults/bounds must match
-- backend/src/shared/config/config-registry.ts (asserted by social-config-seed.test.ts).

-- Preflight: stop for a human decision when a stored value is outside its approved
-- range, when the MIN_MATCHES copy source is invalid, or when the effective group
-- slot bounds violate MIN <= MAX. Nothing is written when it stops.
DO $$
DECLARE
  problems text;
  group_min integer;
  group_max integer;
BEGIN
  WITH rules(config_key, kind, min_value, max_value) AS (
    VALUES
      ('SOCIAL_FEED_ENABLED', 'boolean', NULL::integer, NULL::integer),
      ('MESSAGING_ENABLED', 'boolean', NULL, NULL),
      ('MATCHMAKING_APPLICATION_TIMEOUT_MINUTES', 'integer', 15, 10080),
      ('MATCHMAKING_INVITATION_TIMEOUT_MINUTES', 'integer', 15, 10080),
      ('MATCHMAKING_GROUP_MIN_SLOTS', 'integer', 3, 20),
      ('MATCHMAKING_GROUP_MAX_SLOTS', 'integer', 3, 20),
      ('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', 'integer', 1, 20),
      ('MESSAGING_GROUP_MAX_MEMBERS', 'integer', 3, 100),
      ('MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', 'integer', 1, 500),
      ('MESSAGING_MESSAGES_PER_MINUTE', 'integer', 1, 300),
      ('SOCIAL_FREE_POSTS_PER_DAY', 'integer', 1, 100),
      ('SOCIAL_COMMENTS_PER_MINUTE', 'integer', 1, 60),
      ('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES', 'integer', 1, 100)
  ),
  checked AS (
    SELECT r.config_key, r.kind, r.min_value, r.max_value, btrim(s.config_value) AS stored_value
    FROM rules r JOIN system_configs s ON s.config_key = r.config_key
    UNION ALL
    -- MIN_MATCHES is copied from MIN_RATINGS only when MIN_MATCHES is absent.
    SELECT 'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS (copy source)', 'integer', 1, 100, btrim(s.config_value)
    FROM system_configs s
    WHERE s.config_key = 'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS'
      AND NOT EXISTS (SELECT 1 FROM system_configs m WHERE m.config_key = 'PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES')
  )
  SELECT string_agg(format('%s=%L', config_key, stored_value), ', ' ORDER BY config_key)
  INTO problems
  FROM checked
  WHERE CASE
    WHEN stored_value IS NULL THEN true
    WHEN kind = 'boolean' THEN lower(stored_value) NOT IN ('true', 'false')
    WHEN stored_value !~ '^[0-9]{1,9}$' THEN true
    ELSE stored_value::integer NOT BETWEEN min_value AND max_value
  END;

  IF problems IS NOT NULL THEN
    RAISE EXCEPTION 'SC-12 preflight stopped: stored configuration outside the approved range: %', problems
      USING HINT = 'Resolve the stored values with a human decision; this migration never rewrites them.';
  END IF;

  SELECT COALESCE((SELECT btrim(config_value)::integer FROM system_configs WHERE config_key = 'MATCHMAKING_GROUP_MIN_SLOTS'), 3),
         COALESCE((SELECT btrim(config_value)::integer FROM system_configs WHERE config_key = 'MATCHMAKING_GROUP_MAX_SLOTS'), 12)
  INTO group_min, group_max;
  IF group_min > group_max THEN
    RAISE EXCEPTION 'SC-12 preflight stopped: MATCHMAKING_GROUP_MIN_SLOTS (%) > MATCHMAKING_GROUP_MAX_SLOTS (%)', group_min, group_max;
  END IF;
END;
$$;
--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description") VALUES
  ('SOCIAL_FEED_ENABLED', 'true', 'Enable/disable feed posts, reactions, comments'),
  ('MESSAGING_ENABLED', 'true', 'Enable/disable messaging'),
  ('MATCHMAKING_APPLICATION_TIMEOUT_MINUTES', '1440', 'Pending Apply timeout (capped per §3.12)'),
  ('MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '1440', 'Pending Invite timeout'),
  ('MATCHMAKING_GROUP_MIN_SLOTS', '3', 'Minimum capacity of a casual group post'),
  ('MATCHMAKING_GROUP_MAX_SLOTS', '12', 'Maximum capacity of a casual group post; MIN <= MAX'),
  ('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3', 'Open match-finding posts per Player'),
  ('MESSAGING_GROUP_MAX_MEMBERS', '50', 'Maximum members in a group conversation'),
  ('MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', '20', 'New one-to-one conversations per sender per day'),
  ('MESSAGING_MESSAGES_PER_MINUTE', '30', 'Messages per sender per minute'),
  ('SOCIAL_FREE_POSTS_PER_DAY', '10', 'Free posts per Player per day'),
  ('SOCIAL_COMMENTS_PER_MINUTE', '10', 'Comments per Player per minute')
ON CONFLICT ("config_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description")
SELECT 'PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES',
       COALESCE((SELECT btrim(config_value) FROM system_configs WHERE config_key = 'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS'), '5'),
       'Recent Match entries considered before an automatic skill adjustment'
ON CONFLICT ("config_key") DO NOTHING;
