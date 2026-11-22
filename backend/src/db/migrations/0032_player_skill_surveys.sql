CREATE TABLE "player_skill_surveys" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"survey_version" smallint NOT NULL,
	"answers" jsonb NOT NULL,
	"score_k" numeric(5, 2) NOT NULL,
	"score_r" numeric(5, 2) NOT NULL,
	"score_x" numeric(5, 2) NOT NULL,
	"score_p" numeric(5, 2) NOT NULL,
	"score_a" numeric(5, 2) NOT NULL,
	"score_t" numeric(5, 2) NOT NULL,
	"raw_score" numeric(5, 2) NOT NULL,
	"final_score" numeric(5, 2) NOT NULL,
	"nominal_skill_level_id" bigint NOT NULL,
	"resulting_skill_level_id" bigint NOT NULL,
	"applied_guardrails" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_player_skill_surveys_components" CHECK ("player_skill_surveys"."score_k" BETWEEN 0 AND 100 AND "player_skill_surveys"."score_r" BETWEEN 0 AND 100 AND "player_skill_surveys"."score_x" BETWEEN 0 AND 100 AND "player_skill_surveys"."score_p" BETWEEN 0 AND 100 AND "player_skill_surveys"."score_a" BETWEEN 0 AND 100 AND "player_skill_surveys"."score_t" BETWEEN 0 AND 100),
	CONSTRAINT "chk_player_skill_surveys_scores" CHECK ("player_skill_surveys"."raw_score" BETWEEN 0 AND 100 AND "player_skill_surveys"."final_score" BETWEEN 0 AND 100 AND "player_skill_surveys"."final_score" <= "player_skill_surveys"."raw_score"),
	CONSTRAINT "chk_player_skill_surveys_guardrails" CHECK ("player_skill_surveys"."applied_guardrails" <@ ARRAY['G1_BOTTLENECK', 'G2_EXPERIENCE_CAP']::text[])
);
--> statement-breakpoint
CREATE TABLE "skill_survey_versions" (
	"version" smallint PRIMARY KEY NOT NULL,
	"status" varchar NOT NULL,
	"definition" jsonb NOT NULL,
	"note" text,
	"created_by" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_by" bigint,
	"published_at" timestamp,
	CONSTRAINT "chk_skill_survey_versions_status" CHECK ("skill_survey_versions"."status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
);
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "is_skill_tentative" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "player_skill_surveys" ADD CONSTRAINT "player_skill_surveys_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skill_surveys" ADD CONSTRAINT "player_skill_surveys_survey_version_skill_survey_versions_version_fk" FOREIGN KEY ("survey_version") REFERENCES "public"."skill_survey_versions"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skill_surveys" ADD CONSTRAINT "player_skill_surveys_nominal_skill_level_id_skill_levels_id_fk" FOREIGN KEY ("nominal_skill_level_id") REFERENCES "public"."skill_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skill_surveys" ADD CONSTRAINT "player_skill_surveys_resulting_skill_level_id_skill_levels_id_fk" FOREIGN KEY ("resulting_skill_level_id") REFERENCES "public"."skill_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_survey_versions" ADD CONSTRAINT "skill_survey_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_survey_versions" ADD CONSTRAINT "skill_survey_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_skill_survey_versions_active" ON "skill_survey_versions" USING btree ("status") WHERE "skill_survey_versions"."status" = 'ACTIVE';--> statement-breakpoint
-- Seven-level catalog (matrix §1.2, decision 2026-11-15). Migration 0005 is not edited.
UPDATE "skill_levels" SET "name" = 'Mới chơi', "description" = 'Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định', "updated_at" = now() WHERE "code" = 'BEGINNER';--> statement-breakpoint
UPDATE "skill_levels" SET "name" = 'Yếu', "description" = 'Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả, hay đứng sai vị trí', "updated_at" = now() WHERE "code" = 'WEAK';--> statement-breakpoint
UPDATE "skill_levels" SET "name" = 'Trung bình yếu', "description" = 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi; dễ tự đánh hỏng khi đối phương tăng tốc', "updated_at" = now() WHERE "code" = 'AVERAGE_MINUS';--> statement-breakpoint
UPDATE "skill_levels" SET "name" = 'Trung bình', "description" = 'Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí; độ ổn định chưa đồng đều giữa các kỹ thuật', "updated_at" = now() WHERE "code" = 'AVERAGE';--> statement-breakpoint
UPDATE "skill_levels" SET "name" = 'Trung bình khá', "description" = 'Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật có chủ đích', "updated_at" = now() WHERE "code" = 'AVERAGE_PLUS';--> statement-breakpoint
UPDATE "skill_levels" SET "name" = 'Khá', "description" = 'Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ; người chơi phong trào năng lực cao', "updated_at" = now() WHERE "code" = 'GOOD';--> statement-breakpoint
INSERT INTO "skill_levels" ("code", "name", "rank", "description")
VALUES ('EXCELLENT', 'Giỏi', 7, 'Kỹ thuật chuyên sâu, chính xác ngay cả dưới áp lực; chủ động công thủ tốc độ cao; thường đã có thành tích thi đấu (bao gồm cả bán chuyên và chuyên nghiệp)')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- A version's definition is immutable once ACTIVE or RETIRED (database-schema.md §13.8).
CREATE OR REPLACE FUNCTION "skill_survey_versions_definition_immutable"() RETURNS trigger AS $fn$
BEGIN
  IF OLD."status" IN ('ACTIVE', 'RETIRED') AND NEW."definition" IS DISTINCT FROM OLD."definition" THEN
    RAISE EXCEPTION 'skill_survey_versions.definition is immutable once published (version %)', OLD."version";
  END IF;
  -- Going back to DRAFT would reopen the definition for edits.
  IF OLD."status" IN ('ACTIVE', 'RETIRED') AND NEW."status" = 'DRAFT' THEN
    RAISE EXCEPTION 'skill_survey_versions cannot return to DRAFT once published (version %)', OLD."version";
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_skill_survey_versions_definition_immutable"
BEFORE UPDATE ON "skill_survey_versions"
FOR EACH ROW EXECUTE FUNCTION "skill_survey_versions_definition_immutable"();--> statement-breakpoint
-- Survey version 1 (Auth Tech Design "Version 1 definition"); equals SKILL_SURVEY_DEFINITION_V1 (skill-survey-migration.test.ts).
INSERT INTO "skill_survey_versions" ("version", "status", "definition", "note", "published_at")
VALUES (1, 'ACTIVE', $json${"steps":[{"title":"Tiểu sử & thói quen","questionIds":["yearsPlaying","frequencyPerWeek","coaching","returningAfterBreak"]},{"title":"Kỹ thuật","questionIds":["skill.service","skill.clear","skill.smash","skill.netPlay","skill.defense","skill.drive","skill.backhand","skill.footwork","skill.doublesPlay"]},{"title":"Thực chiến & thể lực","questionIds":["rallyConsistency","stamina"]},{"title":"Thành tích thi đấu","questionIds":["tournamentAchievement"]}],"skillScale":[{"value":0,"label":"Chưa làm được"},{"value":1,"label":"Làm được khi cầu chậm/dễ"},{"value":2,"label":"Ổn định khi đánh giao lưu"},{"value":3,"label":"Ổn định cả khi bị ép tốc độ cao"}],"questions":[{"id":"yearsPlaying","type":"CHOICE","group":"X_YEARS","text":"Tổng thời gian bạn thực sự chơi cầu lông là bao lâu (không tính các giai đoạn nghỉ)?","options":[{"code":"LESS_THAN_6M","label":"Dưới 6 tháng","score":0,"experienceCap":"AVERAGE_MINUS"},{"code":"6M_TO_1Y","label":"6 tháng – dưới 1 năm","score":20,"experienceCap":"AVERAGE"},{"code":"1Y_TO_2Y","label":"1 – dưới 2 năm","score":40},{"code":"2Y_TO_4Y","label":"2 – dưới 4 năm","score":60},{"code":"4Y_TO_7Y","label":"4 – dưới 7 năm","score":80},{"code":"7Y_PLUS","label":"Từ 7 năm trở lên","score":100}]},{"id":"frequencyPerWeek","type":"CHOICE","group":"X_FREQ","text":"Hiện tại bạn chơi trung bình bao nhiêu buổi mỗi tuần?","options":[{"code":"LESS_THAN_1","label":"Dưới 1 buổi","score":0},{"code":"ONE","label":"1 buổi","score":33.333333333333336},{"code":"TWO_TO_THREE","label":"2–3 buổi","score":66.66666666666667},{"code":"FOUR_PLUS","label":"Từ 4 buổi trở lên","score":100}]},{"id":"coaching","type":"CHOICE","group":"T","text":"Bạn đã từng học cầu lông bài bản chưa?","options":[{"code":"NONE","label":"Chưa từng học","score":0},{"code":"SELF_TAUGHT","label":"Tự học qua video/bạn bè","score":25},{"code":"COACH_LESS_THAN_6M","label":"Học lớp cơ bản/HLV dưới 6 tháng","score":50},{"code":"COACH_6M_PLUS","label":"Học có giáo trình từ 6 tháng trở lên","score":75},{"code":"TALENT_TEAM","label":"Từng ở đội tuyển/lớp năng khiếu","score":100}]},{"id":"returningAfterBreak","type":"BOOLEAN","group":"RETURNING","text":"Bạn có đang quay lại chơi sau một thời gian nghỉ liên tục trên 6 tháng, và mới chơi lại chưa đến 3 tháng không?","options":[{"code":false,"label":"Không"},{"code":true,"label":"Có"}],"hiddenWhen":{"questionId":"yearsPlaying","optionCode":"LESS_THAN_6M"}},{"id":"skill.service","type":"SKILL","group":"K","text":"Giao cầu","description":"Giao cầu ngắn sát lưới và giao cầu cao sâu cuối sân"},{"id":"skill.clear","type":"SKILL","group":"K","text":"Phông cầu","description":"Từ cuối sân đánh cầu cao sâu về sát cuối sân đối phương"},{"id":"skill.smash","type":"SKILL","group":"K","text":"Đập cầu","description":"Đập cầu cắm, có lực và điều chỉnh được hướng"},{"id":"skill.netPlay","type":"SKILL","group":"K","text":"Bỏ nhỏ / cầu lưới","description":"Bỏ nhỏ, ve, móc cầu sát mép lưới"},{"id":"skill.defense","type":"SKILL","group":"K","text":"Thủ cầu","description":"Đỡ đập, hất cầu cao sâu thoát hiểm khi bị tấn công"},{"id":"skill.drive","type":"SKILL","group":"K","text":"Tạt cầu & phản tạt","description":"Đánh cầu ngang lưới tốc độ nhanh, chủ động hoặc phản tạt khi bị ép"},{"id":"skill.backhand","type":"SKILL","group":"K","text":"Trái tay","description":"Đánh trái tay từ cuối sân qua lưới để thoát thế bị động"},{"id":"skill.footwork","type":"SKILL","group":"K","text":"Bộ pháp","description":"Di chuyển bao các góc sân và hồi về vị trí trung tâm"},{"id":"skill.doublesPlay","type":"SKILL","group":"K","text":"Phối hợp đánh đôi","description":"Hiểu vị trí tấn công (trên–dưới) và phòng thủ (hai bên), biết bọc lót đồng đội"},{"id":"rallyConsistency","type":"CHOICE","group":"R","text":"Khi đánh qua lại giằng co với người cùng trình độ, bạn thường giữ được bao nhiêu lượt chạm cầu trước khi chính bạn đánh hỏng?","description":"Đếm cả hai bên: bạn đánh, đối phương đánh lại là 2 lượt.","options":[{"code":"LESS_THAN_5","label":"Dưới 5 lượt","score":0,"bottleneckRef":1},{"code":"5_TO_9","label":"5–9 lượt","score":20,"bottleneckRef":2},{"code":"10_TO_14","label":"10–14 lượt","score":40,"bottleneckRef":3},{"code":"15_TO_19","label":"15–19 lượt","score":60,"bottleneckRef":4},{"code":"20_PLUS","label":"Từ 20 lượt trở lên","score":80,"bottleneckRef":5},{"code":"20_PLUS_ATTACKING","label":"Từ 20 lượt trở lên và thường chủ động kết thúc pha cầu bằng tấn công","score":100,"bottleneckRef":6}]},{"id":"stamina","type":"CHOICE","group":"P","text":"Trong một buổi chơi, bạn duy trì được chất lượng đánh như thế nào?","options":[{"code":"UNDER_20M","label":"Hụt hơi trước 20 phút","score":0,"bottleneckRef":2},{"code":"20_TO_40M","label":"Trụ được 20–40 phút","score":25,"bottleneckRef":3},{"code":"ONE_HOUR_FADES_GAME_3","label":"Đánh khoảng 1 giờ nhưng tụt sức ở ván 3","score":50,"bottleneckRef":4},{"code":"THREE_GAMES","label":"Giữ phong độ qua cả 3 ván","score":75,"bottleneckRef":5},{"code":"MULTIPLE_MATCHES","label":"Đánh nhiều trận liên tục trong buổi mà vẫn giữ chất lượng","score":100,"bottleneckRef":6}]},{"id":"tournamentAchievement","type":"CHOICE","group":"A","text":"Thành tích thi đấu cao nhất bạn từng đạt được là gì?","description":"Chỉ tính khi đạt giải Nhất, Nhì hoặc Ba.","options":[{"code":"NONE","label":"Chưa từng đạt giải","score":0},{"code":"INTERNAL","label":"Đạt giải nội bộ CLB/công ty/trường","score":25},{"code":"DISTRICT_OR_STUDENT","label":"Đạt giải cấp quận/huyện hoặc giải sinh viên","score":50},{"code":"PROVINCIAL_MEDAL","label":"Đạt huy chương giải cấp tỉnh/thành phố","score":75},{"code":"NATIONAL_OR_PRO","label":"Đạt giải cấp quốc gia hoặc thi đấu chuyên nghiệp","score":100}]}],"weights":{"K":0.4,"R":0.2,"X":0.15,"P":0.1,"A":0.1,"T":0.05},"experienceMix":{"years":0.7,"frequency":0.3},"returningPenalty":15,"bands":[{"levelCode":"BEGINNER","minScore":0},{"levelCode":"WEAK","minScore":15},{"levelCode":"AVERAGE_MINUS","minScore":30},{"levelCode":"AVERAGE","minScore":45},{"levelCode":"AVERAGE_PLUS","minScore":60},{"levelCode":"GOOD","minScore":70},{"levelCode":"EXCELLENT","minScore":80}]}$json$::jsonb, 'Version 1 — matrix §1.2 (2026-11-15)', now())
ON CONFLICT ("version") DO NOTHING;
