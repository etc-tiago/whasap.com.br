ALTER TABLE "fluxo_autenticacao" ADD COLUMN "link_magico" uuid;--> statement-breakpoint
ALTER TABLE "fluxo_autenticacao" ADD COLUMN "link_magico_expira_em" timestamp;--> statement-breakpoint
ALTER TABLE "fluxo_autenticacao" ADD COLUMN "link_magico_usado_em" timestamp;--> statement-breakpoint
ALTER TABLE "fluxo_autenticacao" ADD CONSTRAINT "fluxo_autenticacao_linkMagico_unique" UNIQUE("link_magico");