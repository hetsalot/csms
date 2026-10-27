import React, { useState } from 'react';
import { X, HelpCircle, Search, ShieldCheck, Zap, DollarSign, AlertCircle } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I search for charging stations near me?',
    a: 'Click the "My GPS" button in the map view to automatically locate stations based on your current device position, or type any neighborhood or street address into the search bar. You can adjust the radius slider between 2 km and 50 km.'
  },
  {
    q: 'What is the 15-minute booking cutoff rule (Book.Date.Cutoff)?',
    a: 'To guarantee charger availability and eliminate waiting queues, charging slots must be booked at least 15 minutes prior to the start time. Booking windows operate on 15-minute intervals.'
  },
  {
    q: 'How does payment authorization hold work (Book.Pay.Hold)?',
    a: 'When you confirm a reservation, an authorization hold is placed on your chosen card or UPI digital wallet for the estimated cost. Once charging finishes, the exact energy delivered (in kWh) is captured and any excess hold is immediately released.'
  },
  {
    q: 'What is the cancellation and refund policy (BR-9 & Pay.Refund.Request)?',
    a: 'You can cancel any confirmed booking before the charging session begins; your pre-authorization hold will be released in full. Completed sessions can be disputed within 7 days by clicking "Dispute / Request Refund" in your invoice details.'
  },
  {
    q: 'What connector types does this system support?',
    a: 'The CSMS supports all major EV standards: CCS2 (Combined Charging System DC Fast), Type 2 (Mennekes AC), GB/T (Bharat DC001 Standard), and CHAdeMO.'
  },
  {
    q: 'What happens if a charger experiences a fault (SF-2 & SI-1.3)?',
    a: 'If a charge point controller detects a fault (e.g., ground impedance or overheating), the charger is instantly removed from Driver search results, the active session is securely halted, and an emergency alert is broadcast to the Station Operator.'
  }
];

export default function HelpModal({ onClose }) {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        
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
            <HelpCircle size={20} color="#10b981" />
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
              CSMS Help Center & Documentation (UD-1)
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* FAQs */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: '#10b981', fontSize: '1.2rem', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <div style={{
                    padding: '0 16px 14px 16px',
                    color: '#cbd5e1',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)'
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
            Close Help
          </button>
        </div>

      </div>
    </div>
  );
}
