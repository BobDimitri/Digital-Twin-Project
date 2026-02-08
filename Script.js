// ==================== 全局变量 ====================
let map;
let nbsLayer = null;           // NBS 项目点层
let riverBasinLayer = null;    // 河流流域区（Polygon）
let waterLevelLayer = L.layerGroup();  // 实时水位标记组
let weatherLayer = L.layerGroup();     // 天气标记组
let riverNetworkLayer = L.layerGroup();  // 只创建，不立即 addTo(map)

// 图层对象（用于控制面板）
const baseLayers = {};
const overlays = {};

// ========== 新增：水位数据缓存配置 ==========
const WATERLEVEL_CACHE_KEY = 'waterLevelData_cache';
const WATERLEVEL_TIME_KEY = 'waterLevelData_time';
const CACHE_DURATION = 60 * 60 * 1000;   // 1小时（毫秒）
const AUTO_CHECK_INTERVAL = 10 * 60 * 1000; // 每10分钟检查一次是否过期

// ==================== 初始化地图 ====================
map = L.map('map').setView([53.35, -7.26], 7);  // 爱尔兰中心

// 底图定义
baseLayers["OpenStreetMap"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
});

baseLayers["ESRI Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
});

baseLayers["ESRI Topo Map"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
    maxZoom: 19
});

baseLayers["CartoDB Light"] = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
});

baseLayers["Stamen Terrain"] = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> (via Stadia Maps), Data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abcd'  // 可选，部分服务器支持
});

// 默认底图
baseLayers["ESRI Topo Map"].addTo(map)

// 测试标记
L.marker([53.35, -7.26]).addTo(map)
    .bindPopup('Ireland Center')
    .openPopup();

// 创建一个专用于背景多边形的 pane，zIndex 低于默认 overlayPane (400)
map.createPane('riverBasinPane');
map.getPane('riverBasinPane').style.zIndex = '350';   // 低于 overlayPane(400)，高于 tilePane(200

// ==================== 图层控制面板（提前创建） ====================
const layerControl = L.control.layers(baseLayers, overlays, {
    position: 'topright',
    collapsed: false  // 展开显示所有选项
}).addTo(map);

// ==================== RainViewer 雷达层 ====================

const rainLayer = L.tileLayer(
  'https://tilecache.rainviewer.com/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png',
  {
    opacity: 0.7,
    attribution: 'RainViewer'
  }
);

// 加入 overlays 管理
overlays['Live Rain Radar (RainViewer)'] = rainLayer;

// 不默认显示（可选）
// rainLayer.addTo(map);

layerControl.addOverlay(rainLayer, 'Live Rain Radar (RainViewer)');
// 调用
loadRiverNetwork();

// 添加到图层控制（overlays）
overlays['River Network (EPA)'] = riverNetworkLayer;
layerControl.addOverlay(riverNetworkLayer, 'River Network (EPA)');


// 在地图初始化代码后（L.map创建之后）
waterLevelLayer = L.layerGroup().addTo(map);  // 专用图层组，用于水位标记

// 当前区域过滤器（默认Dublin周边）
let currentRegionFilter = 'dublin';

// 区域过滤定义（可扩展）
const regionFilters = {
    'dublin': function(feature) {
        const [lon, lat] = feature.geometry.coordinates;
        return lat >= 53.0 && lat <= 53.6 && lon >= -6.6 && lon <= -5.8;  // Swords/Dublin/Fingal区域，出处：GeoJSON坐标范围分析
    },
    'all': function(feature) {
        return true;  // 全国所有站点（约150–200个，出处：waterlevel.ie/geojson/latest/特征数统计）
    }
    // 未来扩展：'leinster'、'cork'等
};

//这部分负责显示右下角的信息可供后续修改使用//
const infoPanel = L.control({position: 'bottomright'});
infoPanel.onAdd = function() {
    const div = L.DomUtil.create('div', 'info');
    div.innerHTML = `
        <h4>NBS Digital Twin Project
        <small>
        
        Madeby Weitao Zhang
        </small>`;
    return div;
};
infoPanel.addTo(map);

// ==================== 加载 NBS 项目层 ====================
fetch('DATA/testprojects.geojson')
    .then(response => {
        if (!response.ok) throw new Error(`NBS 项目加载失败: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log('NBS 项目加载成功，特征数：', data.features.length);

        nbsLayer = L.geoJSON(data, {
            pointToLayer: function(feature, latlng) {
                let color = "#3388ff";
                const type = (feature.properties.type || '').toLowerCase();

                if (type.includes('nbs') || type.includes('nature') || type.includes('自然')) color = "#2ecc71";
                else if (type.includes('hybrid') || type.includes('混合')) color = "#f39c12";
                else if (type.includes('grey') || type.includes('工程') || type.includes('传统')) color = "#e74c3c";

                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: color,
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                layer.bindPopup(`
                    <h3 style="margin:0 0 8px;">${props.name || 'Unnamed Project'}</h3>
                    <p><b>类型：</b> ${props.type || '未知'}</p>
                    <p><b>描述：</b> ${props.description || '无详细描述'}</p>
                    ${props.benefits ? `<p><b>效益：</b> ${props.benefits}</p>` : ''}
                    ${props.photo_url ? `<img src="${props.photo_url}" style="max-width:100%; margin-top:8px;" alt="项目照片">` : ''}
                `);
            }
        });

        overlays['NBS Adaptation Projects'] = nbsLayer;
        nbsLayer.addTo(map);  // 默认显示
        layerControl.addOverlay(nbsLayer, 'NBS Adaptation Projects');
        console.log('NBS 已加入控制面板');
    })
    .catch(err => console.error('NBS 项目加载失败:', err));


// ==================== 实时天气层 ====================
overlays['Live Weather (Irish Cities)'] = weatherLayer;
weatherLayer.addTo(map);  // 默认显示
layerControl.addOverlay(weatherLayer, 'Live Weather (Irish Cities)');

// 天气更新函数（略微简化）
var irishCities = [
    { name: "Dublin", lat: 53.3498, lng: -6.2603 },
    { name: "Cork", lat: 51.8985, lng: -8.4756 },
    { name: "Galway", lat: 53.2707, lng: -9.0568 },
    { name: "Limerick", lat: 52.6638, lng: -8.6267 },
    { name: "Belfast", lat: 54.5973, lng: -5.9301 },
    { name: "Waterford", lat: 52.2583, lng: -7.1190 },
    { name: "Sligo", lat: 54.2766, lng: -8.4761 },
    { name: "Kilkenny", lat: 52.6541, lng: -7.2448 },
    { name: "Wexford", lat: 52.3283, lng: -6.5017 },
    { name: "Waterford", lat: 52.2583, lng: -7.1190 },
    { name: "Wicklow", lat: 52.975, lng: -6.04944 },
    { name: "Shannon", lat: 52.70389, lng: -8.86389 }
    // 加更多城市坐标即可
];

function updateWeather() {
    weatherLayer.clearLayers();
    irishCities.forEach(city => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m,precipitation,wind_speed_10m,rain&timezone=Europe/Dublin`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                const current = data.current || {};
                const temp = current.temperature_2m || 0;
                const rain = current.precipitation || 0;
                const wind = current.wind_speed_10m || 0;

                // 1. 不点击时显示的温度图标（圆形 + 数字）
                const tempColor = temp < 5 ? '#00ffff' : temp > 20 ? '#e74c3c' : (temp > 10 ? '#ff9800' : '#3388ff');
                const tempIcon = L.divIcon({
                    className: 'temp-icon',
                    html: `
                        <div style="
                            background: ${tempColor};
                            color: white;
                            width: 44px;
                            height: 44px;
                            border-radius: 50%;
                            line-height: 44px;
                            text-align: center;
                            font-weight: bold;
                            font-size: 14px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        ">
                            ${Math.round(temp)}°C
                        </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                });

                const marker = L.marker([city.lat, city.lng], { icon: tempIcon });

                // 2. 点击弹出完整信息 + 温度折线图
                marker.bindPopup(`
                    <b>${city.name} Weather</b><br>
                    Temperature: ${temp} °C<br>
                    Rain: ${rain} mm<br>
                    Wind: ${wind} km/h<br>
                    Time: ${current.time || 'Latest'}<br>
                
                `, { maxWidth: 360 });


                marker.addTo(weatherLayer);
            })
            .catch(err => console.error(city.name + ' weather failed:', err));
    });
}

updateWeather();
setInterval(updateWeather, 60 * 60 * 1000);  // 每小时更新

/// ==================== 实时水位层(Core Function!!)==================== ///
//图层开关
overlays['Real-time Major Water Levels (OPW)'] = waterLevelLayer;
waterLevelLayer.addTo(map);  // 默认显示
layerControl.addOverlay(waterLevelLayer, 'Real-time Major Water Levels (OPW)');
var regionControl = L.control({position: 'topleft'});

regionControl.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info leaflet-control-layers');
    div.style.background = 'white';
    div.style.padding = '10px 15px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
    div.style.width = '220px';

    div.innerHTML = `
        <h5 style="margin:0 0 10px;">Area Filter </h5>
        <label style="display:block; margin:5px 0;">
            <input type="radio" name="region" value="dublin" ${currentRegionFilter === 'dublin' ? 'checked' : ''}> Dublin & Swords
        </label>
        <label style="display:block; margin:5px 0;">
            <input type="radio" name="region" value="all" ${currentRegionFilter === 'all' ? 'checked' : ''}> Whlole Country
        </label>
    `;

    L.DomEvent.on(div, 'change', function(e) {
        if (e.target.name === 'region') {
            currentRegionFilter = e.target.value;
            updateWaterLevels();  // 切换后立即刷新
        }
    });

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
};

regionControl.addTo(map);

// 水位更新函数
async function updateWaterLevels(forceUpdate = false) {
    waterLevelLayer.clearLayers();

    // 步骤1：检查缓存是否可用
    const cachedData = localStorage.getItem(WATERLEVEL_CACHE_KEY);
    const cacheTime = localStorage.getItem(WATERLEVEL_TIME_KEY);

    if (!forceUpdate && cachedData && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < CACHE_DURATION) {
            console.log('✅ Local cache（剩余 ' + Math.round((CACHE_DURATION - age)/60000) + ' 分钟过期）');
            renderWaterLevelGeoJSON(JSON.parse(cachedData));
            return;
        }
    }

    // 步骤2：缓存无效或强制更新 → 请求新数据
    console.log('🔄 从 waterlevel.ie Receving latest data...');
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = 'https://waterlevel.ie/geojson/latest/';
    const url = proxyUrl + encodeURIComponent(targetUrl) + '&nocache=' + Date.now();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!data?.features?.length) {
            console.warn('⚠️ No water level data received');
            return;
        }

        // 保存到 localStorage
        localStorage.setItem(WATERLEVEL_CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(WATERLEVEL_TIME_KEY, Date.now().toString());

        renderWaterLevelGeoJSON(data);

    } catch (err) {
        console.error('❌ data receive failed:', err);
        // 失败时尝试使用旧缓存
        if (cachedData) {
            console.log('⚠️ Last cached data will be used ');
            renderWaterLevelGeoJSON(JSON.parse(cachedData));
        }
    }
}

// 渲染函数（提取出来，便于复用）
function renderWaterLevelGeoJSON(data) {
    const geoJsonLayer = L.geoJSON(data, {
        filter: regionFilters[currentRegionFilter] || regionFilters['dublin'],

        pointToLayer: function(feature, latlng) {
            const level = parseFloat(feature.properties.value || '0') || 0;
            let color = "#2ecc71";
            if (level > 3) color = "#f39c12";
            if (level > 6) color = "#e74c3c";

            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: color,
                color: "#000",
                weight: 1,
                fillOpacity: 0.8
            });
        },

onEachFeature: function(feature, layer) {
    const p = feature.properties || {};
    const levelRaw = parseFloat(p.value);
    const level = isNaN(levelRaw) ? 'N/A' : levelRaw.toFixed(3);
    const time = p.datetime ? new Date(p.datetime).toLocaleString('en-IE', { timeZone: 'Europe/Dublin' }) : 'N/A';
    const stationRef = p.station_ref || '';

    // 弹窗内容
    const popupContent = `
        <b>${p.station_name || 'Unknown Site'}</b> (${stationRef})<br>
        Current Water Level: ${level} m (above Datum)<br>
        Last Update: ${time}<br>
        <a href="https://waterlevel.ie/${stationRef}/" target="_blank">View Station Page</a>
        <div style="width:360px; height:240px; margin-top:10px; border:1px solid #eee;">
            <canvas id="chart-${stationRef}"></canvas>
        </div>
    `;

    layer.bindPopup(popupContent, { maxWidth: 400 });

    // 记录数据（每小时1条，范围 0–20 m 适用于低海拔站点）
    const storageKey = `waterLevelHistory_${stationRef}`;
    let history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    // 清理异常记录
    history = history.filter(item => !isNaN(item.level) && item.level >= 0 && item.level <= 20);

    if (!isNaN(levelRaw) && levelRaw >= 0 && levelRaw <= 20) {
        const now = new Date();
        const lastEntry = history[history.length - 1];

        const shouldRecord = !lastEntry || (now - new Date(lastEntry.time) >= 3600000);

        if (shouldRecord) {
            history.push({ time: now.toISOString(), level: levelRaw });
            if (history.length > 168) history.shift();
            localStorage.setItem(storageKey, JSON.stringify(history));
            console.log(`Recorded: ${stationRef} → ${levelRaw.toFixed(3)} m`);
        }
    }

    // 点击绘图
    layer.on('click', function() {
        const canvas = document.getElementById(`chart-${stationRef}`);
        if (!canvas) return;

        const storedHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (storedHistory.length < 2) {
            canvas.innerHTML = '<p style="color:orange; text-align:center; font-size:12px;">Not enough data yet (need 2+ points)</p>';
            return;
        }

        const labels = storedHistory.map(item => new Date(item.time));
        const values = storedHistory.map(item => item.level);

        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

        if (canvas.chart) canvas.chart.destroy();

        canvas.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Water Level (m above Datum)',
                        data: values,
                        borderColor: '#1E90FF',
                        backgroundColor: 'rgba(30, 144, 255, 0.15)',
                        fill: true,
                        tension: 0.1,  // 减小曲线弯曲，避免视觉假象
                        pointRadius: 5,
                        pointBackgroundColor: '#1E90FF',
                        pointHoverRadius: 8
                    },
                    {
                        label: `Average: ${avg.toFixed(3)} m`,
                        data: Array(values.length).fill(avg),
                        borderColor: '#FF3333',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: { hour: 'dd MMM HH:mm' },
                            tooltipFormat: 'dd MMM yyyy HH:mm'
                        },
                        title: { display: true, text: 'Time (Hourly)' },
                        ticks: { maxTicksLimit: 10, autoSkip: true, maxRotation: 45, minRotation: 45 }
                    },
                    y: {
                        title: { display: true, text: 'Water Level (m above Datum)' },
                        // 固定合理范围（Broadmeadow 典型 5–8 m）
                        min: 4,     // 强制从 4 m 开始
                        max: 10,    // 上限 10 m
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    });
}
    });

    geoJsonLayer.addTo(waterLevelLayer);

    console.log(`Water levels updated successfully [${currentRegionFilter}], ${geoJsonLayer.getLayers().length} stations`);

    if (geoJsonLayer.getLayers().length > 0) {
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50] });
    }
}

// 页面加载时：优先使用缓存，只有过期才请求
window.addEventListener('load', () => {
    updateWaterLevels();   // 会自动检查缓存
});

// 每10分钟检查一次是否需要后台更新
setInterval(() => {
    const cacheTime = localStorage.getItem(WATERLEVEL_TIME_KEY);
    if (!cacheTime || (Date.now() - parseInt(cacheTime) >= CACHE_DURATION)) {
        updateWaterLevels(true);  // forceUpdate = true
    }
}, AUTO_CHECK_INTERVAL);

// ==================== 实时潮汐层（Marine Institute ERDDAP） ====================

const tideLayer = L.layerGroup();
overlays['Real-time Tide Levels (Dublin Bay)'] = tideLayer;
tideLayer.addTo(map);  // 默认显示
layerControl.addOverlay(tideLayer, 'Real-time Tide Levels (Dublin Bay)');

// Dublin Bay 周边主要潮汐站位（坐标 + station_id 来自 Marine Institute 数据）
const dublinTideStations = [
    { name: "Dublin Port", station_id: "Dublin Port", lat: 53.3457, lng: -6.2217 },
    
    // 如果你找到更多精确 station_id 和坐标，可以继续添加
];

async function updateTideLevels() {
    tideLayer.clearLayers();

    // 并行查询每个站位（避免阻塞）
    const promises = dublinTideStations.map(station => {
        const url = `https://erddap.marine.ie/erddap/tabledap/IrishNationalTideGaugeNetwork.json?time,station_id,Water_Level_LAT&time>=now-6hours&station_id="${station.station_id}"`;

        return fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`Tide fetch failed for ${station.name}: ${r.status}`);
                return r.json();
            })
            .then(data => {
                const rows = data.table.rows;
                if (rows.length === 0) return null;

                // 取最新一行
                const latest = rows[rows.length - 1];
                const time = latest[0];
                const level = parseFloat(latest[2]) || 0;  // Water_Level_LAT (m above LAT)

                // 颜色根据潮位（高潮红、低潮蓝）
                let color = 'blue';
                if (level > 3.0) color = 'red';      // 高潮警戒
                else if (level > 2.0) color = 'orange';
                else if (level < 0.5) color = 'green';  // 低潮

                L.circleMarker([station.lat, station.lng], {
                    radius: 10 + (level > 2 ? 4 : 0),  // 高潮标记更大
                    fillColor: color,
                    color: '#000',
                    weight: 2,
                    fillOpacity: 0.75
                }).bindPopup(`
                    <b>${station.name} Tide Level</b><br>
                    Water Level: ${level.toFixed(2)} m (above LAT)<br>
                    Time: ${time || 'Latest'}<br>
                    <small>Source: Marine Institute ERDDAP</small>
                `).addTo(tideLayer);

                console.log(`${station.name} tide updated: ${level} m`);
            })
            .catch(err => {
                console.warn(`Failed to load tide for ${station.name}:`, err);
            });
    });

    await Promise.all(promises);
    console.log('Dublin Bay tide levels updated');
}

// 每小时刷新（潮汐变化较慢）
updateTideLevels();
setInterval(updateTideLevels, 60 * 60 * 1000);

// ==================== 加载河流流域区 ====================
fetch('DATA/River_Basin_Districts.geojson')
    .then(response => {
        if (!response.ok) throw new Error(`流域区加载失败: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log(`流域区加载成功！共 ${data.features.length} 个区域`);

        riverBasinLayer = L.geoJSON(data, {
            // 关键：指定放入自定义 pane
            pane: 'riverBasinPane',

            style: {
                fillColor: '#8fb5e9',
                fillOpacity: 0.25,
                color: '#004891',
                weight: 1.5,
                opacity: 0.9,
                dashArray: '5, 5'
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                layer.bindPopup(`
                    <b>River Basin District</b><br><br>
                    Name: <b>${props.RBDName || 'N/A'}</b><br>
                    Code: ${props.EU_CD || props.RBD || 'N/A'}<br>
                    Area Size: ${(props.Shape__Area / 1000000).toFixed(0)} km²<br>
                    Perimeter: ${(props.Shape__Length / 1000).toFixed(1)} km
                `);
            }
        });

        overlays['River Basin Districts'] = riverBasinLayer;
        riverBasinLayer.addTo(map);  // 默认显示
        layerControl.addOverlay(riverBasinLayer, 'River Basin Districts');
        console.log('流域区已加入控制面板（置于自定义 pane）');
    })
    .catch(err => console.error('流域区加载失败:', err));

                                      // 加载河流河道图层 // 不能使用polygon版本
async function loadRiverNetwork() {
    try {
        const response = await fetch('DATA/RiverWaterway.geojson');  
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        L.geoJSON(data, {
            style: { 
                color: '#1E90FF', 
                weight: 1, 
                opacity: 0.7, 
                dashArray: '3, 2' 
            },
            smoothFactor: 2.0,  // ← 新增：值越高，低zoom简化越强（推荐1.0–5.0，根据文件测试调整）
            minZoom: 8,         // 保留：低zoom不显示
            onEachFeature: (feature, layer) => {
                if (feature.properties?.name || feature.properties?.RIVERNAME) {
                    layer.bindPopup(`River: ${feature.properties.name || feature.properties.RIVERNAME || 'Unnamed'}`);
                }
            }
        }).addTo(riverNetworkLayer);
        
        console.log('河流网络加载成功（已启用动态简化），特征数：' + data.features.length);
    } catch (err) {
        console.error('河流网络加载失败:', err);
    }
}
          // ==================== 结束 ====================
console.log('地图初始化完成，请检查右上角图层控制面板，应显示所有叠加层选项');