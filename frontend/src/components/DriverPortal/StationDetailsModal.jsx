import React from 'react';
import { X, MapPin, Clock, Zap, Coffee, Wifi, Shield, ArrowUpRight, DollarSign } from 'lucide-react';

export default function StationDetailsModal({ station, onClose, onBookCharger }) {
  if (!station) return null;

  const chargers = station.chargers || [];
  const amenities = station.amenities || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'var(--bg-sunken)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className={`status-badge ${station.availableCount > 0 ? 'available' : 'reserved'}`}>
                ● {station.availableCount} of {station.totalChargers || chargers.length} Available
              </span>
              <span style={{ fontSize: '0.82rem', color: '#ff6b57', fontWeight: 800 }}>
                {station.distanceKm ? `${station.distanceKm} km away` : ''}
              </span>
            </div>
            <h2 style={{ fontSize: '1.45rem', color: 'var(--text-heading)', marginBottom: '4px', fontWeight: 800 }}>
              {station.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              <MapPin size={16} color="#ff6b57" />
              <span>{station.address}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Quick Info bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '14px'
          }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                <Clock size={14} color="#d97706" />
                <span>Operating Hours</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                {station.operating_hours}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                <DollarSign size={14} color="#ff6b57" />
                <span>Starting Rate</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ff6b57', marginTop: '4px' }}>
                ₹{station.minPrice || 16.50}/kWh
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                <Zap size={14} color="#059669" />
                <span>Max Power</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {Math.max(...chargers.map(c => c.power_rating || 0), 22)} kW
              </div>
            </div>
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em', fontWeight: 800 }}>
                Station Amenities
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {amenities.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'var(--bg-sunken)',
                      border: '1px solid rgba(255, 255, 255, 0.6)',
                      boxShadow: 'var(--neu-sunken)',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-main)'
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Chargers List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-heading)', fontWeight: 800 }}>
                Real-Time Chargers <span style={{ color: '#ff6b57' }}>({chargers.length})</span>
              </h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Live OCPP 2.0.1 Telemetry</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chargers.map(charger => (
                <div
                  key={charger.id}
                  className="glass-panel"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Sunken Socket for Charger Icon (from reference image heart socket!) */}
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'var(--bg-sunken)',
                      boxShadow: 'var(--neu-sunken)',
                      border: '1px solid rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap size={22} color={charger.status === 'available' ? '#059669' : charger.status === 'faulted' ? '#e11d48' : '#ff6b57'} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-heading)' }}>
                          {charger.name}
                        </span>
                        <span className={`status-badge ${charger.status}`}>
                          {charger.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                        Connector: <strong style={{ color: 'var(--text-main)' }}>{charger.connector_type}</strong> • Output: <strong style={{ color: 'var(--text-main)' }}>{charger.power_rating} kW</strong> ({charger.speed_category.toUpperCase()})
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#ff6b57', marginTop: '3px', fontWeight: 700 }}>
                        Rate: <strong>₹{charger.price_rate.toFixed(2)}</strong> / {charger.pricing_type === 'per_kwh' ? 'kWh' : 'min'}
                        {charger.idle_fee > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> • Idle Fee: ₹{charger.idle_fee}/min</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={charger.status === 'faulted' || charger.status === 'out of service'}
                    onClick={() => onBookCharger(station, charger)}
                    className="btn-primary"
                    style={{ padding: '9px 20px', fontSize: '0.88rem' }}
                  >
                    Reserve Slot
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', gap: '14px', paddingTop: '10px' }}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ flex: 1, textDecoration: 'none' }}
            >
              <ArrowUpRight size={16} />
              <span>Get Directions</span>
            </a>
            <button
              onClick={() => onBookCharger(station, chargers[0])}
              className="btn-primary"
              style={{ flex: 2 }}
            >
              Book Charging Slot
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
