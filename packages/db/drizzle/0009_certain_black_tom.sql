CREATE TABLE "campanha_envio" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"instancia_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"nome_destinatario" text,
	"telefone" text NOT NULL,
	"corpo" text,
	"template_nome" text,
	"template_idioma" text,
	"template_variaveis" jsonb,
	"status" text NOT NULL,
	"erro_mensagem" text,
	"conversa_uuid" uuid,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "campanha_envio_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "campanha_template_memorizado" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"instancia_id" integer,
	"nome" text NOT NULL,
	"template_nome" text NOT NULL,
	"template_idioma" text NOT NULL,
	"variaveis" jsonb,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "campanha_template_memorizado_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "campanha_habilitada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "campanha_limite_por_minuto" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "campanha_limite_por_hora" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "campanha_alerta_consecutivos" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "campanha_envio" ADD CONSTRAINT "campanha_envio_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanha_envio" ADD CONSTRAINT "campanha_envio_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanha_envio" ADD CONSTRAINT "campanha_envio_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanha_template_memorizado" ADD CONSTRAINT "campanha_template_memorizado_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanha_template_memorizado" ADD CONSTRAINT "campanha_template_memorizado_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanha_envio_organizacao_criado_em_idx" ON "campanha_envio" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE INDEX "campanha_envio_telefone_idx" ON "campanha_envio" USING btree ("telefone");--> statement-breakpoint
CREATE INDEX "campanha_envio_instancia_id_idx" ON "campanha_envio" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "campanha_envio_usuario_id_idx" ON "campanha_envio" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "campanha_template_memorizado_organizacao_id_idx" ON "campanha_template_memorizado" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "campanha_template_memorizado_instancia_id_idx" ON "campanha_template_memorizado" USING btree ("instancia_id");