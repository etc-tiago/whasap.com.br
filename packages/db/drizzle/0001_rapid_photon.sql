CREATE TYPE "public"."tipo_fluxo_autenticacao" AS ENUM('entrar', 'cadastrar');--> statement-breakpoint
CREATE TABLE "fluxo_autenticacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" uuid NOT NULL,
	"email" text NOT NULL,
	"tipo" "tipo_fluxo_autenticacao" NOT NULL,
	"pedidos_otp" integer DEFAULT 0 NOT NULL,
	"tentativas_otp_invalidas" integer DEFAULT 0 NOT NULL,
	"bloqueado_em" timestamp,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp NOT NULL,
	"atualizado_em" timestamp NOT NULL,
	CONSTRAINT "fluxo_autenticacao_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE INDEX "fluxo_autenticacao_email_idx" ON "fluxo_autenticacao" USING btree ("email");