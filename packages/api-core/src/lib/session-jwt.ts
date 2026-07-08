import { SignJWT, jwtVerify } from "jose";

export type SessionJwtAudience = "web" | "office";

const ISSUER = "whasap";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Emite JWT de sessão com `jti` = token opaco da tabela `sessao`. */
export async function emitirJwtSessao(input: {
  token: string;
  expiraEm: Date;
  audience: SessionJwtAudience;
  secret: string;
}): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setJti(input.token)
    .setIssuer(ISSUER)
    .setAudience(input.audience)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiraEm.getTime() / 1000))
    .sign(secretKey(input.secret));
}

/**
 * Verifica assinatura, expiração e audience do JWT de sessão.
 * @returns Token opaco (`jti`) ou null se inválido.
 */
export async function verificarJwtSessao(
  jwt: string,
  input: { secret: string; audience: SessionJwtAudience },
): Promise<{ token: string } | null> {
  try {
    const { payload } = await jwtVerify(jwt, secretKey(input.secret), {
      issuer: ISSUER,
      audience: input.audience,
    });
    const token = payload.jti;
    if (!token || typeof token !== "string") {
      return null;
    }
    return { token };
  } catch {
    return null;
  }
}
