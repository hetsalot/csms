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
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Slot Reservation
            </span>
            <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginTop: '2px' }}>
              Book Charger at {station?.name}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Confirmed State View */}
        {confirmedBooking ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#10b981'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', marginBottom: '8px' }}>
              Booking Confirmed!
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
              Your charging slot has been reserved. A payment authorization hold has been placed.
            </p>

            <div className="glass-panel" style={{ padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Booking ID:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>#{confirmedBooking.bookingNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Station:</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{confirmedBooking.stationName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Charger:</span>
                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{confirmedBooking.chargerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Reserved Slot:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{confirmedBooking.bookingDate} ({confirmedBooking.timeWindow})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#94a3b8' }}>Pre-Authorization Hold:</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>₹{confirmedBooking.estimatedCost.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              Done / Return to Map
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleConfirmBooking} style={{ padding: '24px' }}>
            
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Vehicle & Connector Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label>1. Select Vehicle / Connector (Book.Vehicle.Select)</label>
              {vehicles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {vehicles.map(v => (
                    <div
                      key={v.id}
                      onClick={() => handleVehicleChange(v.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: selectedVehicleId === v.id ? '2px solid #10b981' : '1px solid var(--border-color)',
                        background: selectedVehicleId === v.id ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{v.make} {v.model}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
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
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  Slot: <strong>{startTime}</strong> to <strong>{calculateEndTime()}</strong>
                </div>
              </div>
            </div>

            {/* Step 3: Compatible Charger Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label>4. Select Compatible Charger at Station</label>
              {compatibleChargers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {compatibleChargers.map(chg => (
                    <div
                      key={chg.id}
                      onClick={() => setSelectedChargerId(chg.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: selectedChargerId === chg.id ? '2px solid #10b981' : '1px solid var(--border-color)',
                        background: selectedChargerId === chg.id ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Zap size={18} color="#10b981" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>{chg.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {chg.power_rating} kW • {chg.speed_category.toUpperCase()} • Rate: ₹{chg.price_rate}/{chg.pricing_type === 'per_kwh' ? 'kWh' : 'min'}
                          </div>
                        </div>
                      </div>
                      <span className={`status-badge ${chg.status}`}>{chg.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px dashed rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.85rem'
                }}>
                  No active chargers with {manualConnector} connector at this station right now.
                </div>
              )}
            </div>

            {/* Step 4: Estimated Duration & Target Battery % */}
            <div style={{ marginBottom: '18px', background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>5. Estimated Session Duration: <strong>{durationMins} Mins</strong></label>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Target SoC: <strong>{targetSoc}%</strong></span>
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={durationMins}
                onChange={e => setDurationMins(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                <span>15 min</span>
                <span>30 min</span>
                <span>45 min</span>
                <span>60 min</span>
                <span>90 min</span>
                <span>120 min</span>
              </div>
            </div>

            {/* Step 5: Payment Hold Method (Book.Pay.Hold & SE-3 Tokenization) */}
            <div style={{ marginBottom: '20px' }}>
              <label>6. Payment Method for Pre-Authorization Hold (Book.Pay.Hold)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={16} />
                  <span>PCI-DSS Tokenized</span>
                </div>
              </div>
            </div>

            {/* Estimated Total & Confirm CTA */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Estimated Cost / Auth Hold (BR-12):</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                  ₹{estimatedCost.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                Final charge calculated<br />on actual energy (kWh)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
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
