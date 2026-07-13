CREATE TABLE "resposta_rapida_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"resposta_rapida_id" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"tipo" text NOT NULL,
	"corpo" text,
	"midia_r_2_chave" text,
	"nome_arquivo" text,
	"criado_em" timestamp NOT NULL,
	CONSTRAINT "resposta_rapida_item_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
ALTER TABLE "resposta_rapida" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "resposta_rapida" ADD COLUMN "excluido_em" timestamp;--> statement-breakpoint
ALTER TABLE "resposta_rapida" ADD COLUMN "atualizado_em" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "resposta_rapida_item" ADD CONSTRAINT "resposta_rapida_item_resposta_rapida_id_resposta_rapida_id_fk" FOREIGN KEY ("resposta_rapida_id") REFERENCES "public"."resposta_rapida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resposta_rapida_item_resposta_rapida_id_idx" ON "resposta_rapida_item" USING btree ("resposta_rapida_id");--> statement-breakpoint
ALTER TABLE "resposta_rapida" DROP COLUMN "corpo";--> statement-breakpoint
ALTER TABLE "resposta_rapida" ADD CONSTRAINT "resposta_rapida_uuid_unique" UNIQUE("uuid");