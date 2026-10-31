import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, Building, KeyRound, Shield, CheckCircle2 } from 'lucide-react';
import { useAuth, DEMO_PRESETS } from '../context/AuthContext';

export default function AuthModal({ onClose, initialMode = 'login' }) {
  const { login, register, verifyOtp, switchPreset } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'verify', 'forgot'
  const [role, setRole] = useState('driver'); // 'driver' or 'operator'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 98');
  const [organizationName, setOrganizationName] = useState('');
  const [otpCode, setOtpCode] = useState('123456');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        const res = await register({ name, email, phone, password, role, organizationName });
        setSuccessMsg(res.message);
        setMode('verify');
      } else if (mode === 'verify') {
        const res = await verifyOtp(email, otpCode);
        setSuccessMsg(res.message);
        setMode('login');
      } else if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSuccessMsg(`Reset code generated! Use code: ${data.sampleResetCode}`);
        setOtpCode(data.sampleResetCode || '654321');
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: otpCode, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSuccessMsg('Password reset successful! You can now log in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (preset) => {
    try {
      setLoading(true);
      setError(null);
      await switchPreset(preset);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(180, 170, 160, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-sunken)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#ff6b57', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CSMS Security Gateway
            </span>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-heading)', marginTop: '2px', fontWeight: 800 }}>
              {mode === 'login' && 'Sign In to Your Account'}
              {mode === 'register' && `Register as ${role === 'driver' ? 'EV Driver' : 'Station Operator'}`}
              {mode === 'verify' && 'Verify Email Verification Code'}
              {mode === 'forgot' && 'Reset Account Password'}
              {mode === 'reset' && 'Set New Password'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px' }}>
          
          {error && (
            <div style={{
              background: 'rgba(225, 29, 72, 0.1)',
              border: '1px solid rgba(225, 29, 72, 0.3)',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '18px'
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(5, 150, 105, 0.12)',
              border: '1px solid #059669',
              color: '#059669',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              fontWeight: 700,
              marginBottom: '18px'
            }}>
              ✓ {successMsg}
            </div>
          )}

          {/* Quick Demo Presets Bar */}
          {mode === 'login' && (
            <div style={{ marginBottom: '22px', background: 'var(--bg-sunken)', boxShadow: 'var(--neu-sunken)', border: '1px solid rgba(255, 255, 255, 0.6)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: '#ff6b57', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚡ Quick 1-Click Role Login:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                {DEMO_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="btn-secondary"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-heading)' }}>{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            
            {mode === 'register' && (
              <>
                <div className="neu-segmented-track" style={{ width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    className={`neu-segmented-item ${role === 'driver' ? 'active' : ''}`}
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    Driver Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('operator')}
                    className={`neu-segmented-item ${role === 'operator' ? 'active' : ''}`}
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    Station Operator
                  </button>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label>Full Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Siddh Sakariya" />
                </div>

                {role === 'operator' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label>Company / Organization Name (Account.Register.Operator)</label>
                    <input type="text" required value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="e.g. EcoVolt Charging Corp" />
                  </div>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <label>Phone Number</label>
                  <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </>
            )}

            {mode !== 'verify' && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label>Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="driver@evtravel.com" />
                </div>

                {mode === 'reset' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label>6-Digit Reset Code (sample: 654321)</label>
                    <input type="text" required value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="654321" />
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div style={{ marginBottom: '18px' }}>
                    <label>{mode === 'reset' ? 'New Password' : 'Password'}</label>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                )}
              </>
            )}

            {mode === 'verify' && (
              <div style={{ marginBottom: '20px' }}>
                <label>6-Digit Verification Code (Account.Register.Verify)</label>
                <input type="text" required value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="123456" style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.3rem', fontWeight: 800 }} />
                <div style={{ fontSize: '0.78rem', color: '#ff6b57', marginTop: '6px', fontWeight: 700 }}>
                  Sample demo code: <strong>123456</strong>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.98rem' }}>
              {loading ? 'Processing...' : (
                mode === 'login' ? 'Sign In' :
                mode === 'register' ? 'Register Account' :
                mode === 'verify' ? 'Verify & Activate' : 
                mode === 'reset' ? 'Save New Password' : 'Send Reset Link'
              )}
            </button>
          </form>

          {/* Toggle modes */}
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {mode === 'login' ? (
              <>
                <span onClick={() => setMode('register')} style={{ color: '#ff6b57', cursor: 'pointer', fontWeight: 700 }}>
                  Need an account? Register
                </span>
                <span onClick={() => setMode('forgot')} style={{ color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                  Forgot Password?
                </span>
              </>
            ) : (
              <span onClick={() => setMode('login')} style={{ color: '#ff6b57', cursor: 'pointer', fontWeight: 700 }}>
                Already have an account? Sign In
              </span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
