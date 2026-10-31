import React, { useState, useEffect } from 'react';
import { Zap, BatteryCharging, Clock, Gauge, DollarSign, AlertTriangle, StopCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export default function ActiveSessionDrawer({ activeBooking, onSessionCompleted, onClose }) {
  const { authFetch } = useAuth();
  const { addEventListener } = useWebSocket();

  const [soc, setSoc] = useState(activeBooking?.target_battery_percent ? 35 : 40);
  const [energyDelivered, setEnergyDelivered] = useState(activeBooking?.energy_delivered_kwh || 12.4);
  const [powerKw, setPowerKw] = useState(60);
  const [elapsedMins, setElapsedMins] = useState(18);
  const [currentCost, setCurrentCost] = useState(217.0);
  const [stopping, setStopping] = useState(false);
  const [completedSummary, setCompletedSummary] = useState(null);

  // Listen for live OCPP telemetry stream
  useEffect(() => {
    const removeListener = addEventListener((event) => {
      if (event.type === 'METER_VALUES_STREAM' && event.data?.bookingId === activeBooking?.id) {
        if (event.data.socPercent !== undefined) setSoc(event.data.socPercent);
        if (event.data.energyDeliveredKwh !== undefined) {
          setEnergyDelivered(event.data.energyDeliveredKwh);
          // calculate cost
          const rate = 17.5;
          setCurrentCost(Math.round(event.data.energyDeliveredKwh * rate * 10) / 10);
        }
        if (event.data.powerKw !== undefined) setPowerKw(event.data.powerKw);
      }
    });

    // Local ticker if simulator is running
    const interval = setInterval(() => {
      setElapsedMins(prev => prev + 1);
      setEnergyDelivered(prev => {
        const next = Math.round((prev + 0.3) * 10) / 10;
        setCurrentCost(Math.round(next * 17.5 * 10) / 10);
        return next;
      });
      setSoc(prev => Math.min(100, prev + 1));
    }, 3000);

    return () => {
      removeListener();
      clearInterval(interval);
    };
  }, [activeBooking]);

  const handleStopCharging = async () => {
    if (!window.confirm('Are you sure you want to stop the charging session and finalize payment?')) return;
    setStopping(true);

    try {
      const res = await authFetch(`/api/bookings/${activeBooking.id}/stop-charging`, {
        method: 'POST',
        body: JSON.stringify({
          energyDeliveredKwh: energyDelivered,
          durationMins: elapsedMins
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stop charging session');

      setCompletedSummary(data);
      if (onSessionCompleted) onSessionCompleted(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        
        {/* Header */}
        <div style={{
          padding: '22px 26px',
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--neu-raised-sm), 0 0 16px var(--primary-glow)'
            }}>
              <Zap size={22} color="white" />
            </div>
            <div>
              <span className="status-badge charging">● LIVE OCPP 2.0.1 SESSION</span>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-heading)', marginTop: '4px', fontWeight: 800 }}>
                {activeBooking?.station_name || 'Charging Station'} • #{activeBooking?.booking_number || '1002'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '26px' }}>
          
          {completedSummary ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle size={56} color="#059669" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.4rem', color: 'var(--text-heading)', marginBottom: '8px', fontWeight: 800 }}>
                Session Successfully Completed!
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '22px' }}>
                Payment captured via authorized method. Invoice #{completedSummary.invoiceId} generated.
              </p>

              <div className="glass-panel" style={{ padding: '20px', textAlign: 'left', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Energy:</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-heading)' }}>{completedSummary.energyDeliveredKwh} kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Duration:</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-heading)' }}>{elapsedMins} Mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', paddingTop: '12px', borderTop: '1px solid rgba(180, 170, 160, 0.25)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Final Captured Total:</span>
                  <span style={{ fontWeight: 800, color: '#ff6b57' }}>₹{completedSummary.finalCost.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                Done / View Invoice
              </button>
            </div>
          ) : (
            <>
              {/* Neumorphic Dial Battery SOC Visualizer (from reference image!) */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{
                  position: 'relative',
                  width: '210px',
                  height: '210px',
                  margin: '0 auto',
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  boxShadow: 'var(--neu-raised)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.7)'
                }}>
                  {/* Sunken track groove for circular meter */}
                  <div style={{
                    position: 'absolute',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background: 'var(--bg-sunken)',
                    boxShadow: 'var(--neu-sunken-deep)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(200, 190, 180, 0.3)" strokeWidth="6" />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="#ff6b57"
                        strokeWidth="7"
                        strokeDasharray="264"
                        strokeDashoffset={264 - (264 * soc) / 100}
                        strokeLinecap="round"
                        style={{
                          transition: 'stroke-dashoffset 0.5s ease',
                          filter: 'drop-shadow(0 0 6px rgba(255, 107, 87, 0.8))'
                        }}
                      />
                    </svg>

                    {/* Center Neumorphic Knob */}
                    <div style={{
                      width: '136px',
                      height: '136px',
                      borderRadius: '50%',
                      background: 'var(--bg-surface)',
                      boxShadow: 'var(--neu-raised)',
                      border: '1px solid rgba(255, 255, 255, 0.8)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      zIndex: 2
                    }}>
                      {/* Notch at top of knob (from reference image) */}
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        width: '4px',
                        height: '10px',
                        borderRadius: '2px',
                        background: '#ff6b57',
                        boxShadow: '0 0 6px var(--primary-glow)'
                      }} />

                      <BatteryCharging size={24} color="#ff6b57" style={{ marginTop: '8px' }} />
                      <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-heading)', lineHeight: 1.1 }}>
                        {soc}%
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        State of Charge
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Telemetry Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                marginBottom: '26px'
              }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Zap size={14} color="#ff6b57" />
                    <span>Energy Delivered</span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                    {energyDelivered} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>kWh</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Gauge size={14} color="#ff6b57" />
                    <span>Current Power</span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ff6b57', marginTop: '4px' }}>
                    {powerKw} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>kW</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Clock size={14} color="#d97706" />
                    <span>Duration Elapsed</span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '4px' }}>
                    {elapsedMins} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Mins</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <DollarSign size={14} color="#059669" />
                    <span>Accumulated Cost</span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    ₹{currentCost.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Stop Session CTA */}
              <button
                onClick={handleStopCharging}
                disabled={stopping}
                className="btn-danger"
                style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '0.98rem' }}
              >
                <StopCircle size={20} />
                <span>{stopping ? 'Finalizing Session & Capturing Payment...' : 'Stop Charging & Finalize Payment'}</span>
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
