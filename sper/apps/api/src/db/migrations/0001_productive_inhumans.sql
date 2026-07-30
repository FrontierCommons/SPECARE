DO $$ BEGIN
 CREATE TYPE "public"."checkin_frequency" AS ENUM('once', 'twice', 'thrice');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "checkin_frequency" "checkin_frequency" DEFAULT 'twice' NOT NULL;