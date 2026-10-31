import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, MapPin, Zap, Clock, ShieldCheck, CheckCircle2, Compass } from 'lucide-react';

const STEPS = [
  {
    title: '1. Locate Stations On The Interactive Map',
    desc: 'Drivers can search stations near their device GPS or enter any city address. Custom pins display real-time charger availability (green = available, amber = occupied, red = faulted).',
    tip: 'Filter by connector type (CCS2, Type 2, GB/T, CHAdeMO) and adjust your search radius from 2 km to 50 km.',
    icon: MapPin,
    highlight: 'GPS location & real-time color-coded pins'
  },
  {
    title: '2. Vehicle & Compatible Charger Selection',
    desc: 'Select your registered EV or choose your vehicle connector. The system automatically filters out incompatible chargers and isolates faulted bays (SI-1.3).',
    tip: 'Charger power ratings range from 11 kW AC to 240 kW DC Ultra-Fast chargers.',
    icon: Zap,
    highlight: 'Automatic compatibility verification'
  },
  {
    title: '3. 15-Minute Slot Time Window (Book.Date.Cutoff)',
    desc: 'Bookings must begin and end on 15-minute intervals. To prevent double-booking, reservations must be requested at least 15 minutes before the desired slot.',
    tip: 'Use the duration slider to specify charging minutes or target battery percentage (e.g. 80% SoC).',
    icon: Clock,
    highlight: 'Strict 15-minute interval scheduling'
  },
  {
    title: '4. Safe Pre-Authorization Payment Hold (SE-3)',
    desc: 'Before confirmation, an authorization hold is placed on your card or digital wallet for the estimated cost. No real funds are captured until charging ends.',
    tip: 'Cancel anytime before charging starts to release the hold in full (BR-9).',
    icon: ShieldCheck,
    highlight: 'PCI-DSS tokenized card & wallet vaults'
  },
  {
    title: '5. Live OCPP 2.0.1 Telemetry & Itemized Invoicing',
    desc: 'When connected, the Charge Point Controller streams live kilowatt-hours, state-of-charge %, and power. When completed, the final amount is captured and a tax invoice is issued.',
    tip: 'Drivers can dispute and request refunds within 7 days directly from their invoice history (Pay.Refund.Request).',
    icon: CheckCircle2,
    highlight: 'Full end-to-end transparent lifecycle'
  }
];

export default function GuidedWalkthrough({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = STEPS[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        
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
            <Compass size={22} color="#ff6b57" />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>
              Driver Booking Walkthrough (UD-2)
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '30px 28px' }}>
          
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '26px' }}>
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: idx <= currentStep ? 'var(--primary-gradient)' : 'var(--bg-sunken)',
                  boxShadow: idx <= currentStep ? '0 0 8px var(--primary-glow)' : 'var(--neu-sunken)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--bg-sunken)',
            boxShadow: 'var(--neu-sunken)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            color: '#ff6b57'
          }}>
            <Icon size={30} />
          </div>

          <h3 style={{ fontSize: '1.35rem', color: 'var(--text-heading)', marginBottom: '10px', fontWeight: 800 }}>
            {step.title}
          </h3>

          <p style={{ color: 'var(--text-body)', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: '20px', fontWeight: 500 }}>
            {step.desc}
          </p>

          <div style={{
            background: 'var(--bg-sunken)',
            boxShadow: 'var(--neu-sunken)',
            borderLeft: '4px solid #ff6b57',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderLeftWidth: '4px',
            borderLeftColor: '#ff6b57',
            padding: '14px 18px',
            borderRadius: '0 12px 12px 0',
            marginBottom: '26px'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#ff6b57', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pro Tip:
            </span>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginTop: '3px', fontWeight: 600 }}>
              {step.tip}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="btn-secondary"
              style={{ visibility: currentStep === 0 ? 'hidden' : 'visible', padding: '9px 18px' }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Step {currentStep + 1} of {STEPS.length}
            </span>

            <button
              onClick={handleNext}
              className="btn-primary"
              style={{ padding: '9px 20px' }}
            >
              <span>{currentStep === STEPS.length - 1 ? 'Get Started' : 'Next Step'}</span>
              <ArrowRight size={16} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
