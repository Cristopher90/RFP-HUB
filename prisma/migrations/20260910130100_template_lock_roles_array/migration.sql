-- TemplateItem.lockMinRole (single "minimum role" threshold) becomes
-- lockRoles (explicit set of roles allowed to edit/remove it). Backfill
-- each existing threshold to the equivalent explicit set so current
-- templates keep behaving the same way.
ALTER TABLE "TemplateItem" ADD COLUMN "lockRoles" "UserRole"[] NOT NULL DEFAULT '{}';
UPDATE "TemplateItem" SET "lockRoles" = CASE "lockMinRole"
  WHEN 'BUYER' THEN ARRAY['BUYER','SENIOR_BUYER','CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'SENIOR_BUYER' THEN ARRAY['SENIOR_BUYER','CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'CLIENT_ADMIN' THEN ARRAY['CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'ADMIN' THEN ARRAY['ADMIN']::"UserRole"[]
  ELSE '{}'::"UserRole"[]
END;
ALTER TABLE "TemplateItem" DROP COLUMN "lockMinRole";

ALTER TABLE "TemplateQuestion" ADD COLUMN "lockRoles" "UserRole"[] NOT NULL DEFAULT '{}';
UPDATE "TemplateQuestion" SET "lockRoles" = CASE "lockMinRole"
  WHEN 'BUYER' THEN ARRAY['BUYER','SENIOR_BUYER','CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'SENIOR_BUYER' THEN ARRAY['SENIOR_BUYER','CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'CLIENT_ADMIN' THEN ARRAY['CLIENT_ADMIN','ADMIN']::"UserRole"[]
  WHEN 'ADMIN' THEN ARRAY['ADMIN']::"UserRole"[]
  ELSE '{}'::"UserRole"[]
END;
ALTER TABLE "TemplateQuestion" DROP COLUMN "lockMinRole";
