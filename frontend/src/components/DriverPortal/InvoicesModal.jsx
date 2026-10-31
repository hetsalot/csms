import React, { useState, useEffect } from 'react';
import { X, Printer, ShieldCheck, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function InvoicesModal({ invoiceId, onClose }) {
  const { authFetch, user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [refundMessage, setRefundMessage] = useState(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true);
        const res = await authFetch(`/api/payments/invoices/${invoiceId}`);
        const data = await res.json();
        setInvoice(data);
      } catch (err) {
        console.error('Invoice fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundReason) return;

    try {
      setSubmittingRefund(true);
      const res = await authFetch('/api/payments/refunds/request', {
        method: 'POST',
        body: JSON.stringify({ invoiceId, reason: refundReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit refund');

      setRefundMessage('Refund request successfully submitted! Station Operator will review your claim.');
      setShowRefundForm(false);
      // Reload invoice
      const updatedRes = await authFetch(`/api/payments/invoices/${invoiceId}`);
      setInvoice(await updatedRes.json());
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  if (!invoiceId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-sunken)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="#ff6b57" />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>
              Tax Invoice & Payment Receipt
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Generating invoice...</div>
        ) : !invoice ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#b91c1c' }}>Invoice not found</div>
        ) : (
          <div style={{ padding: '28px' }}>
            
            {/* Invoice Top Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Invoice Number</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-heading)' }}>{invoice.id}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                  Issued: {new Date(invoice.issued_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge ${invoice.status}`}>
                  ● Status: {invoice.status.toUpperCase()}
                </span>
                <div style={{ fontSize: '0.82rem', color: '#ff6b57', marginTop: '6px', fontWeight: 800 }}>
                  Booking #{invoice.booking_number}
                </div>
              </div>
            </div>

            {/* Station & Driver Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '18px 20px',
              background: 'var(--bg-sunken)',
              boxShadow: 'var(--neu-sunken)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Charging Location</span>
                <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '0.98rem', marginTop: '3px' }}>
                  {invoice.station_name}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {invoice.station_address}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px', fontWeight: 600 }}>
                  Charger: {invoice.charger_name} ({invoice.connector_type})
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Billed To Driver</span>
                <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '0.98rem', marginTop: '3px' }}>
                  {invoice.driver_name}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {invoice.driver_email}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {invoice.driver_phone}
                </div>
              </div>
            </div>

            {/* Itemized Breakdown (Pay.Invoice.Generate) */}
            <div style={{ marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid rgba(180, 170, 160, 0.35)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700 }}>
                    <th style={{ padding: '10px 6px' }}>Item Description</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Units / Qty</th>
                    <th style={{ padding: '10px 6px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '10px 6px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(180, 170, 160, 0.2)', color: 'var(--text-main)' }}>
                    <td style={{ padding: '14px 6px' }}>
                      <strong style={{ color: 'var(--text-heading)' }}>EV Energy Delivered</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Duration: {invoice.duration_mins} mins</div>
                    </td>
                    <td style={{ padding: '14px 6px', textAlign: 'center', fontWeight: 600 }}>{invoice.energy_delivered_kwh} kWh</td>
                    <td style={{ padding: '14px 6px', textAlign: 'right', fontWeight: 600 }}>₹{invoice.unit_price.toFixed(2)}</td>
                    <td style={{ padding: '14px 6px', textAlign: 'right', fontWeight: 700 }}>₹{invoice.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(180, 170, 160, 0.2)', color: 'var(--text-muted)' }}>
                    <td style={{ padding: '10px 6px' }} colSpan="3">GST / Government Taxes (0%)</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 600 }}>₹0.00</td>
                  </tr>
                  <tr style={{ color: 'var(--text-heading)', fontSize: '1.15rem', fontWeight: 800 }}>
                    <td style={{ padding: '14px 6px' }} colSpan="3">Total Paid (INR)</td>
                    <td style={{ padding: '14px 6px', textAlign: 'right', color: '#ff6b57' }}>
                      ₹{invoice.total_cost.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Refund banner if any */}
            {refundMessage && (
              <div style={{
                background: 'rgba(5, 150, 105, 0.12)',
                border: '1px solid #059669',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                color: '#059669',
                fontSize: '0.88rem',
                fontWeight: 700,
                marginBottom: '18px'
              }}>
                ✓ {refundMessage}
              </div>
            )}

            {/* Refund Request Form (Pay.Refund.Request) */}
            {showRefundForm ? (
              <form onSubmit={handleRefundSubmit} style={{
                background: 'var(--bg-sunken)',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                boxShadow: 'var(--neu-sunken)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontSize: '0.92rem', fontWeight: 800, marginBottom: '10px' }}>
                  <AlertCircle size={18} />
                  <span>Request Refund within 7 Days (Pay.Refund.Request)</span>
                </div>
                <textarea
                  required
                  rows="3"
                  placeholder="Please state the specific reason for your refund request (e.g. charger dispensed lower power, billing discrepancy, premature session termination)..."
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  style={{ marginBottom: '12px', fontSize: '0.88rem' }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRefundForm(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingRefund} className="btn-danger" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    {submittingRefund ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              {user?.role === 'driver' && invoice.status === 'paid' && !showRefundForm && (
                <button
                  onClick={() => setShowRefundForm(true)}
                  className="btn-danger"
                  style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                >
                  <AlertCircle size={15} />
                  <span>Dispute / Request Refund</span>
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                >
                  <Printer size={16} color="#ff6b57" />
                  <span>Print Receipt</span>
                </button>
                <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 20px' }}>
                  Close
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
