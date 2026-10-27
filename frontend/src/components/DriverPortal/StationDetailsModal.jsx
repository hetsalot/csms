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
          padding: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'rgba(15, 23, 42, 0.7)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className={`status-badge ${station.availableCount > 0 ? 'available' : 'reserved'}`}>
                ● {station.availableCount} of {station.totalChargers || chargers.length} Available
              </span>
              <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                {station.distanceKm ? `${station.distanceKm} km away` : ''}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '4px' }}>
              {station.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
              <MapPin size={15} color="#10b981" />
              <span>{station.address}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Info bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px'
          }}>
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
                <Clock size={14} />
                <span>Operating Hours</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                {station.operating_hours}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
                <DollarSign size={14} />
                <span>Starting Rate</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                ₹{station.minPrice || 16.50}/kWh
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
                <Zap size={14} />
                <span>Max Power</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                {Math.max(...chargers.map(c => c.power_rating || 0), 22)} kW
              </div>
            </div>
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
                Station Amenities
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {amenities.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      color: '#cbd5e1'
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>
                Real-Time Chargers ({chargers.length})
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Live OCPP 2.0.1 Telemetry</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chargers.map(charger => (
                <div
                  key={charger.id}
                  className="glass-panel"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap size={22} color={charger.status === 'available' ? '#10b981' : charger.status === 'faulted' ? '#ef4444' : '#f59e0b'} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                          {charger.name}
                        </span>
                        <span className={`status-badge ${charger.status}`}>
                          {charger.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
                        Connector: <strong style={{ color: '#e2e8f0' }}>{charger.connector_type}</strong> • Output: <strong style={{ color: '#e2e8f0' }}>{charger.power_rating} kW</strong> ({charger.speed_category.toUpperCase()})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '2px' }}>
                        Rate: <strong>₹{charger.price_rate.toFixed(2)}</strong> / {charger.pricing_type === 'per_kwh' ? 'kWh' : 'min'}
                        {charger.idle_fee > 0 && <span style={{ color: '#94a3b8' }}> • Idle Fee: ₹{charger.idle_fee}/min</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={charger.status === 'faulted' || charger.status === 'out of service'}
                    onClick={() => onBookCharger(station, charger)}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    Reserve Slot
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '10px' }}>
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
