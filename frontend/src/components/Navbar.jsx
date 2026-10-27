import React, { useState } from 'react';
import { Zap, HelpCircle, Compass, User, LogOut, ChevronDown, Activity, BatteryCharging } from 'lucide-react';
import { useAuth, DEMO_PRESETS } from '../context/AuthContext';

export default function Navbar({
  currentView,
  onNavigate,
  onOpenWalkthrough,
  onOpenHelp,
  onOpenAuth,
  activeSession,
  onOpenActiveSession
}) {
  const { user, role, logout, switchPreset } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 900,
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '12px 24px'
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand Logo & Tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => onNavigate('finder')}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.45)'
          }}>
            <Zap size={22} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                VoltFlow
              </span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                CSMS v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              EV Charging Station Management System
            </div>
          </div>
        </div>

        {/* Center Nav Links according to active user role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {role === 'driver' && (
            <>
              <button
                onClick={() => onNavigate('finder')}
                style={{
                  background: currentView === 'finder' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: currentView === 'finder' ? '#34d399' : '#cbd5e1',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Find Stations
              </button>
              <button
                onClick={() => onNavigate('bookings')}
                style={{
                  background: currentView === 'bookings' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: currentView === 'bookings' ? '#34d399' : '#cbd5e1',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                My Bookings & History
              </button>
              <button
                onClick={() => onNavigate('garage')}
                style={{
                  background: currentView === 'garage' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  color: currentView === 'garage' ? '#34d399' : '#cbd5e1',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                EV Garage & Cards
              </button>
            </>
          )}

          {role === 'operator' && (
            <button
              onClick={() => onNavigate('operator')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#34d399',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Operator Control Hub
            </button>
          )}

          {role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f59e0b',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Administrator Portal
            </button>
          )}
        </div>

        {/* Right Action Icons & Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Active Charging session indicator if active */}
          {activeSession && (
            <button
              onClick={onOpenActiveSession}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '999px',
                padding: '6px 14px',
                color: '#60a5fa',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                animation: 'pulse-glow 2s infinite'
              }}
            >
              <BatteryCharging size={16} />
              <span>Session In Progress</span>
            </button>
          )}

          {/* Guided Tour Launcher (UD-2) */}
          <button
            onClick={onOpenWalkthrough}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.8rem' }}
            title="Guided Booking Walkthrough (UD-2)"
          >
            <Compass size={15} color="#10b981" />
            <span>Walkthrough</span>
          </button>

          {/* Help button (UD-1 & UI-2) */}
          <button
            onClick={onOpenHelp}
            className="btn-secondary"
            style={{ padding: '7px 10px', fontSize: '0.8rem' }}
            title="Online Help & FAQ (UD-1)"
          >
            <HelpCircle size={16} />
          </button>

          {/* Role Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: role === 'admin' ? '#f59e0b' : role === 'operator' ? '#3b82f6' : role === 'driver' ? '#10b981' : '#6b7280'
              }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, lineHeight: 1.1 }}>
                  {user ? user.name.split(' ')[0] : 'Guest User'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                  {role}
                </div>
              </div>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {/* Dropdown Menu */}
            {showRoleMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '280px',
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                padding: '8px',
                zIndex: 1000
              }}>
                <div style={{ padding: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    Switch Demo User Preset:
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {DEMO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        switchPreset(p);
                        setShowRoleMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: user?.email === p.email ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        border: 'none',
                        color: user?.email === p.email ? '#34d399' : '#cbd5e1',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.label}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', marginTop: '8px', paddingTop: '6px' }}>
                  {user ? (
                    <button
                      onClick={() => {
                        logout();
                        setShowRoleMenu(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#fca5a5',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onOpenAuth();
                        setShowRoleMenu(false);
                      }}
                      className="btn-primary"
                      style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
                    >
                      Sign In / Register
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </nav>
  );
}
