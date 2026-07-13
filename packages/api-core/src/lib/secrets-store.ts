/** Binding Cloudflare Secrets Store ou string em `.dev.vars`. */
export type SecretsStoreSecretBinding = {
  get(): Promise<string>;
};
