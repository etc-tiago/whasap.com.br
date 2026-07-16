DROP INDEX "mensagem_id_externo_idx";--> statement-breakpoint
ALTER TABLE "conversa" ADD COLUMN "ultima_mensagem_corpo" text;--> statement-breakpoint
ALTER TABLE "conversa" ADD COLUMN "ultima_mensagem_tipo" text;--> statement-breakpoint
CREATE UNIQUE INDEX "mensagem_id_externo_unique" ON "mensagem" USING btree ("id_externo") WHERE "mensagem"."id_externo" IS NOT NULL AND "mensagem"."excluido_em" IS NULL;