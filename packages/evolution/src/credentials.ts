import { z } from "zod";

export const evolutionCredentialsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export type EvolutionCredentials = z.infer<typeof evolutionCredentialsSchema>;

export function evolutionSecretName(organizationId: string, instanceId: string): string {
  return `evolution/${organizationId}/${instanceId}`;
}

export function parseEvolutionCredentials(raw: string): EvolutionCredentials {
  return evolutionCredentialsSchema.parse(JSON.parse(raw));
}
