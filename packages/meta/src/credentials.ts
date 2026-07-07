import { z } from "zod";

export const metaCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
});

export type MetaCredentials = z.infer<typeof metaCredentialsSchema>;

export function parseMetaCredentials(raw: string): MetaCredentials {
  return metaCredentialsSchema.parse(JSON.parse(raw));
}
