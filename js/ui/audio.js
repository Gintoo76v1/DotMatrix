// ── UI feedback sounds ──────────────────────────────────────────────────────
// Low-key click sound generated on demand by a triangle oscillator.
// Audio context is lazy-created on first user interaction (Safari/iOS rule).

import { state } from '../config.js';

let audioCtx = null;

function ensureCtx() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* ignore — Audio API blocked or unsupported */
  }
}

export function initAudio() {
  // Pre-warm on first interaction so the click in the same handler can play.
  document.addEventListener('touchstart', ensureCtx, { once: true, passive: true });
  document.addEventListener('mousedown',  ensureCtx, { once: true, passive: true });
}

const MASTER_VOLUME = 0.35; // -9 dB relative to previous levels

function _smoothEnvelope(gainNode, t0, peakGain, attackMs, decayMs) {
  const attack = attackMs / 1000;
  const decay = decayMs / 1000;
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

export function playClickSound() {
  if (!state.uiSounds) return;
  ensureCtx();
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t0);
    osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.04);
    _smoothEnvelope(gain, t0, 0.04 * MASTER_VOLUME, 3, 45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  } catch {
    /* swallow */
  }
}

export function playToggleSound(on) {
  if (!state.uiSounds) return;
  ensureCtx();
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    // Softer, shorter blip — on=slightly higher pitch
    osc.frequency.setValueAtTime(on ? 900 : 700, t0);
    _smoothEnvelope(gain, t0, 0.035 * MASTER_VOLUME, 2, 35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  } catch {
    /* swallow */
  }
}
