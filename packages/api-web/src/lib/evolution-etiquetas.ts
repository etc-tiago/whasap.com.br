import { criarClienteEvolutionGo, getEvolutionCredentials, preconditionFailed } from "@whasap/api-core";
import { isEvoProvider } from "@whasap/config";
import {
  corPainelParaIndiceWhatsapp,
  extrairLabelIdResposta,
  jidDeContato,
} from "@whasap/evolution";

import type { InstanciaComProvedor } from "./instancia-provedor";
import { isInstanceOperational } from "./instance-operational";
import type { WebContext } from "../types";

type ContatoEtiqueta = {
  telefone: string | null;
  idExternoLinha?: string | null;
};

async function clienteEvolutionInstancia(ctx: WebContext, instance: InstanciaComProvedor) {
  if (!isEvoProvider(instance.provedor)) return null;
  if (!isInstanceOperational(instance)) return null;
  const token = instance.evo?.token;
  if (!token) return null;

  const creds = await getEvolutionCredentials(ctx.env);
  return criarClienteEvolutionGo(
    ctx.env,
    creds,
    { instanceToken: token },
    {
      instanciaUuid: instance.uuid,
      ...(instance.evo?.instanceId ? { evolutionInstanceId: instance.evo.instanceId } : {}),
    },
  );
}

/** Cria etiqueta no WhatsApp via Evolution GO; retorna labelId ou null. */
export async function criarEtiquetaEvolution(
  ctx: WebContext,
  instance: InstanciaComProvedor,
  nome: string,
  cor: string | null | undefined,
): Promise<string | null> {
  const client = await clienteEvolutionInstancia(ctx, instance);
  if (!client) return null;

  const resposta = await client.editLabel({
    name: nome,
    color: corPainelParaIndiceWhatsapp(cor),
  });

  return extrairLabelIdResposta(resposta);
}

/** Associa etiqueta a chat no WhatsApp. */
export async function atribuirEtiquetaEvolution(
  ctx: WebContext,
  instance: InstanciaComProvedor,
  contact: ContatoEtiqueta,
  labelId: string,
): Promise<void> {
  const client = await clienteEvolutionInstancia(ctx, instance);
  if (!client) return;

  await client.labelChat({
    jid: jidDeContato(contact.telefone ?? "", contact.idExternoLinha),
    labelId,
  });
}

/** Remove etiqueta de chat no WhatsApp. */
export async function removerEtiquetaEvolution(
  ctx: WebContext,
  instance: InstanciaComProvedor,
  contact: ContatoEtiqueta,
  labelId: string,
): Promise<void> {
  const client = await clienteEvolutionInstancia(ctx, instance);
  if (!client) return;

  await client.unlabelChat({
    jid: jidDeContato(contact.telefone ?? "", contact.idExternoLinha),
    labelId,
  });
}

/** Garante etiqueta com idExterno no WhatsApp antes de atribuir. */
export async function garantirEtiquetaEvolution(
  ctx: WebContext,
  instance: InstanciaComProvedor,
  tag: { nome: string; cor: string | null; idExterno: string | null },
): Promise<string> {
  if (tag.idExterno) return tag.idExterno;

  const labelId = await criarEtiquetaEvolution(ctx, instance, tag.nome, tag.cor);
  if (!labelId) {
    preconditionFailed("Não foi possível criar etiqueta no WhatsApp");
  }
  return labelId;
}
