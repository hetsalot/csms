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
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.7)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#10b981" />
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
              Tax Invoice & Payment Receipt
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Generating invoice...</div>
        ) : !invoice ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#fca5a5' }}>Invoice not found</div>
        ) : (
          <div style={{ padding: '24px' }}>
            
            {/* Invoice Top Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Invoice Number</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>{invoice.id}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  Issued: {new Date(invoice.issued_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge ${invoice.status}`}>
                  ● Status: {invoice.status.toUpperCase()}
                </span>
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '4px', fontWeight: 600 }}>
                  Booking #{invoice.booking_number}
                </div>
              </div>
            </div>

            {/* Station & Driver Info */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Charging Location</span>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem', marginTop: '2px' }}>
                  {invoice.station_name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {invoice.station_address}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
                  Charger: {invoice.charger_name} ({invoice.connector_type})
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Billed To Driver</span>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem', marginTop: '2px' }}>
                  {invoice.driver_name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {invoice.driver_email}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                  {invoice.driver_phone}
                </div>
              </div>
            </div>

            {/* Itemized Breakdown (Pay.Invoice.Generate) */}
            <div style={{ marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px' }}>Item Description</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Units / Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#f8fafc' }}>
                    <td style={{ padding: '12px 4px' }}>
                      <strong>EV Energy Delivered</strong>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Duration: {invoice.duration_mins} mins</div>
                    </td>
                    <td style={{ padding: '12px 4px', textAlign: 'center' }}>{invoice.energy_delivered_kwh} kWh</td>
                    <td style={{ padding: '12px 4px', textAlign: 'right' }}>₹{invoice.unit_price.toFixed(2)}</td>
                    <td style={{ padding: '12px 4px', textAlign: 'right', fontWeight: 600 }}>₹{invoice.subtotal.toFixed(2)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}>
                    <td style={{ padding: '8px 4px' }} colSpan="3">GST / Government Taxes (0%)</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>₹0.00</td>
                  </tr>
                  <tr style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 800 }}>
                    <td style={{ padding: '12px 4px' }} colSpan="3">Total Paid (INR)</td>
                    <td style={{ padding: '12px 4px', textAlign: 'right', color: '#10b981' }}>
                      ₹{invoice.total_cost.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Refund banner if any */}
            {refundMessage && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                padding: '12px',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}>
                ✓ {refundMessage}
              </div>
            )}

            {/* Refund Request Form (Pay.Refund.Request) */}
            {showRefundForm ? (
              <form onSubmit={handleRefundSubmit} style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fca5a5', fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>
                  <AlertCircle size={18} />
                  <span>Request Refund within 7 Days (Pay.Refund.Request)</span>
                </div>
                <textarea
                  required
                  rows="3"
                  placeholder="Please state the specific reason for your refund request (e.g. charger dispensed lower power, billing discrepancy, premature session termination)..."
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  style={{ marginBottom: '10px', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRefundForm(false)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingRefund} className="btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                    {submittingRefund ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              {user?.role === 'driver' && invoice.status === 'paid' && !showRefundForm && (
                <button
                  onClick={() => setShowRefundForm(true)}
                  className="btn-secondary"
                  style={{ color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.85rem' }}
                >
                  <AlertCircle size={15} />
                  <span>Dispute / Request Refund</span>
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  <Printer size={16} />
                  <span>Print Receipt</span>
                </button>
                <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.85rem' }}>
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
