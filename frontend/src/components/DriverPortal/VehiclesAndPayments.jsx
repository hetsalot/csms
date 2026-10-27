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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      
      {/* 1. Vehicles Section (Account.Vehicle.Add) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc' }}>Registered EV Garage</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Vehicles used for automated connector filtering</p>
          </div>
          <button onClick={() => setShowVehicleModal(true)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Plus size={16} />
            <span>Add EV</span>
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            No vehicles registered yet. Click "Add EV" to register.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {vehicles.map(v => (
              <div
                key={v.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={20} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                      {v.make} {v.model}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                      Connector: <strong style={{ color: '#38bdf8' }}>{v.connector_type}</strong> • Battery: <strong style={{ color: '#34d399' }}>{v.battery_capacity} kWh</strong>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteVehicle(v.id)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Payment Methods Section (Pay.Methods.Manage & SE-3 Tokenization) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc' }}>Payment Methods</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tokenized authorization hold methods</p>
          </div>
          <button onClick={() => setShowPaymentModal(true)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Plus size={16} />
            <span>Add Method</span>
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
            No saved cards or wallets. Add one for 1-click slot booking holds.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paymentMethods.map(pm => (
              <div
                key={pm.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        {pm.provider}
                      </span>
                      {pm.is_default === 1 && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {pm.masked_number}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <ShieldCheck size={12} />
                      <span>Vault Tokenized (SE-3)</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePayment(pm.id)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div className="modal-overlay" onClick={() => setShowVehicleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>Add Electric Vehicle</h3>
              <button onClick={() => setShowVehicleModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleAddVehicle} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label>Manufacturer / Make</label>
                <input type="text" required value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Tesla, Tata, Hyundai, MG" />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Model Name</label>
                <input type="text" required value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Nexon EV, Model 3, Ioniq 5" />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Connector Type Standard</label>
                <select value={connectorType} onChange={e => setConnectorType(e.target.value)}>
                  <option value="CCS2">CCS2 (Combined Charging System 2)</option>
                  <option value="Type 2">Type 2 (AC Fast)</option>
                  <option value="GB/T">GB/T (Bharat DC Standard)</option>
                  <option value="CHAdeMO">CHAdeMO (Fast DC)</option>
                </select>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label>Battery Capacity (kWh)</label>
                <input type="number" step="0.5" required value={batteryCapacity} onChange={e => setBatteryCapacity(e.target.value)} placeholder="e.g. 40.5, 75, 50.3" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>Add Payment Method</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleAddPayment} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label>Method Type</label>
                <select value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                  <option value="credit card">Credit Card</option>
                  <option value="debit card">Debit Card</option>
                  <option value="digital wallet">Digital Wallet / UPI</option>
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label>Card Issuer / Wallet Name</label>
                <input type="text" required value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. HDFC Visa, ICICI Mastercard, Google Pay" />
              </div>
              {paymentType === 'digital wallet' ? (
                <div style={{ marginBottom: '18px' }}>
                  <label>UPI ID / Wallet Identifier</label>
                  <input type="text" required value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="e.g. driver@okhdfcbank" />
                </div>
              ) : (
                <div style={{ marginBottom: '18px' }}>
                  <label>Card Number (Simulated Tokenization)</label>
                  <input type="text" required value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="•••• •••• •••• 4242" />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
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
