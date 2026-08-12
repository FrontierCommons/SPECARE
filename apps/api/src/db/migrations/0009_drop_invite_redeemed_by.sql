ALTER TABLE "invites" DROP CONSTRAINT IF EXISTS "invites_redeemed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invites" DROP COLUMN IF EXISTS "redeemed_by";