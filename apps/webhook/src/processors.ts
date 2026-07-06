import { appCreateData, type Client } from "@whasap/db";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  data?: {
    state?: string;
    key?: { remoteJid?: string; id?: string };
    message?: Record<string, unknown>;
    pushName?: string;
  };
};

export async function processEvolutionWebhook(
  client: Client,
  body: string,
): Promise<void> {
  const payload = JSON.parse(body) as EvolutionPayload;
  const event = payload.event ?? "";
  const instanceName = payload.instance;

  if (!instanceName) return;

  const instance = await client.instances.findFirst({
    where: { evolutionInstanceName: instanceName },
  });
  if (!instance) return;

  if (event === "connection.update") {
    const state = payload.data?.state;
    if (state === "open") {
      await client.instances.update({
        where: { id: instance.id },
        data: {
          status: instance.asaasSubscriptionId ? "connected" : "pending_payment",
          connectedAt: new Date(),
        },
      });
    }
    return;
  }

  if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") return;

  const remoteJid = payload.data?.key?.remoteJid;
  if (!remoteJid) return;

  const phone = remoteJid.replace(/@.*/, "").replace(/\D/g, "");
  const pushName = payload.data?.pushName;
  const messageObj = payload.data?.message as Record<string, unknown> | undefined;

  let bodyText: string | null = null;
  let type = "text";
  if (messageObj?.conversation) {
    bodyText = String(messageObj.conversation);
  } else if (messageObj?.extendedTextMessage) {
    bodyText = String((messageObj.extendedTextMessage as { text?: string }).text ?? "");
  } else if (messageObj?.imageMessage) {
    type = "image";
    bodyText = String((messageObj.imageMessage as { caption?: string }).caption ?? "[imagem]");
  } else if (messageObj?.audioMessage) {
    type = "audio";
    bodyText = "[áudio]";
  } else if (messageObj?.documentMessage) {
    type = "document";
    bodyText = String((messageObj.documentMessage as { fileName?: string }).fileName ?? "[documento]");
  } else if (messageObj?.locationMessage) {
    type = "location";
    bodyText = "[localização]";
  }

  if (!bodyText) return;

  await ingestInboundMessage(client, {
    instanceId: instance.id,
    phone,
    contactName: pushName ?? null,
    body: bodyText,
    type,
    externalId: payload.data?.key?.id ?? null,
    isCloud: false,
  });
}

type MetaPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from: string;
          id: string;
          type: string;
          text?: { body: string };
          image?: { caption?: string };
          document?: { filename?: string };
        }>;
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
};

export async function processMetaWebhook(client: Client, body: string): Promise<void> {
  const payload = JSON.parse(body) as MetaPayload;
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const instance = await client.instances.findFirst({
        where: { cloudPhoneNumberId: phoneNumberId },
      });
      if (!instance) continue;

      for (const msg of value.messages ?? []) {
        let bodyText: string | null = null;
        if (msg.type === "text" && msg.text) bodyText = msg.text.body;
        else if (msg.type === "image") bodyText = msg.image?.caption ?? "[imagem]";
        else if (msg.type === "document") bodyText = msg.document?.filename ?? "[documento]";
        else bodyText = `[${msg.type}]`;

        await ingestInboundMessage(client, {
          instanceId: instance.id,
          phone: msg.from,
          contactName: null,
          body: bodyText,
          type: msg.type,
          externalId: msg.id,
          isCloud: true,
        });
      }

      for (const status of value.statuses ?? []) {
        const message = await client.messages.findFirst({
          where: { externalId: status.id },
        });
        if (message) {
          await client.messages.update({
            where: { id: message.id },
            data: { status: status.status },
          });
        }
      }
    }
  }
}

async function ingestInboundMessage(
  client: Client,
  params: {
    instanceId: number;
    phone: string;
    contactName: string | null;
    body: string;
    type: string;
    externalId: string | null;
    isCloud: boolean;
  },
) {
  let contact = await client.contacts.findFirst({
    where: { instanceId: params.instanceId, phone: params.phone },
  });
  if (!contact) {
    contact = await client.contacts.create({
      data: appCreateData({
        instanceId: params.instanceId,
        phone: params.phone,
        name: params.contactName,
      }),
    });
  }

  let conversation = await client.conversations.findFirst({
    where: { instanceId: params.instanceId, contactId: contact.id, status: "open" },
  });
  if (!conversation) {
    conversation = await client.conversations.create({
      data: appCreateData({
        instanceId: params.instanceId,
        contactId: contact.id,
        lastMessageAt: new Date(),
        ...(params.isCloud
          ? { cloudWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
          : {}),
      }),
    });
  } else if (params.isCloud) {
    await client.conversations.update({
      where: { id: conversation.id },
      data: { cloudWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  }

  const existing = params.externalId
    ? await client.messages.findFirst({ where: { externalId: params.externalId } })
    : null;
  if (existing) return;

  await client.messages.create({
    data: appCreateData({
      conversationId: conversation.id,
      direction: "inbound",
      type: params.type,
      body: params.body,
      externalId: params.externalId,
      status: "delivered",
    }),
  });

  await client.conversations.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  const yearMonth = new Date().toISOString().slice(0, 7);
  const usageContact = await client.monthlyUsageContacts.findFirst({
    where: { instanceId: params.instanceId, contactId: contact.id, yearMonth },
  });
  if (!usageContact) {
    await client.monthlyUsageContacts.create({
      data: appCreateData({
        instanceId: params.instanceId,
        contactId: contact.id,
        yearMonth,
        countedAt: new Date(),
      }),
    });
    const usage = await client.monthlyUsage.findFirst({
      where: { instanceId: params.instanceId, yearMonth },
    });
    if (usage) {
      await client.monthlyUsage.update({
        where: { id: usage.id },
        data: { uniqueContactsCount: usage.uniqueContactsCount + 1 },
      });
    } else {
      await client.monthlyUsage.create({
        data: appCreateData({
          instanceId: params.instanceId,
          yearMonth,
          uniqueContactsCount: 1,
        }),
      });
    }
  }
}
