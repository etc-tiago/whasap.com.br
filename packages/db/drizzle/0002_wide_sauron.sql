ALTER TABLE "instancia" ALTER COLUMN "limite_conversas" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "asaas_id_assinatura_base" text;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "limite_conversas" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "instancia" ADD COLUMN "icone" text DEFAULT 'MessageCircle' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizacao" ADD CONSTRAINT "organizacao_asaasIdAssinaturaBase_unique" UNIQUE("asaas_id_assinatura_base");