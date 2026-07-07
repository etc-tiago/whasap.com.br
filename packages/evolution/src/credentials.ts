import { z } from "zod";

export const evolutionCredentialsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export type EvolutionCredentials = z.infer<typeof evolutionCredentialsSchema>;

/** Contexto por instância Evolution GO (token retornado em `/instance/create`). */
export type EvolutionGoInstanceContext = {
  instanceToken: string;
};

export function parseEvolutionCredentials(raw: string): EvolutionCredentials {
  return evolutionCredentialsSchema.parse(JSON.parse(raw));
}
