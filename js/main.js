:root {
  --accent: #f5a623; 
  --accent-soft: rgba(245, 166, 35, 0.2);
  --accent-alt: #d97706; 
}

body[data-accent="cyan"] { --accent: #06b6d4; --accent-soft: rgba(6, 182, 212, 0.2); --accent-alt: #0ea5e9; }
body[data-accent="amber"] { --accent: #f5a623; --accent-soft: rgba(245, 166, 35, 0.2); --accent-alt: #d97706; }
body[data-accent="toxic"] { --accent: #10b981; --accent-soft: rgba(16, 185, 129, 0.2); --accent-alt: #059669; }
body[data-accent="vapor"] { --accent: #d946ef; --accent-soft: rgba(217, 70, 239, 0.25); --accent-alt: #8b5cf6; }
body[data-accent="classic"] { --accent: #ea580c; --accent-soft: rgba(234, 88, 12, 0.2); --accent-alt: #78716c; }

body.dark-mode {
  --bg-color: #0d0d10; --glass-bg: rgba(255, 255, 255, 0.05); --glass-border: rgba(255, 255, 255, 0.12);
  --glass-highlight: rgba(255, 255, 255, 0.20); --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
  --ink: #ffffff; --ink-soft: #9ca3af; --paper-dark: rgba(0, 0, 0, 0.35); 
}

body.light-mode {
  --bg-color: #e5e7eb; --glass-bg: rgba(255, 255, 255, 0.45); --glass-border: rgba(255, 255, 255, 0.6);
  --glass-highlight: rgba(255, 255, 255, 0.9); --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  --ink: #1f2937; --ink-soft: #5b6573; --paper-dark: rgba(255, 255, 255, 0.7);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

body { position: fixed; inset: 0; overflow: hidden; overscroll-behavior: none; margin: 0; padding: 0; height: 100dvh; width: 100vw; z-index: 1; font-family: 'Outfit', system-ui, sans-serif; font-size: 13.5px; line-height: 1.45; background-color: var(--bg-color); color: var(--ink); transition: background-color 0.3s; }

h2, .btn, .dropzone .big, .status-large, .er-name, .sli-name, .header-fancy, .app-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 500; }
.dropzone .big { font-weight: 700; font-size: 26px; }
.app-logo { font-size: 18px; font-weight: 700; letter-spacing: 0.05em; color: var(--ink); }
.ascii, .yaml-area, .text-input, .profile-meta, .er-val, .hex-input { font-family: 'JetBrains Mono', monospace; }
input[type="file"] { display: none; }

.app-bg { position: absolute; inset: 0; z-index: -2; background: var(--bg-color); overflow: hidden; pointer-events: none; transition: opacity 0.5s; }
.app-bg .orb { position: absolute; border-radius: 50%; opacity: 0.3; mix-blend-mode: screen; will-change: transform; }
.app-bg .orb-1 { width: 70vw; height: 70vw; background: radial-gradient(circle at center, var(--accent) 0%, transparent 65%); top: -20%; left: -20%; }
.app-bg .orb-2 { width: 60vw; height: 60vw; background: radial-gradient(circle at center, var(--accent-alt) 0%, transparent 65%); bottom: -20%; right: -20%; }

.app-bg[data-anim="drift"] .orb-1 { animation: drift1 20s infinite alternate ease-in-out; }
.app-bg[data-anim="drift"] .orb-2 { animation: drift2 25s infinite alternate ease-in-out; }
@keyframes drift1 { 0% { transform: translate3d(0, 0, 0); } 100% { transform: translate3d(15vw, 15vh, 0); } }
@keyframes drift2 { 0% { transform: translate3d(0, 0, 0); } 100% { transform: translate3d(-15vw, -10vh, 0); } }
.app-bg[data-anim="breathe"] .orb-1 { animation: breathe1 8s infinite alternate ease-in-out; }
.app-bg[data-anim="breathe"] .orb-2 { animation: breathe2 10s infinite alternate ease-in-out; }
@keyframes breathe1 { 0% { transform: scale3d(0.8, 0.8, 1); opacity: 0.2; } 100% { transform: scale3d(1.2, 1.2, 1); opacity: 0.5; } }
@keyframes breathe2 { 0% { transform: scale3d(1.2, 1.2, 1); opacity: 0.5; } 100% { transform: scale3d(0.8, 0.8, 1); opacity: 0.2; } }
.app-bg[data-anim="orbit"] .orb-1 { animation: orbit1 25s infinite linear; }
.app-bg[data-anim="orbit"] .orb-2 { animation: orbit2 30s infinite linear reverse; }
@keyframes orbit1 { 0% { transform: rotate(0deg) translateX(10vw) rotate(0deg); } 100% { transform: rotate(360deg) translateX(10vw) rotate(-360deg); } }
@keyframes orbit2 { 0% { transform: rotate(0deg) translateX(8vw) rotate(0deg); } 100% { transform: rotate(360deg) translateX(8vw) rotate(-360deg); } }

.glass-panel { background: var(--glass-bg); backdrop-filter: blur(25px) saturate(120%); -webkit-backdrop-filter: blur(25px) saturate(120%); border: 1px solid var(--glass-border); border-top-color: var(--glass-highlight); border-left-color: var(--glass-highlight); box-shadow: var(--glass-shadow); border-radius: 20px; overflow: hidden; }

.app-container { display: flex; height: 100%; width: 100%; gap: 16px; padding: 16px; min-height: 0; z-index: 1;}
.activity-bar { width: 75px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 12px; }

.icon-btn { font-size: 24px; width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; cursor: pointer; opacity: 0.4; transition: 0.3s; border-radius: 15px; background: transparent; border: 1px solid transparent; }
.icon-btn:hover { opacity: 0.8; background: rgba(255,255,255,0.05); }
.icon-btn.active { opacity: 1; background: rgba(0,0,0,0.25); border-color: var(--glass-border); box-shadow: inset 0 2px 6px rgba(0,0,0,0.3); }
.spacer { flex-grow: 1; }

.sidebar { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; }
.sidebar-scrollable { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; -webkit-overflow-scrolling: touch; padding-bottom: 30px; overscroll-behavior: contain; }
.tab-content { display: none; padding: 24px; }
.tab-content.active { display: block; }

.main-editor { flex-grow: 1; display: flex; flex-direction: column; position: relative; min-height: 0;}
.toolbar { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); z-index: 10;}
.canvas-wrapper { flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; touch-action: none; cursor: grab; padding: 30px; position: relative; }
.canvas-wrapper:active { cursor: grabbing; }
.zoom-container { transform-origin: center center; display: flex; flex-direction: column; align-items: center; gap: 20px; }
canvas { background: #fff; box-shadow: 0 10px 50px rgba(0,0,0,0.6); border-radius: 8px; max-width: none; }

.floating-container { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px; z-index: 50; width: 100%; max-width: 420px; padding: 0 20px; pointer-events: none; }
.status-panel { width: 100%; padding: 10px 16px; border-radius: 12px; pointer-events: auto; display: flex; justify-content: center; align-items: center; background: var(--paper-dark); border: 1px solid var(--glass-border); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); }
.status-large { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--accent); text-align: center; font-weight: 700; }
.floating-actions { width: 100%; padding: 16px; border-radius: 16px; pointer-events: auto; }
.action-buttons { display: flex; gap: 12px; width: 100%; }

h2 { font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 14px; color: var(--ink-soft); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.dropzone { flex-shrink: 0; min-height: 120px; display: flex; flex-direction: column; justify-content: center; background: var(--paper-dark); border: 1px dashed var(--glass-border); border-radius: 12px; padding: 20px 10px; text-align: center; cursor: pointer; transition: 0.3s; }
.dropzone:hover { border-color: var(--accent); background: rgba(0,0,0,0.5); }
.dropzone .big { margin-bottom: 6px; }
.dropzone .small { font-size: 10px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.1em; }

.scroll-list { max-height: 280px; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--paper-dark);}
.sli { padding: 14px 16px; border-bottom: 1px solid var(--glass-border); cursor: pointer; transition: 0.2s; }
.sli:last-child { border-bottom: 0; }
.sli:hover { background: rgba(255,255,255,0.1); }
.sli.active { background: var(--accent); color: #000; }
.sli-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.sli-badge { font-size: 9px; padding: 2px 6px; border: 1px solid currentColor; border-radius: 4px; font-family: 'Space Grotesk', sans-serif;}
.sli-del { font-size: 16px; opacity: 0.4; border: none; background: transparent; color: inherit; cursor: pointer; padding: 0 5px;}
.sli-del:hover { opacity: 1; color: #f33; }

.checks { display: flex; flex-direction: column; gap: 12px; }
.check { display: flex; align-items: center; gap: 14px; cursor: pointer; font-size: 11px; text-transform: uppercase; padding: 8px 0; transition: transform 0.2s ease; font-weight: 500;}
.check .box { width: 22px; height: 22px; border: 1.5px solid var(--glass-border); border-radius: 7px; position: relative; background: rgba(0,0,0,0.2); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.check:hover .box { border-color: var(--accent); background: rgba(255,255,255,0.05); }
.check.on .box { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 15px var(--accent-soft), inset 0 0 5px rgba(255,255,255,0.3); transform: scale(1.05); }
.check .box::after, .er-check::after { content: ""; position: absolute; top: 45%; left: 50%; width: 5px; height: 10px; border: solid #000; border-width: 0 2.5px 2.5px 0; transform: translate(-50%, -50%) rotate(45deg) scale(0); opacity: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.check.on .box::after, .er.on .er-check::after { transform: translate(-50%, -50%) rotate(45deg) scale(1); opacity: 1; }
.check span:not(.box) { letter-spacing: 0.1em; color: var(--ink-soft); transition: 0.2s ease; }
.check.on span:not(.box) { color: var(--ink); font-weight: 700; }

.error-container { background: var(--paper-dark); border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; }
.er { border-bottom: 1px solid var(--glass-border); background: transparent; transition: background 0.2s; }
.er:last-child { border-bottom: none; }
.er-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; transition: background 0.2s; }
.er-head:hover { background: rgba(255,255,255,0.05); }
.er-check { width: 18px; height: 18px; border: 1.5px solid var(--glass-border); border-radius: 5px; position: relative; background: rgba(0,0,0,0.2); transition: all 0.3s; }
.er.on .er-check { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px var(--accent-soft); }
.er-name { font-size: 12px; text-transform: uppercase; flex-grow: 1; letter-spacing: 0.05em; color: var(--ink); transition: 0.3s; }
.er-val { font-size: 11px; color: var(--ink-soft); }
.er.on .er-val { color: var(--accent); font-weight: 700; }
.er-body { display: none; padding: 0 16px 16px 16px; }
.er.on .er-body { display: block; }
.er[data-pattern="cloudy"] .er-name { filter: blur(0.8px); opacity: 0.8; }
.er[data-pattern="ghosting"] .er-name { text-shadow: 2px 0 0 rgba(255,255,255,0.4), -2px 0 0 rgba(255,255,255,0.2); }
.er[data-pattern="misaligned"] .er-name { display: inline-block; transform: skewX(-12deg); }
.er[data-pattern="pin_skip"] .er-name { background: repeating-linear-gradient(180deg, var(--ink) 0, var(--ink) 2px, transparent 2px, transparent 4px); -webkit-background-clip: text; color: transparent; }
.er[data-pattern="smudge"] .er-name { text-shadow: 1px 1px 3px rgba(255,255,255,0.6); }
.er[data-pattern="ink_starved"] .er-name { background: linear-gradient(90deg, var(--ink) 0%, transparent 100%); -webkit-background-clip: text; color: transparent; }

.btn { flex: 1; padding: 14px; border: 1px solid var(--glass-border); background: var(--paper-dark); color: var(--ink); border-radius: 10px; cursor: pointer; text-transform: uppercase; transition: 0.3s; letter-spacing: 0.1em; }
.btn.primary { background: var(--accent); color: #000; border: none; box-shadow: 0 4px 20px var(--accent-soft); }
.btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.2); }
.btn:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); box-shadow: none; transform: none; }
.btn-sm { padding: 10px 14px; border: 1px solid var(--glass-border); background: var(--paper-dark); color: var(--ink); cursor: pointer; border-radius: 8px; font-size: 12px; text-transform: uppercase; transition: 0.2s;}
.btn-sm:hover { border-color: var(--accent); background: rgba(0,0,0,0.5);}

/* Originale Font-Sizes für Inputs (kein 16px Zwang mehr) */
.text-input, .color-picker, select, input[type="text"] { width: 100%; color: var(--ink); padding: 12px; font-size: 12px; transition: 0.2s; background: var(--paper-dark); border: 1px solid var(--glass-border); border-radius: 12px;}
.text-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 10px var(--accent-soft);}
.yaml-area { resize: vertical; font-size: 11px; }

label.field { display: block; margin-top: 16px; }
label.field .name { font-size: 11px; font-weight: 500; text-transform: uppercase; display: flex; justify-content: space-between; margin-bottom: 8px; letter-spacing: 0.1em;}
label.field .name b { color: var(--accent); }

input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
input[type=range]::-webkit-slider-runnable-track { height: 6px; background: var(--glass-border); border-radius: 3px; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: var(--accent); margin-top: -6px; cursor: pointer; box-shadow: 0 0 12px var(--accent-soft);}

.swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.swatch { width: 34px; height: 34px; border: 1px solid var(--glass-border); cursor: pointer; border-radius: 8px; position: relative; }
.swatch.active::after { content: ""; position: absolute; inset: -4px; border: 2px solid var(--accent); border-radius: 10px; pointer-events: none; }
.custom-ink-row { display: flex; gap: 8px; align-items: center; margin-top: 10px;}
.color-picker { width: 36px; height: 36px; padding: 0; cursor: pointer; }

.segmented { overflow: hidden; display: flex; background: var(--paper-dark); border: 1px solid var(--glass-border); border-radius: 12px;}
.segmented.scrollable { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.segmented button { flex: 1; background: transparent; border: none; border-right: 1px solid var(--glass-border); color: var(--ink); padding: 12px 4px; cursor: pointer; font-size: 11px; font-family: 'Space Grotesk', sans-serif; text-transform: uppercase; min-width: 65px; transition: 0.2s;}
.segmented button:last-child { border-right: none; }
.segmented button.active { background: var(--accent); color: #000; font-weight: bold;}

.ascii { background: rgba(0,0,0,0.8); color: var(--accent); padding: 15px; border-radius: 8px; font-size: 14px; line-height: 0.9; white-space: pre; border: 1px solid var(--glass-border); }
.ascii.empty { color: var(--ink-soft); display: none; }

.zoom-controls button { background: var(--paper-dark); border: 1px solid var(--glass-border); color: var(--ink); cursor: pointer; border-radius: 8px; padding: 6px 12px; margin: 0 5px; transition: 0.2s; font-family: inherit;}
.zoom-controls button:hover, .zoom-controls button.active { background: var(--accent-soft); border-color: var(--accent);}
.zoom-controls span { font-size: 12px; display: inline-block; width: 45px; text-align: center; }

@media (orientation: portrait), (max-width: 900px) {
  .app-container { flex-direction: column; padding: 12px; gap: 12px; }
  .activity-bar { width: 100%; height: auto; flex-direction: row; justify-content: center; padding: 10px; gap: 20px; order: 1; }
  .main-editor { width: 100%; flex: 1 1 45%; order: 2; min-height: 400px; }
  .sidebar { width: 100%; flex: 1 1 55%; order: 3; }
  .floating-container { padding: 0 12px; max-width: 100%; width: calc(100% - 24px); bottom: 12px; }
}

/* ==================== FANCY ERROR POPUP ==================== */
.error-popup {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%) translateY(-150%);
  width: 90%; max-width: 400px; z-index: 9999;
  background: rgba(30, 0, 0, 0.75); border: 1px solid rgba(255, 50, 50, 0.4);
  box-shadow: 0 10px 40px rgba(255, 0, 0, 0.25); border-radius: 16px;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex; flex-direction: column; padding: 16px; gap: 8px;
}
.error-popup.show { transform: translateX(-50%) translateY(0); }
.error-header { color: #ff5555; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; }
.error-body { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #fff; word-break: break-word; line-height: 1.4; }
