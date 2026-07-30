CREATE TABLE IF NOT EXISTS "care_gratitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkin_id" uuid NOT NULL,
	"responder_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "care_gratitudes" ADD CONSTRAINT "care_gratitudes_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "care_gratitudes" ADD CONSTRAINT "care_gratitudes_responder_id_users_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_gratitude_responder" ON "care_gratitudes" USING btree ("checkin_id","responder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gratitudes_checkin" ON "care_gratitudes" USING btree ("checkin_id");