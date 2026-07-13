/**
 * Cobertura sintetica de tipos parseados (e lacunas) no HistorySync / Message.
 */
import { describe, expect, it } from "vitest";

import { HISTORY_SYNC_TYPE, parseGoHistorySyncChunk, parseGoMessageEvent } from "./webhook-go";

function msg(message: Record<string, unknown>, id = "M1") {
  return {
    message: {
      key: { remoteJID: "5511999999999@s.whatsapp.net", fromMe: false, ID: id },
      message,
      messageTimestamp: 1_700_000_000,
    },
  };
}

function chunkCom(message: Record<string, unknown>, id = "M1") {
  return parseGoHistorySyncChunk({
    Data: {
      syncType: HISTORY_SYNC_TYPE.RECENT,
      progress: 10,
      conversations: [
        {
          ID: "5511999999999@s.whatsapp.net",
          messages: [msg(message, id)],
        },
      ],
    },
  });
}

describe("HistorySync tipos de mensagem (sintetico)", () => {
  it("1) conversation = text", () => {
    const c = chunkCom({ conversation: "ola" });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "text", body: "ola" });
  });

  it("2) locationMessage", () => {
    const c = chunkCom({ locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6 } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "location",
      body: "[localização]",
    });
  });

  it("3) reactionMessage com emoji", () => {
    const c = chunkCom({ reactionMessage: { text: "👍" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "reaction", body: "👍" });
  });

  it("4) reactionMessage sem text usa placeholder", () => {
    const c = chunkCom({ reactionMessage: {} });
    expect(c.conversations[0]!.messages[0]!.body).toBe("[reação]");
  });

  it("5) pollCreationMessageV3 com opcoes", () => {
    const c = chunkCom({
      pollCreationMessageV3: {
        name: "Horario?",
        options: [{ optionName: "Manha" }, { optionName: "Tarde" }],
      },
    });
    const m = c.conversations[0]!.messages[0]!;
    expect(m.type).toBe("poll");
    expect(m.body).toContain("Horario?");
    expect(m.body).toContain("Manha");
    expect(m.body).toContain("Tarde");
  });

  it("6) poll sem opcoes usa so o nome", () => {
    const c = chunkCom({ pollCreationMessageV3: { name: "So nome" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "poll", body: "So nome" });
  });

  it("7) poll vazio usa placeholder", () => {
    const c = chunkCom({ pollCreationMessageV3: {} });
    expect(c.conversations[0]!.messages[0]!.body).toBe("[enquete]");
  });

  it("8) contactMessage com displayName", () => {
    const c = chunkCom({ contactMessage: { displayName: "Maria" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "contacts", body: "Maria" });
  });

  it("9) contactMessage vazio", () => {
    const c = chunkCom({ contactMessage: {} });
    expect(c.conversations[0]!.messages[0]!.body).toBe("[contato]");
  });

  it("10) eventMessage", () => {
    const c = chunkCom({ eventMessage: { name: "Consulta" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "event", body: "Consulta" });
  });

  it("11) eventMessage sem nome", () => {
    const c = chunkCom({ eventMessage: {} });
    expect(c.conversations[0]!.messages[0]!.body).toBe("[evento]");
  });

  it("12) videoMessage com caption", () => {
    const c = chunkCom({ videoMessage: { caption: "clip", mimetype: "video/mp4" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "video", body: "clip" });
  });

  it("13) videoMessage sem caption", () => {
    const c = chunkCom({ videoMessage: {} });
    expect(c.conversations[0]!.messages[0]!.body).toBe("[vídeo]");
  });

  it("14) stickerMessage", () => {
    const c = chunkCom({ stickerMessage: { mimetype: "image/webp" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "sticker", body: "[sticker]" });
  });

  it("15) image sem caption usa placeholder", () => {
    const c = chunkCom({ imageMessage: {} });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "image", body: "[imagem]" });
  });

  it("16) document sem fileName usa caption ou placeholder", () => {
    expect(
      chunkCom({ documentMessage: { caption: "anexo" } }).conversations[0]!.messages[0]!.body,
    ).toBe("anexo");
    expect(chunkCom({ documentMessage: {} }, "D2").conversations[0]!.messages[0]!.body).toBe(
      "[documento]",
    );
  });

  it("17) interactiveMessage vazio => [interativo]", () => {
    const c = chunkCom({ interactiveMessage: {} });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "interactive",
      body: "[interativo]",
    });
  });

  it("18) interactiveMessage com body.text", () => {
    const c = chunkCom({
      interactiveMessage: { body: { text: "Escolha uma opcao" } },
    });
    expect(c.conversations[0]!.messages[0]!.body).toBe("Escolha uma opcao");
  });

  it("19) interactiveResponseMessage", () => {
    const c = chunkCom({
      interactiveResponseMessage: { body: { text: "Resposta flow" } },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "interactive",
      body: "Resposta flow",
    });
  });

  it("20) buttonsMessage parseia contentText", () => {
    const c = chunkCom({ buttonsMessage: { contentText: "oi", buttons: [] } });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "buttons", body: "oi" });
  });

  it("21) albumMessage parseia placeholder", () => {
    const c = chunkCom({ albumMessage: { expectedImageCount: 2 } });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "album", body: "[álbum]" });
  });

  it("22) listMessage parseia titulo", () => {
    const c = chunkCom({ listMessage: { title: "Lista" } });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "list", body: "Lista" });
  });

  it("23) viewOnceMessage faz unwrap do inner", () => {
    const c = chunkCom({
      viewOnceMessage: {
        message: { conversation: "secreto" },
      },
    });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "text", body: "secreto" });
  });

  it("24) ephemeralMessage faz unwrap do inner", () => {
    const c = chunkCom({
      ephemeralMessage: {
        message: { conversation: "some" },
      },
    });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "text", body: "some" });
  });

  it("25) parseGoMessageEvent poll live", () => {
    const p = parseGoMessageEvent({
      Info: {
        Chat: "5511@s.whatsapp.net",
        ID: "LIVE1",
        IsFromMe: false,
        Timestamp: 1_700_000_000,
      },
      Message: {
        pollCreationMessageV3: { name: "A?", options: [{ optionName: "Sim" }] },
      },
    });
    expect(p?.type).toBe("poll");
    expect(p?.body).toContain("Sim");
  });

  it("26) parseGoMessageEvent reaction live", () => {
    const p = parseGoMessageEvent({
      Info: { Chat: "5511@s.whatsapp.net", ID: "R1", IsFromMe: true, Timestamp: 1_700_000_000 },
      Message: { reactionMessage: { text: "❤️" } },
    });
    expect(p).toMatchObject({ type: "reaction", body: "❤️", fromMe: true });
  });

  it("27) parseGoMessageEvent location live", () => {
    const p = parseGoMessageEvent({
      Info: { Chat: "5511@s.whatsapp.net", ID: "L1", Timestamp: 1_700_000_000 },
      Message: { locationMessage: {} },
    });
    expect(p?.type).toBe("location");
  });

  it("28) parseGoMessageEvent group flag", () => {
    const p = parseGoMessageEvent({
      Info: {
        Chat: "120363@g.us",
        ID: "G1",
        IsGroup: true,
        Timestamp: 1_700_000_000,
      },
      Message: { conversation: "grupo" },
    });
    expect(p?.isGroup).toBe(true);
  });

  it("29) parseGoMessageEvent sem Message retorna null", () => {
    expect(parseGoMessageEvent({ Info: { Chat: "x", ID: "1" } })).toBeNull();
  });

  it("30) parseGoMessageEvent template parseia", () => {
    const p = parseGoMessageEvent({
      Info: { Chat: "5511@s.whatsapp.net", ID: "T1", Timestamp: 1 },
      Message: { templateMessage: { hydratedTemplate: { hydratedContentText: "Olá template" } } },
    });
    expect(p).toMatchObject({ type: "template", body: "Olá template" });
  });

  it("31) extendedText no HistorySync chunk", () => {
    const c = chunkCom({
      extendedTextMessage: { text: "Texto *formatado* com link https://exemplo.com" },
    });
    expect(c.temMensagens).toBe(true);
    const mensagem = c.conversations[0]!.messages[0]!;
    expect(mensagem.type).toBe("text");
    expect(mensagem.body).toContain("formatado");
    expect(mensagem.body).toContain("https://exemplo.com");
  });

  it("32) conversation simples no chunk", () => {
    const c = chunkCom({ conversation: "ola mundo" });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "text",
      body: "ola mundo",
    });
  });

  it("33) conversation vazio descartado (lacuna)", () => {
    const c = chunkCom({ conversation: "" });
    expect(c.temMensagens).toBe(false);
  });

  it("34) status numerico no HistorySync vira string WMI", () => {
    const raw = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: false, ID: "SN1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                  status: 4,
                },
              },
            ],
          },
        ],
      },
    };
    const c = parseGoHistorySyncChunk(raw);
    expect(c.conversations[0]!.messages[0]!.status).toBe("READ");
  });

  it("35) status string read preservado", () => {
    const raw = {
      Data: {
        syncType: HISTORY_SYNC_TYPE.RECENT,
        progress: 10,
        conversations: [
          {
            ID: "5511999@s.whatsapp.net",
            messages: [
              {
                message: {
                  key: { remoteJID: "5511999@s.whatsapp.net", fromMe: true, ID: "SS1" },
                  message: { conversation: "x" },
                  messageTimestamp: 1_700_000_000,
                  status: "READ",
                },
              },
            ],
          },
        ],
      },
    };
    const c = parseGoHistorySyncChunk(raw);
    expect(c.conversations[0]!.messages[0]!.status).toBe("READ");
  });

  it("36) templateMessage no chunk parseia hydrated", () => {
    const c = chunkCom({
      templateMessage: { hydratedTemplate: { hydratedContentText: "Promo" } },
    });
    expect(c.temMensagens).toBe(true);
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "template", body: "Promo" });
  });

  it("37) associatedChildMessage unwrap midia", () => {
    const c = chunkCom({
      associatedChildMessage: { message: { imageMessage: { caption: "filho" } } },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "image", body: "filho" });
  });

  it("38) secretEncryptedMessage vira encrypted", () => {
    const c = chunkCom({ secretEncryptedMessage: { encPayload: "x" } });
    expect(c.conversations[0]!.messages[0]).toMatchObject({
      type: "encrypted",
      body: "[mensagem criptografada]",
    });
  });

  it("39) protocolMessage revoke", () => {
    const c = chunkCom({
      protocolMessage: { type: 0, key: { id: "ORIG-1" } },
    });
    expect(c.conversations[0]!.messages[0]).toMatchObject({ type: "revoke", body: "ORIG-1" });
  });
});
