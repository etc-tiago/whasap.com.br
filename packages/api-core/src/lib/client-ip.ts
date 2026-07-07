export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    undefined
  );
}
