DROP INDEX "mensagem_conversa_criado_em_idx";--> statement-breakpoint
DROP INDEX "mensagem_conversa_direcao_criado_em_idx";--> statement-breakpoint
DROP INDEX "mensagem_enviado_por_usuario_direcao_criado_em_idx";--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "enviado_em" timestamp NOT NULL;--> statement-breakpoint
CREATE INDEX "mensagem_conversa_enviado_em_idx" ON "mensagem" USING btree ("conversa_id","enviado_em");--> statement-breakpoint
CREATE INDEX "mensagem_conversa_direcao_enviado_em_idx" ON "mensagem" USING btree ("conversa_id","direcao","enviado_em");--> statement-breakpoint
CREATE INDEX "mensagem_enviado_por_usuario_direcao_enviado_em_idx" ON "mensagem" USING btree ("enviado_por_usuario_id","direcao","enviado_em");