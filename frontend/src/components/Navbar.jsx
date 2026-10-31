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
      background: 'rgba(232, 226, 220, 0.94)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 4px 18px rgba(188, 178, 169, 0.45)',
      padding: '12px 24px'
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand Logo & Tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => onNavigate('finder')}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--neu-raised-sm), 0 0 16px var(--primary-glow)',
            border: '1px solid rgba(255, 255, 255, 0.7)'
          }}>
            <Zap size={22} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                VoltFlow
              </span>
              <span style={{
                fontSize: '0.68rem',
                background: 'rgba(255, 107, 87, 0.12)',
                color: '#ff5742',
                border: '1px solid rgba(255, 107, 87, 0.3)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 800,
                letterSpacing: '0.04em'
              }}>
                CSMS v1.0
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              EV Charging Station Management System
            </div>
          </div>
        </div>

        {/* Center Nav Links - Neumorphic Segmented Pill Track */}
        <div className="neu-segmented-track" style={{ padding: '4px 6px' }}>
          {(role === 'driver' || role === 'guest') && (
            <>
              <button
                onClick={() => onNavigate('finder')}
                className={`neu-segmented-item ${currentView === 'finder' ? 'active' : ''}`}
              >
                Find Stations
              </button>
              {user && (
                <>
                  <button
                    onClick={() => onNavigate('bookings')}
                    className={`neu-segmented-item ${currentView === 'bookings' ? 'active' : ''}`}
                  >
                    My Bookings
                  </button>
                  <button
                    onClick={() => onNavigate('garage')}
                    className={`neu-segmented-item ${currentView === 'garage' ? 'active' : ''}`}
                  >
                    EV Garage & Cards
                  </button>
                </>
              )}
            </>
          )}

          {role === 'operator' && (
            <button
              onClick={() => onNavigate('operator')}
              className={`neu-segmented-item ${currentView === 'operator' ? 'active' : ''}`}
            >
              Operator Control Hub
            </button>
          )}

          {role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`neu-segmented-item ${currentView === 'admin' ? 'active' : ''}`}
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
                background: 'var(--primary-gradient)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                borderRadius: '999px',
                padding: '7px 16px',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 16px var(--primary-glow), var(--neu-raised-sm)',
                animation: 'neu-pulse-glow 2s infinite'
              }}
            >
              <BatteryCharging size={16} color="white" />
              <span>Session In Progress</span>
            </button>
          )}

          {/* Guided Tour Launcher (UD-2) */}
          <button
            onClick={onOpenWalkthrough}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
            title="Guided Booking Walkthrough (UD-2)"
          >
            <Compass size={15} color="#ff6b57" />
            <span>Walkthrough</span>
          </button>

          {/* Help button (UD-1 & UI-2) */}
          <button
            onClick={onOpenHelp}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem' }}
            title="Online Help & FAQ (UD-1)"
          >
            <HelpCircle size={16} color="var(--text-main)" />
          </button>

          {/* Sign In button for guests */}
          {!user && (
            <button
              onClick={onOpenAuth}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Sign In
            </button>
          )}

          {/* Role Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="btn-secondary"
              style={{
                padding: '6px 14px',
                gap: '10px'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: role === 'admin' ? '#d97706' : role === 'operator' ? '#0284c7' : role === 'driver' ? '#059669' : '#ff6b57',
                boxShadow: '0 0 6px currentColor'
              }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, lineHeight: 1.1, fontSize: '0.88rem', color: 'var(--text-heading)' }}>
                  {user ? user.name.split(' ')[0] : 'Guest User'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 600 }}>
                  {role}
                </div>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {/* Dropdown Menu */}
            {showRoleMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '290px',
                background: 'var(--bg-surface)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--neu-raised-lg)',
                padding: '10px',
                zIndex: 1000,
                animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(180, 170, 160, 0.25)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    Switch Demo User Preset:
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: user?.email === p.email ? 'var(--primary-gradient)' : 'var(--bg-sunken)',
                        border: '1px solid rgba(255, 255, 255, 0.5)',
                        boxShadow: user?.email === p.email ? '0 0 12px var(--primary-glow)' : 'var(--neu-sunken)',
                        color: user?.email === p.email ? '#ffffff' : 'var(--text-main)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.label}</div>
                        <div style={{ fontSize: '0.72rem', color: user?.email === p.email ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted)' }}>
                          {p.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(180, 170, 160, 0.25)', marginTop: '10px', paddingTop: '8px' }}>
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
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onOpenAuth();
                        setShowRoleMenu(false);
                      }}
                      className="btn-primary"
                      style={{ width: '100%', padding: '9px', fontSize: '0.88rem' }}
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
