// =====================================================================
//  3D NBS Planner v9 — Modern UI redesign
//  MapLibre GL JS · OSM raster + GeoJSON fill-extrusion
//  UI: bottom toolbar · right slide-in NBS panel · full Leaflet cover
// =====================================================================
(function () {
    'use strict';

// 将中心点稍微向西移，以适应更完整的区域
    const SWORDS = [-6.2250, 53.4597]; // [lng, lat]
    // 扩大边界范围：向西扩展到 -6.275，向东、南、北也做了适当延伸
    const BBOX   = '53.435,-6.275,53.485,-6.175';

    const NBS = {
        none:        { label: 'No NBS',      color: '#64748b', bg: '#64748b18', icon: '—'  },
        green_roof:  { label: 'Green Roof',  color: '#22c55e', bg: '#22c55e18', icon: '🌿' },
        solar_green: { label: 'Solar Roof',  color: '#f59e0b', bg: '#f59e0b18', icon: '☀️' },
        green_wall:  { label: 'Green Wall',  color: '#84cc16', bg: '#84cc1618', icon: '🍃' },
        rain_garden: { label: 'Rain Garden', color: '#3b82f6', bg: '#3b82f618', icon: '💧' },
        wetland:     { label: 'Wetland',     color: '#06b6d4', bg: '#06b6d418', icon: '🌊' },
    };

    // ── Inject CSS ─────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
    /* ════════════════════════════════════════
       ENTRY BUTTON  (floats over Leaflet map)
    ════════════════════════════════════════ */
    #btn-open-3d {
        position: absolute !important;
        BOTTOM: 80px !important; left: 10px !important;
        z-index: 1001 !important;
        display: flex; align-items: center; gap: 8px;
        background: #0f172a;
        color: #38bdf8;
        border: 1px solid #38bdf840;
        border-radius: 10px;
        padding: 9px 16px;
        font: 600 12px/1 'Inter', system-ui, sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 16px #0009, 0 0 0 1px #38bdf815;
        transition: all .2s;
        white-space: nowrap;
        letter-spacing: 0.2px;
    }
    #btn-open-3d:hover {
        background: #1e293b;
        border-color: #38bdf870;
        box-shadow: 0 4px 20px #0009, 0 0 12px #38bdf822;
        transform: translateY(-1px);
    }
    #btn-open-3d svg { flex-shrink: 0; }

    /* ════════════════════════════════════════
       FULL SCREEN 3D OVERLAY
       z-index 3000 covers ALL Leaflet UI
    ════════════════════════════════════════ */
    #view3d {
        display: none;
        position: absolute !important;
        inset: 0 !important;
        z-index: 3000 !important;   /* above everything in Leaflet */
        background: #0c1a2e;
        font-family: 'Inter', system-ui, sans-serif;
    }
    #view3d.show { display: block; }

    /* MapLibre fills the whole overlay */
    #ml-map {
        position: absolute;
        inset: 0;
    }

    /* ════════════════════════════════════════
       TOP BAR  (exit + title + view mode tabs)
    ════════════════════════════════════════ */
    #bar-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        z-index: 10;
        height: 52px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 14px;
        background: linear-gradient(180deg, rgba(12,26,46,.95) 0%, transparent 100%);
        backdrop-filter: blur(2px);
    }
    #btn-exit-3d {
        display: flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.12);
        color: #e2e8f0;
        border-radius: 8px;
        padding: 7px 13px;
        font: 600 12px 'Inter', system-ui, sans-serif;
        cursor: pointer;
        transition: all .18s;
        flex-shrink: 0;
    }
    #btn-exit-3d:hover { background: rgba(255,255,255,.14); }

    #bar-top-title {
        font-size: 13px; font-weight: 700;
        color: #f1f5f9; letter-spacing: 0.1px; flex: 1;
    }
    #bar-top-title span { color: #38bdf8; }

    /* View mode tabs */
    #view-tabs {
        display: flex; gap: 3px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 9px; padding: 3px;
    }
    .vtab {
        padding: 5px 14px;
        border-radius: 7px;
        border: none;
        font: 600 11px 'Inter', system-ui, sans-serif;
        cursor: pointer;
        color: #94a3b8;
        background: transparent;
        transition: all .18s;
        letter-spacing: 0.2px;
    }
    .vtab.on { background: rgba(56,189,248,.18); color: #38bdf8; }
    .vtab:hover:not(.on) { background: rgba(255,255,255,.06); color: #cbd5e1; }

    /* ════════════════════════════════════════
       BOTTOM TOOLBAR  (pitch · basemap · export)
    ════════════════════════════════════════ */
    #bar-bottom {
        position: absolute;
        bottom: 28px; left: 50%; transform: translateX(-50%);
        z-index: 10;
        display: flex;
        align-items: center; gap: 8px;
        background: rgba(12,20,36,.88);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        padding: 8px 16px;
        backdrop-filter: blur(12px);
        box-shadow: 0 8px 32px rgba(0,0,0,.5);
        white-space: nowrap;
    }
    .bar-sep { width: 1px; height: 20px; background: rgba(255,255,255,.1); flex-shrink: 0; }

    /* Pitch control */
    #pitch-group {
        display: flex; align-items: center; gap: 8px;
    }
    #pitch-label {
        font: 600 10px 'Inter', system-ui; color: #64748b;
        letter-spacing: 0.5px; text-transform: uppercase;
    }
    #pitch-slider {
        -webkit-appearance: none; appearance: none;
        width: 110px; height: 4px; border-radius: 2px; outline: none;
        background: linear-gradient(90deg, #38bdf8 var(--v,0%), #1e293b var(--v,0%));
        cursor: pointer;
        transition: background .15s;
    }
    #pitch-slider::-webkit-slider-thumb {
        -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
        background: #38bdf8; box-shadow: 0 0 8px #38bdf866;
        cursor: pointer; border: 2px solid #0c1a2e;
    }
    #pitch-val {
        font: 700 11px 'Inter', system-ui;
        color: #38bdf8; min-width: 26px; text-align: right;
    }

    /* Tool buttons in bottom bar */
    .tool-btn {
        display: flex; align-items: center; gap: 5px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.09);
        color: #94a3b8;
        border-radius: 8px; padding: 5px 11px;
        font: 600 11px 'Inter', system-ui;
        cursor: pointer; transition: all .15s; letter-spacing: 0.2px;
    }
    .tool-btn:hover { background: rgba(255,255,255,.1); color: #e2e8f0; }
    .tool-btn.on { background: rgba(56,189,248,.15); border-color: #38bdf840; color: #38bdf8; }

    /* ════════════════════════════════════════
       COMPASS / NAV  (top-right)
    ════════════════════════════════════════ */
    .maplibregl-ctrl-group {
        background: rgba(12,20,36,.88) !important;
        border: 1px solid rgba(255,255,255,.1) !important;
        border-radius: 10px !important;
        overflow: hidden;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 16px rgba(0,0,0,.4) !important;
    }
    .maplibregl-ctrl-group button {
        background: transparent !important;
        color: #94a3b8 !important;
        border-bottom: 1px solid rgba(255,255,255,.06) !important;
    }
    .maplibregl-ctrl-group button:last-child { border-bottom: none !important; }
    .maplibregl-ctrl-group button:hover { background: rgba(255,255,255,.08) !important; }

    /* ════════════════════════════════════════
       RIGHT PANEL  (NBS assignment)
    ════════════════════════════════════════ */
    #panel-nbs {
        position: absolute;
        top: 62px; right: 0; bottom: 0;
        z-index: 10;
        width: 280px;
        transform: translateX(100%);
        transition: transform .35s cubic-bezier(.23,1,.32,1);
        display: flex; flex-direction: column;
        pointer-events: none;
    }
    #panel-nbs.open {
        transform: translateX(0);
        pointer-events: all;
    }
    #panel-nbs-inner {
        margin: 10px 10px 10px 0;
        background: rgba(12,20,36,.92);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        backdrop-filter: blur(16px);
        box-shadow: -8px 0 40px rgba(0,0,0,.4);
        display: flex; flex-direction: column;
        overflow: hidden; flex: 1;
    }

    /* Panel header */
    #panel-nbs-head {
        padding: 14px 16px 12px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        display: flex; align-items: flex-start; justify-content: space-between;
    }
    #panel-bldg-name {
        font: 700 13px 'Inter', system-ui;
        color: #f1f5f9; margin-bottom: 3px;
        max-width: 200px; word-break: break-word;
    }
    #panel-bldg-meta {
        font: 400 10px 'Inter', system-ui;
        color: #64748b; line-height: 1.7;
    }
    #btn-close-panel {
        background: rgba(255,255,255,.06); border: none;
        color: #64748b; border-radius: 6px;
        width: 24px; height: 24px; font-size: 13px;
        cursor: pointer; flex-shrink: 0; margin-top: 2px;
        transition: all .15s;
    }
    #btn-close-panel:hover { background: rgba(255,255,255,.1); color: #e2e8f0; }

    /* NBS options */
    #panel-nbs-opts {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        flex-shrink: 0;
    }
    #panel-nbs-opts-title {
        font: 600 9px 'Inter', system-ui;
        color: #475569; letter-spacing: 1px; text-transform: uppercase;
        margin-bottom: 8px;
    }
    #panel-nbs-btns { display: flex; flex-direction: column; gap: 5px; }
    .nbs-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; border-radius: 9px;
        border: 1px solid transparent;
        cursor: pointer; transition: all .15s;
    }
    .nbs-row:hover { background: rgba(255,255,255,.05); }
    .nbs-row.sel {
        border-color: currentColor;
        background: var(--bg);
    }
    .nbs-row-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .nbs-row-label { font: 600 11px 'Inter', system-ui; flex: 1; }
    .nbs-row-check {
        font-size: 12px; opacity: 0; transition: opacity .15s;
    }
    .nbs-row.sel .nbs-row-check { opacity: 1; }

    /* Summary section */
    #panel-summary {
        padding: 12px 16px;
        flex: 1; overflow-y: auto;
    }
    #panel-summary-title {
        font: 600 9px 'Inter', system-ui;
        color: #475569; letter-spacing: 1px; text-transform: uppercase;
        margin-bottom: 10px;
    }
    .sum-row {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 7px;
    }
    .sum-bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,.06); border-radius: 2px; }
    .sum-bar { height: 100%; border-radius: 2px; transition: width .4s ease; }
    .sum-count { font: 700 10px 'Inter', system-ui; color: #64748b; min-width: 20px; text-align: right; }
    .sum-icon  { font-size: 11px; width: 16px; text-align: center; flex-shrink: 0; }
    .sum-name  { font: 400 10px 'Inter', system-ui; color: #64748b; min-width: 72px; }

    #coverage-badge {
        margin-top: 12px;
        background: rgba(56,189,248,.08);
        border: 1px solid rgba(56,189,248,.2);
        border-radius: 8px; padding: 8px 12px;
        display: flex; align-items: center; justify-content: space-between;
    }
    #coverage-label { font: 400 10px 'Inter', system-ui; color: #64748b; }
    #coverage-pct { font: 700 16px 'Inter', system-ui; color: #38bdf8; }

    /* Status line */
    #ml-status {
        padding: 8px 16px;
        border-top: 1px solid rgba(255,255,255,.06);
        display: flex; align-items: center; gap: 6px;
        flex-shrink: 0;
    }
    #ml-sdot {
        width: 6px; height: 6px; border-radius: 50%;
        background: #1e293b; flex-shrink: 0;
    }
    #ml-sdot.spin { background: #f59e0b; animation: dot-spin 1s infinite; }
    #ml-sdot.ok   { background: #22c55e; }
    #ml-sdot.err  { background: #ef4444; }
    @keyframes dot-spin { 0%,100%{opacity:1}50%{opacity:.3} }
    #ml-stxt { font: 400 10px 'Inter', system-ui; color: #475569; }

    /* Hint overlay bottom-left */
    #hint3d {
        position: absolute;
        bottom: 30px; left: 12px; z-index: 10;
        background: rgba(12,20,36,.8);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; padding: 8px 12px;
        font: 400 10px/1.9 'Inter', system-ui;
        color: #475569; pointer-events: none;
        backdrop-filter: blur(8px);
        transition: opacity .3s;
    }
    #hint3d b { color: #64748b; }
    #hint3d.hide { opacity: 0; }

    /* MapLibre popup */
    .maplibregl-popup-content {
        background: rgba(12,20,36,.95) !important;
        border: 1px solid rgba(56,189,248,.25) !important;
        border-radius: 10px !important;
        padding: 11px 14px !important;
        color: #94a3b8 !important;
        font: 11px 'Inter', system-ui !important;
        box-shadow: 0 8px 32px rgba(0,0,0,.6) !important;
    }
    .maplibregl-popup-tip {
        border-top-color: rgba(12,20,36,.95) !important;
    }
    .maplibregl-popup-close-button {
        color: #64748b !important; font-size: 16px !important; right: 8px !important; top: 6px !important;
    }
    `;
    document.head.appendChild(css);

    // ── Wait for #map ──────────────────────────────────────────────────
    function start() {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) { setTimeout(start, 200); return; }
        mapDiv.style.position = 'relative';
        buildUI(mapDiv);
    }
    setTimeout(start, 500);

    // ══════════════════════════════════════════════════════════════════
    function buildUI(mapDiv) {

        // ── Entry button ──────────────────────────────────────────────
        const openBtn = document.createElement('button');
        openBtn.id = 'btn-open-3d';
        openBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M2 20l10-16 10 16H2z"/><line x1="2" y1="20" x2="22" y2="20"/>
        </svg> 3D NBS Planner`;
        
        mapDiv.appendChild(openBtn);

        // ── 3D overlay ────────────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.id = 'view3d';
        overlay.innerHTML = `
        <!-- MapLibre fills here -->
        <div id="ml-map"></div>

        <!-- Top bar -->
        <div id="bar-top">
            <button id="btn-exit-3d">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to 2D
            </button>
            <div id="bar-top-title">NBS Planner — <span>Swords, Dublin</span></div>
            <div id="view-tabs">
                <button class="vtab on" id="tab-3d">3D</button>
                <button class="vtab" id="tab-2d">2D</button>
            </div>
        </div>
function enterMode()
        <!-- Right NBS panel -->
        <div id="panel-nbs">
            <div id="panel-nbs-inner">
                <div id="panel-nbs-head">
                    <div>
                        <div id="panel-bldg-name">Select a building</div>
                        <div id="panel-bldg-meta">Click any building to assign an NBS solution</div>
                    </div>
                    <button id="btn-close-panel">✕</button>
                </div>
                <div id="panel-nbs-opts">
                    <div id="panel-nbs-opts-title">Nature-Based Solution</div>
                    <div id="panel-nbs-btns"></div>
                </div>
                <div id="panel-impact" style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.07);">
                    <div style="font: 600 9px 'Inter'; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;">Environmental Impact</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
                            <div style="font-size: 9px; color: #64748b;">Runoff Mitigated</div>
                            <div id="stat-runoff" style="font: 700 14px 'Inter'; color: #38bdf8;">0 m³</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
                            <div style="font-size: 9px; color: #64748b;">Carbon Saved</div>
                            <div id="stat-carbon" style="font: 700 14px 'Inter'; color: #22c55e;">0 kg</div>
                        </div>
                    </div>
                </div>
                <div id="panel-summary">
                    <div id="panel-summary-title">Coverage Summary</div>
                    <div id="summary-rows"></div>
                    <div id="coverage-badge">
                        <span id="coverage-label">NBS Coverage</span>
                        <span id="coverage-pct">0%</span>
                    </div>
                </div>
                <div id="ml-status">
                    <div id="ml-sdot" class="spin"></div>
                    <span id="ml-stxt">Initialising…</span>
                </div>
            </div>
        </div>

        <!-- Bottom toolbar -->
        <div id="bar-bottom">
            <div id="pitch-group">
                <span id="pitch-label">Tilt</span>
                <input type="range" id="pitch-slider" min="0" max="70" value="45" step="1">
                <span id="pitch-val">45°</span>
            </div>
            <div class="bar-sep"></div>
            <button class="tool-btn on" id="tb-buildings">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="10" width="4" height="11"/><rect x="10" y="6" width="4" height="15"/>
                    <rect x="17" y="3" width="4" height="18"/>
                </svg>
                Buildings
            </button>
            <button class="tool-btn" id="tb-nbs-panel">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>
                </svg>
                NBS Panel
            </button>
            <div class="bar-sep"></div>
            <button class="tool-btn" id="tb-export">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
            </button>
        </div>

        <!-- Hint -->
        <div id="hint3d">
            <b>DRAG</b> Pan &nbsp;·&nbsp; <b>CTRL+DRAG</b> Tilt &nbsp;·&nbsp; <b>RIGHT-DRAG</b> Rotate &nbsp;·&nbsp; <b>SCROLL</b> Zoom
        </div>
        `;
        mapDiv.appendChild(overlay);

        // Build NBS option rows
        const nbsBtns = overlay.querySelector('#panel-nbs-btns');
        Object.entries(NBS).forEach(([key, n]) => {
            const row = document.createElement('div');
            row.className = 'nbs-row' + (key === 'none' ? ' sel' : '');
            row.style.color = n.color;
            row.style.setProperty('--bg', n.bg);
            row.innerHTML = `
                <div class="nbs-row-dot" style="background:${n.color}"></div>
                <span class="nbs-row-label" style="color:${key==='none'?'#94a3b8':n.color}">${n.icon} ${n.label}</span>
                <span class="nbs-row-check" style="color:${n.color}">✓</span>
            `;
            row.dataset.nbs = key;
            nbsBtns.appendChild(row);
        });

        // ── State ──────────────────────────────────────────────────────
        let mlMap       = null;
        let active      = false;
        let assignments = {};
        let bldgData    = null;
        let selUID      = null;
        let showBldg    = true;
        let currentPopup = null;

        // ── Open / Close ───────────────────────────────────────────────
        openBtn.onclick = () => enterMode();
        
// 确保函数唯一且逻辑闭合
function enterMode() {
            active = true;
            window._3dModeActive = true;
            overlay.classList.add('show');
            openBtn.style.display = 'none';
            
            // 禁用 2D Leaflet 交互
            mapDiv.querySelectorAll('.leaflet-pane, .leaflet-control-container')
                  .forEach(el => el.style.pointerEvents = 'none');

            // 隐藏 2D UI 的侧边抽屉按钮
            const drawerToggle = document.querySelector('.custom-drawer-toggle');
            if (drawerToggle) drawerToggle.style.display = 'none';

            // 加载并初始化 MapLibre 3D 地图
            loadML(() => initML(getLeafletView()));
        }  

        function exitMode() {
            active = false;
            window._3dModeActive = false;
            overlay.classList.remove('show');
            openBtn.style.display = ''; 
            
            // Restore Leaflet
            mapDiv.querySelectorAll(
                '.leaflet-pane, .leaflet-control-container, .leaflet-top, .leaflet-bottom'
            ).forEach(el => el.style.pointerEvents = '');

            // === 核心修复：退出 3D 时恢复显示 2D 的抽屉按钮 ===
            const drawerToggle = document.querySelector('.custom-drawer-toggle');
            if (drawerToggle) {
                drawerToggle.style.display = 'flex'; 
            }
            // ===============================================

            // Sync position back to Leaflet
            if (mlMap) {
                try {
                    const lm = eval('typeof map!=="undefined"?map:null'); 
                    const c  = mlMap.getCenter();
                    if (lm) lm.setView([c.lat, c.lng], Math.round(mlMap.getZoom()));
                } catch(e) {}
            }
        }
        overlay.querySelector('#btn-exit-3d').onclick = exitMode;

        // ── View tabs (2D/3D pitch) ────────────────────────────────────
        overlay.querySelector('#tab-3d').onclick = function() {
            this.classList.add('on');
            overlay.querySelector('#tab-2d').classList.remove('on');
            if (mlMap) mlMap.easeTo({ pitch: 45, duration: 600 });
            document.getElementById('pitch-slider').value = 45;
            syncPitchSlider(45);
        };
        overlay.querySelector('#tab-2d').onclick = function() {
            this.classList.add('on');
            overlay.querySelector('#tab-3d').classList.remove('on');
            if (mlMap) mlMap.easeTo({ pitch: 0, bearing: 0, duration: 600 });
            document.getElementById('pitch-slider').value = 0;
            syncPitchSlider(0);
        };

        // ── Pitch slider ───────────────────────────────────────────────
        function syncPitchSlider(p) {
            const pct = (p / 70) * 100;
            document.getElementById('pitch-slider').style.setProperty('--v', pct + '%');
            document.getElementById('pitch-val').textContent = Math.round(p) + '°';
            // Sync tabs
            overlay.querySelector('#tab-3d').classList.toggle('on', p > 5);
            overlay.querySelector('#tab-2d').classList.toggle('on', p <= 5);
        }

        overlay.querySelector('#pitch-slider').addEventListener('input', function() {
            const p = Number(this.value);
            syncPitchSlider(p);
            if (mlMap) mlMap.easeTo({ pitch: p, duration: 150 });
        });

        // ── Tool buttons ───────────────────────────────────────────────
        overlay.querySelector('#tb-buildings').onclick = function() {
            showBldg = !showBldg;
            this.classList.toggle('on', showBldg);
            if (!mlMap) return;
            ['buildings-extrusion', 'buildings-base', 'buildings-outline'].forEach(id => {
                if (mlMap.getLayer(id))
                    mlMap.setLayoutProperty(id, 'visibility', showBldg ? 'visible' : 'none');
            });
        };

        overlay.querySelector('#tb-nbs-panel').onclick = function() {
            const p = document.getElementById('panel-nbs');
            const open = p.classList.toggle('open');
            this.classList.toggle('on', open);
        };

        overlay.querySelector('#tb-export').onclick = exportNBS;
        overlay.querySelector('#btn-close-panel').onclick = () => {
            document.getElementById('panel-nbs').classList.remove('open');
            overlay.querySelector('#tb-nbs-panel').classList.remove('on');
            selUID = null;
        };

        // Hide hint after 6 seconds
        setTimeout(() => {
            const h = document.getElementById('hint3d');
            if (h) h.classList.add('hide');
        }, 6000);

        // ── Get Leaflet view ───────────────────────────────────────────
        function getLeafletView() {
            try {
                const m = eval('typeof map!=="undefined"?map:null'); // eslint-disable-line
                if (m && m.getCenter) {
                    const c = m.getCenter();
                    return { lng: c.lng, lat: c.lat, zoom: Math.min(m.getZoom(), 18) };
                }
            } catch(e) {}
            return { lng: SWORDS[0], lat: SWORDS[1], zoom: 16 };
        }

        // ── Load MapLibre ──────────────────────────────────────────────
        function loadML(cb) {
            if (!document.getElementById('ml-css')) {
                const l = document.createElement('link');
                l.id = 'ml-css'; l.rel = 'stylesheet';
                l.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
                document.head.appendChild(l);
            }
            if (window.maplibregl) { cb(); return; }
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
            s.onload = cb;
            s.onerror = () => setStatus('err', 'MapLibre failed to load');
            document.head.appendChild(s);
        }

        // ── Init MapLibre ──────────────────────────────────────────────
        function initML(view) {
            if (mlMap) {
                mlMap.jumpTo({ center: [view.lng, view.lat], zoom: view.zoom });
                return;
            }
            setStatus('spin', 'Loading map…');

            mlMap = new maplibregl.Map({
                container: 'ml-map',
                style: {
                    version: 8,
                    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                    sources: {
                        osm: {
                            type: 'raster',
                            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                            maxzoom: 19
                        }
                    },
                    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
                },
                center:    [view.lng, view.lat],
                zoom:      view.zoom,
                pitch:     45,
                bearing:   0,
                antialias: true,
                maxPitch:  80
            });

            syncPitchSlider(45);

            mlMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
            mlMap.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

            // Sync pitch slider when user drags map
            mlMap.on('pitch', () => {
                const p = mlMap.getPitch();
                document.getElementById('pitch-slider').value = p;
                syncPitchSlider(p);
            });

            mlMap.on('load', () => {
                setStatus('spin', 'Fetching building data…');
                fetchBuildings()
                    .then(gj => { addLayers(gj); setStatus('ok', `${gj.features.length} buildings loaded`); })
                    .catch(e  => { console.warn('[3D]', e.message); addLayers(fallback()); setStatus('err', 'Demo mode'); });
            });

            mlMap.on('error', e => console.warn('[ML]', e.error?.message));
        }

        // ── Overpass fetch ─────────────────────────────────────────────
        async function fetchBuildings() {
            const q = `[out:json][timeout:25];(way["building"](${BBOX}););out geom;`;
            for (const ep of [
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter'
            ]) {
                try {
                    const ac = new AbortController();
                    const ti = setTimeout(() => ac.abort(), 22000);
                    const r  = await fetch(`${ep}?data=${encodeURIComponent(q)}`, { signal: ac.signal });
                    clearTimeout(ti);
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    const j = await r.json();
                    if (!j.elements?.length) throw new Error('empty');
                    return toGeoJSON(j);
                } catch(e) { console.warn('[3D]', ep, e.message); }
            }
            throw new Error('all endpoints failed');
        }

        function toGeoJSON(data) {
            const features = [];
            let uid = 0;
            data.elements.forEach(el => {
                if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) return;
                const coords = el.geometry.map(p => [p.lon, p.lat]);
                if (coords[0][0] !== coords[coords.length-1][0]) coords.push([...coords[0]]);
                const tags = el.tags || {};
                let h = parseFloat(tags.height) || 0;
                if (!h) { const lv = parseInt(tags['building:levels'])||0; h = lv ? lv*3.5 : 8; }
                features.push({
                    type: 'Feature', id: uid,
                    geometry: { type: 'Polygon', coordinates: [coords] },
                    properties: {
                        uid:        uid++,
                        height:     Math.max(Math.round(h), 4),
                        min_height: Math.max(parseFloat(tags.min_height)||0, 0),
                        name:       tags.name || tags['addr:street'] || '',
                        building:   tags.building || 'yes',
                        levels:     parseInt(tags['building:levels'])||0,
                        nbs:        'none',
                        nbs_color:  NBS.none.color
                    }
                });
            });
            bldgData = { type:'FeatureCollection', features };
            return bldgData;
        }

        // ── Add MapLibre layers ────────────────────────────────────────
        function addLayers(gj) {
            bldgData = gj;
            ['buildings-extrusion','buildings-base','buildings-outline'].forEach(id => {
                if (mlMap.getLayer(id)) mlMap.removeLayer(id);
            });
            if (mlMap.getSource('buildings')) mlMap.removeSource('buildings');

            mlMap.addSource('buildings', { type:'geojson', data: gj });

            mlMap.addLayer({
                id: 'buildings-outline', type: 'line', source: 'buildings',
                paint: { 'line-color':'#1e293b', 'line-width': 0.6, 'line-opacity': 0.7 }
            });
            mlMap.addLayer({
                id: 'buildings-base', type: 'fill', source: 'buildings',
                paint: { 'fill-color': ['get','nbs_color'], 'fill-opacity': 0.3 }
            });
            mlMap.addLayer({
                id: 'buildings-extrusion', type: 'fill-extrusion', source: 'buildings',
                paint: {
                    'fill-extrusion-color':   ['get', 'nbs_color'],
                    'fill-extrusion-height':  ['get', 'height'],
                    'fill-extrusion-base':    ['get', 'min_height'],
                    // 将透明度改为固定值 0.9，去除不支持的 pitch 表达式和阴影属性
                    'fill-extrusion-opacity': 0.9
                }
            });

            ['buildings-extrusion','buildings-base'].forEach(id => {
                mlMap.on('click', id, onBldgClick);
                mlMap.on('mouseenter', id, () => mlMap.getCanvas().style.cursor = 'pointer');
                mlMap.on('mouseleave', id, () => mlMap.getCanvas().style.cursor = '');
            });


            ['buildings-extrusion','buildings-base'].forEach(id => {
                mlMap.on('click', id, onBldgClick);
                mlMap.on('mouseenter', id, () => mlMap.getCanvas().style.cursor = 'pointer');
                mlMap.on('mouseleave', id, () => mlMap.getCanvas().style.cursor = '');
            });

            // === 新增：绘制数字孪生研究区 (Study Area) 边界 ===
            const bArr = BBOX.split(',').map(Number); // [minLat, minLon, maxLat, maxLon]
            const boundaryGeoJSON = {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [bArr[1], bArr[0]], // 左下
                            [bArr[3], bArr[0]], // 右下
                            [bArr[3], bArr[2]], // 右上
                            [bArr[1], bArr[2]], // 左上
                            [bArr[1], bArr[0]]  // 闭合
                        ]]
                    }
                }]
            };

            if (mlMap.getSource('swords-boundary')) {
                mlMap.getSource('swords-boundary').setData(boundaryGeoJSON);
            } else {
                mlMap.addSource('swords-boundary', { type: 'geojson', data: boundaryGeoJSON });
                
                // 1. 添加边界发光底色 (科技感)
                mlMap.addLayer({
                    id: 'boundary-glow', type: 'line', source: 'swords-boundary',
                    paint: { 'line-color': '#38bdf8', 'line-width': 8, 'line-opacity': 0.15, 'line-blur': 4 }
                });
                // 2. 添加内侧虚线
                mlMap.addLayer({
                    id: 'boundary-line', type: 'line', source: 'swords-boundary',
                    paint: { 'line-color': '#38bdf8', 'line-width': 2, 'line-dasharray': [4, 3], 'line-opacity': 0.8 }
                });
            }
            // ================================================


            updateSummary();
        }

        // ── Building click ─────────────────────────────────────────────
        function onBldgClick(e) {
            if (!e.features?.length) return;
            const f   = e.features[0];
            const p   = f.properties;
            selUID    = p.uid;
            const cur = assignments[selUID] || 'none';

            // Update panel header
            document.getElementById('panel-bldg-name').textContent = p.name || 'Building';
            document.getElementById('panel-bldg-meta').innerHTML =
                `${p.building} &nbsp;·&nbsp; ${p.height}m tall` +
                (p.levels ? ` &nbsp;·&nbsp; ${p.levels} floors` : '');

            // Highlight selected NBS row
            document.querySelectorAll('.nbs-row').forEach(row => {
                const k = row.dataset.nbs;
                row.classList.toggle('sel', k === cur);
            });

            // Open panel
            document.getElementById('panel-nbs').classList.add('open');
            overlay.querySelector('#tb-nbs-panel').classList.add('on');

            // Popup on map
            if (currentPopup) currentPopup.remove();
            currentPopup = new maplibregl.Popup({ offset: 8, maxWidth: '200px' })
                .setLngLat(e.lngLat)
                .setHTML(`
                    <b style="color:#e2e8f0;font-size:12px">${p.name || 'Building'}</b><br>
                    <span style="color:#64748b">${p.height}m &nbsp;·&nbsp; ${NBS[cur].icon} ${NBS[cur].label}</span>
                `)
                .addTo(mlMap);
        }

        // NBS row click handler
        overlay.querySelector('#panel-nbs-btns').addEventListener('click', e => {
            const row = e.target.closest('.nbs-row');
            if (!row || selUID === null) return;
            assignNBS(selUID, row.dataset.nbs);
        });

        // ── Assign NBS ─────────────────────────────────────────────────
        function assignNBS(uid, key) {
            assignments[uid] = key;
            const n = NBS[key];

            if (bldgData) {
                bldgData.features.forEach(f => {
                    if (f.properties.uid === uid) {
                        f.properties.nbs       = key;
                        f.properties.nbs_color = n.color;
                    }
                });
                if (mlMap.getSource('buildings')) mlMap.getSource('buildings').setData(bldgData);
            }

            // Update panel rows
            document.querySelectorAll('.nbs-row').forEach(row => {
                row.classList.toggle('sel', row.dataset.nbs === key);
            });
            // Update popup
            const pName = bldgData?.features.find(f => f.properties.uid === uid)?.properties.name || 'Building';
            if (currentPopup) {
                currentPopup.setHTML(`
                    <b style="color:#e2e8f0;font-size:12px">${pName}</b><br>
                    <span style="color:${n.color}">${n.icon} ${n.label}</span>
                `);
            }
            setStatus('ok', `${n.label} assigned`);
            updateSummary();
        }

        // ── Summary ────────────────────────────────────────────────────
        function updateSummary() {
            const counts = {};
            Object.values(assignments).forEach(k => counts[k] = (counts[k]||0)+1);
            const total = bldgData?.features.length || 0;
            const asgnd = Object.values(assignments).filter(k => k !== 'none').length;

            document.getElementById('coverage-pct').textContent =
                total ? `${((asgnd/total)*100).toFixed(0)}%` : '0%';

            const rows = document.getElementById('summary-rows');
            rows.innerHTML = Object.entries(NBS)
                .filter(([k]) => k !== 'none')
                .map(([k, n]) => {
                    const cnt = counts[k] || 0;
                    const pct = total ? (cnt/total)*100 : 0;
                    return `<div class="sum-row">
                        <span class="sum-icon">${n.icon}</span>
                        <span class="sum-name" style="color:${cnt?n.color:'#334155'}">${n.label.split(' ')[0]}</span>
                        <div class="sum-bar-wrap">
                            <div class="sum-bar" style="width:${pct}%;background:${n.color}"></div>
                        </div>
                        <span class="sum-count" style="color:${cnt?n.color:'#334155'}">${cnt}</span>
                    </div>`;
                }).join('');
    let totalRunoffReduced = 0;
    let totalCarbonSaved = 0;
    const RAINFALL_EVENT = 0.03; // 假设 Swords 发生 30mm 的降雨事件

    Object.entries(assignments).forEach(([uid, type]) => {
        if (type === 'none') return;

        // 获取建筑特征数据计算面积
        const feature = bldgData.features.find(f => f.properties.uid == uid);
        if (!feature) return;
        
        // 简化的面积估算：基于边界框的粗略面积
        // 实际上可以用 turf.area(feature) 获得精确值
        const area = 250; // 默认平均单体面积

        // 根据 NBS 类型设置影响系数
        const impactMap = {
            'green_roof':  { runoff: 0.65, carbon: 2.5 }, // 截留 65%, 每平米固碳 2.5kg
            'rain_garden': { runoff: 0.80, carbon: 1.2 },
            'solar_green': { runoff: 0.40, carbon: 15.0 }, // 结合 LCA 项目，太阳能减排潜力大
            'wetland':     { runoff: 0.90, carbon: 0.8 },
            'green_wall':  { runoff: 0.10, carbon: 3.5 }
        };

        const impact = impactMap[type];
        if (impact) {
            totalRunoffReduced += area * RAINFALL_EVENT * impact.runoff;
            totalCarbonSaved += area * impact.carbon;
        }
    });

    // 更新 UI 元素
    document.getElementById('stat-runoff').textContent = `${totalRunoffReduced.toFixed(1)} m³`;
    document.getElementById('stat-carbon').textContent = `${totalCarbonSaved.toFixed(0)} kg`;
        }

        // ── Export ─────────────────────────────────────────────────────
        function exportNBS() {
            if (!bldgData) return;
            const out = bldgData.features.map(f => ({
                id:       f.properties.uid,
                name:     f.properties.name,
                height:   f.properties.height,
                building: f.properties.building,
                nbs_type: f.properties.nbs,
                nbs_label:NBS[f.properties.nbs].label,
                coords:   f.geometry.coordinates[0][0]
            }));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(out,null,2)], {type:'application/json'}));
            a.download = 'swords_nbs_plan.json';
            a.click();
            setStatus('ok', 'Exported swords_nbs_plan.json');
        }

        // ── Fallback ───────────────────────────────────────────────────
        function fallback() {
            const C = SWORDS;
            let uid = 0;
            function box(dlng, dlat, w, h, height, name) {
                return { type:'Feature', id:uid, geometry:{type:'Polygon',coordinates:[[
                    [C[0]+dlng-w/2,C[1]+dlat-h/2],[C[0]+dlng+w/2,C[1]+dlat-h/2],
                    [C[0]+dlng+w/2,C[1]+dlat+h/2],[C[0]+dlng-w/2,C[1]+dlat+h/2],
                    [C[0]+dlng-w/2,C[1]+dlat-h/2]
                ]]}, properties:{uid:uid++,height,min_height:0,name,building:'yes',
                    levels:Math.round(height/3.5),nbs:'none',nbs_color:NBS.none.color}};
            }
            bldgData = {type:'FeatureCollection', features:[
                box(-0.004,-0.001,0.006,0.003,18,'Swords Pavilions'),
                box( 0.003,-0.002,0.003,0.002,12,'Office Block A'),
                box(-0.002, 0.003,0.002,0.002, 8,'Residential Block'),
                box( 0.005,-0.001,0.002,0.002, 6,'Community Centre'),
                box(-0.007,-0.001,0.003,0.002,20,'Crowne Plaza Hotel'),
                box( 0.000, 0.003,0.002,0.001,10,'County Council'),
                box(-0.003, 0.002,0.002,0.001, 5,'Retail Units'),
                box( 0.002, 0.001,0.003,0.002,14,'Apartment Block'),
                box(-0.005, 0.004,0.002,0.002, 8,'Primary School'),
                box( 0.006, 0.002,0.002,0.001, 6,'Health Centre'),
            ]};
            return bldgData;
        }

        // ── Status helper ──────────────────────────────────────────────
        function setStatus(s, m) {
            const d = document.getElementById('ml-sdot');
            const t = document.getElementById('ml-stxt');
            if (d) d.className = s;
            if (t) t.textContent = m;
        }
    }

    console.log('[3D NBS v9] Loaded — modern UI, MapLibre GL overlay');
})();