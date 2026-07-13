/**
 * Helpers de JID usados no HistorySync e ingestao.
 */
import { describe, expect, it } from "vitest";

import {
  jidParaIdExterno,
  jidParaTelefone,
  montarJidContato,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  telefoneExibicaoDeInfo,
} from "./webhook-go";

describe("jidParaTelefone", () => {
  it("1) DM @s.whatsapp.net extrai digitos", () => {
    expect(jidParaTelefone("5511999999999@s.whatsapp.net")).toBe("5511999999999");
  });

  it("2) grupo @g.us preserva id numerico", () => {
    expect(jidParaTelefone("120363123456789012@g.us")).toBe("120363123456789012");
  });

  it("3) @lid extrai parte antes do @", () => {
    expect(jidParaTelefone("999888777@lid")).toBe("999888777");
  });

  it("4) jid sem @ retorna digitos", () => {
    expect(jidParaTelefone("5511888")).toBe("5511888");
  });
});

describe("jidParaIdExterno / montarJidContato", () => {
  it("5) idExterno e o jid completo", () => {
    expect(jidParaIdExterno("5511@s.whatsapp.net")).toBe("5511@s.whatsapp.net");
  });

  it("6) montarJidContato com idExterno @ usa direto", () => {
    expect(montarJidContato("5511", "5511999@s.whatsapp.net")).toBe("5511999@s.whatsapp.net");
  });

  it("7) montarJidContato telefone normal vira s.whatsapp.net", () => {
    expect(montarJidContato("5511999999999", null)).toBe("5511999999999@s.whatsapp.net");
  });

  it("8) montarJidContato grupo por idExterno g.us", () => {
    expect(montarJidContato("", "120363@g.us")).toBe("120363@g.us");
  });

  it("9) montarJidContato telefone longo vira grupo", () => {
    expect(montarJidContato("120363123456789012", null)).toBe("120363123456789012@g.us");
  });
});

describe("resolverIdExternoCanonicoGo", () => {
  it("10) prefere SenderAlt @s.whatsapp.net", () => {
    expect(
      resolverIdExternoCanonicoGo({
        SenderAlt: "5511999@s.whatsapp.net",
        Chat: "111@lid",
        Sender: "111@lid",
      }),
    ).toBe("5511999@s.whatsapp.net");
  });

  it("11) RecipientAlt como fallback", () => {
    expect(
      resolverIdExternoCanonicoGo({
        RecipientAlt: "5511888@s.whatsapp.net",
        Chat: "222@lid",
      }),
    ).toBe("5511888@s.whatsapp.net");
  });

  it("12) sem Alt usa Chat", () => {
    expect(resolverIdExternoCanonicoGo({ Chat: "5511777@s.whatsapp.net" })).toBe(
      "5511777@s.whatsapp.net",
    );
  });

  it("13) sem Chat usa Sender", () => {
    expect(resolverIdExternoCanonicoGo({ Sender: "5511666@s.whatsapp.net" })).toBe(
      "5511666@s.whatsapp.net",
    );
  });
});

describe("telefoneExibicaoDeInfo", () => {
  it("14) Alt @s.whatsapp.net vira telefone", () => {
    expect(telefoneExibicaoDeInfo({ SenderAlt: "5511999@s.whatsapp.net" })).toBe("5511999");
  });

  it("15) Chat @s.whatsapp.net vira telefone", () => {
    expect(telefoneExibicaoDeInfo({ Chat: "5511888@s.whatsapp.net" })).toBe("5511888");
  });

  it("16) so @lid retorna null", () => {
    expect(telefoneExibicaoDeInfo({ Chat: "111@lid" })).toBeNull();
  });
});

describe("resolverInstanciaWebhookGo", () => {
  it("17) instanceName do payload", () => {
    expect(resolverInstanciaWebhookGo({ instanceName: "whasap-abc" }).instanceName).toBe(
      "whasap-abc",
    );
  });

  it("18) fallback instance", () => {
    expect(resolverInstanciaWebhookGo({ instance: "inst-1" }).instanceName).toBe("inst-1");
  });

  it("19) instanceId separado", () => {
    expect(resolverInstanciaWebhookGo({ instanceName: "x", instanceId: "uuid-1" }).instanceId).toBe(
      "uuid-1",
    );
  });
});

describe("jidDeContato (labels)", () => {
  it("20) telefone + idExterno @s.whatsapp.net", async () => {
    const { jidDeContato } = await import("./labels");
    expect(jidDeContato("5511999999999", "5511999@s.whatsapp.net")).toBe("5511999@s.whatsapp.net");
  });

  it("21) so telefone monta s.whatsapp.net", async () => {
    const { jidDeContato } = await import("./labels");
    expect(jidDeContato("5511888888888", null)).toBe("5511888888888@s.whatsapp.net");
  });

  it("22) idExterno grupo @g.us", async () => {
    const { jidDeContato } = await import("./labels");
    expect(jidDeContato("", "120363@g.us")).toBe("120363@g.us");
  });
});
