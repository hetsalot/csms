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
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.7)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
              CSMS Security Gateway
            </span>
            <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginTop: '2px' }}>
              {mode === 'login' && 'Sign In to Your Account'}
              {mode === 'register' && `Register as ${role === 'driver' ? 'EV Driver' : 'Station Operator'}`}
              {mode === 'verify' && 'Verify Email Verification Code'}
              {mode === 'forgot' && 'Reset Account Password'}
              {mode === 'reset' && 'Set New Password'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#34d399',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              ✓ {successMsg}
            </div>
          )}

          {/* Quick Demo Presets Bar */}
          {mode === 'login' && (
            <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                ⚡ Quick 1-Click Role Login:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                {DEMO_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#cbd5e1',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            
            {mode === 'register' && (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('driver')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      background: role === 'driver' ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                      color: role === 'driver' ? '#fff' : '#94a3b8',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Driver Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('operator')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      background: role === 'operator' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                      color: role === 'operator' ? '#fff' : '#94a3b8',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Station Operator
                  </button>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label>Full Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Siddh Sakariya" />
                </div>

                {role === 'operator' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label>Company / Organization Name (Account.Register.Operator)</label>
                    <input type="text" required value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="e.g. EcoVolt Charging Corp" />
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <label>Phone Number</label>
                  <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </>
            )}

            {mode !== 'verify' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label>Email Address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="driver@evtravel.com" />
                </div>

                {mode === 'reset' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label>6-Digit Reset Code (sample: 654321)</label>
                    <input type="text" required value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="654321" />
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label>{mode === 'reset' ? 'New Password' : 'Password'}</label>
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                )}
              </>
            )}

            {mode === 'verify' && (
              <div style={{ marginBottom: '18px' }}>
                <label>6-Digit Verification Code (Account.Register.Verify)</label>
                <input type="text" required value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="123456" style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.2rem' }} />
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                  Sample demo code: <strong>123456</strong>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}>
              {loading ? 'Processing...' : (
                mode === 'login' ? 'Sign In' :
                mode === 'register' ? 'Register Account' :
                mode === 'verify' ? 'Verify & Activate' : 
                mode === 'reset' ? 'Save New Password' : 'Send Reset Link'
              )}
            </button>
          </form>

          {/* Toggle modes */}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
            {mode === 'login' ? (
              <>
                <span onClick={() => setMode('register')} style={{ color: '#10b981', cursor: 'pointer', fontWeight: 600 }}>
                  Need an account? Register
                </span>
                <span onClick={() => setMode('forgot')} style={{ color: '#38bdf8', cursor: 'pointer' }}>
                  Forgot Password?
                </span>
              </>
            ) : (
              <span onClick={() => setMode('login')} style={{ color: '#10b981', cursor: 'pointer', fontWeight: 600 }}>
                Already have an account? Sign In
              </span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
