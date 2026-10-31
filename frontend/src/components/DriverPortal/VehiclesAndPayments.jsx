import React, { useState, useEffect } from 'react';
import { Car, CreditCard, Plus, Trash2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function VehiclesAndPayments() {
  const { authFetch } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  // New vehicle form state
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [make, setMake] = useState('Tesla');
  const [model, setModel] = useState('Model Y');
  const [connectorType, setConnectorType] = useState('CCS2');
  const [batteryCapacity, setBatteryCapacity] = useState('75');

  // New payment form state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState('credit card');
  const [provider, setProvider] = useState('HDFC Visa Signature');
  const [cardNumber, setCardNumber] = useState('4242 8888 9999 5566');
  const [upiId, setUpiId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [vRes, pRes] = await Promise.all([
        authFetch('/api/auth/vehicles'),
        authFetch('/api/auth/payment-methods')
      ]);
      setVehicles(await vRes.json() || []);
      setPaymentMethods(await pRes.json() || []);
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/auth/vehicles', {
        method: 'POST',
        body: JSON.stringify({ make, model, connectorType, batteryCapacity })
      });
      if (!res.ok) throw new Error('Failed to add vehicle');
      setShowVehicleModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Remove this vehicle from your profile?')) return;
    try {
      await authFetch(`/api/auth/vehicles/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/auth/payment-methods', {
        method: 'POST',
        body: JSON.stringify({ type: paymentType, provider, cardNumber, upiId })
      });
      if (!res.ok) throw new Error('Failed to add payment method');
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Remove this payment method?')) return;
    try {
      await authFetch(`/api/auth/payment-methods/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetDefaultPayment = async (id) => {
    try {
      const res = await authFetch(`/api/auth/payment-methods/${id}/default`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to set default payment method');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      
      {/* 1. Vehicles Section (Account.Vehicle.Add) */}
      <div className="glass-panel" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>Registered EV Garage</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Vehicles used for automated connector filtering</p>
          </div>
          <button onClick={() => setShowVehicleModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Add EV</span>
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No vehicles registered yet. Click "Add EV" to register.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vehicles.map(v => (
              <div
                key={v.id}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--neu-raised-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Sunken Socket for Icon */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-sunken)', boxShadow: 'var(--neu-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={20} color="#ff6b57" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '0.98rem' }}>
                      {v.make} {v.model}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                      Connector: <strong style={{ color: '#ff6b57' }}>{v.connector_type}</strong> • Battery: <strong style={{ color: '#059669' }}>{v.battery_capacity} kWh</strong>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVehicle(v.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                  title="Remove vehicle"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Payment Methods Section (Pay.Methods.Manage & SE-3 Tokenization) */}
      <div className="glass-panel" style={{ padding: '26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>Payment Methods</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Tokenized authorization hold methods</p>
          </div>
          <button onClick={() => setShowPaymentModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Add Method</span>
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No saved cards or wallets. Add one for 1-click slot booking holds.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paymentMethods.map(pm => (
              <div
                key={pm.id}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--neu-raised-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Sunken Socket for Card Icon */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-sunken)', boxShadow: 'var(--neu-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} color="#ff6b57" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-heading)', fontSize: '0.98rem' }}>
                        {pm.provider}
                      </span>
                      {pm.is_default === 1 && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 600 }}>
                      {pm.masked_number}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: 700 }}>
                      <ShieldCheck size={14} />
                      <span>Vault Tokenized (SE-3)</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {pm.is_default !== 1 && (
                    <button
                      onClick={() => handleSetDefaultPayment(pm.id)}
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 700
                      }}
                      title="Set as default payment method"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePayment(pm.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                    title="Remove payment method"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div className="modal-overlay" onClick={() => setShowVehicleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(180, 170, 160, 0.25)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-heading)', fontWeight: 800 }}>Add Electric Vehicle</h3>
              <button onClick={() => setShowVehicleModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>
            <form onSubmit={handleAddVehicle} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label>Manufacturer / Make</label>
                <input type="text" required value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Tesla, Tata, Hyundai, MG" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Model Name</label>
                <input type="text" required value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Nexon EV, Model 3, Ioniq 5" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Connector Type Standard</label>
                <select value={connectorType} onChange={e => setConnectorType(e.target.value)}>
                  <option value="CCS2">CCS2 (Combined Charging System 2)</option>
                  <option value="Type 2">Type 2 (AC Fast)</option>
                  <option value="GB/T">GB/T (Bharat DC Standard)</option>
                  <option value="CHAdeMO">CHAdeMO (Fast DC)</option>
                </select>
              </div>
              <div style={{ marginBottom: '22px' }}>
                <label>Battery Capacity (kWh)</label>
                <input type="number" step="0.5" required value={batteryCapacity} onChange={e => setBatteryCapacity(e.target.value)} placeholder="e.g. 40.5, 75, 50.3" />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowVehicleModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(180, 170, 160, 0.25)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-heading)', fontWeight: 800 }}>Add Payment Method</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>
            <form onSubmit={handleAddPayment} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label>Method Type</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                  <option value="credit card">Credit Card</option>
                  <option value="debit card">Debit Card</option>
                  <option value="digital wallet">Digital Wallet / UPI</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Card Issuer / Wallet Name</label>
                <input type="text" required value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. HDFC Visa, ICICI Mastercard, Google Pay" />
              </div>
              {paymentType === 'digital wallet' ? (
                <div style={{ marginBottom: '22px' }}>
                  <label>UPI ID / Wallet Identifier</label>
                  <input type="text" required value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="e.g. driver@okhdfcbank" />
                </div>
              ) : (
                <div style={{ marginBottom: '22px' }}>
                  <label>Card Number (Simulated Tokenization)</label>
                  <input type="text" required value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="•••• •••• •••• 4242" />
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Tokenize & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
