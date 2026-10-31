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
          padding: '24px 28px',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-sunken)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HelpCircle size={22} color="#ff6b57" />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>
              CSMS Help Center & Documentation (UD-1)
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* FAQs */}
        <div style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="glass-panel"
                style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  boxShadow: isOpen ? 'var(--neu-raised-sm)' : 'var(--neu-raised-sm)'
                }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-heading)',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '0.96rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: '#ff6b57', fontSize: '1.3rem', fontWeight: 800, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <div style={{
                    padding: '0 20px 18px 20px',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    borderTop: '1px solid rgba(180, 170, 160, 0.2)',
                    fontWeight: 500
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '18px 28px', borderTop: '1px solid rgba(180, 170, 160, 0.25)', background: 'var(--bg-sunken)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.88rem' }}>
            Close Help
          </button>
        </div>

      </div>
    </div>
  );
}
