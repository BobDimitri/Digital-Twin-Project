// map-patch.js — load BEFORE script.js
// Prevents fitBounds/setView from resetting view during 3D mode

(function() {
    // Wait for Leaflet to be defined
    function patch() {
        if (!window.L || !L.Map) { setTimeout(patch, 50); return; }

        const _fitBounds = L.Map.prototype.fitBounds;
        L.Map.prototype.fitBounds = function() {
            if (window._3dModeActive) return this; // block during 3D
            return _fitBounds.apply(this, arguments);
        };

        // Also block automatic setView that comes from water level refresh
        const _setView = L.Map.prototype.setView;
        L.Map.prototype.setView = function() {
            if (window._3dModeActive && this._3dBlocked) return this;
            return _setView.apply(this, arguments);
        };

        console.log('[map-patch] fitBounds/setView patched — 3D mode safe');
    }
    patch();
})();
