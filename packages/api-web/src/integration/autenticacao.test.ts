import { describe, expect, it, afterEach } from "vitest";

import { SESSION_COOKIE } from "../lib/session";
import {
  buscarUltimoOtp,
  createTestOrpcClient,
  createTestWebEnv,
  emailTesteUnico,
  limparDadosTeste,
  rpcRaw,
} from "@whasap/api-web/test";

const emailsCriados: string[] = [];

function rastrearEmail(email: string) {
  emailsCriados.push(email);
  return email;
}

afterEach(async () => {
  while (emailsCriados.length > 0) {
    const email = emailsCriados.pop();
    if (email) await limparDadosTeste(email);
  }
});

describe("autenticacao — fluxo clássico", () => {
  it("cadastro completo emite cookie JWT e autenticacao.eu retorna usuário", async () => {
    const env = createTestWebEnv();
    const { client, cookieJar } = createTestOrpcClient(env);
    const email = rastrearEmail(emailTesteUnico());
    const nome = "Usuário Teste";

    await client.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
    const otp = await buscarUltimoOtp(email, "signup");

    await client.autenticacao.cadastrar({
      email,
      nome,
      otp,
      lgpdConsent: true,
    });

    expect(cookieJar.hasSessionCookie()).toBe(true);

    const sessao = await client.autenticacao.eu();
    expect(sessao.usuario.email).toBe(email);
    expect(sessao.usuario.nome).toBe(nome);
    expect(sessao.organizacao).toBeNull();
  });

  it("login de conta existente", async () => {
    const env = createTestWebEnv();
    const { client } = createTestOrpcClient(env);
    const email = rastrearEmail(emailTesteUnico());
    const nome = "Usuário Login";

    await client.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
    const otpCadastro = await buscarUltimoOtp(email, "signup");
    await client.autenticacao.cadastrar({
      email,
      nome,
      otp: otpCadastro,
      lgpdConsent: true,
    });

    const { client: clientLogin, cookieJar } = createTestOrpcClient(env);
    await clientLogin.autenticacao.enviarOtp({ email, proposito: "entrar" });
    const otpLogin = await buscarUltimoOtp(email, "login");

    await clientLogin.autenticacao.entrar({ email, otp: otpLogin });

    expect(cookieJar.hasSessionCookie()).toBe(true);

    const sessao = await clientLogin.autenticacao.eu();
    expect(sessao.usuario.email).toBe(email);
  });
});

describe("autenticacao — regressão JWT secret", () => {
  it("com WEB_SESSION_JWT_SECRET string o login funciona", async () => {
    const env = createTestWebEnv({ WEB_SESSION_JWT_SECRET: "outro-secret-valido" });
    const { client, cookieJar } = createTestOrpcClient(env);
    const email = rastrearEmail(emailTesteUnico());

    await client.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
    const otp = await buscarUltimoOtp(email, "signup");
    await client.autenticacao.cadastrar({
      email,
      nome: "JWT OK",
      otp,
      lgpdConsent: true,
    });

    expect(cookieJar.hasSessionCookie()).toBe(true);
    await expect(client.autenticacao.eu()).resolves.toMatchObject({
      usuario: { email },
    });
  });

  it("sem WEB_SESSION_JWT_SECRET handleRpc falha", async () => {
    const env = createTestWebEnv();
    const { WEB_SESSION_JWT_SECRET: _, ...envSemSecret } = env;

    await expect(
      rpcRaw(envSemSecret as typeof env, "/autenticacao/iniciarFluxo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "qualquer@whasap.test" }),
      }),
    ).rejects.toThrow(/WEB_SESSION_JWT_SECRET/);
  });

  it("autenticacao.eu sem cookie retorna 401", async () => {
    const env = createTestWebEnv();
    const { client } = createTestOrpcClient(env);

    await expect(client.autenticacao.eu()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("autenticacao — fluxo wizard", () => {
  it("cadastro via iniciarFluxo → cadastrarFluxo", async () => {
    const env = createTestWebEnv();
    const { client, cookieJar } = createTestOrpcClient(env);
    const email = rastrearEmail(emailTesteUnico());

    const inicio = await client.autenticacao.iniciarFluxo({ email });
    expect(inicio.tipo).toBe("cadastrar");
    expect(inicio.hash).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    await client.autenticacao.enviarOtpFluxo({ hash: inicio.hash });
    const otp = await buscarUltimoOtp(email, "signup");

    await client.autenticacao.cadastrarFluxo({
      hash: inicio.hash,
      otp,
      lgpdConsent: true,
    });

    expect(cookieJar.hasSessionCookie()).toBe(true);

    const sessao = await client.autenticacao.eu();
    expect(sessao.usuario.email).toBe(email);
    expect(sessao.organizacao).toBeNull();
  });

  it("login via iniciarFluxo → entrarFluxo", async () => {
    const env = createTestWebEnv();
    const email = rastrearEmail(emailTesteUnico());

    const { client: cadastro } = createTestOrpcClient(env);
    await cadastro.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
    const otpCadastro = await buscarUltimoOtp(email, "signup");
    await cadastro.autenticacao.cadastrar({
      email,
      nome: "Conta Wizard",
      otp: otpCadastro,
      lgpdConsent: true,
    });

    const { client: login, cookieJar } = createTestOrpcClient(env);
    const inicio = await login.autenticacao.iniciarFluxo({ email });
    expect(inicio.tipo).toBe("entrar");

    await login.autenticacao.enviarOtpFluxo({ hash: inicio.hash });
    const otpLogin = await buscarUltimoOtp(email, "login");

    await login.autenticacao.entrarFluxo({ hash: inicio.hash, otp: otpLogin });

    expect(cookieJar.hasSessionCookie()).toBe(true);

    const sessao = await login.autenticacao.eu();
    expect(sessao.usuario.email).toBe(email);
  });
});

describe("autenticacao — cookie", () => {
  it("Set-Cookie usa nome whasap_web", async () => {
    const env = createTestWebEnv();
    const { client, cookieJar } = createTestOrpcClient(env);
    const email = rastrearEmail(emailTesteUnico());

    await client.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
    const otp = await buscarUltimoOtp(email, "signup");

    await client.autenticacao.cadastrar({
      email,
      nome: "Cookie Test",
      otp,
      lgpdConsent: true,
    });

    expect(cookieJar.hasSessionCookie()).toBe(true);
    expect(cookieJar.header()).toContain(`${SESSION_COOKIE}=`);
  });
});
