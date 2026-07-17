import { describe, expect, it } from "bun:test";

type Contato = {
  id: number;
  organizacaoId: number;
  idExterno: string;
  telefone: string | null;
  nome: string | null;
  excluidoEm: null;
};

type ContatoInstancia = {
  id: number;
  contatoId: number;
  instanciaId: number;
  idExterno: string;
};

type Conversa = {
  id: number;
  instanciaId: number;
  contatoId: number;
  status: string;
  naoLidas: number;
  excluidoEm: null;
  metaCloudJanelaExpiraEm?: Date;
};

type Mensagem = {
  id: number;
  conversaId: number;
  idExterno: string | null;
  tipo: string;
  corpo: string | null;
  direcao: string;
  status: string;
  metadados: Record<string, unknown> | null;
  excluidoEm: null;
};

/** Builder mínimo: side-effect já ocorreu; `.returning()` devolve as rows. */
function insertResult<T>(rows: T[]) {
  const chain = {
    returning: async () => rows,
    onConflictDoUpdate: () => chain,
    onConflictDoNothing: () => chain,
  };
  return chain;
}

/** Mock de Db focado no fluxo de `ingerirMensagem`. */
function criarDbMemoria() {
  let seq = 1;
  const contatos: Contato[] = [];
  const contatoInstancias: ContatoInstancia[] = [];
  const conversas: Conversa[] = [];
  const mensagens: Mensagem[] = [];
  const usoMensalContato: Array<{ instanciaId: number; contatoId: number; anoMes: string }> = [];
  const usoMensal: Array<{
    id: number;
    instanciaId: number;
    anoMes: string;
    contatosUnicosContagem: number;
  }> = [];

  function insertValues(values: Record<string, unknown>) {
    const id = seq++;

    // mensagem (tem conversaId)
    if (typeof values.conversaId === "number") {
      const row: Mensagem = {
        id,
        conversaId: values.conversaId,
        idExterno: (values.idExterno as string) ?? null,
        tipo: values.tipo as string,
        corpo: (values.corpo as string) ?? null,
        direcao: values.direcao as string,
        status: values.status as string,
        metadados: (values.metadados as Record<string, unknown>) ?? null,
        excluidoEm: null,
      };
      mensagens.push(row);
      return insertResult([row]);
    }

    // uso_mensal_contato
    if (values.contadoEm !== undefined) {
      usoMensalContato.push({
        instanciaId: values.instanciaId as number,
        contatoId: values.contatoId as number,
        anoMes: values.anoMes as string,
      });
      return insertResult([{}]);
    }

    // uso_mensal
    if (values.contatosUnicosContagem !== undefined) {
      const row = {
        id,
        instanciaId: values.instanciaId as number,
        anoMes: values.anoMes as string,
        contatosUnicosContagem: values.contatosUnicosContagem as number,
      };
      usoMensal.push(row);
      return insertResult([row]);
    }

    // contato org (organizacaoId + idExterno, sem instanciaId)
    if (
      typeof values.organizacaoId === "number" &&
      typeof values.idExterno === "string" &&
      values.instanciaId === undefined
    ) {
      const row: Contato = {
        id,
        organizacaoId: values.organizacaoId,
        idExterno: values.idExterno,
        telefone: (values.telefone as string) ?? null,
        nome: (values.nome as string) ?? null,
        excluidoEm: null,
      };
      contatos.push(row);
      return insertResult([{ id: row.id }]);
    }

    // contato_instancia (instanciaId + idExterno + contatoId, sem status de conversa)
    if (
      typeof values.contatoId === "number" &&
      typeof values.instanciaId === "number" &&
      typeof values.idExterno === "string" &&
      values.ultimaMensagemEm === undefined &&
      values.naoLidas === undefined
    ) {
      const row: ContatoInstancia = {
        id,
        contatoId: values.contatoId,
        instanciaId: values.instanciaId,
        idExterno: values.idExterno,
      };
      contatoInstancias.push(row);
      return insertResult([row]);
    }

    // conversa
    if (typeof values.contatoId === "number" && typeof values.instanciaId === "number") {
      const row: Conversa = {
        id,
        instanciaId: values.instanciaId,
        contatoId: values.contatoId,
        status: (values.status as string) ?? "open",
        naoLidas: (values.naoLidas as number) ?? 0,
        excluidoEm: null,
        metaCloudJanelaExpiraEm: values.metaCloudJanelaExpiraEm as Date | undefined,
      };
      conversas.push(row);
      return insertResult([{ id: row.id, naoLidas: row.naoLidas }]);
    }

    throw new Error(`insert não classificado: ${JSON.stringify(Object.keys(values))}`);
  }

  const db = {
    query: {
      contato: {
        findFirst: async () => null as Contato | null,
        findMany: async () => [] as Contato[],
      },
      contatoInstancia: {
        findFirst: async () => null as ContatoInstancia | null,
      },
      conversa: {
        findFirst: async () => null as { id: number; naoLidas: number } | null,
      },
      mensagem: {
        findFirst: async () => null as { id: number } | null,
      },
      usoMensalContato: {
        findFirst: async () => null as (typeof usoMensalContato)[number] | null,
      },
      usoMensal: {
        findFirst: async () => null as (typeof usoMensal)[number] | null,
      },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => insertValues(values),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  };

  return {
    db: db as never,
    store: { contatos, contatoInstancias, conversas, mensagens, usoMensal, usoMensalContato },
  };
}

describe("ingerirMensagem (db memória)", () => {
  it("cria contato org + contato_instancia + conversa + mensagem", async () => {
    const { ingerirMensagem } = await import("./ingestao-mensagem");
    const { db, store } = criarDbMemoria();

    const result = await ingerirMensagem(db, {
      instanciaId: 10,
      organizacaoId: 1,
      phone: "554688043494",
      contactName: "Paciente",
      idExternoLinha: "151187160604818@lid",
      idExternoCanonico: "554688043494@s.whatsapp.net",
      body: "oi",
      type: "text",
      externalId: "MSG-1",
      provedor: "evo",
      naoLidasDelta: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.created).toBe(true);
    expect(store.contatos).toHaveLength(1);
    // Celular BR canônico: 9º dígito após DDD (554688043494 → 5546988043494).
    expect(store.contatos[0]!.idExterno).toBe("5546988043494@s.whatsapp.net");
    expect(store.contatos[0]!.telefone).toBe("5546988043494");
    expect(store.contatoInstancias).toHaveLength(1);
    expect(store.contatoInstancias[0]!.idExterno).toBe("151187160604818@lid");
    expect(store.conversas).toHaveLength(1);
    expect(store.mensagens).toHaveLength(1);
    expect(store.mensagens[0]!.metadados).toMatchObject({
      provedor: "evo",
      idExternoLinha: "151187160604818@lid",
    });
  });

  it("é idempotente por externalId e devolve a existente", async () => {
    const { ingerirMensagem } = await import("./ingestao-mensagem");
    const { db } = criarDbMemoria();

    (
      db as {
        query: {
          mensagem: {
            findFirst: () => Promise<{ id: number; conversaId: number; midiaR2Chave: null }>;
          };
        };
      }
    ).query.mensagem.findFirst = async () => ({
      id: 99,
      conversaId: 7,
      midiaR2Chave: null,
    });

    const result = await ingerirMensagem(db, {
      instanciaId: 10,
      organizacaoId: 1,
      phone: "554688043494",
      contactName: null,
      idExternoLinha: "554688043494@s.whatsapp.net",
      idExternoCanonico: "554688043494@s.whatsapp.net",
      body: "dup",
      type: "text",
      externalId: "MSG-DUP",
      provedor: "evo",
    });

    expect(result).toEqual({
      messageId: 99,
      conversaId: 7,
      created: false,
      midiaR2Chave: null,
    });
  });

  it("abre janela meta_cloud na conversa", async () => {
    const { ingerirMensagem } = await import("./ingestao-mensagem");
    const { db, store } = criarDbMemoria();

    await ingerirMensagem(db, {
      instanciaId: 10,
      organizacaoId: 1,
      phone: "16315551234",
      contactName: "Kerry",
      idExternoLinha: "16315551234",
      idExternoCanonico: "16315551234@s.whatsapp.net",
      body: "hello",
      type: "text",
      externalId: "wamid.1",
      provedor: "meta_cloud",
      naoLidasDelta: 1,
    });

    expect(store.conversas[0]!.metaCloudJanelaExpiraEm).toBeInstanceOf(Date);
  });

  it("revoke soft-delete a mensagem alvo sem criar linha nova", async () => {
    const { ingerirMensagem } = await import("./ingestao-mensagem");
    const { db } = criarDbMemoria();

    let softDeleted = false;
    type DbRevokeMock = {
      query: {
        mensagem: {
          findFirst: () => Promise<{
            id: number;
            conversaId: number;
            corpo: string;
            tipo: string;
            enviadoEm: Date;
            metadados: null;
          } | null>;
        };
      };
      update: () => {
        set: (values: Record<string, unknown>) => {
          where: () => Promise<void>;
        };
      };
    };
    const dbRevoke = db as unknown as DbRevokeMock;
    dbRevoke.query.mensagem.findFirst = async () => {
      if (softDeleted) {
        return {
          id: 2,
          conversaId: 7,
          corpo: "anterior",
          tipo: "text",
          enviadoEm: new Date("2024-01-01T00:00:00Z"),
          metadados: null,
        };
      }
      return {
        id: 1,
        conversaId: 7,
        corpo: "apagada",
        tipo: "text",
        enviadoEm: new Date("2024-01-02T00:00:00Z"),
        metadados: null,
      };
    };
    dbRevoke.update = () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (values.excluidoEm !== undefined) softDeleted = true;
        },
      }),
    });

    const result = await ingerirMensagem(db, {
      instanciaId: 10,
      organizacaoId: 1,
      phone: "554688043494",
      contactName: null,
      idExternoLinha: "554688043494@s.whatsapp.net",
      idExternoCanonico: "554688043494@s.whatsapp.net",
      body: "MSG-ALVO",
      type: "revoke",
      externalId: "REVOKE-1",
      provedor: "evo",
    });

    expect(result).toEqual({
      messageId: 1,
      conversaId: 7,
      created: false,
      midiaR2Chave: null,
    });
    expect(softDeleted).toBe(true);
  });
});
