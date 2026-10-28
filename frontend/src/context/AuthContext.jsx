import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const DEMO_PRESETS = [
  {
    label: 'Driver (Alex Rivera)',
    email: 'driver@evtravel.com',
    password: 'Driver@123',
    role: 'driver',
    desc: 'EV Driver with Tesla Model 3 & Hyundai Ioniq 5'
  },
  {
    label: 'Driver (Siddh Sakariya)',
    email: 'siddh@example.com',
    password: 'Driver@123',
    role: 'driver',
    desc: 'Project Lead with Tata Nexon & Punch EV'
  },
  {
    label: 'Driver (Het Salot)',
    email: 'het@example.com',
    password: 'Driver@123',
    role: 'driver',
    desc: 'Project Co-Author with MG ZS & Mahindra'
  },
  {
    label: 'Driver (Priya Sharma)',
    email: 'priya@evtravel.com',
    password: 'Driver@123',
    role: 'driver',
    desc: 'EV Driver with Kia EV6 & BMW i4'
  },
  {
    label: 'Station Operator (VoltCharge Networks)',
    email: 'operator@chargehub.com',
    password: 'Operator@123',
    role: 'operator',
    desc: 'Approved Station Operator managing 5 charging hubs'
  },
  {
    label: 'Station Operator (GreenPower - Pending)',
    email: 'greenpower@ev.org',
    password: 'Operator@123',
    role: 'operator',
    desc: 'Pending Approval (test Admin approval workflow)'
  },
  {
    label: 'Station Operator (Zenith Hubs)',
    email: 'zenith@gridtech.in',
    password: 'Operator@123',
    role: 'operator',
    desc: 'Operator managing Lower Parel Phoenix SpeedHub'
  },
  {
    label: 'System Administrator',
    email: 'admin@evcharge.com',
    password: 'Admin@123',
    role: 'admin',
    desc: 'Platform Administrator with full oversight'
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('csms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('csms_token') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token && user) {
      localStorage.setItem('csms_token', token);
      localStorage.setItem('csms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('csms_token');
      localStorage.removeItem('csms_user');
    }
  }, [token, user]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setToken(data.token);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, code) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('csms_token');
    localStorage.removeItem('csms_user');
  };

  // Quick preset login helper
  const switchPreset = async (preset) => {
    try {
      return await login(preset.email, preset.password);
    } catch (err) {
      console.error('Preset login error:', err);
      throw err;
    }
  };

  const authFetch = (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        role: user?.role || 'guest',
        loading,
        error,
        login,
        register,
        verifyOtp,
        logout,
        switchPreset,
        authFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
