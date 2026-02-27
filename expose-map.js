// expose-map.js — place this AFTER script.js in your HTML
// Makes the Leaflet map instance findable by 3d_buildings.js
(function expose() {
    // 'map' is the variable from script.js (let map = L.map(...))
    // It is in the same script scope, so we can reach it at load time
    // via a small timeout to ensure script.js has fully executed
    setTimeout(function() {
        if (typeof map !== 'undefined' && map && map.getContainer) {
            map.getContainer()._leaflet_map = map;
            console.log('[expose-map] Leaflet map instance registered on #map div');
        }
    }, 100);
})();
