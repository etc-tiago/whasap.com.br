import { describe, expect, it } from "vitest";

import {
  buscarFixtureWebhookGo,
  carregarFixturesWebhookGo,
} from "./fixtures/carregar-fixtures-webhook-go";
import {
  extrairFlowToken,
  parseInteractiveMessage,
  parseInteractiveResponseMessage,
  parseParamsJSON,
} from "./flow-parser";
import {
  deveIgnorarHistorySyncChunk,
  historySyncConcluido,
  jidParaTelefone,
  parseGoButtonClick,
  parseGoHistorySyncChunk,
  parseGoLabelAssociation,
  parseGoMessageEvent,
  parseGoPairSuccess,
  parseGoPushName,
  parseGoReceipt,
  receiptIndicaLeitura,
  resolverIdExternoCanonicoGo,
  resolverInstanciaWebhookGo,
  telefoneExibicaoDeInfo,
} from "./webhook-go";
import { parseGoDisconnectedEvent } from "./connection-state";

describe("webhook-go fixtures", () => {
  it("carrega fixtures de webhook evo", () => {
    const msg = buscarFixtureWebhookGo("message-inbound.json");
    expect(msg?.payload.event).toBe("Message");
  });
});

describe("resolverInstanciaWebhookGo", () => {
  it("usa instanceName do GO", () => {
    const fixture = buscarFixtureWebhookGo("message-inbound.json")!;
    const resolved = resolverInstanciaWebhookGo(fixture.payload as never);
    expect(resolved.instanceName).toBe("whasap-c330073d");
    expect(resolved.instanceId).toBeTruthy();
  });
});

describe("parseGoMessageEvent", () => {
  it("parseia todas as fixtures Message sem retornar null", () => {
    const messageFixtures = carregarFixturesWebhookGo().filter(
      (fixture) => fixture.payload.event === "Message",
    );

    expect(messageFixtures.length).toBeGreaterThanOrEqual(9);

    for (const fixture of messageFixtures) {
      const data = fixture.payload.data as Record<string, unknown>;
      const parsed = parseGoMessageEvent(data);
      expect(parsed, `fixture ${fixture.arquivo} deveria parsear`).not.toBeNull();
      expect(parsed!.body.length).toBeGreaterThan(0);
      expect(parsed!.type.length).toBeGreaterThan(0);
    }
  });

  it("parseia Message inbound", () => {
    const fixture = buscarFixtureWebhookGo("message-inbound.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const parsed = parseGoMessageEvent(data);
    expect(parsed).not.toBeNull();
    expect(parsed!.fromMe).toBe(false);
    expect(parsed!.messageId).toBe("3AA188695720E8FC630F");
    expect(parsed!.body.length).toBeGreaterThan(0);
  });

  it("parseia SendMessage outbound", () => {
    const fixture = buscarFixtureWebhookGo("send-message-outbound.json")!;
    const data = fixture.payload.data as Record<string, unknown>;
    const parsed = parseGoMessageEvent(data);
    expect(parsed?.fromMe).toBe(true);
  });

  it("parseia sticker, reaction, poll, contact, event e interactive", () => {
    const cases = [
      ["message-sticker.json", "sticker"],
      ["message-reaction.json", "reaction"],
      ["message-poll.json", "poll"],
      ["message-contact.json", "contacts"],
      ["message-event.json", "event"],
      ["message-interactive-flow.json", "interactive"],
      ["message-interactive-response.json", "interactive"],
    ] as const;

    for (const [arquivo, type] of cases) {
      const fixture = buscarFixtureWebhookGo(arquivo)!;
      const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
      expect(parsed?.type).toBe(type);
    }
  });
});

describe("parseGoHistorySyncChunk", () => {
  it("ignora chunk metadata syncType 5", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-metadata-only.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(true);
    expect(chunk.conversations).toHaveLength(0);
  });

  it("parseia bootstrap mini com mensagens", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-bootstrap-mini.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(false);
    expect(chunk.conversations[0]?.messages.length).toBe(2);
    expect(historySyncConcluido(chunk)).toBe(true);
  });

  it("parseia conversa de grupo", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-group.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(chunk.conversations[0]?.jid).toContain("@g.us");
    expect(jidParaTelefone(chunk.conversations[0]!.jid)).toBeTruthy();
  });
});

describe("parseGoReceipt", () => {
  it("detecta leitura", () => {
    const fixture = buscarFixtureWebhookGo("receipt-read.json")!;
    const receipt = parseGoReceipt(
      fixture.payload.data as Record<string, unknown>,
      fixture.payload.state as string,
    );
    expect(receipt).not.toBeNull();
    expect(receiptIndicaLeitura(receipt!)).toBe(true);
  });
});

describe("parseGoLabelAssociation", () => {
  it("parseia labeled true", () => {
    const fixture = buscarFixtureWebhookGo("label-association.json")!;
    const parsed = parseGoLabelAssociation(fixture.payload.data as Record<string, unknown>);
    expect(parsed?.labeled).toBe(true);
    expect(parsed?.labelId).toBe("9");
  });
});

describe("parseGoPairSuccess", () => {
  it("retorna open", () => {
    const fixture = buscarFixtureWebhookGo("pair-success.json")!;
    expect(parseGoPairSuccess(fixture.payload.data as Record<string, unknown>)).toBe("open");
  });
});

describe("parseGoDisconnectedEvent", () => {
  it("retorna close com data vazio", () => {
    const fixture = buscarFixtureWebhookGo("disconnected.json")!;
    expect(fixture.payload.event).toBe("Disconnected");
    expect(fixture.payload.data).toEqual({});
    expect(parseGoDisconnectedEvent(fixture.payload)).toBe("close");
  });
});

describe("resolverIdExternoCanonicoGo", () => {
  it("prefere Alt @s.whatsapp.net sobre Chat @lid", () => {
    const fixture = buscarFixtureWebhookGo("message-reaction.json")!;
    const info = (fixture.payload.data as Record<string, unknown>).Info as Record<string, unknown>;
    expect(resolverIdExternoCanonicoGo(info)).toBe("554688043494@s.whatsapp.net");
  });

  it("usa Chat @lid quando não há Alt whatsapp", () => {
    expect(
      resolverIdExternoCanonicoGo({
        Chat: "151187160604818@lid",
        SenderAlt: "",
        RecipientAlt: "",
      }),
    ).toBe("151187160604818@lid");
  });

  it("extrai telefone de exibição do Alt", () => {
    const fixture = buscarFixtureWebhookGo("message-lid-text.json")!;
    const info = (fixture.payload.data as Record<string, unknown>).Info as Record<string, unknown>;
    expect(telefoneExibicaoDeInfo(info)).toBe("554688043494");
  });
});

describe("parseGoButtonClick", () => {
  it("extrai flow_token como idempotency key", () => {
    const fixture = buscarFixtureWebhookGo("button-click-flow.json")!;
    const parsed = parseGoButtonClick(fixture.payload.data as Record<string, unknown>);
    expect(parsed).not.toBeNull();
    expect(parsed!.flowToken).toBe("51376508-1B69-4BF9-9DD7-E873C36A6F49");
    expect(parsed!.idempotencyKey).toBe(parsed!.flowToken);
    expect(parsed!.type).toBe("native_flow_response");
  });
});

describe("parseGoPushName", () => {
  it("parseia atualização de push name com LID", () => {
    const fixture = buscarFixtureWebhookGo("push-name-lid.json")!;
    const parsed = parseGoPushName(fixture.payload.data as Record<string, unknown>);
    expect(parsed).not.toBeNull();
    expect(parsed!.jid).toBe("257376032694407@lid");
    expect(parsed!.jidAlt).toBe("554688281922@s.whatsapp.net");
    expect(parsed!.newPushName).toBe("Sistema ClínicaWork");
  });
});

describe("flow-parser", () => {
  it("extrai flow_token de interactive flow", () => {
    const fixture = buscarFixtureWebhookGo("message-interactive-flow.json")!;
    const messageObj = (fixture.payload.data as Record<string, unknown>).Message as Record<
      string,
      unknown
    >;
    const flow = parseInteractiveMessage(messageObj);
    expect(flow?.flowToken).toBe("51376508-1B69-4BF9-9DD7-E873C36A6F49");
    expect(flow?.flowCta).toContain("Preencher formulário");
  });

  it("extrai resposta de flow com paramsJSON", () => {
    const fixture = buscarFixtureWebhookGo("message-interactive-response.json")!;
    const messageObj = (fixture.payload.data as Record<string, unknown>).Message as Record<
      string,
      unknown
    >;
    const response = parseInteractiveResponseMessage(messageObj);
    expect(response?.flowToken).toBe("51376508-1B69-4BF9-9DD7-E873C36A6F49");
    expect(response?.flowName).toBe("customer_info_13d75e");
    expect(response?.responseMessage).toBeTruthy();
  });

  it("parseia paramsJSON aninhado", () => {
    const fixture = buscarFixtureWebhookGo("button-click-flow.json")!;
    const extraData = (fixture.payload.data as Record<string, unknown>).extraData as Record<
      string,
      unknown
    >;
    const params = parseParamsJSON(extraData.paramsJSON);
    expect(extrairFlowToken(params)).toBe("51376508-1B69-4BF9-9DD7-E873C36A6F49");
  });
});
