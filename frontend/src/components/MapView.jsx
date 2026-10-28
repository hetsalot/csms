import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Zap, Navigation, MapPin } from 'lucide-react';

export default function MapView({
  stations = [],
  userLocation,
  radiusKm = 15,
  onStationSelect,
  onLocationChange
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const circleLayerRef = useRef(null);
  const userMarkerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 12,
        zoomControl: false
      });

      // Add Zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // CartoDB Dark Matter / OpenStreetMap tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // Map click handler to update search location
      map.on('click', (e) => {
        if (onLocationChange) {
          onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update user location pin and radius circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    // Remove existing user marker & circle
    if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    if (circleLayerRef.current) map.removeLayer(circleLayerRef.current);

    // Custom pulse pin for user
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="
          width: 22px; height: 22px;
          background: #3b82f6;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 16px #3b82f6, 0 0 30px rgba(59, 130, 246, 0.5);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    userMarkerRef.current.bindTooltip('Your Search Location', { permanent: false, direction: 'top' });

    // Draw radius circle
    circleLayerRef.current = L.circle([userLocation.lat, userLocation.lng], {
      radius: radiusKm * 1000,
      color: '#10b981',
      weight: 1.5,
      dashArray: '6, 6',
      fillColor: '#10b981',
      fillOpacity: 0.07
    }).addTo(map);
  }, [userLocation, radiusKm]);

  // Update Station Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    stations.forEach((stn) => {
      const isAvailable = stn.availableCount > 0;
      const isFaulted = stn.chargers && stn.chargers.every(c => c.status === 'faulted');

      let pinColor = '#10b981';
      let statusText = `${stn.availableCount} Available`;
      if (isFaulted) {
        pinColor = '#ef4444';
        statusText = 'Faulted';
      } else if (!isAvailable) {
        pinColor = '#f59e0b';
        statusText = 'Occupied';
      }

      const icon = L.divIcon({
        className: 'custom-station-pin',
        html: `
          <div style="
            background: ${pinColor};
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          ">
            <div style="transform: rotate(45deg); color: white; display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([stn.latitude, stn.longitude], { icon }).addTo(layer);

      // Create rich popup content
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '220px';
      popupDiv.style.fontFamily = 'var(--font-body)';
      popupDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
          <h4 style="font-size: 1rem; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">${stn.name}</h4>
          <p style="font-size: 0.8rem; color: #94a3b8; line-height: 1.3;">${stn.address}</p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.85rem;">
          <span style="color: ${pinColor}; font-weight: 600;">● ${statusText}</span>
          <span style="color: #38bdf8; font-weight: 700;">From ₹${stn.minPrice}/kWh</span>
        </div>
        <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 10px;">
          Distance: <strong>${stn.distanceKm || 0} km</strong> • Hours: <strong>${stn.operating_hours}</strong>
        </div>
        <button id="btn-select-${stn.id}" style="
          width: 100%;
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        ">
          View Chargers & Book Slot
        </button>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-${stn.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onStationSelect) onStationSelect(stn);
          };
        }
      });
    });
  }, [stations, onStationSelect]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1 });
    }
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (onLocationChange) onLocationChange(newLoc);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([newLoc.lat, newLoc.lng], 13);
          }
        },
        (err) => {
          alert('Unable to retrieve GPS coordinates. Defaulting to Central Mumbai (BKC).');
        }
      );
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '420px', borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '420px' }} />

      {/* Floating Map Controls */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <button
          onClick={handleUseGPS}
          title="Use device GPS location (BR-1)"
          className="btn-secondary"
          style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', padding: '8px 12px', fontSize: '0.85rem' }}
        >
          <Navigation size={15} color="#38bdf8" />
          <span>My GPS</span>
        </button>
        <button
          onClick={handleRecenter}
          title="Recenter on search point"
          className="btn-secondary"
          style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', padding: '8px 12px', fontSize: '0.85rem' }}
        >
          <MapPin size={15} color="#10b981" />
          <span>Center</span>
        </button>
      </div>

      {/* Interactive Helper Banner */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 500,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        padding: '8px 14px',
        fontSize: '0.8rem',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Zap size={14} color="#10b981" />
        <span>Click anywhere on the map to set custom search center • Radius: {radiusKm} km</span>
      </div>
    </div>
  );
}
