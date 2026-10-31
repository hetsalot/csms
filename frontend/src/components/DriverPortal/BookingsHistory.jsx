import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Zap, RotateCcw, XCircle, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export default function BookingsHistory({ onOpenInvoice, onReorderBooking, onOpenActiveSession }) {
  const { authFetch } = useAuth();
  const { addEventListener } = useWebSocket();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/bookings/history');
      const data = await res.json();
      setBookings(data || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const removeListener = addEventListener((event) => {
      if (['NEW_BOOKING', 'BOOKING_CANCELED', 'CHARGING_STARTED', 'CHARGING_COMPLETED', 'BOOKING_NO_SHOW'].includes(event.type)) {
        fetchHistory();
      }
    });

    return () => removeListener();
  }, []);

  const handleCancelBooking = async (bookingId) => {
    const reason = window.prompt('Please provide a reason for cancelling this booking:', 'Change of travel plans');
    if (!reason) return;

    try {
      setActionLoadingId(bookingId);
      const res = await authFetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');
      alert('Booking canceled successfully! Pre-authorization hold has been released.');
      fetchHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartSession = async (booking) => {
    try {
      setActionLoadingId(booking.id);
      const res = await authFetch(`/api/bookings/${booking.id}/start-charging`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start session');
      
      // Open active session telemetry
      if (onOpenActiveSession) {
        onOpenActiveSession({ ...booking, status: 'in-progress' });
      }
      fetchHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title & Filter bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', color: 'var(--text-heading)', fontWeight: 800 }}>Bookings & Session History</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
            All charging sessions from the previous 12 months (Book.Previous.Period)
          </p>
        </div>

        {/* Filter Pills - Neumorphic Segmented Control Track */}
        <div className="neu-segmented-track">
          {['all', 'confirmed', 'in-progress', 'completed', 'canceled', 'no-show'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`neu-segmented-item ${filterStatus === st ? 'active' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings history...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Calendar size={44} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ color: 'var(--text-heading)', fontSize: '1.2rem', fontWeight: 800 }}>No bookings found in this period</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
            Book a charging slot from the map to see your scheduled reservations here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredBookings.map(bk => (
            <div
              key={bk.id}
              className="glass-panel glass-panel-hover"
              style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              {/* Left details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--bg-sunken)',
                  boxShadow: 'var(--neu-sunken)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Zap size={22} color={bk.status === 'completed' ? '#059669' : bk.status === 'in-progress' ? '#ff6b57' : '#d97706'} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-heading)' }}>
                      {bk.station_name}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#ff6b57', fontWeight: 800 }}>
                      #{bk.booking_number}
                    </span>
                    <span className={`status-badge ${bk.status}`}>
                      {bk.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                    {bk.charger_name} • {bk.connector_type} • {bk.power_rating} kW
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} color="#ff6b57" />
                      {bk.booking_date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} color="#059669" />
                      {bk.start_time} - {bk.end_time}
                    </span>
                    {bk.energy_delivered_kwh > 0 && (
                      <span style={{ color: '#059669', fontWeight: 700 }}>
                        {bk.energy_delivered_kwh} kWh delivered
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right price and actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {bk.status === 'completed' ? 'Final Charged' : 'Pre-Auth Hold'}
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: bk.status === 'completed' ? '#059669' : '#ff6b57' }}>
                    ₹{(bk.final_cost || bk.estimated_cost).toFixed(2)}
                  </div>
                </div>

                {/* Actions per state */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {bk.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleStartSession(bk)}
                        disabled={actionLoadingId === bk.id}
                        className="btn-primary"
                        style={{ padding: '9px 18px', fontSize: '0.88rem' }}
                      >
                        Start Charge
                      </button>
                      <button
                        onClick={() => handleCancelBooking(bk.id)}
                        disabled={actionLoadingId === bk.id}
                        className="btn-danger"
                        style={{ padding: '9px 14px', fontSize: '0.85rem' }}
                        title="Cancel booking and release hold (BR-9)"
                      >
                        <XCircle size={16} />
                        <span>Cancel</span>
                      </button>
                    </>
                  )}

                  {bk.status === 'in-progress' && (
                    <button
                      onClick={() => onOpenActiveSession(bk)}
                      className="btn-primary"
                      style={{ padding: '9px 18px', fontSize: '0.88rem' }}
                    >
                      Live Session
                    </button>
                  )}

                  {bk.status === 'completed' && (
                    <>
                      {bk.invoice_id && (
                        <button
                          onClick={() => onOpenInvoice(bk.invoice_id)}
                          className="btn-secondary"
                          style={{ padding: '9px 14px', fontSize: '0.85rem' }}
                          title="View Invoice & Receipt"
                        >
                          <FileText size={16} color="#ff6b57" />
                          <span>Invoice</span>
                        </button>
                      )}
                      <button
                        onClick={() => onReorderBooking(bk)}
                        className="btn-secondary"
                        style={{ padding: '9px 14px', fontSize: '0.85rem' }}
                        title="Re-order booking pre-filled (Book.Previous.Reorder)"
                      >
                        <RotateCcw size={16} color="#059669" />
                        <span>Re-book</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
