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
  HISTORY_SYNC_TYPE,
  historySyncConcluido,
  jidParaTelefone,
  mapaLidParaPn,
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
  resolverJidHistoricoSync,
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
      expect(parsed!.type.length).toBeGreaterThan(0);
      if (parsed!.type === "edit_encrypted") {
        expect(parsed!.editTargetId).toBeTruthy();
        continue;
      }
      if (parsed!.type === "revoke") {
        expect(parsed!.body.length).toBeGreaterThan(0);
        continue;
      }
      expect(parsed!.body.length).toBeGreaterThan(0);
    }
  });

  it("parseia message-edit-encrypted como edit_encrypted", () => {
    const fixture = buscarFixtureWebhookGo("message-edit-encrypted.json")!;
    const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
    expect(parsed).toMatchObject({
      type: "edit_encrypted",
      editTargetId: "AC9A902ED6D1458D0A9FB5C4023580E7",
    });
    expect(parsed!.body).not.toContain("criptografada");
  });

  it("parseia message-revoke como revoke", () => {
    const fixture = buscarFixtureWebhookGo("message-revoke.json")!;
    const parsed = parseGoMessageEvent(fixture.payload.data as Record<string, unknown>);
    expect(parsed).toMatchObject({
      type: "revoke",
      messageId: "2A47A4C8DB3F7FF28EEF",
      fromMe: true,
    });
    expect(parsed!.body).toBe("3EB0CA26A0B2685ED88476");
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

  it("parseia bootstrap mini sem marcar sync concluído (fase 0 @ 100)", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-bootstrap-mini.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(false);
    expect(chunk.conversations[0]?.messages.length).toBe(2);
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.INITIAL_BOOTSTRAP);
    expect(chunk.progress).toBe(100);
    expect(historySyncConcluido(chunk)).toBe(false);
  });

  it("marca concluído só na fase RECENT @ 100", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-recent-complete.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(chunk.syncType).toBe(HISTORY_SYNC_TYPE.RECENT);
    expect(chunk.progress).toBe(100);
    expect(historySyncConcluido(chunk)).toBe(true);
    expect(deveIgnorarHistorySyncChunk(chunk)).toBe(false);
  });

  it("resolve LID via phoneNumberToLidMappings", () => {
    const fixture = buscarFixtureWebhookGo("history-sync-lid-map.json")!;
    const chunk = parseGoHistorySyncChunk(fixture.payload.data as Record<string, unknown>);
    expect(chunk.phoneLidMappings.length).toBeGreaterThan(0);
    const lidJid = chunk.phoneLidMappings[0]!.lidJid;
    const pnJid = chunk.phoneLidMappings[0]!.pnJid;
    const resolved = resolverJidHistoricoSync(lidJid, mapaLidParaPn(chunk.phoneLidMappings));
    expect(resolved.idExternoCanonico).toBe(pnJid);
    expect(resolved.idExternoLinha).toBe(lidJid);
    expect(resolved.phone).toBe(jidParaTelefone(pnJid));
    expect(historySyncConcluido(chunk)).toBe(false);
  });

  it("timeline multi-fase: só RECENT@100 conclui (corpus real)", () => {
    const fases = [
      { syncType: 5, progress: null, temMensagens: false },
      { syncType: 0, progress: 100, temMensagens: true },
      { syncType: 4, progress: null, temMensagens: false },
      { syncType: 3, progress: 29, temMensagens: true },
      { syncType: 3, progress: 100, temMensagens: true },
      { syncType: 2, progress: 26, temMensagens: true },
      { syncType: 2, progress: 100, temMensagens: true },
    ] as const;

    const concluidos = fases.map((f) =>
      historySyncConcluido({
        syncType: f.syncType,
        progress: f.progress,
        chunkOrder: 1,
        conversations: [],
        temMensagens: f.temMensagens,
        phoneLidMappings: [],
      }),
    );
    expect(concluidos.filter(Boolean)).toHaveLength(1);
    expect(concluidos.at(-1)).toBe(true);
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
