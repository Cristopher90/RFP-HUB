-- Enum value additions only, kept in their own migration: Postgres will
-- not let a value be used in the same transaction that adds it, so the
-- lockRoles backfill (which only reads/writes existing values) lives in
-- the next migration instead.
ALTER TYPE "UserRole" ADD VALUE 'APPROVER';
ALTER TYPE "QuestionType" ADD VALUE 'INFO';
