import { criarClienteEvolutionGo, criarClienteMeta, preconditionFailed } from "@whasap/api-core";
import { isEvoProvider, isMetaCloudProvider, type InstanceProvider } from "@whasap/config";
import { extractGoMessageId } from "@whasap/evolution";
import { extractMetaMessageId } from "@whasap/meta";

import { obterCredenciaisEvolution, obterCredenciaisMeta } from "../handlers/instancia";
import type { InstanciaComProvedor } from "./instancia-provedor";
import type { WebContext } from "../types";

export type SendMessageParams = {
  ctx: WebContext;
  instance: InstanciaComProvedor;
  phone: string;
  type: string;
  body?: string | null;
  mediaUrl?: string;
  mediaR2Key?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
  latitude?: number;
  longitude?: number;
  localNome?: string;
  localEndereco?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown[];
  contatos?: unknown[];
  interactive?: unknown;
  payload?: unknown;
  contextoMensagemId?: string;
  mensagemIdExterno?: string;
  emoji?: string;
};

const CAPABILITIES: Record<string, InstanceProvider[]> = {
  text: ["meta_cloud", "evo"],
  image: ["meta_cloud", "evo"],
  audio: ["meta_cloud", "evo"],
  video: ["meta_cloud", "evo"],
  document: ["meta_cloud", "evo"],
  sticker: ["meta_cloud", "evo"],
  location: ["meta_cloud", "evo"],
  contacts: ["meta_cloud", "evo"],
  template: ["meta_cloud"],
  interactive: ["meta_cloud"],
  reaction: ["meta_cloud", "evo"],
  button: ["evo"],
  list: ["evo"],
  carousel: ["evo"],
  poll: ["evo"],
  link: ["evo"],
};

export function assertMessageTypeSupported(type: string, provedor: InstanceProvider) {
  const allowed = CAPABILITIES[type];
  if (!allowed?.includes(provedor)) {
    preconditionFailed(`Tipo "${type}" não suportado para o provedor ${provedor}`);
  }
}

function quotedFrom(contextoMensagemId?: string) {
  return contextoMensagemId ? { messageId: contextoMensagemId } : undefined;
}

function metaOptions(contextoMensagemId?: string) {
  return contextoMensagemId ? { contextMessageId: contextoMensagemId } : undefined;
}

export async function sendProviderMessage(params: SendMessageParams): Promise<string | null> {
  const { ctx, instance, phone, type } = params;
  const normalizedPhone = phone.replace(/\D/g, "");
  assertMessageTypeSupported(type, instance.provedor);

  const evoToken = instance.evo?.token;
  if (isEvoProvider(instance.provedor) && evoToken) {
    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: evoToken },
      {
        origem: "messaging",
        rpc: "messaging.send",
        instanciaUuid: instance.uuid,
        ...(instance.evo?.instanceId ? { evolutionInstanceId: instance.evo.instanceId } : {}),
      },
    );
    const quoted = quotedFrom(params.contextoMensagemId);

    if (type === "text" && params.body) {
      return extractGoMessageId(await client.sendText(normalizedPhone, params.body, quoted));
    }
    if (["image", "video", "audio", "document"].includes(type) && params.mediaUrl) {
      return extractGoMessageId(
        await client.sendMedia(
          normalizedPhone,
          type as "image" | "video" | "audio" | "document",
          params.mediaUrl,
          params.caption ?? params.body ?? undefined,
          params.filename,
          quoted,
        ),
      );
    }
    if (type === "sticker" && params.mediaUrl) {
      return extractGoMessageId(await client.sendSticker(normalizedPhone, params.mediaUrl, quoted));
    }
    if (type === "location" && params.latitude != null && params.longitude != null) {
      return extractGoMessageId(
        await client.sendLocation(
          normalizedPhone,
          params.latitude,
          params.longitude,
          params.localNome,
          params.localEndereco,
          quoted,
        ),
      );
    }
    if (type === "contacts" && params.contatos?.[0]) {
      return extractGoMessageId(
        await client.sendContact(normalizedPhone, params.contatos[0], quoted),
      );
    }
    if (type === "reaction" && params.mensagemIdExterno && params.emoji != null) {
      return extractGoMessageId(
        await client.react(normalizedPhone, params.mensagemIdExterno, params.emoji),
      );
    }
    if (type === "button" && params.payload) {
      return extractGoMessageId(await client.sendButton(params.payload));
    }
    if (type === "list" && params.payload) {
      return extractGoMessageId(await client.sendList(params.payload));
    }
    if (type === "carousel" && params.payload) {
      return extractGoMessageId(await client.sendCarousel(params.payload));
    }
    if (type === "poll" && params.payload) {
      return extractGoMessageId(await client.sendPoll(params.payload));
    }
    if (type === "link" && params.payload) {
      return extractGoMessageId(await client.sendLink(params.payload));
    }
    return null;
  }

  if (isMetaCloudProvider(instance.provedor)) {
    const creds = obterCredenciaisMeta(instance);
    const client = criarClienteMeta(ctx.env, creds, {
      origem: "messaging",
      rpc: "messaging.send",
      instanciaUuid: instance.uuid,
    });
    const opts = metaOptions(params.contextoMensagemId);

    if (type === "template" && params.templateName) {
      return extractMetaMessageId(
        await client.sendTemplate(
          normalizedPhone,
          params.templateName,
          params.templateLanguage ?? "pt_BR",
          params.templateComponents,
        ),
      );
    }
    if (type === "text" && params.body) {
      return extractMetaMessageId(await client.sendText(normalizedPhone, params.body, opts));
    }
    if (type === "image" && params.mediaUrl) {
      return extractMetaMessageId(
        await client.sendImage(
          normalizedPhone,
          params.mediaUrl,
          params.caption ?? params.body ?? undefined,
          opts,
        ),
      );
    }
    if (type === "audio" && params.mediaUrl) {
      return extractMetaMessageId(
        await client.sendAudio(normalizedPhone, params.mediaUrl, params.voice, opts),
      );
    }
    if (type === "video" && params.mediaUrl) {
      return extractMetaMessageId(
        await client.sendVideo(
          normalizedPhone,
          params.mediaUrl,
          params.caption ?? params.body ?? undefined,
          opts,
        ),
      );
    }
    if (type === "document" && params.mediaUrl) {
      return extractMetaMessageId(
        await client.sendDocument(
          normalizedPhone,
          params.mediaUrl,
          params.filename,
          params.caption ?? params.body ?? undefined,
          opts,
        ),
      );
    }
    if (type === "sticker" && params.mediaUrl) {
      return extractMetaMessageId(await client.sendSticker(normalizedPhone, params.mediaUrl, opts));
    }
    if (type === "location" && params.latitude != null && params.longitude != null) {
      return extractMetaMessageId(
        await client.sendLocation(
          normalizedPhone,
          params.latitude,
          params.longitude,
          params.localNome,
          params.localEndereco,
        ),
      );
    }
    if (type === "contacts" && params.contatos) {
      return extractMetaMessageId(await client.sendContacts(normalizedPhone, params.contatos));
    }
    if (type === "interactive" && params.interactive) {
      return extractMetaMessageId(
        await client.sendInteractive(normalizedPhone, params.interactive, opts),
      );
    }
    if (type === "reaction" && params.mensagemIdExterno && params.emoji != null) {
      return extractMetaMessageId(
        await client.sendReaction(normalizedPhone, params.mensagemIdExterno, params.emoji),
      );
    }
  }

  return null;
}

/** Marca mensagem inbound como lida no provedor (Meta Cloud ou Evolution). */
export async function markProviderMessageRead(
  ctx: WebContext,
  instance: SendMessageParams["instance"],
  phone: string,
  externalMessageId: string,
): Promise<void> {
  if (isMetaCloudProvider(instance.provedor)) {
    const client = criarClienteMeta(ctx.env, obterCredenciaisMeta(instance), {
      origem: "messaging",
      rpc: "messaging.markRead",
      instanciaUuid: instance.uuid,
    });
    await client.markAsRead(externalMessageId);
    return;
  }
  const evoToken = instance.evo?.token;
  if (isEvoProvider(instance.provedor) && evoToken) {
    const creds = await obterCredenciaisEvolution(ctx.env);
    const client = criarClienteEvolutionGo(
      ctx.env,
      creds,
      { instanceToken: evoToken },
      {
        origem: "messaging",
        rpc: "messaging.markRead",
        instanciaUuid: instance.uuid,
        ...(instance.evo?.instanceId ? { evolutionInstanceId: instance.evo.instanceId } : {}),
      },
    );
    await client.markRead(phone.replace(/\D/g, ""), [externalMessageId]);
  }
}

export function isMetaCloudWindowOpen(metaCloudJanelaExpiraEm: Date | null): boolean {
  if (!metaCloudJanelaExpiraEm) return false;
  return metaCloudJanelaExpiraEm.getTime() > Date.now();
}

export function cloudRequiresTemplate(
  provider: InstanceProvider,
  metaCloudJanelaExpiraEm: Date | null,
  isNewConversation: boolean,
): boolean {
  if (!isMetaCloudProvider(provider)) return false;
  if (isNewConversation) return true;
  return !isMetaCloudWindowOpen(metaCloudJanelaExpiraEm);
}
