ALTER TABLE "instancia_addon" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "asaas_webhook_registro" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "instancia_addon" CASCADE;--> statement-breakpoint
DROP TABLE "asaas_webhook_registro" CASCADE;--> statement-breakpoint
ALTER TABLE "organizacao" DROP CONSTRAINT "organizacao_asaasIdCliente_unique";--> statement-breakpoint
ALTER TABLE "organizacao" DROP CONSTRAINT "organizacao_asaasIdAssinaturaBase_unique";--> statement-breakpoint
ALTER TABLE "instancia" DROP CONSTRAINT "instancia_asaasIdAssinatura_unique";--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "telefone_whatsapp" text;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "aceite_adesao_em" timestamp;--> statement-breakpoint
ALTER TABLE "organizacao" ADD COLUMN "aceite_adesao_versao" text;--> statement-breakpoint
ALTER TABLE "organizacao" DROP COLUMN "asaas_id_cliente";--> statement-breakpoint
ALTER TABLE "organizacao" DROP COLUMN "asaas_id_assinatura_base";--> statement-breakpoint
ALTER TABLE "organizacao" DROP COLUMN "demonstracao_inicia_em";--> statement-breakpoint
ALTER TABLE "instancia" DROP COLUMN "asaas_id_assinatura";--> statement-breakpoint
ALTER TABLE "instancia" DROP COLUMN "trial_termina_em";