CREATE TYPE "public"."papel_membro" AS ENUM('admin', 'usuario', 'analista');--> statement-breakpoint
CREATE TYPE "public"."tipo_fluxo_autenticacao" AS ENUM('entrar', 'cadastrar');--> statement-breakpoint
CREATE TYPE "public"."instancia_provedor" AS ENUM('evo', 'meta_cloud');--> statement-breakpoint
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
CREATE TABLE "fluxo_autenticacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" uuid NOT NULL,
	"email" text NOT NULL,
	"tipo" "tipo_fluxo_autenticacao" NOT NULL,
	"pedidos_otp" integer DEFAULT 0 NOT NULL,
	"tentativas_otp_invalidas" integer DEFAULT 0 NOT NULL,
	"bloqueado_em" timestamp,
	"link_magico" uuid,
	"link_magico_expira_em" timestamp,
	"link_magico_usado_em" timestamp,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "fluxo_autenticacao_hash_unique" UNIQUE("hash"),
	CONSTRAINT "fluxo_autenticacao_linkMagico_unique" UNIQUE("link_magico")
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
	"demonstracao_inicia_em" timestamp,
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
	"tentativas_provisionamento" integer DEFAULT 0 NOT NULL,
	"conectado_em" timestamp,
	"trial_termina_em" timestamp,
	"desativado_em" timestamp,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "instancia_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "instancia_asaasIdAssinatura_unique" UNIQUE("asaas_id_assinatura")
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
CREATE TABLE "instancia_evo" (
	"id" serial PRIMARY KEY NOT NULL,
	"instancia_id" integer NOT NULL,
	"nome_instancia" text,
	"instance_id" text,
	"token" text,
	"historico_sincronizado_em" timestamp,
	"historico_sincronizando_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "instancia_evo_nomeInstancia_unique" UNIQUE("nome_instancia"),
	CONSTRAINT "instancia_evo_instanceId_unique" UNIQUE("instance_id"),
	CONSTRAINT "instancia_evo_instanciaId_unique" UNIQUE("instancia_id")
);
--> statement-breakpoint
CREATE TABLE "instancia_meta_cloud" (
	"id" serial PRIMARY KEY NOT NULL,
	"instancia_id" integer NOT NULL,
	"phone_number_id" text,
	"waba_id" text,
	"access_token" text,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "instancia_meta_cloud_phoneNumberId_unique" UNIQUE("phone_number_id"),
	CONSTRAINT "instancia_meta_cloud_instanciaId_unique" UNIQUE("instancia_id")
);
--> statement-breakpoint
CREATE TABLE "contato" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"id_externo" text NOT NULL,
	"telefone" text,
	"nome" text,
	"excluido_em" timestamp,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "contato_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "contato_organizacaoId_idExterno_unique" UNIQUE("organizacao_id","id_externo")
);
--> statement-breakpoint
CREATE TABLE "contato_instancia" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"instancia_id" integer NOT NULL,
	"id_externo" text NOT NULL,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "contato_instancia_instanciaId_idExterno_unique" UNIQUE("instancia_id","id_externo"),
	CONSTRAINT "contato_instancia_contatoId_instanciaId_unique" UNIQUE("contato_id","instancia_id")
);
--> statement-breakpoint
CREATE TABLE "contato_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" integer NOT NULL,
	"nome" text NOT NULL,
	"cor" text,
	"id_externo" text,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "contato_tag_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "contato_tag_org_id_externo_unique" UNIQUE("organizacao_id","id_externo")
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
	"meta_cloud_janela_expira_em" timestamp,
	"ultima_mensagem_em" timestamp,
	"nao_lidas" integer DEFAULT 0 NOT NULL,
	"ultima_leitura_em" timestamp,
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
ALTER TABLE "instancia_evo" ADD CONSTRAINT "instancia_evo_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instancia_meta_cloud" ADD CONSTRAINT "instancia_meta_cloud_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_organizacao_id_organizacao_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_instancia" ADD CONSTRAINT "contato_instancia_contato_id_contato_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."contato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_instancia" ADD CONSTRAINT "contato_instancia_instancia_id_instancia_id_fk" FOREIGN KEY ("instancia_id") REFERENCES "public"."instancia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "fluxo_autenticacao_email_idx" ON "fluxo_autenticacao" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessao_usuario_id_idx" ON "sessao" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "office_sessao_usuario_id_idx" ON "office_sessao" USING btree ("office_usuario_id");--> statement-breakpoint
CREATE INDEX "organizacao_convite_organizacao_id_idx" ON "organizacao_convite" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "organizacao_membro_usuario_id_idx" ON "organizacao_membro" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "instancia_organizacao_id_idx" ON "instancia" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "instancia_addon_instancia_id_idx" ON "instancia_addon" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "instancia_evo_instancia_id_idx" ON "instancia_evo" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "instancia_evo_nome_instancia_idx" ON "instancia_evo" USING btree ("nome_instancia");--> statement-breakpoint
CREATE INDEX "instancia_meta_cloud_instancia_id_idx" ON "instancia_meta_cloud" USING btree ("instancia_id");--> statement-breakpoint
CREATE INDEX "instancia_meta_cloud_phone_number_id_idx" ON "instancia_meta_cloud" USING btree ("phone_number_id");--> statement-breakpoint
CREATE INDEX "contato_organizacao_id_idx" ON "contato" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "contato_instancia_contato_id_idx" ON "contato_instancia" USING btree ("contato_id");--> statement-breakpoint
CREATE INDEX "contato_instancia_instancia_id_idx" ON "contato_instancia" USING btree ("instancia_id");--> statement-breakpoint
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