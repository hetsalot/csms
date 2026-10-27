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
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)'
            }}>
              <Zap size={20} color="white" />
            </div>
            <div>
              <span className="status-badge charging">● LIVE OCPP 2.0.1 SESSION</span>
              <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginTop: '2px' }}>
                {activeBooking?.station_name || 'Charging Station'} • Booking #{activeBooking?.booking_number || '1002'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          
          {completedSummary ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '8px' }}>
                Session Successfully Completed!
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                Payment captured via authorized method. Invoice #{completedSummary.invoiceId} generated.
              </p>

              <div className="glass-panel" style={{ padding: '16px', textAlign: 'left', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: '#94a3b8' }}>Total Energy:</span>
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{completedSummary.energyDeliveredKwh} kWh</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: '#94a3b8' }}>Total Duration:</span>
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>{elapsedMins} Mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: '#94a3b8' }}>Final Payment Captured:</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>₹{completedSummary.finalCost.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={onClose} className="btn-primary" style={{ width: '100%' }}>
                Done / View Invoice
              </button>
            </div>
          ) : (
            <>
              {/* Battery SOC Visualizer */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto' }}>
                  <svg width="180" height="180" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="8"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * soc) / 100}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <BatteryCharging size={28} color="#10b981" />
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                      {soc}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>State of Charge</span>
                  </div>
                </div>
              </div>

              {/* Real-time Telemetry Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div className="glass-panel" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <Zap size={14} color="#34d399" />
                    <span>Energy Delivered</span>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {energyDelivered} <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>kWh</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <Gauge size={14} color="#38bdf8" />
                    <span>Current Power</span>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {powerKw} <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>kW</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <Clock size={14} color="#f59e0b" />
                    <span>Duration Elapsed</span>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {elapsedMins} <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mins</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <DollarSign size={14} color="#10b981" />
                    <span>Accumulated Cost</span>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                    ₹{currentCost.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Stop Session CTA */}
              <button
                onClick={handleStopCharging}
                disabled={stopping}
                className="btn-danger"
                style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1rem' }}
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
