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

export function playClickSound() {
  if (!state.uiSounds) return;
  ensureCtx();
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t0);
    osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.06);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.10);
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
    osc.frequency.setValueAtTime(on ? 1000 : 500, t0);
    gain.gain.setValueAtTime(0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  } catch {
    /* swallow */
  }
}
