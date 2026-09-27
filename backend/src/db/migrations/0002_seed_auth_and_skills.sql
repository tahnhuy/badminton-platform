INSERT INTO "skill_levels" ("code", "name", "rank", "description")
VALUES
  ('BEGINNER', 'Mới chơi', 1, 'Mới tập, chưa giữ được cầu qua lại ổn định'),
  ('WEAK', 'Yếu', 2, 'Đánh qua lại được, kỹ thuật cơ bản chưa vững'),
  ('AVERAGE_MINUS', 'Trung bình yếu', 3, 'Có phông cầu, đập và bỏ nhỏ chưa ổn định'),
  ('AVERAGE', 'Trung bình', 4, 'Chơi đôi ổn, có chiến thuật cơ bản'),
  ('AVERAGE_PLUS', 'Trung bình khá', 5, 'Kỹ thuật đều, di chuyển tốt, hay đánh giải phong trào'),
  ('GOOD', 'Khá / Giỏi', 6, 'Có thành tích giải phong trào, kỹ thuật toàn diện')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description", "updated_by")
VALUES
  ('AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD', '5', 'Consecutive failed sign-in attempts before an account is temporarily locked', NULL),
  ('AUTH_FAILED_LOGIN_LOCKOUT_MINUTES', '15', 'Lockout duration; account auto-unlocks after this period', NULL),
  ('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER', '10080', 'Player session idle timeout (7 days)', NULL),
  ('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER', '43200', 'Player session absolute maximum duration (30 days)', NULL),
  ('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER', '10080', 'Court Owner session idle timeout (7 days)', NULL),
  ('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER', '43200', 'Court Owner session absolute maximum duration (30 days)', NULL),
  ('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN', '60', 'Admin session idle timeout (1 hour)', NULL),
  ('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN', '480', 'Admin session absolute maximum duration (8 hours)', NULL)
ON CONFLICT ("config_key") DO NOTHING;