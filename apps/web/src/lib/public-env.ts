const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export function getTurnstileSiteKey(): string | undefined {
  return (
    import.meta.env.VITE_TURNSTILE_SITE_KEY ??
    (import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : undefined)
  );
}
