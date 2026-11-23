-- Permission to revoke an award from the monitor (administrators always can).
ALTER TABLE "User" ADD COLUMN "canRevokeAward" BOOLEAN NOT NULL DEFAULT false;
