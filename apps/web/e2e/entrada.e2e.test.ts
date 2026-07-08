import { chromium, type Browser, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

import { E2E_APP_URL } from "./constants";
import {
  buscarUltimoOtp,
  createTestOrpcClient,
  createTestWebEnv,
  limparDadosTeste,
} from "@whasap/api-web/test";

const SESSION_COOKIE = "whasap_web";
const emailsCriados: string[] = [];

let browser: Browser;
let page: Page;

function emailTesteUnico(): string {
  return `test+${crypto.randomUUID()}@whasap.test`;
}

function rastrearEmail(email: string) {
  emailsCriados.push(email);
  return email;
}

async function criarUsuarioCadastro(email: string, nome = "Usuário E2E") {
  const env = createTestWebEnv();
  const { client } = createTestOrpcClient(env);
  await client.autenticacao.enviarOtp({ email, proposito: "cadastrar" });
  const otp = await buscarUltimoOtp(email, "signup");
  await client.autenticacao.cadastrar({
    email,
    nome,
    otp,
    lgpdConsent: true,
  });
}

async function preencherEmailContinuar(email: string) {
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByRole("button", { name: /continuar/i }).click();
}

async function buscarOtpComRetry(email: string, finalidade: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      return await buscarUltimoOtp(email, finalidade);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`OTP não encontrado para ${email} (${finalidade})`);
}

async function aceitarTermosCadastro() {
  await page.getByRole("heading", { name: "Criar sua conta" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /aceitar e continuar/i }).click();
}

async function preencherOtpESubmeter(otp: string) {
  await page.getByText("Verifique seu e-mail").waitFor({ state: "visible" });
  const firstDigit = page.locator('input[inputmode="numeric"]').first();
  await firstDigit.click();
  await page.keyboard.type(otp);
  await page.getByRole("button", { name: /verificar e entrar/i }).click();
}

async function aguardarCookieSessao() {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const cookies = await page.context().cookies();
    if (cookies.some((cookie) => cookie.name === SESSION_COOKIE && cookie.value)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Cookie ${SESSION_COOKIE} não encontrado após 5s`);
}

beforeAll(async () => {
  browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser?.close();
});

afterEach(async () => {
  while (emailsCriados.length > 0) {
    const email = emailsCriados.pop();
    if (email) await limparDadosTeste(email);
  }
});

describe("entrada wizard — E2E Playwright", () => {
  it("cadastro: e-mail → termos → OTP emite cookie whasap_web", async () => {
    const email = rastrearEmail(emailTesteUnico());

    await page.goto(`${E2E_APP_URL}/~/`);
    await preencherEmailContinuar(email);
    await aceitarTermosCadastro();

    const otp = await buscarOtpComRetry(email, "signup");
    await preencherOtpESubmeter(otp);
    await aguardarCookieSessao();
  });

  it("login: conta existente → OTP emite cookie whasap_web", async () => {
    const email = rastrearEmail(emailTesteUnico());
    await criarUsuarioCadastro(email, "Login E2E");

    await page.goto(`${E2E_APP_URL}/~/`);
    await preencherEmailContinuar(email);

    await page.getByText("Verifique seu e-mail").waitFor({ state: "visible" });

    const otp = await buscarOtpComRetry(email, "login");
    await preencherOtpESubmeter(otp);
    await aguardarCookieSessao();
  });
});
