ALTER TABLE "contato_tag" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "contato_tag" ADD CONSTRAINT "contato_tag_uuid_unique" UNIQUE("uuid");