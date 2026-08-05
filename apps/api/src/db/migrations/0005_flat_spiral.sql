ALTER TABLE "circle_notifications" DROP CONSTRAINT "circle_notifications_target_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invites" DROP CONSTRAINT "invites_redeemed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "touchpoint_logs" DROP CONSTRAINT "touchpoint_logs_responder_id_users_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "circle_notifications" ADD CONSTRAINT "circle_notifications_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invites" ADD CONSTRAINT "invites_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "touchpoint_logs" ADD CONSTRAINT "touchpoint_logs_responder_id_users_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
