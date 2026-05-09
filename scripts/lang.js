// ── Language dictionaries ──────────────────────────────────────────────────
// Keys are referenced via `data-i18n="..."` attributes in the HTML.
// Missing translations gracefully fall back to the original DOM text.

export const translations = {
  de: {
    sourceTitle: 'Bildquelle',
    dropzoneBig: 'Bild auswählen',
    profileTitle: 'Druckerprofil',
    adjustTitle: 'Bildanpassung',
    presetsTitle: 'Presets',
    errorsTitle: 'Hardware Fehler',
    advancedTitle: 'Erweitert',
    btnRender: 'Manuell Rendern',
    previewTitle: 'Live-Vorschau',
    halftoneTitle: 'Halftone',
    paperFormatTitle: 'Papier & Format',
    inkTitle: 'Tinte',
    paperTitle: 'Papier',
    doubleStrike: 'Double-strike',
    condensedMode: 'Condensed Mode',
    invert: 'Invert Image',
    brightness: 'Helligkeit',
    contrast: 'Kontrast',
    gamma: 'Gamma',
    btnExport: 'Export YAML',
    btnImport: 'Import YAML',
    btnSavePreset: 'Speichern',
    createPresetTitle: 'Preset Erstellen / Code',
    systemTitle: 'System Settings',
  },
  en: {
    sourceTitle: 'Image Source',
    dropzoneBig: 'Select Image',
    profileTitle: 'Printer Profile',
    adjustTitle: 'Adjustments',
    presetsTitle: 'Presets',
    errorsTitle: 'Hardware Errors',
    advancedTitle: 'Advanced',
    btnRender: 'Manual Render',
    previewTitle: 'Live Preview',
    halftoneTitle: 'Halftone',
    paperFormatTitle: 'Paper & Format',
    inkTitle: 'Ink',
    paperTitle: 'Paper',
    doubleStrike: 'Double-strike',
    condensedMode: 'Condensed Mode',
    invert: 'Invert Image',
    brightness: 'Brightness',
    contrast: 'Contrast',
    gamma: 'Gamma',
    btnExport: 'Export YAML',
    btnImport: 'Import YAML',
    btnSavePreset: 'Save',
    createPresetTitle: 'Create Preset / Code',
    systemTitle: 'System Settings',
  },
};

export function applyLanguage(lang) {
  const resolvedLang = Object.keys(translations).includes(lang) ? lang : 'de';
  const dict = translations[resolvedLang];

  // Update html lang attribute (M3)
  document.documentElement.lang = resolvedLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  // Sync all lang selectors on page (M3: multiple selectors for same setting)
  document.querySelectorAll('#langSelector').forEach((sel) => {
    if (sel.value !== resolvedLang) sel.value = resolvedLang;
  });
}
