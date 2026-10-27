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
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.7)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={20} color="#10b981" />
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc' }}>
              Driver Booking Walkthrough (UD-2)
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: idx <= currentStep ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  transition: 'background 0.3s'
                }}
              />
            ))}
          </div>

          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            color: '#10b981'
          }}>
            <Icon size={30} />
          </div>

          <h3 style={{ fontSize: '1.3rem', color: '#f8fafc', marginBottom: '10px' }}>
            {step.title}
          </h3>

          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '16px' }}>
            {step.desc}
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '3px solid #10b981',
            padding: '12px 16px',
            borderRadius: '0 8px 8px 0',
            marginBottom: '24px'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
              Pro Tip:
            </span>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              {step.tip}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="btn-secondary"
              style={{ visibility: currentStep === 0 ? 'hidden' : 'visible', padding: '8px 14px' }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Step {currentStep + 1} of {STEPS.length}
            </span>

            <button
              onClick={handleNext}
              className="btn-primary"
              style={{ padding: '8px 18px' }}
            >
              <span>{currentStep === STEPS.length - 1 ? 'Start Exploring' : 'Next Step'}</span>
              <ArrowRight size={16} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
