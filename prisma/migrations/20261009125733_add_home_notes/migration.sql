-- CreateEnum
CREATE TYPE "NoteScope" AS ENUM ('PRIVATE', 'TARGETED', 'ALL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canNoteAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canNoteOwn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canNoteTargeted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 3,
    "scope" "NoteScope" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTarget" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NoteTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_clientId_idx" ON "Note"("clientId");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTarget_noteId_userId_key" ON "NoteTarget"("noteId", "userId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTarget" ADD CONSTRAINT "NoteTarget_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTarget" ADD CONSTRAINT "NoteTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
