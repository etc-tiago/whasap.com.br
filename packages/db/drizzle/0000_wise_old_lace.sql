CREATE TYPE "public"."papel_membro" AS ENUM('admin', 'usuario', 'analista');--> statement-breakpoint
CREATE TYPE "public"."instancia_provedor" AS ENUM('cloud_api', 'evolution');--> statement-breakpoint
CREATE TYPE "public"."instancia_status" AS ENUM('pending_connection', 'pending_payment', 'provisioning', 'disconnected', 'connected', 'deactivated');--> statement-breakpoint
CREATE TABLE "codigo_otp" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"codigo" text NOT NULL,
	"finalidade" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"usado_em" timestamp,
	"criado_em" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"organizacao_id" integer,
	"token" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "sessao_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"email_verificado_em" timestamp,
	"lgpd_consentido_em" timestamp,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "usuario_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "office_sessao" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_usuario_id" integer NOT NULL,
	"token" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "office_sessao_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "office_usuario" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "office_usuario_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "office_usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "organizacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"documento_fiscal" text,
	"tipo_documento" text,
	"razao_social" text,
	"asaas_id_cliente" text,
	"horas_auto_fechar_inatividade" text DEFAULT '72',
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "organizacao_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "organizacao_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizacao_asaasIdCliente_unique" UNIQUE("asaas_id_cliente")
);
--> statement-breakpoint
CREATE TABLE "organizacao_convite" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"email" text NOT NULL,
	"nome" text,
	"papel" "papel_membro" DEFAULT 'usuario' NOT NULL,
	"token" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"aceito_em" timestamp,
	"criado_por_usuario_id" integer,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "organizacao_convite_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "organizacao_convite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organizacao_membro" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"papel" "papel_membro" DEFAULT 'usuario' NOT NULL,
	"convidado_em" timestamp,
	"ingressou_em" timestamp NOT NULL,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "organizacao_membro_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "organizacao_membro_organizacaoId_usuarioId_unique" UNIQUE("organizacao_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "instancia" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"nome" text NOT NULL,
	"provedor" "instancia_provedor" NOT NULL,
	"status" "instancia_status" DEFAULT 'pending_connection' NOT NULL,
	"asaas_id_assinatura" text,
	"limite_conversas" integer DEFAULT 1000 NOT NULL,
	"evolucao_nome_instancia" text,
	"nuvem_id_numero_telefone" text,
	"nuvem_id_waba" text,
	"nuvem_token_acesso" text,
	"tentativas_provisionamento" integer DEFAULT 0 NOT NULL,
	"conectado_em" timestamp,
	"trial_termina_em" timestamp,
	"desativado_em" timestamp,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "instancia_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "instancia_asaasIdAssinatura_unique" UNIQUE("asaas_id_assinatura"),
	CONSTRAINT "instancia_evolucaoNomeInstancia_unique" UNIQUE("evolucao_nome_instancia"),
	CONSTRAINT "instancia_nuvemIdNumeroTelefone_unique" UNIQUE("nuvem_id_numero_telefone")
);
--> statement-breakpoint
CREATE TABLE "instancia_addon" (
	"id" serial PRIMARY KEY NOT NULL,
	"instancia_id" integer NOT NULL,
	"asaas_id_assinatura" text NOT NULL,
	"tamanho_pacote_conversas" integer DEFAULT 1000 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "instancia_addon_instanciaId_asaasIdAssinatura_unique" UNIQUE("instancia_id","asaas_id_assinatura")
);
--> statement-breakpoint
CREATE TABLE "contato" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"instancia_id" integer NOT NULL,
	"telefone" text NOT NULL,
	"nome" text,
	"id_externo" text,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "contato_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "contato_instanciaId_telefone_unique" UNIQUE("instancia_id","telefone")
);
--> statement-breakpoint
CREATE TABLE "contato_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizacao_id" integer NOT NULL,
	"nome" text NOT NULL,
	"cor" text,
	"criado_em" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contato_tag_atribuicao" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "contato_tag_atribuicao_contatoId_tagId_unique" UNIQUE("contato_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "conversa" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"instancia_id" integer NOT NULL,
	"contato_id" integer NOT NULL,
	"atribuido_usuario_id" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"nuvem_janela_expira_em" timestamp,
	"ultima_mensagem_em" timestamp,
	"fechado_em" timestamp,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "conversa_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "conversa_anotacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" integer NOT NULL,
	"autor_usuario_id" integer NOT NULL,
	"corpo" text NOT NULL,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "conversa_anotacao_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "mensagem" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" integer NOT NULL,
	"direcao" text NOT NULL,
	"tipo" text DEFAULT 'text' NOT NULL,
	"corpo" text,
	"midia_r_2_chave" text,
	"template_nome" text,
	"template_idioma" text,
	"template_variaveis" jsonb,
	"metadados" jsonb,
	"id_externo" text,
	"enviado_por_usuario_id" integer,
	"status" text DEFAULT 'sent' NOT NULL,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "mensagem_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "mensagem_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"instancia_id" integer NOT NULL,
	"nome" text NOT NULL,
	"idioma" text DEFAULT 'pt_BR' NOT NULL,
	"categoria" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"componentes" jsonb,
	"id_externo" text,
	"sincronizado_em" timestamp,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "mensagem_template_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "mensagem_template_instanciaId_nome_idioma_unique" UNIQUE("instancia_id","nome","idioma")
);
--> statement-breakpoint
CREATE TABLE "resposta_rapida" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizacao_id" integer NOT NULL,
	"titulo" text NOT NULL,
	"corpo" text NOT NULL,
	"criado_em" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uso_mensal" (
	"id" serial PRIMARY KEY NOT NULL,
	"instancia_id" integer NOT NULL,
	"ano_mes" text NOT NULL,
	"contatos_unicos_contagem" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "uso_mensal_instanciaId_anoMes_unique" UNIQUE("instancia_id","ano_mes")
);
--> statement-breakpoint
CREATE TABLE "uso_mensal_contato" (
	"id" serial PRIMARY KEY NOT NULL,
	"instancia_id" integer NOT NULL,
	"contato_id" integer NOT NULL,
	"ano_mes" text NOT NULL,
	"contado_em" timestamp NOT NULL,
	CONSTRAINT "uso_mensal_contato_instanciaId_contatoId_anoMes_unique" UNIQUE("instancia_id","contato_id","ano_mes")
);
--> statement-breakpoint
CREATE TABLE "asaas_webhook_registro" (
	"id" serial PRIMARY KEY NOT NULL,
	"asaas_id_evento" text NOT NULL,
	"tipo" text NOT NULL,
	"payload" text NOT NULL,
	"processado_em" timestamp,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "asaas_webhook_registro_asaasIdEvento_unique" UNIQUE("asaas_id_evento")
);
--> statement-breakpoint
CREATE TABLE "webhook_evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"origem" text NOT NULL,
	"id_evento" text,
	"payload" text NOT NULL,
	"processado_em" timestamp,
	"criado_em" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_sessao" ADD CONSTRAINT "office_sessao_office_usuario_id_office_usuario_id_fk" FOREIGN KEY ("office_usuario_id") REFERENCES "public"."office_usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizacao_convite" ADD CONSTRAINT "organizacao_convite_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizacao_convite" ADD CONSTRAINT "organizacao_convite_criado_por_usuario_id_usuario_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizacao_membro" ADD CONSTRAINT "organizacao_membro_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizacao_membro" ADD CONSTRAINT "organizacao_membro_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instancia" ADD CONSTRAINT "instancia_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instancia_addon" ADD CONSTRAINT "instancia_addon_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_tag" ADD CONSTRAINT "contato_tag_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_tag_atribuicao" ADD CONSTRAINT "contato_tag_atribuicao_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_tag_atribuicao" ADD CONSTRAINT "contato_tag_atribuicao_tag_id_contato_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."contato_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_atribuido_usuario_id_usuario_id_fk" FOREIGN KEY ("atribuido_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa_anotacao" ADD CONSTRAINT "conversa_anotacao_conversa_id_conversa_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa_anotacao" ADD CONSTRAINT "conversa_anotacao_autor_usuario_id_usuario_id_fk" FOREIGN KEY ("autor_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_conversa_id_conversa_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_enviado_por_usuario_id_usuario_id_fk" FOREIGN KEY ("enviado_por_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_template" ADD CONSTRAINT "mensagem_template_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resposta_rapida" ADD CONSTRAINT "resposta_rapida_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uso_mensal" ADD CONSTRAINT "uso_mensal_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uso_mensal_contato" ADD CONSTRAINT "uso_mensal_contato_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uso_mensal_contato" ADD CONSTRAINT "uso_mensal_contato_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codigo_otp_email_finalidade_criado_idx" ON "codigo_otp" USING btree ("email","finalidade","criado_em");--> statement-breakpoint
CREATE INDEX "codigo_otp_email_finalidade_codigo_idx" ON "codigo_otp" USING btree ("email","finalidade","codigo");--> statement-breakpoint
CREATE INDEX "sessao_usuario_id_idx" ON "sessao" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "office_sessao_usuario_id_idx" ON "office_sessao" USING btree ("office_usuario_id");--> statement-breakpoint
CREATE INDEX "organizacao_convite_organizacao_id_idx" ON "organizacao_convite" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "organizacao_membro_usuario_id_idx" ON "organizacao_membro" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "instancia_organizacao_id_idx" ON "instancia" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "instancia_addon_instancia_id_idx" ON "instancia_addon" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "contato_tag_organizacao_id_idx" ON "contato_tag" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "conversa_instancia_ultima_mensagem_idx" ON "conversa" USING btree ("instancia_id","ultima_mensagem_em");--> statement-breakpoint
CREATE INDEX "conversa_instancia_contato_status_idx" ON "conversa" USING btree ("instancia_id","contato_id","status");--> statement-breakpoint
CREATE INDEX "conversa_instancia_criado_em_idx" ON "conversa" USING btree ("instancia_id","criado_em");--> statement-breakpoint
CREATE INDEX "conversa_atribuido_usuario_id_idx" ON "conversa" USING btree ("atribuido_usuario_id");--> statement-breakpoint
CREATE INDEX "conversa_anotacao_conversa_id_idx" ON "conversa_anotacao" USING btree ("conversa_id");--> statement-breakpoint
CREATE INDEX "mensagem_conversa_criado_em_idx" ON "mensagem" USING btree ("conversa_id","criado_em");--> statement-breakpoint
CREATE INDEX "mensagem_conversa_direcao_criado_em_idx" ON "mensagem" USING btree ("conversa_id","direcao","criado_em");--> statement-breakpoint
CREATE INDEX "mensagem_id_externo_idx" ON "mensagem" USING btree ("id_externo");--> statement-breakpoint
CREATE INDEX "mensagem_enviado_por_usuario_direcao_criado_em_idx" ON "mensagem" USING btree ("enviado_por_usuario_id","direcao","criado_em");--> statement-breakpoint
CREATE INDEX "mensagem_template_instancia_id_idx" ON "mensagem_template" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "resposta_rapida_organizacao_id_idx" ON "resposta_rapida" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "webhook_evento_origem_criado_em_idx" ON "webhook_evento" USING btree ("origem","criado_em");--> statement-breakpoint
CREATE INDEX "webhook_evento_id_evento_idx" ON "webhook_evento" USING btree ("id_evento");