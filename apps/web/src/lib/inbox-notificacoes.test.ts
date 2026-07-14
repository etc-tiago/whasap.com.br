import { describe, expect, it } from "vitest";

import {
  detectarEventosInbox,
  limitarEventosNotificacao,
  snapshotDeConversas,
  type ConversaNotificacaoSnapshot,
} from "./inbox-notificacoes";
import { conversaRelevanteParaNotificacao } from "./inbox-permissoes";

const MEU = "user-me";
const OUTRO = "user-other";

function conv(
  partial: Partial<ConversaNotificacaoSnapshot> & Pick<ConversaNotificacaoSnapshot, "id">,
): ConversaNotificacaoSnapshot {
  return {
    contatoNome: "Maria",
    contatoTelefone: "5511999999999",
    usuarioAtribuidoId: null,
    ultimaMensagemEm: "2026-07-14T12:00:00.000Z",
    ultimaMensagemTipo: "text",
    ultimaMensagemPreview: "Olá",
    naoLidas: 0,
    ...partial,
  };
}

describe("conversaRelevanteParaNotificacao", () => {
  it("aceita sem dono ou atribuída a mim", () => {
    expect(conversaRelevanteParaNotificacao(null, MEU)).toBe(true);
    expect(conversaRelevanteParaNotificacao(MEU, MEU)).toBe(true);
    expect(conversaRelevanteParaNotificacao(OUTRO, MEU)).toBe(false);
  });
});

describe("detectarEventosInbox", () => {
  it("detecta aumento de naoLidas em conversa sem dono", () => {
    const prev = snapshotDeConversas([conv({ id: "c1", naoLidas: 0 })]);
    const next = [conv({ id: "c1", naoLidas: 2, ultimaMensagemPreview: "Oi de novo" })];
    const eventos = detectarEventosInbox(prev, next, MEU);
    expect(eventos).toEqual([
      {
        tipo: "mensagem",
        conversaId: "c1",
        titulo: "Maria",
        corpo: "Oi de novo",
      },
    ]);
  });

  it("ignora mensagem em conversa de outro atendente", () => {
    const prev = snapshotDeConversas([
      conv({ id: "c1", usuarioAtribuidoId: OUTRO, naoLidas: 0 }),
    ]);
    const next = [conv({ id: "c1", usuarioAtribuidoId: OUTRO, naoLidas: 3 })];
    expect(detectarEventosInbox(prev, next, MEU)).toEqual([]);
  });

  it("detecta atribuição para mim", () => {
    const prev = snapshotDeConversas([conv({ id: "c1", usuarioAtribuidoId: null })]);
    const next = [conv({ id: "c1", usuarioAtribuidoId: MEU })];
    expect(detectarEventosInbox(prev, next, MEU)).toEqual([
      {
        tipo: "atribuicao",
        conversaId: "c1",
        titulo: "Conversa atribuída a você",
        corpo: "Maria",
      },
    ]);
  });

  it("não notifica desatribuição nem atribuição a outro", () => {
    const prev = snapshotDeConversas([conv({ id: "c1", usuarioAtribuidoId: MEU })]);
    const next = [conv({ id: "c1", usuarioAtribuidoId: OUTRO })];
    expect(detectarEventosInbox(prev, next, MEU)).toEqual([]);
  });

  it("detecta mensagem e atribuição juntos quando conversa nova vem atribuída com não lidas", () => {
    const prev = new Map<string, ConversaNotificacaoSnapshot>();
    const next = [
      conv({
        id: "c-nova",
        usuarioAtribuidoId: MEU,
        naoLidas: 1,
        ultimaMensagemPreview: "ajuda",
      }),
    ];
    const eventos = detectarEventosInbox(prev, next, MEU);
    expect(eventos.map((e) => e.tipo).sort()).toEqual(["atribuicao", "mensagem"]);
  });

  it("usa telefone quando nome está vazio", () => {
    const prev = snapshotDeConversas([
      conv({ id: "c1", contatoNome: null, naoLidas: 0 }),
    ]);
    const next = [conv({ id: "c1", contatoNome: null, naoLidas: 1 })];
    expect(detectarEventosInbox(prev, next, MEU)[0]?.titulo).toBe("5511999999999");
  });
});

describe("limitarEventosNotificacao", () => {
  it("resume excedente", () => {
    const muitos = Array.from({ length: 5 }, (_, i) => ({
      tipo: "mensagem" as const,
      conversaId: `c${i}`,
      titulo: `T${i}`,
      corpo: "x",
    }));
    const limited = limitarEventosNotificacao(muitos, 3);
    expect(limited).toHaveLength(4);
    expect(limited[3]?.titulo).toBe("+2 conversas");
  });
});
