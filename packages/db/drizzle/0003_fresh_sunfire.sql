ALTER TABLE "instancia_evo" ADD COLUMN "historico_sync_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "instancia_evo" ADD COLUMN "historico_sync_progress" integer;--> statement-breakpoint
ALTER TABLE "instancia_evo" ADD COLUMN "historico_sync_erro" text;