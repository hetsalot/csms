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
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Input (Locate.Search.Manual) */}
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by station name, neighborhood, or address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '42px' }}
            />
          </div>

          {/* Quick Connector Dropdown */}
          <div style={{ flex: '0 1 190px' }}>
            <select
              value={connectorFilter}
              onChange={e => setConnectorFilter(e.target.value)}
              style={{ padding: '11px 14px' }}
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
            style={{ padding: '10px 18px', fontSize: '0.9rem' }}
          >
            <SlidersHorizontal size={16} color={showFilters ? '#ff6b57' : 'currentColor'} />
            <span>Filters {(speedFilter || availableOnly || radiusKm !== 15) ? '• Active' : ''}</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters (Locate.Filter.Speed, Radius, Availability) */}
        {showFilters && (
          <div style={{
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(180, 170, 160, 0.25)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
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
                <label style={{ margin: 0 }}>Search Radius: <strong style={{ color: '#ff6b57' }}>{radiusKm} km</strong></label>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={radiusKm}
                onChange={e => setRadiusKm(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>2 km</span>
                <span>15 km (Default)</span>
                <span>50 km</span>
              </div>
            </div>

            {/* Availability Checkbox (Locate.Filter.Availability) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
              <input
                type="checkbox"
                id="availOnly"
                checked={availableOnly}
                onChange={e => setAvailableOnly(e.target.checked)}
              />
              <label htmlFor="availOnly" style={{ margin: 0, cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
                Only show stations with &ge;1 Available Charger
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout: Interactive Map + Results List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        
        {/* Interactive Map View */}
        <div className="glass-panel" style={{ padding: '10px', minHeight: '440px', position: 'relative' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>
              Available Stations Nearby <span style={{ color: '#ff6b57' }}>({stations.length})</span>
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing results within {radiusKm} km of selected position
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Searching charging stations...
            </div>
          ) : stations.length === 0 ? (
            /* Locate.Results.Empty */
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
              <Zap size={48} color="var(--primary)" style={{ margin: '0 auto 14px' }} />
              <h4 style={{ fontSize: '1.25rem', color: 'var(--text-heading)' }}>No Charging Stations Found</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '480px', margin: '8px auto 20px', lineHeight: 1.5 }}>
                No stations match your current location and filter criteria. Try widening the search radius or clearing connector and speed filters.
              </p>
              <button
                onClick={() => { setRadiusKm(35); setConnectorFilter(''); setSpeedFilter(''); setAvailableOnly(false); }}
                className="btn-primary"
              >
                Reset Filters & Widen Radius
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px'
            }}>
              {stations.map(stn => (
                <div
                  key={stn.id}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectStation(stn)}
                >
                  <div>
                    {/* Top status & distance badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={`status-badge ${stn.availableCount > 0 ? 'available' : 'reserved'}`}>
                        ● {stn.availableCount} of {stn.totalChargers} Available
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#ff6b57', fontWeight: 800 }}>
                        {stn.distanceKm} km away
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.15rem', color: 'var(--text-heading)', marginBottom: '6px', fontWeight: 700 }}>
                      {stn.name}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '16px' }}>
                      {stn.address}
                    </p>

                    {/* Connectors pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                      {Array.from(new Set(stn.chargers.map(c => c.connector_type))).map(conn => (
                        <span
                          key={conn}
                          style={{
                            background: 'var(--bg-sunken)',
                            border: '1px solid rgba(255, 255, 255, 0.6)',
                            boxShadow: 'var(--neu-sunken)',
                            fontSize: '0.78rem',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px'
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
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(180, 170, 160, 0.2)'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Starting from</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                        <span style={{ color: '#ff6b57' }}>₹{stn.minPrice.toFixed(2)}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}> / kWh</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStation(stn);
                      }}
                      className="btn-primary"
                      style={{ padding: '9px 18px', fontSize: '0.85rem' }}
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
