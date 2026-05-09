// ── Image upload (file input + drag-drop) ──────────────────────────────────

import { setSliderValue } from './sliders.js';
import { detectAndSetPaperColor, analyzeAndAdaptImage } from './analyze.js';
import { showError } from './error.js';
import { queueBlobUpload } from '../sync.js';

const A4_LONG_INCH = 297 / 25.4;

function estimateDpiFromImageSize(img) {
  return Math.max(
    100,
    Math.min(1200, Math.round(Math.max(img.width, img.height) / A4_LONG_INCH / 50) * 50)
  );
}

export function initUpload(state, opts) {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const outCanvas = document.getElementById('outCanvas');
  const renderBtn = document.getElementById('renderBtn');
  const dzBig = document.getElementById('dzBig');
  const dzSmall = document.getElementById('dzSmall');
  if (!dropzone || !fileInput) return;

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showError('Bitte wähle eine gültige Bilddatei aus (PNG, JPG, WebP).');
      return;
    }
    if (opts.setStatus) opts.setStatus('Lade Bild...');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dpi = estimateDpiFromImageSize(img);
      setSliderValue(state, 'dpi', dpi);

      state.sourceImage = img;
      detectAndSetPaperColor(state, img);
      analyzeAndAdaptImage(state, img);

      if (dzBig) dzBig.textContent = file.name;
      if (dzSmall) dzSmall.textContent = `${img.width} × ${img.height}`;

      // Initial preview: scaled bitmap, replaced when render() resolves.
      if (outCanvas) {
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        outCanvas.width = Math.round(img.width * scale);
        outCanvas.height = Math.round(img.height * scale);
        outCanvas.getContext('2d').drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
      }

      if (renderBtn) renderBtn.disabled = false;
      document.getElementById('ascii')?.classList.add('empty');
      URL.revokeObjectURL(img.src);

      // Notify other modules (footer filename, etc.)
      document.dispatchEvent(new CustomEvent('dm:imageLoaded', { detail: { name: file.name } }));

      // Queue image for cloud sync (Phase F)
      if (state.currentProjectId) {
        queueBlobUpload(state.currentProjectId, 'source_image', file, file.name, file.type).catch(
          console.error
        );
      }

      opts.onLoad();
    };
    img.onerror = () => {
      showError('Das Bild konnte nicht geladen werden (eventuell korrupt).');
      if (opts.setStatus) opts.setStatus('Ladefehler');
      URL.revokeObjectURL(img.src);
    };
    img.src = url;
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}
