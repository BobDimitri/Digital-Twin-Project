// ═══════════════════════════════════════════════════════════════════════
//  Weather Layers v2 — Ireland Climate Adaptation Map
//  A) Wind Field  — dense animated arrows across full viewport
//  B) Heatmap     — interpolated temp / rain / wind overlay
//  C) Timeline    — RainViewer radar scrubber
// ═══════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    const CITIES = [
        { name:'Dublin',     lat:53.3498, lng:-6.2603 },
        { name:'Cork',       lat:51.8985, lng:-8.4756 },
        { name:'Galway',     lat:53.2707, lng:-9.0568 },
        { name:'Limerick',   lat:52.6638, lng:-8.6267 },
        { name:'Belfast',    lat:54.5973, lng:-5.9301 },
        { name:'Waterford',  lat:52.2583, lng:-7.1190 },
        { name:'Sligo',      lat:54.2766, lng:-8.4761 },
        { name:'Kilkenny',   lat:52.6541, lng:-7.2448 },
        { name:'Wexford',    lat:52.3283, lng:-6.5017 },
        { name:'Wicklow',    lat:52.9750, lng:-6.0494 },
        { name:'Athlone',    lat:53.4239, lng:-7.9407 },
        { name:'Tralee',     lat:52.2710, lng:-9.7016 },
        { name:'Donegal',    lat:54.6543, lng:-8.1096 },
        { name:'Mullingar',  lat:53.5257, lng:-7.3378 },
        { name:'Dundalk',    lat:54.0027, lng:-6.4048 },
        { name:'Shannon',    lat:52.7039, lng:-8.8639 },
        { name:'Ennis',      lat:52.8435, lng:-8.9862 },
        { name:'Letterkenny',lat:54.9558, lng:-7.7335 },
        { name:'Tullamore',  lat:53.2762, lng:-7.4886 },
        { name:'Drogheda',   lat:53.7179, lng:-6.3561 },
    ];

    // ─── CSS ────────────────────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    /* FAB */
    #wx-fab {
        position:absolute; top:130px; right:14px; z-index:1001;
        display:flex; align-items:center; gap:8px;
        background:rgba(6,10,18,.88);
        border:1px solid rgba(255,255,255,.12); border-radius:40px;
        padding:9px 16px 9px 12px;
        color:#e2e8f0; font:500 12px 'Syne',sans-serif;
        cursor:pointer; backdrop-filter:blur(16px);
        box-shadow:0 4px 24px rgba(0,0,0,.45);
        transition:all .22s; pointer-events:all; letter-spacing:.3px;
    }
    #wx-fab:hover { border-color:rgba(125,211,252,.4); color:#7dd3fc; }
    #wx-fab.open  { background:rgba(6,10,18,.96); border-color:rgba(125,211,252,.3); color:#7dd3fc; }
    #wx-fab-ic { font-size:16px; transition:transform .35s; }
    #wx-fab.open #wx-fab-ic { transform:rotate(180deg); }

    /* Panel */
    #wx-panel {
        position:absolute; top:176px; right:14px; z-index:1000;
        width:272px; pointer-events:none;
        opacity:0; transform:translateY(-6px) scale(.98);
        transform-origin:top right;
        transition:opacity .22s, transform .25s cubic-bezier(.23,1,.32,1);
    }
    #wx-panel.open { pointer-events:all; opacity:1; transform:translateY(0) scale(1); }

    #wx-inner {
        background:rgba(6,10,20,.94);
        border:1px solid rgba(255,255,255,.07);
        border-radius:18px;
        backdrop-filter:blur(24px);
        box-shadow:0 24px 64px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.03) inset;
        overflow:hidden;
    }

    /* Tabs */
    #wx-tabbar {
        display:grid; grid-template-columns:repeat(3,1fr);
        border-bottom:1px solid rgba(255,255,255,.06);
    }
    .wx-tab {
        padding:12px 4px 10px; border:none; background:transparent;
        color:rgba(255,255,255,.27);
        font:500 10px 'Syne',sans-serif;
        letter-spacing:.6px; text-transform:uppercase;
        cursor:pointer; text-align:center;
        display:flex; flex-direction:column; align-items:center; gap:4px;
        position:relative; transition:color .18s;
    }
    .wx-tab-ic { font-size:16px; }
    .wx-tab::after {
        content:''; position:absolute; bottom:-1px; left:22%; right:22%;
        height:2px; border-radius:1px; background:#38bdf8; opacity:0; transition:opacity .18s;
    }
    .wx-tab.active { color:#7dd3fc; }
    .wx-tab.active::after { opacity:1; }
    .wx-tab:hover:not(.active) { color:rgba(255,255,255,.55); }

    /* Panes */
    .wx-pane { display:none; padding:14px; }
    .wx-pane.active { display:block; }

    /* Labels */
    .wx-lbl {
        font:500 9px 'JetBrains Mono',monospace;
        letter-spacing:1.2px; text-transform:uppercase;
        color:rgba(255,255,255,.2); margin:10px 0 7px;
    }
    .wx-lbl:first-child { margin-top:0; }

    /* Stats grid */
    .wx-stats {
        display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:2px;
    }
    .wx-stat {
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06);
        border-radius:10px; padding:8px 10px; text-align:center;
    }
    .wx-sv { font:600 18px 'JetBrains Mono',monospace; color:#7dd3fc; line-height:1; margin-bottom:3px; }
    .wx-sk { font:400 8px 'JetBrains Mono',monospace; color:rgba(255,255,255,.22); letter-spacing:.8px; text-transform:uppercase; }

    /* Segmented control */
    .wx-seg {
        display:flex; gap:3px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.07);
        border-radius:10px; padding:3px; margin-bottom:2px;
    }
    .wx-sb {
        flex:1; padding:5px 2px;
        background:transparent; border:none;
        color:rgba(255,255,255,.33);
        font:500 10px 'Syne',sans-serif;
        border-radius:7px; cursor:pointer;
        transition:all .15s; letter-spacing:.3px;
        white-space:nowrap;
    }
    .wx-sb.on { background:rgba(56,189,248,.18); color:#7dd3fc; }
    .wx-sb:hover:not(.on) { color:rgba(255,255,255,.6); }

    /* Range slider */
    .wx-range {
        -webkit-appearance:none; appearance:none;
        width:100%; height:3px; border-radius:2px; outline:none;
        background:linear-gradient(90deg,#38bdf8 var(--v,65%),rgba(255,255,255,.1) var(--v,65%));
        cursor:pointer;
    }
    .wx-range::-webkit-slider-thumb {
        -webkit-appearance:none; width:13px; height:13px; border-radius:50%;
        background:#38bdf8; border:2px solid #060a14;
        box-shadow:0 0 8px rgba(56,189,248,.5); cursor:pointer;
    }

    /* Legend */
    .wx-legend { display:flex; align-items:center; gap:6px; margin-top:8px; }
    .wx-leg-bar { flex:1; height:5px; border-radius:3px; }
    .wx-leg-val { font:500 9px 'JetBrains Mono',monospace; color:rgba(255,255,255,.25); }

    /* Timeline */
    #tl-timebox {
        background:rgba(56,189,248,.07); border:1px solid rgba(56,189,248,.15);
        border-radius:10px; padding:8px 12px; margin-bottom:10px;
    }
    #tl-ts { font:500 11px 'JetBrains Mono',monospace; color:#7dd3fc; display:block; margin-bottom:2px; }
    #tl-ms { font:400 9px 'JetBrains Mono',monospace; color:rgba(125,211,252,.4); letter-spacing:.5px; }
    #tl-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    #tl-play {
        width:34px; height:34px; border-radius:50%; flex-shrink:0;
        background:rgba(56,189,248,.18); border:1px solid rgba(56,189,248,.35);
        color:#7dd3fc; font-size:11px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; transition:all .15s;
    }
    #tl-play:hover { background:rgba(56,189,248,.28); }
    #tl-fi { font:400 9px 'JetBrains Mono',monospace; color:rgba(255,255,255,.2); margin-bottom:8px; }

    /* Footer */
    .wx-foot {
        display:flex; align-items:center; gap:6px;
        padding:8px 14px 10px;
        border-top:1px solid rgba(255,255,255,.05);
        font:400 9px 'JetBrains Mono',monospace; color:rgba(255,255,255,.2);
    }
    .wx-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; background:#1e293b; }
    .wx-dot.spin { background:#f59e0b; animation:wxbl 1s infinite; }
    .wx-dot.ok   { background:#22c55e; }
    .wx-dot.err  { background:#ef4444; }
    @keyframes wxbl { 0%,100%{opacity:1}50%{opacity:.25} }
    `;
    document.head.appendChild(css);

    // ── Wait for map ──────────────────────────────────────────────────
    function waitForMap(cb) {
        try { if (typeof map!=='undefined' && map.getContainer) { cb(); return; } } catch(e){}
        setTimeout(() => waitForMap(cb), 200);
    }
    waitForMap(boot);

    // ── State ─────────────────────────────────────────────────────────
    let wxData=[], activeTab='wind';
    let windVisible = true;
    let canvas = null, ctx = null, particles = [];
    let particleCount = 1200; // 对应“Normal”密度
    let animationId = null;
    let hmInst=null, hmMode='temp', hmOpacity=0.65;
    let tlLayer=null, tlFrames=[], tlIdx=0;
    let tlPlaying=false, tlTimer=null, tlSpeed=600;
    let tlPast=[], tlForecast=[], tlFuture=false;

    // ═════════════════════════════════════════
    function boot() { buildUI(); fetchWeather(); fetchRadar(); }

    // ═════════════════════════════════════════  BUILD UI
    function buildUI() {
        const C = map.getContainer();

        const fab = mk('button','wx-fab',
            '<span id="wx-fab-ic">🌬</span><span>Weather Layers</span>');
        C.appendChild(fab);

        const panel = mk('div','wx-panel',`
        <div id="wx-inner">
          <div id="wx-tabbar">
            <button class="wx-tab active" data-tab="wind">
              <span class="wx-tab-ic">🌬</span>Wind
            </button>
            <button class="wx-tab" data-tab="heatmap">
              <span class="wx-tab-ic">🌡</span>Heat
            </button>
            <button class="wx-tab" data-tab="timeline">
              <span class="wx-tab-ic">📡</span>Radar
            </button>
          </div>

          <!-- WIND -->
          <div class="wx-pane active" id="pane-wind">
            <p class="wx-lbl">Live Wind Statistics</p>
            <div class="wx-stats">
              <div class="wx-stat"><div class="wx-sv" id="ws-avg">—</div><div class="wx-sk">Avg km/h</div></div>
              <div class="wx-stat"><div class="wx-sv" id="ws-max">—</div><div class="wx-sk">Max km/h</div></div>
              <div class="wx-stat"><div class="wx-sv" id="ws-dir">—</div><div class="wx-sk">Direction</div></div>
            </div>
            <p class="wx-lbl">Arrow Density</p>
            <div class="wx-seg" id="seg-den">
              <button class="wx-sb" data-sp="90">Sparse</button>
              <button class="wx-sb on" data-sp="60">Normal</button>
              <button class="wx-sb" data-sp="38">Dense</button>
            </div>
            <p class="wx-lbl">Visibility</p>
            <div class="wx-seg" id="seg-vis">
              <button class="wx-sb on" data-vis="1">Show</button>
              <button class="wx-sb" data-vis="0">Hide</button>
            </div>
          </div>

          <!-- HEATMAP -->
          <div class="wx-pane" id="pane-heatmap">
            <p class="wx-lbl">Variable</p>
            <div class="wx-seg" id="seg-hm">
              <button class="wx-sb on" data-mode="temp">🌡 Temp</button>
              <button class="wx-sb" data-mode="rain">💧 Rain</button>
              <button class="wx-sb" data-mode="wind">💨 Wind</button>
            </div>
            <p class="wx-lbl">Opacity</p>
            <input class="wx-range" id="hm-op" type="range" min="15" max="90" value="65" style="--v:65%">
            <div class="wx-legend">
              <span class="wx-leg-val" id="hm-min">—</span>
              <div class="wx-leg-bar" id="hm-bar"></div>
              <span class="wx-leg-val" id="hm-max">—</span>
            </div>
          </div>

          <!-- TIMELINE -->
          <div class="wx-pane" id="pane-timeline">
            <div id="tl-timebox">
              <span id="tl-ts">Loading radar…</span>
              <span id="tl-ms">RADAR</span>
            </div>
            <div id="tl-row">
              <button id="tl-play">▶</button>
              <div style="flex:1"><input class="wx-range" id="tl-sl" type="range" min="0" max="12" value="0" style="--v:0%"></div>
            </div>
            <div id="tl-fi">— of —</div>
            <p class="wx-lbl">Playback Speed</p>
            <div class="wx-seg" id="seg-spd">
              <button class="wx-sb" data-spd="1200">Slow</button>
              <button class="wx-sb on" data-spd="600">Normal</button>
              <button class="wx-sb" data-spd="250">Fast</button>
            </div>
            <p class="wx-lbl">Data Mode</p>
            <div class="wx-seg" id="seg-tm">
              <button class="wx-sb on" data-f="0">📡 Past</button>
              <button class="wx-sb" data-f="1">🔮 Forecast</button>
            </div>
          </div>

          <div class="wx-foot">
            <div class="wx-dot spin" id="wx-dot"></div>
            <span id="wx-st">Fetching weather data…</span>
          </div>
        </div>`);
        C.appendChild(panel);

        // FAB open/close
        fab.addEventListener('click', () => {
            panel.classList.toggle('open');
            fab.classList.toggle('open', panel.classList.contains('open'));
        });

        // Tab switching
        panel.querySelectorAll('.wx-tab').forEach(t => t.addEventListener('click', () => {
            panel.querySelectorAll('.wx-tab').forEach(x=>x.classList.remove('active'));
            panel.querySelectorAll('.wx-pane').forEach(x=>x.classList.remove('active'));
            t.classList.add('active');
            g('pane-'+t.dataset.tab).classList.add('active');
            activeTab = t.dataset.tab;
            if (activeTab==='heatmap') toggleHeatmap(true);
            else toggleHeatmap(false);
        }));

        // Wind: density
        onSeg('seg-den', b => { 
            // 将原来的间距映射为粒子数量
            const counts = { "90": 600, "60": 1200, "38": 2500 }; 
            particleCount = counts[b.dataset.sp] || 1200; 
            rebuildArrows(); 
        });
        // Wind: visibility
        onSeg('seg-vis', b => {
            windVisible = b.dataset.vis==='1';
            if (arrowWrapper) arrowWrapper.style.display = windVisible?'':'none';
        });

        // Heatmap: mode
        onSeg('seg-hm', b => { hmMode=b.dataset.mode; if(wxData.length) drawHeatmap(); });
        // Heatmap: opacity
        g('hm-op').addEventListener('input', function() {
            hmOpacity = this.value/100;
            const pct = ((this.value-15)/75*100).toFixed(0);
            this.style.setProperty('--v', pct+'%');
            if(wxData.length) drawHeatmap();
        });

        // Timeline: slider
        g('tl-sl').addEventListener('input', function() {
            tlIdx = parseInt(this.value);
            this.style.setProperty('--v', (tlFrames.length>1 ? tlIdx/(tlFrames.length-1)*100 : 0).toFixed(0)+'%');
            showFrame(tlIdx);
        });
        // Timeline: play
        g('tl-play').addEventListener('click', function() {
            tlPlaying=!tlPlaying;
            this.textContent=tlPlaying?'⏸':'▶';
            tlPlaying ? stepTL() : clearTimeout(tlTimer);
        });
        // Timeline: speed
        onSeg('seg-spd', b => { tlSpeed=parseInt(b.dataset.spd); });
        // Timeline: past/forecast
        onSeg('seg-tm', b => {
            tlFuture = b.dataset.f==='1';
            tlFrames = tlFuture ? tlForecast : tlPast;
            tlIdx    = tlFuture ? 0 : tlFrames.length-1;
            g('tl-sl').max = Math.max(tlFrames.length-1, 0);
            g('tl-ms').textContent = tlFuture ? 'FORECAST' : 'RADAR';
            showFrame(tlIdx);
        });

        // Rebuild on map movement
// 关键：在移动开始时停止动画并清理，防止割裂感
        map.on('movestart zoomstart', () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        map.on('moveend zoomend', () => {
            if (windVisible && wxData.length) rebuildArrows();
            if (activeTab==='heatmap' && wxData.length) drawHeatmap();
        });
    }

    function mk(tag,id,html) { const e=document.createElement(tag); e.id=id; e.innerHTML=html; return e; }
    function g(id) { return document.getElementById(id); }
    function onSeg(gid, cb) {
        const grp = g(gid); if (!grp) return;
        grp.querySelectorAll('.wx-sb').forEach(b => b.addEventListener('click', function() {
            grp.querySelectorAll('.wx-sb').forEach(x=>x.classList.remove('on'));
            this.classList.add('on'); cb(this);
        }));
    }

    // ══════════════════════════════════════════════════
    // WEATHER FETCH
    // ══════════════════════════════════════════════════
    async function fetchWeather() {
        setSt('spin','Fetching live weather data…');
        const results = await Promise.all(CITIES.map(city =>
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
                  `&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=Europe%2FDublin`)
                .then(r=>r.json())
                .then(d=>({ ...city,
                    temp:    d.current?.temperature_2m    ?? 10,
                    rain:    d.current?.precipitation      ?? 0,
                    windSpd: d.current?.wind_speed_10m    ?? 15,
                    windDir: d.current?.wind_direction_10m ?? 270,
                }))
                .catch(()=>({ ...city, temp:10, rain:0, windSpd:15, windDir:270 }))
        ));
        wxData = results;

        const spds = wxData.map(d=>d.windSpd);
        const avg  = (spds.reduce((a,b)=>a+b,0)/spds.length).toFixed(0);
        const max  = Math.max(...spds).toFixed(0);
        const dirs = wxData.map(d=>d.windDir);
        let sx=0,sy=0; dirs.forEach(d=>{sx+=Math.cos(d*Math.PI/180);sy+=Math.sin(d*Math.PI/180);});
        const meanDir = (Math.atan2(sy,sx)*180/Math.PI+360)%360;
        const compass = ['N','NE','E','SE','S','SW','W','NW'][Math.round(meanDir/45)%8];

        if(g('ws-avg')) g('ws-avg').textContent=avg;
        if(g('ws-max')) g('ws-max').textContent=max;
        if(g('ws-dir')) g('ws-dir').textContent=compass;

        setSt('ok',`${wxData.length} stations · live`);
        rebuildArrows();
    }

    // IDW at point
    function windAt(lat,lng) {
        if(!wxData.length) return {spd:15,dir:270};
        let tw=0,ws=0,sx=0,cx=0;
        wxData.forEach(d=>{
            const dist=Math.hypot(lat-d.lat,lng-d.lng)+0.001, w=1/(dist*dist);
            tw+=w; ws+=d.windSpd*w;
            sx+=Math.sin(d.windDir*Math.PI/180)*w;
            cx+=Math.cos(d.windDir*Math.PI/180)*w;
        });
        return { spd:ws/tw, dir:(Math.atan2(sx/tw,cx/tw)*180/Math.PI+360)%360 };
    }
    function valAt(lat,lng) {
        if(!wxData.length) return 0;
        let tw=0,vs=0;
        wxData.forEach(d=>{
            const dist=Math.hypot(lat-d.lat,lng-d.lng)+0.001, w=1/(dist*dist);
            tw+=w; vs+=(hmMode==='temp'?d.temp:hmMode==='rain'?d.rain:d.windSpd)*w;
        });
        return vs/tw;
    }


   
    // A: WIND PARTICLES (Renewables Map Style)
    // ══════════════════════════════════════════════════
    function rebuildArrows() {
        if (animationId) cancelAnimationFrame(animationId);
        const container = map.getContainer();
        
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'wx-wind-canvas';
            canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:430;';
            container.appendChild(canvas);
            ctx = canvas.getContext('2d');
        }

        // 自动适应容器大小
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;

        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(resetParticle({}));
        }

        if (windVisible && wxData.length) animParticles();
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function resetParticle(p) {
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
        p.lx = p.x; 
        p.ly = p.y; 
        p.age = 0;
        p.maxAge = 30 + Math.random() * 70; // 随机寿命，避免粒子整齐划一地消失
        return p;
    }

    function animParticles() {
        if (!windVisible || !wxData.length) return;

        // 核心技巧：通过绘制半透明层实现“拖尾”效果
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.1;
        
        particles.forEach(p => {
            if (p.age > p.maxAge) resetParticle(p);

            // 坐标转换与风场采样
            const ll = map.containerPointToLatLng([p.x, p.y]);
            const wind = windAt(ll.lat, ll.lng); // 使用你原有的 IDW 采样函数
            
            const angle = (wind.dir + 180) * Math.PI / 180;
            const speed = wind.spd * 0.15; // 速度系数

            p.lx = p.x;
            p.ly = p.y;
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;

            // 根据风速计算动态颜色
            const t = Math.min(wind.spd / 50, 1);
            ctx.strokeStyle = `rgb(${Math.round(80 + t * 150)}, ${Math.round(180 + t * 70)}, 255)`;

            ctx.beginPath();
            ctx.moveTo(p.lx, p.ly);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            p.age++;

            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                resetParticle(p);
            }
        });

        animationId = requestAnimationFrame(animParticles);
    }

    // ══════════════════════════════════════════════════
    // B: HEATMAP
    // ══════════════════════════════════════════════════
    const HmL = L.Layer.extend({
        onAdd(m) {
            this._m=m; this._c=document.createElement('canvas');
            this._c.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:420;';
            m.getContainer().appendChild(this._c); this._sz();
            hmInst=this;
        },
        onRemove() { if(this._c) this._c.remove(); hmInst=null; },
        _sz() { const s=this._m.getSize(); this._c.width=s.x; this._c.height=s.y; },
        cvs(){ return this._c; }, ctx(){ return this._c.getContext('2d'); }
    });

    let hmL=null;
    function toggleHeatmap(on) {
        if(on) { if(!hmL){hmL=new HmL();hmL.addTo(map);} if(wxData.length) drawHeatmap(); }
        else   { if(hmL){hmL.remove();hmL=null;} }
    }

    function drawHeatmap() {
        if(!hmL) return;
        const cvs=hmL.cvs(), ctx=hmL.ctx(), W=cvs.width, H=cvs.height;
        const vals=wxData.map(d=>hmMode==='temp'?d.temp:hmMode==='rain'?d.rain:d.windSpd);
        const minV=Math.min(...vals), maxV=Math.max(...vals), rng=maxV-minV||1;
        const unit=hmMode==='temp'?'°C':hmMode==='rain'?'mm':'km/h';

        if(g('hm-min')) g('hm-min').textContent=minV.toFixed(1)+unit;
        if(g('hm-max')) g('hm-max').textContent=maxV.toFixed(1)+unit;
        if(g('hm-bar')) g('hm-bar').style.background=gradCSS();

        const STEP=5;
        const off=document.createElement('canvas'); off.width=W; off.height=H;
        const oc=off.getContext('2d'), img=oc.createImageData(W,H), d=img.data;
        for(let px=0;px<W;px+=STEP) for(let py=0;py<H;py+=STEP) {
            const ll=map.containerPointToLatLng([px,py]);
            const t=(valAt(ll.lat,ll.lng)-minV)/rng;
            const [r,gv,b]=colScale(t);
            for(let dx=0;dx<STEP&&px+dx<W;dx++) for(let dy=0;dy<STEP&&py+dy<H;dy++){
                const i=((py+dy)*W+(px+dx))*4;
                d[i]=r;d[i+1]=gv;d[i+2]=b;d[i+3]=255;
            }
        }
        oc.putImageData(img,0,0);
        ctx.clearRect(0,0,W,H);
        ctx.filter='blur(30px)'; ctx.globalAlpha=hmOpacity;
        ctx.drawImage(off,0,0);
        ctx.filter='none'; ctx.globalAlpha=1;
    }

    function colScale(t) {
        t=Math.max(0,Math.min(1,t));
        const M={
            temp:[[0,[59,130,246]],[.35,[34,197,94]],[.65,[234,179,8]],[1,[239,68,68]]],
            rain:[[0,[226,232,240]],[.2,[147,197,253]],[.6,[59,130,246]],[1,[30,58,138]]],
            wind:[[0,[56,189,248]],[.4,[167,243,208]],[.7,[251,191,36]],[1,[239,68,68]]],
        };
        const s=M[hmMode]||M.temp;
        for(let i=1;i<s.length;i++) if(t<=s[i][0]) {
            const f=(t-s[i-1][0])/(s[i][0]-s[i-1][0]);
            return s[i-1][1].map((c,j)=>Math.round(c+f*(s[i][1][j]-c)));
        }
        return s[s.length-1][1];
    }
    function gradCSS() {
        return 'linear-gradient(90deg,' +
            Array.from({length:9},(_,i)=>{const[r,gv,b]=colScale(i/8);return `rgb(${r},${gv},${b}) ${(i/8*100).toFixed(0)}%`;}).join(',') + ')';
    }

    // ══════════════════════════════════════════════════
    // C: RADAR TIMELINE
    // ══════════════════════════════════════════════════
    async function fetchRadar() {
        try {
            const d=await fetch('https://api.rainviewer.com/public/weather-maps.json').then(r=>r.json());
            tlPast     = d.radar?.past    || [];
            tlForecast = d.radar?.nowcast || [];
            tlFrames   = tlPast;
            tlIdx      = tlFrames.length-1;
            if(g('tl-sl')) g('tl-sl').max=Math.max(tlFrames.length-1,0);
            showFrame(tlIdx);
        } catch(e) { setSt('err','Radar load failed'); }
    }

    function showFrame(idx) {
        tlIdx=Math.max(0,Math.min(idx,tlFrames.length-1));
        const f=tlFrames[tlIdx]; if(!f) return;
        if(tlLayer){map.removeLayer(tlLayer);tlLayer=null;}
        tlLayer=L.tileLayer(
            `https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
            {opacity:.72,zIndex:460,attribution:'RainViewer'}
        ).addTo(map);
        const ts=new Date(f.time*1000);
        const str=ts.toLocaleString('en-IE',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Dublin'});
        if(g('tl-ts')) g('tl-ts').textContent=str;
        if(g('tl-fi')) g('tl-fi').textContent=`Frame ${tlIdx+1} of ${tlFrames.length}`;
        const sl=g('tl-sl'); if(sl){
            sl.value=tlIdx;
            sl.style.setProperty('--v',(tlFrames.length>1?tlIdx/(tlFrames.length-1)*100:0).toFixed(0)+'%');
        }
    }
    function stepTL() {
        if(!tlPlaying) return;
        tlIdx=(tlIdx+1)%tlFrames.length; showFrame(tlIdx);
        tlTimer=setTimeout(stepTL,tlSpeed);
    }

    function setSt(s,m) {
        const d=g('wx-dot'),t=g('wx-st');
        if(d){d.className='wx-dot';d.classList.add(s);}
        if(t) t.textContent=m;
    }
})();
