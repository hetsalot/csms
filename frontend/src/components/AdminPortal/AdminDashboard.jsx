import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Zap, CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Lock, Unlock, FileText, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export default function AdminDashboard() {
  const { authFetch, user } = useAuth();
  const { addEventListener } = useWebSocket();

  const [activeTab, setActiveTab] = useState('overview'); // overview, users, stations, audit
  const [overview, setOverview] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [stationsList, setStationsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [ovRes, uRes, sRes, aRes] = await Promise.all([
        authFetch('/api/admin/overview'),
        authFetch('/api/admin/users'),
        authFetch('/api/admin/stations'),
        authFetch('/api/admin/audit-logs?limit=100')
      ]);

      setOverview(await ovRes.json());
      setUsersList(await uRes.json() || []);
      setStationsList(await sRes.json() || []);
      setAuditLogs(await aRes.json() || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();

    const removeListener = addEventListener((event) => {
      if (['USER_STATUS_CHANGED', 'STATION_APPROVAL_CHANGED', 'NEW_BOOKING'].includes(event.type)) {
        loadAdminData();
      }
    });

    return () => removeListener();
  }, []);

  // Account.Deactivate (SE-6 & Account.Deactivate: cancels pending bookings)
  const handleToggleUserStatus = async (targetUser) => {
    const isDeactivating = targetUser.status === 'active';
    const actionStr = isDeactivating ? 'deactivate' : 'activate';

    if (!window.confirm(`Are you sure you want to ${actionStr} ${targetUser.name}? ${isDeactivating ? 'Any active bookings will be automatically canceled.' : ''}`)) return;

    try {
      const endpoint = isDeactivating ? `/api/admin/users/${targetUser.id}/deactivate` : `/api/admin/users/${targetUser.id}/activate`;
      const res = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Admin panel manual override' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionStr} user`);
      alert(data.message);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Account.Register.Operator approval review
  const handleReviewOperator = async (operatorId, action) => {
    try {
      const res = await authFetch(`/api/admin/users/${operatorId}/review-operator`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review operator');
      alert(data.message);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Station.Approval: Approve, reject, or suspend station
  const handleReviewStation = async (stationId, status) => {
    try {
      const res = await authFetch(`/api/admin/stations/${stationId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review station');
      alert(data.message);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered users
  const filteredUsers = usersList.filter(u => {
    if (userRoleFilter && u.role !== userRoleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            System Administrator Oversight
          </span>
          <h2 style={{ fontSize: '1.5rem', color: '#f8fafc', marginTop: '2px' }}>
            CSMS Central Command & Governance Portal
          </h2>
        </div>

        <button onClick={loadAdminData} className="btn-secondary" style={{ padding: '8px 14px' }}>
          <RefreshCw size={16} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
        {[
          { key: 'overview', label: 'Platform Analytics', icon: Activity },
          { key: 'users', label: `Users & Approvals (${usersList.length})`, icon: Users },
          { key: 'stations', label: `Station Approvals (${stationsList.length})`, icon: Zap },
          { key: 'audit', label: `Audit Trail Logs (SE-6)`, icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: activeTab === tab.key ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: activeTab === tab.key ? '#34d399' : '#94a3b8',
                border: activeTab === tab.key ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '8px 16px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Platform Overview & System Health */}
      {activeTab === 'overview' && overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px'
          }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Users</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                {overview.users.total}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                {overview.users.drivers} Drivers • {overview.users.operators} Operators ({overview.users.pendingOperators} Pending)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Concurrent Users (Peak Window)</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                ~{overview.concurrentUsersEstimate}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                Target: &gt;2,000 capacity (PE-1)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Total Revenue Captured</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                ₹{overview.financials.totalRevenue.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                {overview.bookings.total} lifetime bookings
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Stations & Infrastructure</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                {overview.stations.approved} Approved
              </div>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>
                {overview.stations.pending} pending approval
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '16px' }}>
              Charging Infrastructure Status (OCPP 2.0.1 Health)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {overview.chargers.byStatus.map(st => (
                <div key={st.status} style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)'
                }}>
                  <span className={`status-badge ${st.status}`}>● {st.status}</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
                    {st.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Users & Operator Approvals (Account.Register.Operator & Account.Deactivate) */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>User Accounts Management</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Review registered Drivers, Station Operators, and System Admins. Deactivation prevents login and cancels pending bookings (Account.Deactivate).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search by name, email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '220px', padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                style={{ width: '140px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="">All Roles</option>
                <option value="driver">Drivers</option>
                <option value="operator">Station Operators</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>User / Organization</th>
                  <th style={{ padding: '10px 8px' }}>Role</th>
                  <th style={{ padding: '10px 8px' }}>Contact</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Administrative Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <strong style={{ color: '#f8fafc' }}>{u.name}</strong>
                      {u.organization_name && (
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{u.organization_name}</div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.id}</div>
                    </td>
                    <td style={{ padding: '12px 8px', textTransform: 'capitalize', color: '#cbd5e1' }}>
                      {u.role}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#94a3b8' }}>
                      <div>{u.email}</div>
                      <div style={{ fontSize: '0.75rem' }}>{u.phone}</div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`status-badge ${u.status === 'active' ? 'available' : u.status === 'pending_approval' ? 'reserved' : 'faulted'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      {/* Operator pending approval workflow */}
                      {u.role === 'operator' && u.status === 'pending_approval' ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleReviewOperator(u.id, 'approved')}
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewOperator(u.id, 'rejected')}
                            className="btn-danger"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : u.role !== 'admin' ? (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={u.status === 'active' ? 'btn-danger' : 'btn-primary'}
                          style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                        >
                          {u.status === 'active' ? 'Deactivate (SE-6)' : 'Reactivate'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Admin Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: Station Approvals Center (Station.Approval) */}
      {activeTab === 'stations' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Charging Station Approvals (Station.Approval)</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Per SRS: A newly created station remains in "Pending Approval" status and does NOT appear in Driver search results until approved by an Administrator.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {stationsList.map(stn => (
              <div
                key={stn.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{stn.name}</h4>
                    <span className={`status-badge ${stn.approval_status === 'approved' ? 'available' : stn.approval_status === 'pending approval' ? 'reserved' : 'faulted'}`}>
                      {stn.approval_status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '3px' }}>
                    {stn.address} • Operating: {stn.operating_hours}
                  </p>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
                    Operator: <strong style={{ color: '#38bdf8' }}>{stn.operator_name}</strong> ({stn.operator_email}) • Chargers: <strong>{stn.chargers.length} bays deployed</strong>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {stn.approval_status !== 'approved' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'approved')}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      Approve Station
                    </button>
                  )}
                  {stn.approval_status !== 'suspended' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'suspended')}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.85rem', color: '#f59e0b' }}
                    >
                      Suspend
                    </button>
                  )}
                  {stn.approval_status !== 'rejected' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'rejected')}
                      className="btn-danger"
                      style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 4: Audit Logs (SE-6) */}
      {activeTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>System Audit Trail (Security SE-6)</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Immutable audit log of all administrative actions, account changes, approvals, and financial transactions.
            </p>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                  <th style={{ padding: '8px' }}>Action</th>
                  <th style={{ padding: '8px' }}>Actor</th>
                  <th style={{ padding: '8px' }}>Target</th>
                  <th style={{ padding: '8px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#f8fafc' }}>
                      {log.user_name} <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({log.user_role})</span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#38bdf8' }}>
                      {log.target_type}: {log.target_id}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
