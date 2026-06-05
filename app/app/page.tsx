import Script from 'next/script';

export const metadata = {
  title: 'DotMatrix Studio',
};

export default function AppPage() {
  return (
    <>
      <div id="appSplash" className="app-splash">
        <div className="splash-scanline"></div>
        <div className="splash-inner">
          <div className="splash-logo">DotMatrix Studio</div>
          <div className="splash-dots"><span></span><span></span><span></span><span></span><span></span></div>
          <div className="splash-author">von <span className="author-name" id="authorName" title="Klick mich 3x">Gintoo</span></div>
        </div>
        <div className="splash-bar"></div>
      </div>

      <div className="app-bg" id="appBg" data-anim="drift">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div className="app-layout">
        <div className="app-container">
          <nav className="activity-bar glass-panel">
            <div className="icon-btn active" data-tab="tab-source" title="Quelle">🖨️</div>
            <div className="icon-btn" data-tab="tab-presets" title="Presets">📂</div>
            <div className="icon-btn" data-tab="tab-history" title="Historie">⏳</div>
            <div className="icon-btn" data-tab="tab-errors" title="Hardware">🔧</div>
            <div className="spacer"></div>
            <div className="icon-btn toggle-btn" id="sidebarToggleBtn" title="Sidebar umschalten">
              <span className="toggle-chevron"></span>
            </div>
            <div className="icon-btn" data-tab="tab-system" title="System">⚙️</div>
          </nav>

          <aside className="sidebar glass-panel">
            <div className="sidebar-scrollable">
              <div className="tab-content active" id="tab-source">
                <div className="sidebar-logo">DotMatrix Studio</div>
                <h2 data-i18n="sourceTitle">Bildquelle</h2>
                <div id="dropzone" className="dropzone">
                  <div className="big" id="dzBig" data-i18n="dropzoneBig">Bild auswählen</div>
                  <div className="small" id="dzSmall">PNG · JPG · HEIC · WebP</div>
                  <input type="file" id="fileInput" accept="image/*" />
                </div>

                <h2 data-i18n="profileTitle" style={{ marginTop: '24px' }}>Druckerprofil</h2>
                <div className="scroll-list" id="profileList">
                  {[
                    { id: 'epson_fx', name: 'Epson FX-80', badge: '9-PIN' },
                    { id: 'epson_lq', name: 'Epson LQ-850', badge: '24-PIN' },
                    { id: 'ibm_proprinter', name: 'IBM Proprinter', badge: '9-PIN' },
                    { id: 'oki_microline', name: 'OKI Microline', badge: '9-PIN', active: true },
                    { id: 'star_nx1000', name: 'Star NX-1000', badge: '9-PIN' },
                    { id: 'panasonic_kx', name: 'Panasonic KX-P', badge: '24-PIN' },
                    { id: 'dec_la75', name: 'DEC LA75', badge: '9-PIN' },
                    { id: 'nec_p6', name: 'NEC P6', badge: '24-PIN' },
                    { id: 'commodore_mps', name: 'MPS-803', badge: '7-PIN' },
                    { id: 'apple_imagewriter', name: 'ImageWriter II', badge: '9-PIN' },
                  ].map((p) => (
                    <button key={p.id} type="button" className={`sli${p.active ? ' active' : ''}`} data-profile={p.id}>
                      <div className="sli-row">
                        <span className="sli-name">{p.name}</span>
                        <span className="sli-badge">{p.badge}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="profile-meta" id="profileMeta"></div>
                <div className="checks" style={{ marginTop: '12px' }}>
                  <label className="check" data-flag="doubleStrike"><span className="box"></span><span data-i18n="doubleStrike">Double-strike</span></label>
                  <label className="check" data-flag="condensed"><span className="box"></span><span data-i18n="condensedMode">Condensed Mode</span></label>
                </div>

                <h2 data-i18n="adjustTitle" style={{ marginTop: '24px' }}>Bildanpassung</h2>
                <label className="field"><span className="name"><span data-i18n="brightness">Helligkeit</span><b id="brightnessVal">0</b></span><input type="range" id="brightnessSlider" min="-100" max="100" defaultValue="0" /></label>
                <label className="field"><span className="name"><span data-i18n="contrast">Kontrast</span><b id="contrastVal">20</b></span><input type="range" id="contrastSlider" min="-100" max="100" defaultValue="20" /></label>
                <label className="field"><span className="name"><span data-i18n="gamma">Gamma</span><b id="gammaVal">1.0</b></span><input type="range" id="gammaSlider" min="0.1" max="3.0" step="0.1" defaultValue="1.0" /></label>
                <div className="checks" style={{ marginTop: '12px' }}>
                  <label className="check" data-flag="invert"><span className="box"></span><span data-i18n="invert">Invert Image</span></label>
                </div>

                <h2 data-i18n="halftoneTitle" style={{ marginTop: '24px' }}>Halftone</h2>
                <div className="segmented" id="ditherBtns">
                  <button data-dither="floyd_steinberg">Floyd-S</button>
                  <button data-dither="ordered">Ordered</button>
                  <button data-dither="threshold" className="active">Thresh</button>
                </div>
                <label className="field" id="thresholdField" style={{ display: 'block', marginTop: '12px' }}>
                  <span className="name"><span>Threshold</span><b id="thresholdVal">128</b></span>
                  <input type="range" id="thresholdSlider" min="0" max="255" defaultValue="128" />
                </label>

                <h2 style={{ marginTop: '24px' }}>Druck-Mathematik</h2>
                <div className="segmented" id="mathVersionBtns">
                  <button data-mathv="legacy">Legacy</button>
                  <button data-mathv="v1" className="active">V1</button>
                  <button data-mathv="v2">V2</button>
                </div>

                <h2 data-i18n="paperFormatTitle" style={{ marginTop: '24px' }}>Paper &amp; Format</h2>
                <div className="segmented scrollable" id="paperFormatBtns" style={{ marginBottom: '12px' }}>
                  <button data-format="Original" className="active">Orig</button>
                  <button data-format="Fit">Auto</button>
                  <button data-format="A4">A4</button>
                  <button data-format="A5">A5</button>
                  <button data-format="Letter">Letter</button>
                </div>
                <div className="segmented" id="orientationBtns">
                  <button data-orient="Portrait" className="active">Portrait</button>
                  <button data-orient="Landscape">Landscape</button>
                </div>

                <div className="grid-2" style={{ marginTop: '24px' }}>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }} data-i18n="inkTitle">Tinte</div>
                    <div className="swatches" id="inkSwatches">
                      <button type="button" className="swatch active" style={{ background: '#19191e' }} data-ink="25,25,30" aria-label="Tinte Schwarz"></button>
                      <button type="button" className="swatch" style={{ background: '#142d82' }} data-ink="20,45,130" aria-label="Tinte Blau"></button>
                      <button type="button" className="swatch" style={{ background: '#a01e23' }} data-ink="160,30,35" aria-label="Tinte Rot"></button>
                      <button type="button" className="swatch" style={{ background: '#4a2c6e' }} data-ink="74,44,110" aria-label="Tinte Violett"></button>
                      <button type="button" className="swatch custom-swatch" id="customInkSwatch" style={{ background: '#19191e' }} aria-label="Eigene Tinte"></button>
                      <div className="swatch swatch-add" id="inkAddSwatch" title="Benutzerdefinierte Farbe">
                        <span>+</span>
                        <input type="color" id="inkColorPickerAdd" className="color-picker-hidden" defaultValue="#19191e" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }} data-i18n="paperTitle">Papier</div>
                    <div className="swatches" id="paperSwatches">
                      <button type="button" className="swatch" style={{ background: '#f8f5e8' }} data-paper="248,245,232" aria-label="Papier Creme"></button>
                      <button type="button" className="swatch active" style={{ background: '#ffffff' }} data-paper="255,255,255" aria-label="Papier Weiß"></button>
                      <button type="button" className="swatch" style={{ background: '#eadfb8' }} data-paper="234,223,184" aria-label="Papier Alt"></button>
                      <button type="button" className="swatch" style={{ background: '#d8c8a0' }} data-paper="216,200,160" aria-label="Papier Gelblich"></button>
                      <button type="button" className="swatch" style={{ background: '#f0f0f0' }} data-paper="240,240,240" aria-label="Papier Hellgrau"></button>
                      <button type="button" className="swatch custom-swatch" id="customPaperSwatch" style={{ background: '#ffffff' }} aria-label="Eigenes Papier"></button>
                      <div className="swatch swatch-add" id="paperAddSwatch" title="Benutzerdefinierte Farbe">
                        <span>+</span>
                        <input type="color" id="paperColorPickerAdd" className="color-picker-hidden" defaultValue="#ffffff" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tab-content" id="tab-presets">
                <div className="sidebar-logo">DotMatrix Studio</div>
                <h2 data-i18n="presetsTitle">Gespeicherte Presets</h2>
                <div className="scroll-list" id="presetList"></div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn-sm" id="exportPresetBtn" data-i18n="btnExport" style={{ flex: 1 }}>Export YAML</button>
                  <button className="btn-sm" id="importPresetBtn" data-i18n="btnImport" style={{ flex: 1 }}>Import YAML</button>
                  <input type="file" id="presetFileInput" accept=".yaml,.yml,.json" style={{ display: 'none' }} />
                </div>
                <h2 style={{ marginTop: '32px' }} data-i18n="createPresetTitle">Preset Erstellen / Code</h2>
                <input type="text" id="presetNameInput" className="text-input" placeholder="Name für Preset" aria-label="Preset-Name" />
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button className="btn-sm" id="savePresetBtn" style={{ flex: 1 }} data-i18n="btnSavePreset">Speichern</button>
                  <button className="btn-sm" id="exportCurrentBtn" style={{ flex: 1 }}>Als YAML exportieren</button>
                </div>
                <textarea id="presetYamlArea" className="yaml-area text-input" placeholder="YAML Code hier einfügen..." rows={10} style={{ marginTop: '16px' }} aria-label="YAML-Code"></textarea>
                <button className="btn-sm" id="importYamlBtn" style={{ width: '100%', marginTop: '10px' }}>Aus Textfeld anwenden</button>
              </div>

              <div className="tab-content" id="tab-history">
                <div className="sidebar-logo">DotMatrix Studio</div>
                <h2>Verlauf</h2>
                <p style={{ color: 'var(--dm-text-weak)', fontSize: '12px', marginTop: '4px' }}>Klicke auf den Tab, um den Projektverlauf zu laden.</p>
              </div>

              <div className="tab-content" id="tab-errors">
                <div className="sidebar-logo">DotMatrix Studio</div>
                <h2 data-i18n="errorsTitle">Hardware Fehler</h2>
                <div className="error-container scroll-list" id="errorList">
                  {[
                    'cloudy', 'ghosting', 'misaligned', 'pin_skip', 'smudge',
                    'ribbon_twist', 'head_gap', 'ink_starved', 'paper_slip',
                    'static_noise', 'double_feed', 'mechanical_resonance',
                  ].map((pattern) => (
                    <div key={pattern} className="er" data-pattern={pattern}>
                      <button type="button" className="er-head" aria-expanded="false">
                        <span className="er-check"></span>
                        <span className="er-name">{pattern.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                        <span className="er-val">0%</span>
                      </button>
                      <div className="er-body">
                        <input type="range" className="er-slider" min="0" max="100" defaultValue="50" />
                      </div>
                    </div>
                  ))}
                </div>
                <h2 style={{ marginTop: '32px' }}>Erweiterte Optionen</h2>
                <label className="field"><span className="name"><span>Output DPI</span><b id="dpiVal">300</b></span><input type="range" id="dpiSlider" min="100" max="1200" step="50" defaultValue="300" /></label>
                <label className="field"><span className="name"><span>Jitter Scale</span><b id="jitterVal">1.0</b></span><input type="range" id="jitterSlider" min="0" max="30" defaultValue="10" /></label>
                <label className="field"><span className="name"><span>Banding Scale</span><b id="bandingVal">1.0</b></span><input type="range" id="bandingSlider" min="0" max="20" defaultValue="10" /></label>
                <label className="field"><span className="name"><span>Max Size</span><b id="maxSizeVal">3000</b></span><input type="range" id="maxSizeSlider" min="1000" max="8000" step="100" defaultValue="3000" /></label>
                <label className="field"><span className="name"><span>Seed</span><b id="seedVal">0</b></span><input type="range" id="seedSlider" min="0" max="9999" defaultValue="0" /></label>
                <div className="checks" style={{ marginTop: '16px' }}>
                  <label className="check" data-flag="softBlur"><span className="box"></span><span>Softening Blur</span></label>
                </div>
              </div>

              <div className="tab-content" id="tab-system">
                <div className="sidebar-logo">DotMatrix Studio</div>
                <h2 data-i18n="systemTitle">System Settings</h2>
                <div className="settings-search-wrap">
                  <input type="text" id="settingsSearch" className="text-input settings-search" placeholder="🔍 Einstellungen suchen..." autoComplete="off" aria-label="Einstellungen suchen" />
                  <button className="settings-search-clear" id="settingsSearchClear" aria-label="Suche leeren">✕</button>
                </div>

                <details className="settings-group">
                  <summary><span className="sg-icon">🎨</span><span className="sg-title">Darstellung</span></summary>
                  <div className="sg-body">
                    <label className="field"><span className="name">Erscheinungsbild</span>
                      <select id="themeModeSelector" className="text-input">
                        <option value="dark">Dunkel</option>
                        <option value="light">Hell</option>
                        <option value="auto">System</option>
                      </select>
                    </label>
                    <select id="themeSelector" style={{ display: 'none' }}><option value="oc-2">OC-2</option></select>
                    <select id="layoutSelector" style={{ display: 'none' }}><option value="classic">Classic</option></select>
                    <label className="field" style={{ marginTop: '20px' }}><span className="name">UI-Schriftart</span>
                      <select id="fontSansSelector" className="text-input">
                        <option value="Inter">Inter</option>
                        <option value="System Sans">System Sans</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Open Sans">Open Sans</option>
                        <option value="Custom">Custom...</option>
                      </select>
                    </label>
                    <label className="field" id="fontSansCustomField" style={{ marginTop: '8px', display: 'none' }}>
                      <span className="name">Custom UI Font</span>
                      <input type="text" id="fontSansCustom" className="text-input" placeholder="z.B. 'Helvetica Neue'" />
                    </label>
                    <label className="field" style={{ marginTop: '12px' }}><span className="name">Eingabeschriftart</span>
                      <select id="fontMonoSelector" className="text-input">
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="IBM Plex Mono">IBM Plex Mono</option>
                        <option value="Custom">Custom...</option>
                      </select>
                    </label>
                    <label className="field" id="fontMonoCustomField" style={{ marginTop: '8px', display: 'none' }}>
                      <span className="name">Custom Eingabeschriftart</span>
                      <input type="text" id="fontMonoCustom" className="text-input" />
                    </label>
                    <label className="field" style={{ marginTop: '12px' }}><span className="name">Render Schriftart</span>
                      <select id="fontTerminalSelector" className="text-input">
                        <option value="JetBrainsMono Nerd Font Mono">JetBrainsMono Nerd Font Mono</option>
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="Custom">Custom...</option>
                      </select>
                    </label>
                    <label className="field" id="fontTerminalCustomField" style={{ marginTop: '8px', display: 'none' }}>
                      <span className="name">Custom Render Schriftart</span>
                      <input type="text" id="fontTerminalCustom" className="text-input" />
                    </label>
                    <div className="settings-subgroup" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--dm-border-base)' }}>
                      <div className="checks">
                        <label className="check" data-flag="bgEffects"><span className="box"></span><span>Hintergrund-Effekte</span></label>
                        <label className="check" data-flag="bgAnim"><span className="box"></span><span>Hintergrund-Animation</span></label>
                      </div>
                      <div id="animSettingsBody">
                        <label className="field" style={{ marginTop: '12px' }}><span className="name">Muster</span>
                          <select id="animPatternSelector" className="text-input">
                            <option value="aurora">Aurora</option>
                            <option value="pulse">Pulse</option>
                            <option value="orbit">Orbit</option>
                            <option value="drift">Drift</option>
                            <option value="breathe">Breathe</option>
                            <option value="off">Aus</option>
                          </select>
                        </label>
                        <label className="field" style={{ marginTop: '12px' }}><span className="name">Geschwindigkeit <b id="animSpeedVal">50%</b></span><input type="range" id="animSpeedSlider" min="10" max="200" defaultValue="50" /></label>
                        <label className="field" style={{ marginTop: '12px' }}><span className="name">Intensität <b id="animIntensityVal">30%</b></span><input type="range" id="animIntensitySlider" min="0" max="100" defaultValue="30" /></label>
                        <label className="field" style={{ marginTop: '12px' }}><span className="name">Größe <b id="animSizeVal">50%</b></span><input type="range" id="animSizeSlider" min="20" max="100" defaultValue="50" /></label>
                      </div>
                    </div>
                  </div>
                </details>

                <details className="settings-group">
                  <summary><span className="sg-icon">🔊</span><span className="sg-title">Workflow</span></summary>
                  <div className="sg-body">
                    <div className="checks">
                      <label className="check" data-flag="uiSounds"><span className="box"></span><span>UI Click Sounds</span></label>
                      <label className="check" data-flag="autoRender"><span className="box"></span><span>Auto-Render (Live)</span></label>
                      <label className="check" data-flag="renderDebug" style={{ display: 'none' }}><span className="box"></span><span>Render Debug Text</span></label>
                    </div>
                    <label className="field" style={{ marginTop: '16px' }}><span className="name">Sprache</span>
                      <select id="langSelector" className="text-input lang-selector">
                        <option value="de">🇩🇪 Deutsch</option>
                        <option value="en">🇺🇸 English</option>
                      </select>
                    </label>
                  </div>
                </details>

                <details className="settings-group">
                  <summary><span className="sg-icon">⚡</span><span className="sg-title">Engine</span></summary>
                  <div className="sg-body">
                    <div className="checks">
                      <label className="check" data-flag="useWorker"><span className="box"></span><span>Worker Rendering</span></label>
                      <label className="check" data-flag="legacyMath"><span className="box"></span><span>Legacy Math</span></label>
                    </div>
                  </div>
                </details>

                <details className="settings-group">
                  <summary><span className="sg-icon">🛡️</span><span className="sg-title">Sicherheit</span></summary>
                  <div className="sg-body" id="securitySettings"></div>
                </details>
              </div>
            </div>
          </aside>

          <main className="main-editor glass-panel">
            <div className="toolbar">
              <span data-i18n="previewTitle" className="header-fancy">Live-Vorschau</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="toolbar-render-debug" id="toolbarRenderDebug" title="Render-Debug ein/ausschalten">
                  <span className="trd-dot"></span>
                  <span style={{ fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Debug</span>
                </button>
                <div className="zoom-controls">
                  <button id="zoomOut">➖</button><span id="zoomLevel">100%</span><button id="zoomIn">➕</button>
                </div>
              </div>
            </div>
            <div className="canvas-wrapper" id="canvasWrapper">
              <div className="zoom-container" id="zoomContainer">
                <canvas id="outCanvas" width="400" height="300"></canvas>
                <pre id="ascii" className="ascii empty">// Bild laden //</pre>
              </div>
            </div>
            <div className="floating-container">
              <div className="status-panel glass-panel" id="statusPanel">
                <span id="status" className="status-large">Warte auf Bild...</span>
              </div>
              <div className="floating-actions glass-panel" id="floatingActions">
                <button className="floating-actions-toggle" id="floatingActionsToggle" title="Ein/Ausklappen">
                  <span className="fat-arrow">▲</span>
                </button>
                <div className="action-buttons">
                  <button className="btn primary" id="renderBtn" disabled data-i18n="btnRender">Rendern</button>
                  <button className="btn" id="downloadBtn" disabled>Speichern PNG</button>
                </div>
              </div>
            </div>
          </main>
        </div>

        <footer className="app-footer glass-panel" id="appFooter">
          <div className="footer-left">
            <span className="footer-accent">DotMatrix Studio</span>
            <span className="footer-divider">|</span>
            <div id="syncStatus" className="sync-status" title="Sync Status">
              <span className="status-dot saved"></span> Saved
            </div>
            <span className="footer-divider" id="footerFilenameDivider" style={{ display: 'none' }}>|</span>
            <span className="footer-filename" id="footerFilename" style={{ display: 'none' }}></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="footer-right" id="footerVersion" role="button" tabIndex={0} title="Changelog anzeigen">
              <span className="online-dot" id="onlineDot" title="Online"></span>
              <span className="version-text" id="versionText">v2.0.0</span>
              <span className="version-separator">·</span>
              <span className="update-badges" id="updateBadges">
                <span className="update-badge update-badge--ui">UI</span>
                <span className="update-badge update-badge--perf">Perf</span>
              </span>
            </div>
            <span className="footer-divider">|</span>
            <div className="user-session" id="userSession">
              <div className="user-session-chip" id="userSessionChip" role="button" tabIndex={0} title="Kontoeinstellungen">
                <span className="user-session-dot" aria-hidden="true"></span>
                <span className="user-session-name" id="sessionUsername"></span>
                <span className="user-session-time" id="sessionTime"></span>
              </div>
              <button className="logout-btn" id="logoutBtn" title="Abmelden" aria-label="Abmelden">✕</button>
            </div>
            <button className="footer-collapse-btn" id="footerCollapseBtn" title="Fußzeile ein/ausklappen">▼</button>
          </div>
        </footer>

        <div className="changelog-overlay" id="changelogOverlay" aria-hidden="true">
          <div className="changelog-backdrop"></div>
          <div className="changelog-panel glass-panel">
            <div className="changelog-header">
              <h2>Updates &amp; Changelog</h2>
              <button className="changelog-close" id="changelogClose" aria-label="Schließen">✕</button>
            </div>
            <div className="changelog-body" id="changelogBody"></div>
          </div>
        </div>

        <div className="welcome-overlay" id="welcomeOverlay" aria-hidden="true">
          <div className="welcome-backdrop" id="welcomeBackdrop"></div>
          <div className="welcome-panel glass-panel">
            <div className="welcome-header">
              <h2>Willkommen bei DotMatrix Studio <span className="welcome-counter" id="welcomeCounter">15</span></h2>
              <button className="welcome-close" id="welcomeClose" aria-label="Schließen">✕</button>
            </div>
            <div className="welcome-body" id="welcomeBody"></div>
          </div>
        </div>

        <div className="idle-overlay" id="idleOverlay" aria-hidden="true">
          <div className="idle-backdrop"></div>
          <div className="idle-panel glass-panel">
            <div className="idle-progress-wrap"><div className="idle-progress-bar" id="idleProgressBar"></div></div>
            <div className="idle-body">
              <span className="idle-icon">⏱️</span>
              <div className="idle-title">Bist du noch da?</div>
              <div className="idle-countdown" id="idleCountdown">10</div>
              <div className="idle-actions">
                <button className="idle-btn-stay" id="idleStayBtn">✔ Noch da!</button>
                <button className="idle-btn-logout" id="idleLogoutBtn">Abmelden</button>
              </div>
            </div>
          </div>
        </div>

        <div className="easter-egg-toast" id="easterEggToast">
          <span className="ee-emoji">🥚</span>
          <div>Du hast das Easter Egg gefunden!</div>
          <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>Entwickelt mit ❤️ von Gintoo</div>
        </div>
      </div>

      <div className="account-panel" id="accountPanel" aria-hidden="true">
        <div className="account-panel-header">
          <div className="account-avatar" id="acAvatar" data-initials="?"></div>
          <div className="account-user-info">
            <div className="account-username" id="acUsername">—</div>
            <span className="account-role-badge" id="acRole">user</span>
          </div>
          <button className="account-close" id="accountClose" aria-label="Schließen">✕</button>
        </div>
        <div className="account-session">
          <span>Sitzungsdauer</span>
          <span className="account-session-value" id="acSession">—</span>
        </div>
        <div className="account-body">
          <button className="account-btn" id="acPasswordBtn"><span className="account-btn-icon">🔑</span>Passwort ändern</button>
          <div className="account-password-form" id="acPasswordForm" style={{ display: 'none' }}>
            <input type="password" className="text-input" id="acCurPw" placeholder="Aktuelles Passwort" autoComplete="current-password" />
            <input type="password" className="text-input" id="acNewPw" placeholder="Neues Passwort (min. 8 Zeichen)" autoComplete="new-password" />
            <div className="account-form-actions">
              <button className="btn btn-sm primary" id="acPwSave" style={{ flex: 1 }}>Speichern</button>
              <button className="btn btn-sm" id="acPwCancel" style={{ flex: 1 }}>Abbrechen</button>
            </div>
          </div>
          <button className="account-btn" id="ac2faBtn"><span className="account-btn-icon">🔐</span>2-Faktor-Auth<span id="ac2faStatus" style={{ marginLeft: 'auto', fontSize: '10px' }}></span></button>
          <div className="account-divider"></div>
          <button className="account-btn account-btn--danger" id="acLogoutBtn"><span className="account-btn-icon">↩</span>Abmelden</button>
        </div>
      </div>

      <Script src="/scripts/main.js" strategy="afterInteractive" type="module" />
    </>
  );
}
