import React, { useState, useEffect } from 'react';
import { Plus, Zap, AlertTriangle, CheckCircle, RefreshCw, Trash2, Edit, Clock, Shield, History, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export default function OperatorDashboard() {
  const { authFetch, user } = useAuth();
  const { addEventListener } = useWebSocket();

  const [stations, setStations] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [selectedChargerHistory, setSelectedChargerHistory] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Station Modal state
  const [showAddStation, setShowAddStation] = useState(false);
  const [stnName, setStnName] = useState('');
  const [stnAddress, setStnAddress] = useState('');
  const [stnLat, setStnLat] = useState('19.0760');
  const [stnLng, setStnLng] = useState('72.8777');
  const [stnHours, setStnHours] = useState('24/7');

  // New Charger Modal state
  const [activeStationForCharger, setActiveStationForCharger] = useState(null);
  const [chargerName, setChargerName] = useState('');
  const [chargerConnector, setChargerConnector] = useState('CCS2');
  const [chargerPower, setChargerPower] = useState('60');
  const [chargerPricingType, setChargerPricingType] = useState('per_kwh');
  const [chargerRate, setChargerRate] = useState('18.50');
  const [chargerIdleFee, setChargerIdleFee] = useState('3.00');

  // Edit Charger Modal state
  const [editingCharger, setEditingCharger] = useState(null);
  const [editPriceRate, setEditPriceRate] = useState('');
  const [editIdleFee, setEditIdleFee] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // Edit Station Modal state
  const [editingStation, setEditingStation] = useState(null);
  const [editStnName, setEditStnName] = useState('');
  const [editStnAddress, setEditStnAddress] = useState('');
  const [editStnHours, setEditStnHours] = useState('');

  const loadOperatorData = async () => {
    try {
      setLoading(true);
      const [stnRes, refRes] = await Promise.all([
        authFetch('/api/stations/operator/my-stations'),
        authFetch('/api/payments/refunds')
      ]);
      setStations(await stnRes.json() || []);
      setRefundRequests(await refRes.json() || []);
    } catch (err) {
      console.error('Operator load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperatorData();

    // Listen for live OCPP updates, status changes, new bookings, refund updates (< 5s per PE-3)
    const removeListener = addEventListener((event) => {
      if (['CHARGER_STATUS_CHANGED', 'NEW_BOOKING', 'BOOKING_CANCELED', 'CHARGING_STARTED', 'CHARGING_COMPLETED', 'NEW_REFUND_REQUEST', 'CHARGER_FAULT_ALERT'].includes(event.type)) {
        loadOperatorData();
      }
    });

    return () => removeListener();
  }, []);

  // Station.Create
  const handleCreateStation = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/stations', {
        method: 'POST',
        body: JSON.stringify({
          name: stnName,
          address: stnAddress,
          latitude: stnLat,
          longitude: stnLng,
          operatingHours: stnHours
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create station');
      alert(data.message);
      setShowAddStation(false);
      setStnName('');
      setStnAddress('');
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Charger.Add
  const handleAddCharger = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`/api/stations/${activeStationForCharger.id}/chargers`, {
        method: 'POST',
        body: JSON.stringify({
          name: chargerName,
          connectorType: chargerConnector,
          powerRating: chargerPower,
          pricingType: chargerPricingType,
          priceRate: chargerRate,
          idleFee: chargerIdleFee
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add charger');
      setActiveStationForCharger(null);
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Edit & Station.Edit.ActiveBooking
  const handleUpdateCharger = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`/api/stations/chargers/${editingCharger.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          priceRate: editPriceRate,
          idleFee: editIdleFee,
          status: editStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update charger');
      if (data.warning) {
        alert(data.warning);
      } else {
        alert('Charger updated successfully.');
      }
      setEditingCharger(null);
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Delete (validates zero active/future bookings)
  const handleDeleteStation = async (stationId) => {
    if (!window.confirm('Are you sure you want to delete this charging station? It must have NO active or future bookings.')) return;
    try {
      const res = await authFetch(`/api/stations/${stationId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete station');
      alert('Station deleted successfully');
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Update
  const handleUpdateStation = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`/api/stations/${editingStation.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editStnName,
          address: editStnAddress,
          operatingHours: editStnHours
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update station');
      alert(data.message);
      setEditingStation(null);
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Charger.Delete
  const handleDeleteCharger = async (chargerId) => {
    if (!window.confirm('Delete this charger? It must have no active or confirmed future bookings.')) return;
    try {
      const res = await authFetch(`/api/stations/chargers/${chargerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete charger');
      alert(data.message);
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Monitor.History (90-day status logs)
  const handleViewHistory = async (charger) => {
    try {
      setSelectedChargerHistory(charger);
      const res = await authFetch(`/api/stations/chargers/${charger.id}/history`);
      const data = await res.json();
      setHistoryLogs(data || []);
    } catch (err) {
      alert('Failed to load charger status history');
    }
  };

  // Pay.Refund.Review & Process
  const handleReviewRefund = async (refundId, action) => {
    const operatorNotes = window.prompt(`Enter notes/remarks for ${action} this refund:`, action === 'approved' ? 'Discrepancy verified and refunded' : 'Charge session completed normally');
    try {
      const res = await authFetch(`/api/payments/refunds/${refundId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, operatorNotes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review refund');
      alert(data.message);
      loadOperatorData();
    } catch (err) {
      alert(err.message);
    }
  };

  // OCPP Simulator triggers
  const triggerSimulatorAction = async (endpoint, body) => {
    try {
      const res = await fetch(`/api/simulator/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      alert(data.message || 'Simulation signal sent');
      loadOperatorData();
    } catch (err) {
      alert('Simulator trigger error');
    }
  };

  // Aggregate metrics
  const allChargers = stations.flatMap(s => s.chargers || []);
  const availableCount = allChargers.filter(c => c.status === 'available').length;
  const chargingCount = allChargers.filter(c => c.status === 'charging').length;
  const faultedCount = allChargers.filter(c => c.status === 'faulted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner & KPI metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
            Station Operator Portal
          </span>
          <h2 style={{ fontSize: '1.5rem', color: '#f8fafc', marginTop: '2px' }}>
            {user?.organizationName || 'VoltCharge Networks'} — Station Control Hub
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadOperatorData} className="btn-secondary" style={{ padding: '8px 14px' }}>
            <RefreshCw size={16} />
            <span>Refresh Telemetry</span>
          </button>
          <button onClick={() => setShowAddStation(true)} className="btn-primary" style={{ padding: '8px 16px' }}>
            <Plus size={18} />
            <span>Register New Station</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        <div className="glass-panel" style={{ padding: '18px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Charging Stations</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            {stations.length}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <span style={{ fontSize: '0.8rem', color: '#34d399' }}>Available Chargers</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {availableCount} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ {allChargers.length}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>Active Charging Sessions</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>
            {chargingCount}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <span style={{ fontSize: '0.8rem', color: '#f87171' }}>Faulted / Alert Chargers</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>
            {faultedCount}
          </div>
        </div>
      </div>

      {/* Live Charger Monitoring Grid (Monitor.Dashboard.Operator) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
              Live Charger Monitor & OCPP 2.0.1 Telemetry
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Real-time hardware status updates received via secure WebSocket connection (OE-3 / SI-1)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#10b981' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            <span>WebSocket Live Stream Active</span>
          </div>
        </div>

        {stations.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
            No stations registered under your account yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {stations.map(stn => (
              <div key={stn.id} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{stn.name}</h4>
                      <span className={`status-badge ${stn.approval_status === 'approved' ? 'available' : 'reserved'}`}>
                        {stn.approval_status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>{stn.address} • Operating: {stn.operating_hours}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setEditingStation(stn);
                        setEditStnName(stn.name);
                        setEditStnAddress(stn.address);
                        setEditStnHours(stn.operating_hours || '24/7');
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      title="Edit Station details (Station.Edit)"
                    >
                      <Edit size={14} />
                      <span>Edit Station</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveStationForCharger(stn);
                        setChargerName(`${stn.name.split(' ')[0]} - Bay ${stn.chargers.length + 1}`);
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      <Plus size={14} />
                      <span>Add Charger</span>
                    </button>
                    <button
                      onClick={() => handleDeleteStation(stn.id)}
                      className="btn-danger"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      title="Delete station if no bookings exist (Station.Delete)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Chargers grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px'
                }}>
                  {stn.chargers.map(chg => (
                    <div
                      key={chg.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{chg.name}</span>
                          <span className={`status-badge ${chg.status}`}>{chg.status}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {chg.connector_type} • {chg.power_rating} kW ({chg.speed_category.toUpperCase()})
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '4px', fontWeight: 600 }}>
                          ₹{chg.price_rate.toFixed(2)} / {chg.pricing_type === 'per_kwh' ? 'kWh' : 'min'}
                          {chg.idle_fee > 0 && <span style={{ color: '#94a3b8', fontWeight: 400 }}> + ₹{chg.idle_fee}/min idle</span>}
                        </div>
                      </div>

                      {/* Hardware / OCPP Controls for this charger */}
                      <div style={{
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px'
                      }}>
                        <button
                          onClick={() => {
                            setEditingCharger(chg);
                            setEditPriceRate(chg.price_rate);
                            setEditIdleFee(chg.idle_fee);
                            setEditStatus(chg.status);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Edit pricing / details (Station.Edit)"
                        >
                          <Edit size={12} />
                          <span>Edit Rate</span>
                        </button>

                        <button
                          onClick={() => handleViewHistory(chg)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="View 90-day status log (Monitor.History)"
                        >
                          <History size={12} />
                          <span>History</span>
                        </button>

                        {/* Interactive Simulator signals */}
                        {chg.status !== 'faulted' ? (
                          <button
                            onClick={() => triggerSimulatorAction('fault', { chargerId: chg.id, faultType: 'Overheating' })}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Simulate hardware fault (SF-2 / SI-1.3)"
                          >
                            ⚡ Sim Fault
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerSimulatorAction('clear-fault', { chargerId: chg.id })}
                            style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Clear fault & restore"
                          >
                            ✓ Clear Fault
                          </button>
                        )}

                        <button
                          onClick={() => triggerSimulatorAction('simulate-timeout', { chargerId: chg.id })}
                          style={{ background: 'rgba(107, 114, 128, 0.1)', border: '1px solid rgba(107, 114, 128, 0.3)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                          title="Simulate 90s heartbeat loss (Monitor.Status.Timeout)"
                        >
                          ⏱ Timeout (90s)
                        </button>

                        <button
                          onClick={() => handleDeleteCharger(chg.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                          title="Delete charger (Station.Charger.Delete)"
                        >
                          <Trash2 size={12} style={{ display: 'inline', marginRight: '2px', verticalAlign: 'middle' }} />
                          Del
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refund Claims Review Section (Pay.Refund.Review) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
              Dispute & Refund Claims (Pay.Refund.Review)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Drivers may dispute a completed session within 7 days. Operator review issues refunds via Payment Gateway.
            </p>
          </div>
          <span className="status-badge reserved">
            {refundRequests.filter(r => r.status === 'pending').length} Pending Review
          </span>
        </div>

        {refundRequests.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            No refund claims submitted for your stations.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {refundRequests.map(ref => (
              <div
                key={ref.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                      Claim #{ref.id}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                      for Booking #{ref.booking_number} ({ref.station_name})
                    </span>
                    <span className={`status-badge ${ref.status}`}>{ref.status}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '4px' }}>
                    Reason: "{ref.reason}"
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    Claimant: {ref.driver_name} ({ref.driver_email}) • Claim Amount: <strong style={{ color: '#10b981' }}>₹{ref.amount.toFixed(2)}</strong>
                  </div>
                </div>

                {ref.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleReviewRefund(ref.id, 'approved')}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      Approve & Refund
                    </button>
                    <button
                      onClick={() => handleReviewRefund(ref.id, 'rejected')}
                      className="btn-danger"
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      Reject Claim
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Reviewed: <strong>{ref.status.toUpperCase()}</strong> ({ref.operator_notes || 'No notes'})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Register Station (Station.Create) */}
      {showAddStation && (
        <div className="modal-overlay" onClick={() => setShowAddStation(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Register New Charging Station</h3>
              <button onClick={() => setShowAddStation(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCreateStation} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label>Station Name</label>
                <input type="text" required value={stnName} onChange={e => setStnName(e.target.value)} placeholder="e.g. VoltCharge Hub - Juhu Beach" />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Physical Address</label>
                <input type="text" required value={stnAddress} onChange={e => setStnAddress(e.target.value)} placeholder="Full street address..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label>Latitude Coordinates</label>
                  <input type="number" step="any" required value={stnLat} onChange={e => setStnLat(e.target.value)} />
                </div>
                <div>
                  <label>Longitude Coordinates</label>
                  <input type="number" step="any" required value={stnLng} onChange={e => setStnLng(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label>Operating Hours</label>
                <input type="text" value={stnHours} onChange={e => setStnHours(e.target.value)} placeholder="e.g. 24/7 or 06:00 - 23:00" />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                Note (Station.Approval): Newly created stations remain in "Pending Approval" status until verified and activated by a System Administrator.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddStation(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Submit Station</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Charger to Station (Station.Charger.Add) */}
      {activeStationForCharger && (
        <div className="modal-overlay" onClick={() => setActiveStationForCharger(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Add Charger to {activeStationForCharger.name}</h3>
              <button onClick={() => setActiveStationForCharger(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleAddCharger} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label>Charger Label / Bay Name</label>
                <input type="text" required value={chargerName} onChange={e => setChargerName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label>Connector Type</label>
                  <select value={chargerConnector} onChange={e => setChargerConnector(e.target.value)}>
                    <option value="CCS2">CCS2 (DC Fast)</option>
                    <option value="Type 2">Type 2 (AC)</option>
                    <option value="GB/T">GB/T (Bharat DC)</option>
                    <option value="CHAdeMO">CHAdeMO</option>
                  </select>
                </div>
                <div>
                  <label>Power Output (kW)</label>
                  <input type="number" required value={chargerPower} onChange={e => setChargerPower(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label>Pricing Structure</label>
                  <select value={chargerPricingType} onChange={e => setChargerPricingType(e.target.value)}>
                    <option value="per_kwh">Price per kWh</option>
                    <option value="per_minute">Price per Minute</option>
                  </select>
                </div>
                <div>
                  <label>Base Rate (INR)</label>
                  <input type="number" step="0.5" required value={chargerRate} onChange={e => setChargerRate(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label>Idle Fee (₹ / min after charging)</label>
                <input type="number" step="0.5" value={chargerIdleFee} onChange={e => setChargerIdleFee(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setActiveStationForCharger(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Deploy Charger</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Charger (Station.Edit & Station.Edit.ActiveBooking) */}
      {editingCharger && (
        <div className="modal-overlay" onClick={() => setEditingCharger(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Edit Charger: {editingCharger.name}</h3>
              <button onClick={() => setEditingCharger(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateCharger} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label>Rate (INR per {editingCharger.pricing_type === 'per_kwh' ? 'kWh' : 'min'})</label>
                <input type="number" step="0.5" required value={editPriceRate} onChange={e => setEditPriceRate(e.target.value)} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Idle Fee (₹ / min)</label>
                <input type="number" step="0.5" value={editIdleFee} onChange={e => setEditIdleFee(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Manual Status Override</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="charging">Charging</option>
                  <option value="faulted">Faulted</option>
                  <option value="out of service">Out of Service</option>
                </select>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px' }}>
                Per Station.Edit.ActiveBooking: Any updates will apply to future bookings without altering existing confirmed booking holds.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditingCharger(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: 90-Day Status History Log (Monitor.History) */}
      {selectedChargerHistory && (
        <div className="modal-overlay" onClick={() => setSelectedChargerHistory(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
                  Charger Status History (Monitor.History)
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {selectedChargerHistory.name} (Retained for 90 Days)
                </span>
              </div>
              <button onClick={() => setSelectedChargerHistory(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              {historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                  No historical state changes recorded in the last 90 days.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyLogs.map(log => (
                    <div
                      key={log.id}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                          Status changed: <span style={{ color: '#94a3b8' }}>{log.previous_status || 'none'}</span> → <span style={{ color: '#10b981', fontWeight: 700 }}>{log.new_status}</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        Reason: {log.reason} • Actor: {log.changed_by}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Station Modal */}
      {editingStation && (
        <div className="modal-overlay" onClick={() => setEditingStation(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Edit Station (Station.Edit)</h3>
              <button onClick={() => setEditingStation(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateStation} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Station Name</label>
                <input
                  type="text"
                  required
                  value={editStnName}
                  onChange={e => setEditStnName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Physical Address</label>
                <input
                  type="text"
                  required
                  value={editStnAddress}
                  onChange={e => setEditStnAddress(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Operating Hours</label>
                <input
                  type="text"
                  required
                  value={editStnHours}
                  onChange={e => setEditStnHours(e.target.value)}
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditingStation(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
