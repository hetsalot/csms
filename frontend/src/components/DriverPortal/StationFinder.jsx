import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, MapPin, Zap, ArrowRight, BatteryCharging, Filter, CheckCircle2 } from 'lucide-react';
import MapView from '../MapView';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export default function StationFinder({ onSelectStation, onBookCharger }) {
  const { authFetch } = useAuth();
  const { addEventListener } = useWebSocket();

  // Search parameters
  const [userLocation, setUserLocation] = useState({ lat: 19.0657, lng: 72.8686 }); // BKC Central Mumbai
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(15);
  const [connectorFilter, setConnectorFilter] = useState('');
  const [speedFilter, setSpeedFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius: radiusKm,
        availableOnly: availableOnly ? 'true' : 'false'
      });
      if (searchQuery) params.append('searchQuery', searchQuery);
      if (connectorFilter) params.append('connector', connectorFilter);
      if (speedFilter) params.append('speed', speedFilter);

      const res = await authFetch(`/api/stations?${params.toString()}`);
      const data = await res.json();
      setStations(data.stations || []);
    } catch (err) {
      console.error('Error fetching stations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();

    // Listen for live status changes so map and list update within 5 seconds (PE-3)
    const removeListener = addEventListener((event) => {
      if (['CHARGER_STATUS_CHANGED', 'NEW_BOOKING', 'CHARGING_COMPLETED', 'STATION_APPROVAL_CHANGED'].includes(event.type)) {
        fetchStations();
      }
    });

    return () => removeListener();
  }, [userLocation, radiusKm, connectorFilter, speedFilter, availableOnly, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Input (Locate.Search.Manual) */}
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by station name, neighborhood, or address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          {/* Quick Connector Dropdown */}
          <div style={{ flex: '0 1 180px' }}>
            <select
              value={connectorFilter}
              onChange={e => setConnectorFilter(e.target.value)}
              style={{ padding: '9px 12px' }}
            >
              <option value="">All Connectors</option>
              <option value="CCS2">CCS2 (DC Fast)</option>
              <option value="Type 2">Type 2 (AC)</option>
              <option value="GB/T">GB/T (Bharat)</option>
              <option value="CHAdeMO">CHAdeMO</option>
            </select>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
            style={{ padding: '9px 14px', fontSize: '0.9rem' }}
          >
            <SlidersHorizontal size={16} />
            <span>Filters {(speedFilter || availableOnly || radiusKm !== 15) ? '• Active' : ''}</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters (Locate.Filter.Speed, Radius, Availability) */}
        {showFilters && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            animation: 'fadeIn 0.2s ease'
          }}>
            {/* Speed Category Filter */}
            <div>
              <label>Charging Speed Category (Locate.Filter.Speed)</label>
              <select value={speedFilter} onChange={e => setSpeedFilter(e.target.value)}>
                <option value="">Any Power / Speed</option>
                <option value="rapid">Rapid / DC Fast (50kW+)</option>
                <option value="fast">Fast (22kW - 50kW)</option>
                <option value="slow">Standard / Slow (&lt;22kW)</option>
              </select>
            </div>

            {/* Radius Slider (Locate.Search.Radius) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>Search Radius: <strong>{radiusKm} km</strong></label>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={radiusKm}
                onChange={e => setRadiusKm(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                <span>2 km</span>
                <span>15 km (Default)</span>
                <span>50 km</span>
              </div>
            </div>

            {/* Availability Checkbox (Locate.Filter.Availability) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
              <input
                type="checkbox"
                id="availOnly"
                checked={availableOnly}
                onChange={e => setAvailableOnly(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <label htmlFor="availOnly" style={{ margin: 0, cursor: 'pointer', color: '#f8fafc' }}>
                Only show stations with &ge;1 Available Charger
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout: Interactive Map + Results List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* Interactive Map View */}
        <div className="glass-panel" style={{ padding: '8px', minHeight: '440px', position: 'relative' }}>
          <MapView
            stations={stations}
            userLocation={userLocation}
            radiusKm={radiusKm}
            onStationSelect={onSelectStation}
            onLocationChange={setUserLocation}
          />
        </div>

        {/* Stations Results List (Locate.Results.Display) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700 }}>
              Available Stations Nearby ({stations.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Showing results within {radiusKm} km of selected position
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Searching charging stations...
            </div>
          ) : stations.length === 0 ? (
            /* Locate.Results.Empty */
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Zap size={44} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1.15rem', color: '#f8fafc' }}>No Charging Stations Found</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '480px', margin: '8px auto 16px' }}>
                No stations match your current location and filter criteria. Try widening the search radius (e.g. 25km or 50km) or clearing connector and speed filters.
              </p>
              <button
                onClick={() => { setRadiusKm(35); setConnectorFilter(''); setSpeedFilter(''); setAvailableOnly(false); }}
                className="btn-secondary"
              >
                Reset Filters & Widen Radius
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {stations.map(stn => (
                <div
                  key={stn.id}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectStation(stn)}
                >
                  <div>
                    {/* Top status & distance badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className={`status-badge ${stn.availableCount > 0 ? 'available' : 'reserved'}`}>
                        ● {stn.availableCount} of {stn.totalChargers} Available
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
                        {stn.distanceKm} km away
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '4px' }}>
                      {stn.name}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.3, marginBottom: '12px' }}>
                      {stn.address}
                    </p>

                    {/* Connectors pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {Array.from(new Set(stn.chargers.map(c => c.connector_type))).map(conn => (
                        <span
                          key={conn}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.75rem',
                            color: '#cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          ⚡ {conn}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pricing and Action button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Starting from</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                        ₹{stn.minPrice.toFixed(2)}<span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}> / kWh</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStation(stn);
                      }}
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    >
                      <span>Details & Book</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
