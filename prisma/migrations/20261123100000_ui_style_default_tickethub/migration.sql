-- New users (internal and supplier) start with the "tickethub" interface style.
-- Existing users keep the style they have.
ALTER TABLE "User" ALTER COLUMN "uiStyle" SET DEFAULT 'tickethub';
ALTER TABLE "SupplierUser" ALTER COLUMN "uiStyle" SET DEFAULT 'tickethub';
