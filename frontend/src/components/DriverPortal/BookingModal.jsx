import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Zap, ShieldCheck, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';

export default function BookingModal({ station, initialCharger, onClose, onBookingSuccess }) {
  const { user, authFetch } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [manualConnector, setManualConnector] = useState(initialCharger?.connector_type || 'CCS2');
  
  const [selectedChargerId, setSelectedChargerId] = useState(initialCharger?.id || '');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Set default start time 30 mins ahead rounded to 15 mins (satisfying Book.Date.Cutoff)
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [durationMins, setDurationMins] = useState(45);
  const [targetSoc, setTargetSoc] = useState(80);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cutoffWarning, setCutoffWarning] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Load vehicles and payment methods
  useEffect(() => {
    async function loadData() {
      try {
        const [vRes, pRes] = await Promise.all([
          authFetch('/api/auth/vehicles'),
          authFetch('/api/auth/payment-methods')
        ]);
        const vData = await vRes.json();
        const pData = await pRes.json();

        setVehicles(vData || []);
        if (vData && vData.length > 0) {
          setSelectedVehicleId(vData[0].id);
          setManualConnector(vData[0].connector_type);
        }

        setPaymentMethods(pData || []);
        if (pData && pData.length > 0) {
          const defaultPm = pData.find(p => p.is_default) || pData[0];
          setSelectedPaymentMethodId(defaultPm.id);
        }
      } catch (err) {
        console.error('Failed to load user booking data:', err);
      }
    }
    loadData();
  }, []);

  // When vehicle changes, sync connector
  const handleVehicleChange = (vId) => {
    setSelectedVehicleId(vId);
    const found = vehicles.find(v => v.id === vId);
    if (found) {
      setManualConnector(found.connector_type);
    }
  };

  // Filter compatible chargers at station
  const compatibleChargers = (station?.chargers || []).filter(c => {
    const matchConnector = c.connector_type === manualConnector;
    const isUsable = c.status !== 'faulted' && c.status !== 'out of service';
    return matchConnector && isUsable;
  });

  // Keep selected charger valid
  useEffect(() => {
    if (compatibleChargers.length > 0 && !compatibleChargers.some(c => c.id === selectedChargerId)) {
      setSelectedChargerId(compatibleChargers[0].id);
    }
  }, [manualConnector, compatibleChargers]);

  const selectedCharger = (station?.chargers || []).find(c => c.id === selectedChargerId) || compatibleChargers[0];

  // Calculate end time
  const calculateEndTime = () => {
    if (!startTime) return '12:00';
    const [h, m] = startTime.split(':').map(Number);
    const endMinutesTotal = h * 60 + m + parseInt(durationMins);
    const endH = Math.floor(endMinutesTotal / 60) % 24;
    const endM = endMinutesTotal % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  // Cost Estimation (BR-12)
  const calculateEstimatedCost = () => {
    if (!selectedCharger) return 0;
    if (selectedCharger.pricing_type === 'per_kwh') {
      const estKwh = Math.min((selectedCharger.power_rating * (durationMins / 60)) * 0.85, 60);
      return Math.max(120, Math.round(estKwh * selectedCharger.price_rate));
    } else {
      return Math.max(100, Math.round(durationMins * selectedCharger.price_rate));
    }
  };

  const estimatedCost = calculateEstimatedCost();

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setError(null);
    setCutoffWarning(null);

    if (!selectedCharger) {
      setError('Please select an available charger.');
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          stationId: station.id,
          chargerId: selectedCharger.id,
          vehicleId: selectedVehicleId || null,
          bookingDate,
          startTime,
          endTime: calculateEndTime(),
          estimatedDurationMins: durationMins,
          targetBatteryPercent: targetSoc,
          paymentMethodId: selectedPaymentMethodId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm booking');
      }

      // Fire celebratory confetti!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      setConfirmedBooking(data);
      if (onBookingSuccess) onBookingSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-sunken)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#ff6b57', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Slot Reservation
            </span>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-heading)', marginTop: '2px', fontWeight: 800 }}>
              Book Charger at {station?.name}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* Confirmed State View */}
        {confirmedBooking ? (
          <div style={{ padding: '36px 28px', textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--bg-sunken)',
              border: '2px solid #059669',
              boxShadow: 'var(--neu-raised-sm), 0 0 16px rgba(5, 150, 105, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              color: '#059669'
            }}>
              <CheckCircle2 size={38} />
            </div>

            <h3 style={{ fontSize: '1.45rem', color: 'var(--text-heading)', marginBottom: '8px', fontWeight: 800 }}>
              Booking Confirmed!
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
              Your charging slot has been reserved. A payment authorization hold has been placed.
            </p>

            <div className="glass-panel" style={{ padding: '20px', textAlign: 'left', marginBottom: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Booking ID:</span>
                <span style={{ color: '#ff6b57', fontWeight: 800 }}>#{confirmedBooking.bookingNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Station:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{confirmedBooking.stationName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Charger:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{confirmedBooking.chargerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Reserved Slot:</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>{confirmedBooking.bookingDate} ({confirmedBooking.timeWindow})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', paddingTop: '12px', borderTop: '1px solid rgba(180, 170, 160, 0.25)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Pre-Authorization Hold:</span>
                <span style={{ color: '#ff6b57', fontWeight: 800 }}>₹{confirmedBooking.estimatedCost.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              Done / Return to Map
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleConfirmBooking} style={{ padding: '28px' }}>
            
            {error && (
              <div style={{
                background: 'rgba(225, 29, 72, 0.1)',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '18px',
                color: '#b91c1c',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Vehicle & Connector Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label>1. Select Vehicle / Connector (Book.Vehicle.Select)</label>
              {vehicles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {vehicles.map(v => (
                    <div
                      key={v.id}
                      onClick={() => handleVehicleChange(v.id)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: selectedVehicleId === v.id ? '2px solid #ff6b57' : '1px solid rgba(255, 255, 255, 0.7)',
                        background: 'var(--bg-surface)',
                        boxShadow: selectedVehicleId === v.id ? '0 0 14px var(--primary-glow), var(--neu-raised-sm)' : 'var(--neu-raised-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-heading)' }}>{v.make} {v.model}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                        {v.connector_type} • {v.battery_capacity} kWh
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <select
                  value={manualConnector}
                  onChange={e => setManualConnector(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="CCS2">CCS2 (Combined Charging System 2)</option>
                  <option value="Type 2">Type 2 (Mennekes AC)</option>
                  <option value="GB/T">GB/T (Bharat DC Standard)</option>
                  <option value="CHAdeMO">CHAdeMO (Fast DC)</option>
                </select>
              )}
            </div>

            {/* Step 2: Date & 15-Minute Slot Time Window */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label>2. Booking Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label>3. Start Time (15-min intervals)</label>
                <input
                  type="time"
                  step="900" // 15 mins
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                  Slot: <strong style={{ color: '#ff6b57' }}>{startTime}</strong> to <strong style={{ color: '#ff6b57' }}>{calculateEndTime()}</strong>
                </div>
              </div>
            </div>

            {/* Step 3: Compatible Charger Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label>4. Select Compatible Charger at Station</label>
              {compatibleChargers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {compatibleChargers.map(chg => (
                    <div
                      key={chg.id}
                      onClick={() => setSelectedChargerId(chg.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: selectedChargerId === chg.id ? '2px solid #ff6b57' : '1px solid rgba(255, 255, 255, 0.7)',
                        background: 'var(--bg-surface)',
                        boxShadow: selectedChargerId === chg.id ? '0 0 14px var(--primary-glow), var(--neu-raised-sm)' : 'var(--neu-raised-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'var(--bg-sunken)',
                          boxShadow: 'var(--neu-sunken)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Zap size={18} color="#ff6b57" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-heading)' }}>{chg.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {chg.power_rating} kW • {chg.speed_category.toUpperCase()} • Rate: <span style={{ color: '#ff6b57' }}>₹{chg.price_rate}/{chg.pricing_type === 'per_kwh' ? 'kWh' : 'min'}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`status-badge ${chg.status}`}>{chg.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '14px',
                  background: 'var(--bg-sunken)',
                  border: '1px dashed #e11d48',
                  borderRadius: 'var(--radius-md)',
                  color: '#b91c1c',
                  fontSize: '0.88rem',
                  fontWeight: 600
                }}>
                  No active chargers with {manualConnector} connector at this station right now.
                </div>
              )}
            </div>

            {/* Step 4: Estimated Duration & Target Battery % */}
            <div style={{ marginBottom: '20px', background: 'var(--bg-sunken)', boxShadow: 'var(--neu-sunken)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>5. Estimated Session Duration: <strong style={{ color: '#ff6b57' }}>{durationMins} Mins</strong></label>
                <span style={{ fontSize: '0.82rem', color: '#ff6b57', fontWeight: 800 }}>Target SoC: {targetSoc}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={durationMins}
                onChange={e => setDurationMins(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                <span>15 min</span>
                <span>30 min</span>
                <span>45 min</span>
                <span>60 min</span>
                <span>90 min</span>
                <span>120 min</span>
              </div>
            </div>

            {/* Step 5: Payment Hold Method (Book.Pay.Hold & SE-3 Tokenization) */}
            <div style={{ marginBottom: '22px' }}>
              <label>6. Payment Method for Pre-Authorization Hold (Book.Pay.Hold)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <select
                  value={selectedPaymentMethodId}
                  onChange={e => setSelectedPaymentMethodId(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>
                      {pm.provider} ({pm.masked_number}) - Tokenized
                    </option>
                  ))}
                  {paymentMethods.length === 0 && (
                    <option value="sim_card_1">HDFC Visa Credit Card (•••• 4242)</option>
                  )}
                </select>
                <div style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                  <ShieldCheck size={18} />
                  <span>PCI-DSS Tokenized</span>
                </div>
              </div>
            </div>

            {/* Estimated Total & Confirm CTA */}
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow: 'var(--neu-sunken)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '22px'
            }}>
              <div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Cost / Auth Hold (BR-12):</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff6b57', marginTop: '2px' }}>
                  ₹{estimatedCost.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Final charge calculated<br />on actual energy delivered (kWh)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedCharger}
                className="btn-primary"
                style={{ flex: 2, padding: '12px' }}
              >
                {loading ? 'Authorizing Hold...' : `Confirm & Authorize ₹${estimatedCost.toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
