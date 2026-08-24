-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Commodity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Commodity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Commodity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Commodity" ("code", "createdAt", "description", "id") SELECT "code", "createdAt", "description", "id" FROM "Commodity";
DROP TABLE "Commodity";
ALTER TABLE "new_Commodity" RENAME TO "Commodity";
CREATE UNIQUE INDEX "Commodity_code_key" ON "Commodity"("code");
CREATE TABLE "new_Region" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Region_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Region" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Region" ("code", "createdAt", "description", "id") SELECT "code", "createdAt", "description", "id" FROM "Region";
DROP TABLE "Region";
ALTER TABLE "new_Region" RENAME TO "Region";
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
