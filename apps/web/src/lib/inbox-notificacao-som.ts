/**
 * Som curto de notificação via Web Audio API (sem asset binário).
 * Desbloqueia no primeiro gesto do usuário (política de autoplay).
 */

let ctx: AudioContext | null = null;
let desbloqueado = false;
let listenersAtivos = false;

function obterContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

function desbloquear() {
  const audio = obterContexto();
  if (!audio) return;
  void audio.resume().then(() => {
    desbloqueado = audio.state === "running";
  });
}

/** Registra listeners one-shot para desbloquear áudio no primeiro gesto. */
export function garantirUnlockSomNotificacao() {
  if (typeof window === "undefined" || listenersAtivos || desbloqueado) return;
  listenersAtivos = true;
  const once = () => {
    desbloquear();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}

/** Toca um beep curto (~180ms). No-op se ainda bloqueado ou sem AudioContext. */
export function tocarSomNotificacao() {
  const audio = obterContexto();
  if (!audio) return;
  if (audio.state === "suspended") {
    void audio.resume();
  }
  if (audio.state !== "running" && !desbloqueado) return;

  const agora = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, agora);
  osc.frequency.exponentialRampToValueAtTime(660, agora + 0.12);
  gain.gain.setValueAtTime(0.0001, agora);
  gain.gain.exponentialRampToValueAtTime(0.12, agora + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.18);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(agora);
  osc.stop(agora + 0.2);
}
