import type { CSSProperties } from "react";

/** Cores de avatar estáveis por identificador de contato. */
const AVATAR_CORES = [
  "oklch(0.55 0.05 50)",
  "oklch(0.6 0.1 20)",
  "oklch(0.65 0.12 320)",
  "oklch(0.5 0.15 25)",
  "oklch(0.55 0.14 140)",
  "oklch(0.6 0.1 240)",
  "oklch(0.55 0.08 60)",
  "oklch(0.6 0.12 10)",
  "oklch(0.6 0.08 40)",
  "oklch(0.55 0.1 80)",
  "oklch(0.6 0.13 200)",
  "oklch(0.5 0.1 250)",
] as const;

export function corAvatarContato(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_CORES.length;
  }
  return AVATAR_CORES[hash]!;
}

export function estiloAvatarContato(cor: string): CSSProperties {
  return {
    backgroundColor: cor,
    backgroundImage: "radial-gradient(circle at 50% 35%, oklch(1 0 0 / 0.35), transparent 60%)",
  };
}

export function formatarHorarioConversa(iso: string | null | undefined): string {
  if (!iso) return "";
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (data.toDateString() === ontem.toDateString()) {
    return "Ontem";
  }
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatarHorarioMensagem(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Data/hora completa para o dialog de detalhes da mensagem. */
export function formatarDataHoraMensagem(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Rótulo em pt-BR do status de entrega WhatsApp. */
export function rotuloStatusEntrega(status: string): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "sent":
      return "Enviado";
    case "delivered":
      return "Entregue";
    case "read":
      return "Lido";
    case "played":
      return "Reproduzido";
    default:
      return status || "—";
  }
}

export function formatarRotuloDia(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function agruparMensagensPorDia<T extends { enviadoEm: string }>(
  mensagens: T[],
): Array<{ dia: string; mensagens: T[] }> {
  const grupos: Array<{ dia: string; mensagens: T[] }> = [];
  for (const msg of mensagens) {
    const dia = formatarRotuloDia(msg.enviadoEm);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) {
      ultimo.mensagens.push(msg);
    } else {
      grupos.push({ dia, mensagens: [msg] });
    }
  }
  return grupos;
}

/** Nome de exibição derivado da parte local do e-mail. */
export function nomeExibicaoDoEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) return email;
  if (local.length < 2) return email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Tempo restante até o fim da janela Cloud API. Retorna `null` se já expirou. */
export function tempoRestanteJanela(
  expiraEm: string,
  agora: Date = new Date(),
): { horas: number; minutos: number } | null {
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  if (ms <= 0) return null;
  const totalMinutos = Math.floor(ms / 60_000);
  return {
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
  };
}

/** Formata countdown da janela de 24h para exibição no header. */
export function formatarCountdownJanela(tempo: { horas: number; minutos: number }): string {
  const rotuloHoras = tempo.horas === 1 ? "hora" : "horas";
  const rotuloMinutos = tempo.minutos === 1 ? "minuto" : "minutos";
  return `${tempo.horas} ${rotuloHoras} e ${tempo.minutos} ${rotuloMinutos}`;
}

const PREVIEW_POR_CORPO: Record<string, string> = {
  "[imagem]": "Imagem",
  "[vídeo]": "Vídeo",
  "[video]": "Vídeo",
  "[áudio]": "Áudio",
  "[audio]": "Áudio",
  "[documento]": "Documento",
  "[sticker]": "Figurinha",
  "[localização]": "Localização",
  "[reação]": "Reação",
  "[enquete]": "Enquete",
  "[contato]": "Contato",
  "[evento]": "Evento",
  "[interativo]": "Mensagem interativa",
  "[resposta interativa]": "Resposta interativa",
};

const PLACEHOLDERS_MIDIA = new Set([
  "[imagem]",
  "[vídeo]",
  "[video]",
  "[áudio]",
  "[audio]",
  "[documento]",
  "[sticker]",
]);

/** Indica se o corpo é só placeholder de mídia (sem legenda real). */
export function isCorpoPlaceholderMidia(corpo: string | null | undefined): boolean {
  const texto = corpo?.trim() ?? "";
  return PLACEHOLDERS_MIDIA.has(texto);
}

/** Preview amigável da última mensagem na lista de conversas. */
export function formatarPreviewMensagem(
  corpo: string | null | undefined,
  tipo?: string | null,
): string {
  const texto = corpo?.trim() ?? "";
  if (!texto && !tipo) return "";

  switch (tipo) {
    case "image":
      return texto && !isCorpoPlaceholderMidia(texto) ? texto : "Imagem";
    case "video":
      return texto && !isCorpoPlaceholderMidia(texto) ? texto : "Vídeo";
    case "audio":
      return "Áudio";
    case "document":
      return texto && !isCorpoPlaceholderMidia(texto) ? texto : "Documento";
    case "sticker":
      return "Figurinha";
    case "reaction":
      return texto ? `Reagiu com ${texto}` : "Reação";
    case "poll": {
      if (!texto || texto === "[enquete]") return "Enquete";
      const sep = texto.indexOf(": ");
      const nome = sep === -1 ? texto : texto.slice(0, sep);
      return `Enquete: ${nome}`;
    }
    case "contacts":
      return texto ? `Contato: ${texto}` : "Contato";
    case "event":
      return texto ? `Evento: ${texto}` : "Evento";
    case "location":
      return "Localização";
    case "interactive":
      if (texto && !texto.startsWith("[")) return texto;
      return "Mensagem interativa";
    default:
      break;
  }

  if (texto && PREVIEW_POR_CORPO[texto]) return PREVIEW_POR_CORPO[texto]!;
  return texto;
}
