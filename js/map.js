
/**
 * CivicFix - Interactive Map Engine
 * Native Browser Geolocation + Leaflet
 * No paid geolocation API or API key required.
 */

class CivicFixMap {
    constructor() {
        this.map = null;
        this.markersLayer = null;
        this.hotspotsLayer = null;
        this.userLocationLayer = null;

        this.pickerMap = null;
        this.pickerMarker = null;

        this.currentUserLocation = null;
        this.activeTileLayer = null;
        this.pickerTileLayer = null;

        // Default map center: India.
        // Change this to your project's operating area if needed.
        this.defaultCenter = [20.5937, 78.9629];
        this.defaultZoom = 5;

        this.tileProviders = [
            {
                name: "OpenStreetMap",
                url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                options: {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    maxZoom: 19
                }
            },
            {
                name: "CartoDB Voyager",
                url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
                options: {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                    subdomains: "abcd",
                    maxZoom: 19
                }
            },
            {
                name: "CartoDB Light",
                url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
                options: {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                    subdomains: "abcd",
                    maxZoom: 19
                }
            }
        ];

        this._setupDefaultIcons();
    }

    get L() {
        return window.L;
    }

    // --------------------------------------------------
    // COMMON HELPERS
    // --------------------------------------------------

    _setupDefaultIcons() {
        const L = this.L;

        if (!L || !L.Icon || !L.Icon.Default) return;

        delete L.Icon.Default.prototype._getIconUrl;

        L.Icon.Default.mergeOptions({
            iconRetinaUrl: "assets/leaflet/images/marker-icon-2x.png",
            iconUrl: "assets/leaflet/images/marker-icon.png",
            shadowUrl: "assets/leaflet/images/marker-shadow.png"
        });
    }

    escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    showStatus(element, message, type = "loading") {
        if (!element) return;

        element.style.display = "block";
        element.className = `location-status-badge status-${type}`;
        element.textContent = message;
    }

    // --------------------------------------------------
    // LEAFLET TILE LAYER WITH FALLBACK
    // --------------------------------------------------

    _createTileLayer(providerIndex = 0) {
        const L = this.L;
        const provider = this.tileProviders[providerIndex];

        if (!L || !provider) return null;

        return L.tileLayer(provider.url, {
            ...provider.options
        });
    }

    _addTileLayerWithFallback(map, propertyName, index = 0) {
        if (!map || index >= this.tileProviders.length) {
            console.error("All map tile providers failed.");
            return;
        }

        const layer = this._createTileLayer(index);

        if (!layer) return;

        let errorCount = 0;
        let switched = false;

        layer.on("tileerror", () => {
            errorCount++;

            if (errorCount >= 3 && !switched) {
                switched = true;

                console.warn(
                    `${this.tileProviders[index].name} failed. Trying another provider.`
                );

                setTimeout(() => {
                    if (!map || !map.getContainer().isConnected) return;

                    if (map.hasLayer(layer)) {
                        map.removeLayer(layer);
                    }

                    this._addTileLayerWithFallback(
                        map,
                        propertyName,
                        index + 1
                    );
                }, 500);
            }
        });

        layer.addTo(map);

        this[propertyName] = layer;
    }

    _scheduleInvalidateSize(map, container) {
        if (!map) return;

        const invalidate = () => {
            if (map && map.getContainer().isConnected) {
                map.invalidateSize();
            }
        };

        invalidate();

        setTimeout(invalidate, 150);
        setTimeout(invalidate, 500);
        setTimeout(invalidate, 1200);

        window.addEventListener("resize", invalidate);

        if (window.ResizeObserver && container) {
            const observer = new ResizeObserver(invalidate);
            observer.observe(container);
        }
    }

    // --------------------------------------------------
    // NATIVE BROWSER GEOLOCATION
    // --------------------------------------------------

    getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {

            if (!navigator.geolocation) {
                reject({
                    type: "NOT_SUPPORTED",
                    message: "Your browser does not support geolocation."
                });
                return;
            }

            if (!window.isSecureContext) {
                reject({
                    type: "INSECURE_CONTEXT",
                    message: "Location requires HTTPS or localhost. Please run your project using Live Server or HTTPS."
                });
                return;
            }

            navigator.geolocation.getCurrentPosition(

                position => {

                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };

                    this.currentUserLocation = coords;

                    resolve(coords);
                },

                error => {

                    let type;
                    let message;

                    switch (error.code) {

                        case 1:
                            type = "PERMISSION_DENIED";
                            message = "Location permission denied. Allow location access in your browser settings.";
                            break;

                        case 2:
                            type = "POSITION_UNAVAILABLE";
                            message = "Your location is currently unavailable. Check your device location settings.";
                            break;

                        case 3:
                            type = "TIMEOUT";
                            message = "Location request timed out. Please try again.";
                            break;

                        default:
                            type = "UNKNOWN";
                            message = error.message || "Unable to detect your location.";
                    }

                    reject({
                        type,
                        code: error.code,
                        message
                    });
                },

                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                    ...options
                }
            );
        });
    }

    // --------------------------------------------------
    // OPTIONAL REVERSE GEOCODING
    // --------------------------------------------------

    async reverseGeocode(lat, lng) {

        try {

            const controller = new AbortController();

            const timeout = setTimeout(
                () => controller.abort(),
                8000
            );

            try {

                const url =
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (!response.ok) return null;

                const data = await response.json();
                const address = data.address || {};

                const locality =
                    address.suburb ||
                    address.neighbourhood ||
                    address.city_district ||
                    address.town ||
                    address.village ||
                    address.city ||
                    "Detected Area";

                const road =
                    address.road ||
                    address.pedestrian ||
                    "";

                return {
                    locality,
                    ward: address.city_district ||
                        address.district ||
                        "Not available",
                    address: road || data.display_name || "Address unavailable",
                    displayName: data.display_name || ""
                };

            } finally {
                clearTimeout(timeout);
            }

        } catch (error) {

            console.warn("Reverse geocoding unavailable:", error);

            return null;
        }
    }

    // --------------------------------------------------
    // PUBLIC MAP INITIALIZATION
    // --------------------------------------------------

    async initPublicMap(elementId = "public-map") {

        const L = this.L;
        const container = document.getElementById(elementId);

        if (!container) {
            console.error("Public map container not found.");
            return;
        }

        if (!L) {
            console.error("Leaflet is not loaded. Check leaflet.js.");
            return;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        this._setupDefaultIcons();

        const params = new URLSearchParams(window.location.search);

        const hasCoordinates =
            params.has("lat") && params.has("lng");

        const lat = Number(params.get("lat"));
        const lng = Number(params.get("lng"));

        const validCoordinates =
            hasCoordinates &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180;

        const initialCenter = validCoordinates
            ? [lat, lng]
            : this.defaultCenter;

        const initialZoom = validCoordinates
            ? 16
            : this.defaultZoom;

        this.map = L.map(elementId, {
            zoomControl: true,
            preferCanvas: true
        }).setView(initialCenter, initialZoom);

        // Load map tiles with fallback.
        this._addTileLayerWithFallback(
            this.map,
            "activeTileLayer"
        );

        this.markersLayer = L.layerGroup().addTo(this.map);
        this.hotspotsLayer = L.layerGroup().addTo(this.map);
        this.userLocationLayer = L.layerGroup().addTo(this.map);

        this._scheduleInvalidateSize(this.map, container);

        this._addLocateControlToMap();

        // Attach events BEFORE loading Supabase data.

        const filterCat =
            document.getElementById("map-filter-category");

        const filterStatus =
            document.getElementById("map-filter-status");

        const toggleHotspots =
            document.getElementById("map-toggle-hotspots");

        const locateButton =
            document.getElementById("btn-public-locate-me");

        if (filterCat) {
            filterCat.onchange = () => this.loadMapData();
        }

        if (filterStatus) {
            filterStatus.onchange = () => this.loadMapData();
        }

        if (toggleHotspots) {
            toggleHotspots.onchange = event => {

                if (event.target.checked) {
                    this.map.addLayer(this.hotspotsLayer);
                } else {
                    this.map.removeLayer(this.hotspotsLayer);
                }
            };
        }

        if (locateButton) {
            locateButton.onclick = () => {
                this.locateUserOnPublicMap();
            };
        }

        // Load complaints independently.
        this.loadMapData();

        // Optional automatic location.
        if (
            params.get("locate") === "1" ||
            params.get("locate") === "true"
        ) {
            this.locateUserOnPublicMap();
        }
    }

    // --------------------------------------------------
    // MAP LOCATE CONTROL
    // --------------------------------------------------

    _addLocateControlToMap() {

        const L = this.L;

        if (!this.map || !L) return;

        const LocateControl = L.Control.extend({

            options: {
                position: "topleft"
            },

            onAdd: () => {

                const container = L.DomUtil.create(
                    "div",
                    "leaflet-bar leaflet-control"
                );

                const button = L.DomUtil.create(
                    "a",
                    "",
                    container
                );

                button.href = "#";
                button.title = "Find my location";
                button.innerHTML = "📍";
                button.style.fontSize = "20px";
                button.style.textAlign = "center";

                L.DomEvent.disableClickPropagation(container);

                L.DomEvent.on(button, "click", event => {

                    L.DomEvent.stop(event);

                    this.locateUserOnPublicMap();
                });

                return container;
            }
        });

        this.map.addControl(new LocateControl());
    }

    // --------------------------------------------------
    // CENTER PUBLIC MAP ON USER LOCATION
    // --------------------------------------------------

    async locateUserOnPublicMap() {

        const L = this.L;

        const statusEl =
            document.getElementById("public-map-status");

        const button =
            document.getElementById("btn-public-locate-me");

        if (!this.map) {
            console.error("Map has not been initialized.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "📡 Locating...";
        }

        this.showStatus(
            statusEl,
            "Requesting browser location permission...",
            "loading"
        );

        try {

            const coords = await this.getCurrentPosition();

            const {
                latitude,
                longitude,
                accuracy
            } = coords;

            if (!this.map) return;

            this.userLocationLayer.clearLayers();

            // Accuracy circle.
            const accuracyCircle = L.circle(
                [latitude, longitude],
                {
                    radius: Math.max(accuracy || 30, 30),
                    color: "#0284c7",
                    fillColor: "#38bdf8",
                    fillOpacity: 0.2,
                    weight: 2
                }
            );

            // User marker.
            const userIcon = L.divIcon({

                className: "user-map-pin",

                html: `
                    <div class="user-location-marker">
                        <span class="user-pulse"></span>
                        <span class="user-dot"></span>
                    </div>
                `,

                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });

            const marker = L.marker(
                [latitude, longitude],
                {
                    icon: userIcon
                }
            );

            marker.bindPopup(`
                <strong>📍 You Are Here</strong>
                <p>
                    Latitude: ${latitude.toFixed(6)}<br>
                    Longitude: ${longitude.toFixed(6)}<br>
                    Accuracy: ±${Math.round(accuracy)} metres
                </p>
            `);

            this.userLocationLayer.addLayer(accuracyCircle);
            this.userLocationLayer.addLayer(marker);

            this.map.flyTo(
                [latitude, longitude],
                16,
                {
                    duration: 1.2
                }
            );

            setTimeout(() => {
                if (this.map && this.map.hasLayer(marker)) {
                    marker.openPopup();
                }
            }, 1300);

            this.showStatus(
                statusEl,
                `Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
                "success"
            );

            setTimeout(() => {
                if (statusEl) {
                    statusEl.style.display = "none";
                }
            }, 6000);

        } catch (error) {

            console.error("Geolocation error:", error);

            this.showStatus(
                statusEl,
                `${error.type || "LOCATION_ERROR"}: ${error.message}`,
                "error"
            );

        } finally {

            if (button) {
                button.disabled = false;
                button.textContent = "📍 Center on My Location";
            }
        }
    }

    // --------------------------------------------------
    // LOAD COMPLAINTS AND HOTSPOTS
    // --------------------------------------------------

    async loadMapData() {

        const L = this.L;

        if (!this.map || !this.markersLayer) return;

        this.markersLayer.clearLayers();
        this.hotspotsLayer.clearLayers();

        try {

            if (!window.civicfixDB) {
                throw new Error("Supabase database connection not found.");
            }

            const category =
                document.getElementById("map-filter-category")?.value || "all";

            const status =
                document.getElementById("map-filter-status")?.value || "all";

            // Fetch complaints.
            const result = await window.civicfixDB.getComplaints({

                category_id:
                    category !== "all" ? category : null,

                status:
                    status !== "all" ? status : null

            });

            if (result?.error) {
                throw result.error;
            }

            const complaints = Array.isArray(result)
                ? result
                : result?.data || [];

            const categoryIcons = {

                GARBAGE: {
                    color: "#10b981",
                    symbol: "🗑️"
                },

                DRAINAGE: {
                    color: "#0284c7",
                    symbol: "💧"
                },

                ROADS: {
                    color: "#f59e0b",
                    symbol: "🚧"
                },

                ELECTRICAL: {
                    color: "#eab308",
                    symbol: "⚡"
                },

                INFRASTRUCTURE: {
                    color: "#8b5cf6",
                    symbol: "🌳"
                }
            };

            // Complaint markers.
            complaints.forEach(complaint => {

                const location = complaint.location;

                if (!location) return;

                const latitude = Number(location.latitude);
                const longitude = Number(location.longitude);

                if (
                    !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    longitude < -180 ||
                    longitude > 180
                ) {
                    return;
                }

                const categoryCode =
                    complaint.category?.code || "OTHER";

                const style = categoryIcons[categoryCode] || {
                    color: "#64748b",
                    symbol: "📍"
                };

                const icon = L.divIcon({

                    className: "custom-map-pin",

                    html: `
                        <div class="pin-marker"
                            style="
                                background-color: ${style.color};
                                border: 3px solid white;
                            ">
                            <span>${style.symbol}</span>
                        </div>
                    `,

                    iconSize: [38, 38],
                    iconAnchor: [19, 38]
                });

                const marker = L.marker(
                    [latitude, longitude],
                    { icon }
                );

                const ageDays = Math.max(
                    0,
                    Math.round(
                        (Date.now() -
                            new Date(complaint.created_at).getTime()) /
                            86400000
                    )
                );

                const ageText = ageDays === 0
                    ? "Reported today"
                    : `${ageDays} days ago`;

                const title = this.escapeHtml(complaint.title);
                const tracking = this.escapeHtml(complaint.tracking_number);
                const locality = this.escapeHtml(location.locality_name);
                const ward = this.escapeHtml(location.ward_number);
                const description = this.escapeHtml(
                    (complaint.description || "").substring(0, 95)
                );

                const popup = `
                    <div class="map-popup-card">

                        <div class="popup-body">

                            <h4 class="popup-title">
                                #${tracking}: ${title}
                            </h4>

                            <p class="popup-locality">
                                📍 ${locality} (${ward})
                            </p>

                            <p>
                                👥 ${this.escapeHtml(complaint.affected_people)}
                                affected • ${ageText}
                            </p>

                            <p class="popup-desc">
                                ${description}
                            </p>

                            <a
                                href="complaint-details.html?id=${encodeURIComponent(complaint.id)}"
                                class="btn btn-sm btn-primary">
                                View Full Ticket →
                            </a>

                        </div>
                    </div>
                `;

                marker.bindPopup(popup);

                this.markersLayer.addLayer(marker);
            });

        } catch (error) {

            console.error("Complaint loading error:", error);
        }

        // Load hotspots independently so a complaint error
        // does not prevent hotspot loading.

        try {

            const hotspotResult =
                await window.civicfixDB.getHistoricalHotspots();

            if (hotspotResult?.error) {
                throw hotspotResult.error;
            }

            const hotspots = Array.isArray(hotspotResult)
                ? hotspotResult
                : hotspotResult?.data || [];

            hotspots.forEach(hotspot => {

                if (Number(hotspot.totalReports) < 2) return;

                const latitude = Number(hotspot.latitude);
                const longitude = Number(hotspot.longitude);

                if (
                    !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    longitude < -180 ||
                    longitude > 180
                ) {
                    return;
                }

                const highRisk = hotspot.riskLevel === "High";

                const circle = L.circle(
                    [latitude, longitude],
                    {
                        color: highRisk ? "#ef4444" : "#f59e0b",
                        fillColor: highRisk ? "#ef4444" : "#f59e0b",
                        fillOpacity: 0.22,
                        radius: 350
                    }
                );

                circle.bindPopup(`
                    <div class="hotspot-popup">

                        <h4>🔥 Recurring Issue Hotspot</h4>

                        <p>
                            <strong>
                                ${this.escapeHtml(hotspot.locality)}
                            </strong>
                        </p>

                        <p>
                            Total Incidents:
                            ${this.escapeHtml(hotspot.totalReports)}
                        </p>

                        <p>
                            Dominant Failure:
                            ${this.escapeHtml(hotspot.primaryCategory)}
                        </p>

                        <a href="dashboard.html#preventive-section">
                            See Engineering Analysis →
                        </a>

                    </div>
                `);

                this.hotspotsLayer.addLayer(circle);
            });

            const toggle =
                document.getElementById("map-toggle-hotspots");

            if (toggle && !toggle.checked) {
                this.map.removeLayer(this.hotspotsLayer);
            }

        } catch (error) {

            console.error("Hotspot loading error:", error);
        }
    }

    // --------------------------------------------------
    // COMPLAINT SUBMISSION LOCATION PICKER
    // --------------------------------------------------

    initLocationPicker(elementId = "location-picker-map") {

        const L = this.L;
        const container = document.getElementById(elementId);

        if (!container || !L) {
            console.error("Location picker or Leaflet not found.");
            return;
        }

        if (this.pickerMap) {
            this.pickerMap.remove();
            this.pickerMap = null;
        }

        this._setupDefaultIcons();

        const latInput = document.getElementById("loc-latitude");
        const lngInput = document.getElementById("loc-longitude");

        const localityInput =
            document.getElementById("loc-locality");

        const wardInput =
            document.getElementById("loc-ward");

        const addressInput =
            document.getElementById("loc-address");

        const detectButton =
            document.getElementById("btn-detect-gps");

        const statusEl =
            document.getElementById("location-status");

        const latitude = Number(latInput?.value);
        const longitude = Number(lngInput?.value);

        const valid =
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180 &&
            latInput?.value !== "" &&
            lngInput?.value !== "";

        const initialLat = valid ? latitude : this.defaultCenter[0];
        const initialLng = valid ? longitude : this.defaultCenter[1];

        this.pickerMap = L.map(elementId, {
            zoomControl: true,
            scrollWheelZoom: false
        }).setView(
            [initialLat, initialLng],
            valid ? 15 : this.defaultZoom
        );

        this._addTileLayerWithFallback(
            this.pickerMap,
            "pickerTileLayer"
        );

        const pinIcon = L.divIcon({

            className: "picker-pin-icon",

            html: `
                <div style="
                    background:#ef4444;
                    width:34px;
                    height:34px;
                    border-radius:50%;
                    border:3px solid white;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:18px;
                ">
                    📍
                </div>
            `,

            iconSize: [34, 34],
            iconAnchor: [17, 34]
        });

        this.pickerMarker = L.marker(
            [initialLat, initialLng],
            {
                draggable: true,
                icon: pinIcon
            }
        ).addTo(this.pickerMap);

        this._scheduleInvalidateSize(
            this.pickerMap,
            container
        );

        const updateInputs = (lat, lng) => {

            if (latInput) {
                latInput.value = lat.toFixed(6);
                latInput.dispatchEvent(
                    new Event("input", { bubbles: true })
                );
                latInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            if (lngInput) {
                lngInput.value = lng.toFixed(6);
                lngInput.dispatchEvent(
                    new Event("input", { bubbles: true })
                );
                lngInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }
        };

        // Click anywhere to move pin.
        this.pickerMap.on("click", event => {

            const { lat, lng } = event.latlng;

            this.pickerMarker.setLatLng([lat, lng]);

            updateInputs(lat, lng);

            this.showStatus(
                statusEl,
                `Pin updated: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                "success"
            );
        });

        // Drag marker.
        this.pickerMarker.on("dragend", () => {

            const position = this.pickerMarker.getLatLng();

            updateInputs(position.lat, position.lng);

            this.showStatus(
                statusEl,
                "Location pin updated successfully.",
                "success"
            );
        });

        // Manual coordinate editing.
        const syncCoordinates = () => {

            const lat = Number(latInput?.value);
            const lng = Number(lngInput?.value);

            if (
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180
            ) {

                this.pickerMarker.setLatLng([lat, lng]);

                this.pickerMap.setView(
                    [lat, lng],
                    this.pickerMap.getZoom()
                );
            }
        };

        if (latInput) {
            latInput.oninput = syncCoordinates;
        }

        if (lngInput) {
            lngInput.oninput = syncCoordinates;
        }

        // Native GPS button.
        if (detectButton) {

            detectButton.onclick = async event => {

                event.preventDefault();

                await this.requestAndSetUserLocation({

                    latInput,
                    lngInput,
                    localityInput,
                    wardInput,
                    addressInput,
                    btnDetect: detectButton,
                    statusEl

                });
            };
        }
    }

    // --------------------------------------------------
    // GET LOCATION AND UPDATE SUBMISSION FORM
    // --------------------------------------------------

    async requestAndSetUserLocation({
        latInput,
        lngInput,
        localityInput,
        wardInput,
        addressInput,
        btnDetect,
        statusEl
    }) {

        if (btnDetect) {
            btnDetect.disabled = true;
            btnDetect.textContent = "📡 Detecting location...";
        }

        this.showStatus(
            statusEl,
            "Requesting browser location permission...",
            "loading"
        );

        try {

            const coords = await this.getCurrentPosition();

            const {
                latitude,
                longitude,
                accuracy
            } = coords;

            // Update coordinates.
            if (latInput) {
                latInput.value = latitude.toFixed(6);
            }

            if (lngInput) {
                lngInput.value = longitude.toFixed(6);
            }

            // Update picker map.
            if (this.pickerMarker && this.pickerMap) {

                this.pickerMarker.setLatLng([
                    latitude,
                    longitude
                ]);

                this.pickerMap.setView(
                    [latitude, longitude],
                    16
                );

                this.pickerMap.invalidateSize();
            }

            this.showStatus(
                statusEl,
                `Location acquired: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`,
                "success"
            );

            // Trigger input events.
            if (latInput) {
                latInput.dispatchEvent(
                    new Event("input", { bubbles: true })
                );

                latInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            if (lngInput) {
                lngInput.dispatchEvent(
                    new Event("input", { bubbles: true })
                );

                lngInput.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            // Optional address lookup.
            const geoResult = await this.reverseGeocode(
                latitude,
                longitude
            );

            if (geoResult) {

                if (localityInput && !localityInput.value) {
                    localityInput.value = geoResult.locality;
                }

                if (wardInput && !wardInput.value) {
                    wardInput.value = geoResult.ward;
                }

                if (addressInput && !addressInput.value) {
                    addressInput.value = geoResult.address;
                }

                this.showStatus(
                    statusEl,
                    `Location acquired: ${geoResult.locality}, ${geoResult.address}`,
                    "success"
                );
            }

        } catch (error) {

            console.error("Location picker error:", error);

            this.showStatus(
                statusEl,
                `${error.type || "LOCATION_ERROR"}: ${error.message}`,
                "error"
            );

        } finally {

            if (btnDetect) {
                btnDetect.disabled = false;
                btnDetect.textContent = "📍 Detect My Current Location";
            }
        }
    }
}

// --------------------------------------------------
// GLOBAL CIVICFIX MAP INSTANCE
// --------------------------------------------------

window.civicfixMap = new CivicFixMap();
