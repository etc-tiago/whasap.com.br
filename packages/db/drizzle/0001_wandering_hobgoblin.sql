ALTER TABLE "instancia" ADD COLUMN "desconectado_em" timestamp;--> statement-breakpoint
CREATE INDEX "instancia_provedor_status_idx" ON "instancia" USING btree ("provedor","status");