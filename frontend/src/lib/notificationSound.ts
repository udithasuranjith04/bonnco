// Synthesized notification chimes via the Web Audio API — no audio file to fetch or bundle, and
// the tone shape itself signals urgency (a sharper double-beep for critical alerts, a soft single
// chime for routine ones), the way trading terminals differentiate alert sounds by severity.
import type { AlertSeverity } from "../contexts/AlertsContext";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function tone(audioCtx: AudioContext, freq: number, startAt: number, duration: number, peakGain: number): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

const SEVERITY_TONES: Record<AlertSeverity, (audioCtx: AudioContext) => void> = {
  critical: (audioCtx) => {
    const now = audioCtx.currentTime;
    tone(audioCtx, 740, now, 0.14, 0.16);
    tone(audioCtx, 740, now + 0.18, 0.14, 0.16);
  },
  warning: (audioCtx) => {
    const now = audioCtx.currentTime;
    tone(audioCtx, 600, now, 0.18, 0.13);
  },
  positive: (audioCtx) => {
    const now = audioCtx.currentTime;
    tone(audioCtx, 660, now, 0.11, 0.11);
    tone(audioCtx, 990, now + 0.1, 0.16, 0.11);
  },
  info: (audioCtx) => {
    const now = audioCtx.currentTime;
    tone(audioCtx, 880, now, 0.13, 0.1);
    tone(audioCtx, 1180, now + 0.09, 0.14, 0.09);
  },
};

export function playNotificationSound(severity: AlertSeverity): void {
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  try {
    SEVERITY_TONES[severity](audioCtx);
  } catch {
    // Non-critical — a failed chime should never break the notification itself.
  }
}
