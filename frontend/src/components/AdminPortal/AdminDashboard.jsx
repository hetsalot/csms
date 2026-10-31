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

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        if (ovData && ovData.users) setOverview(ovData);
      }
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsersList(Array.isArray(uData) ? uData : []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setStationsList(Array.isArray(sData) ? sData : []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAuditLogs(Array.isArray(aData) ? aData : []);
      }
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
  const safeUsers = Array.isArray(usersList) ? usersList : [];
  const filteredUsers = safeUsers.filter(u => {
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
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            System Administrator Oversight
          </span>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--text-heading)', marginTop: '2px', fontWeight: 800 }}>
            CSMS Central Command & Governance Portal
          </h2>
        </div>

        <button onClick={loadAdminData} className="btn-secondary" style={{ padding: '10px 16px' }}>
          <RefreshCw size={16} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Tabs Bar - Neumorphic Segmented Track */}
      <div className="neu-segmented-track" style={{ alignSelf: 'flex-start', flexWrap: 'wrap', maxWidth: '100%' }}>
        {[
          { key: 'overview', label: 'Platform Analytics', icon: Activity },
          { key: 'users', label: `Users & Approvals (${usersList.length})`, icon: Users },
          { key: 'stations', label: `Station Approvals (${stationsList.length})`, icon: Zap },
          { key: 'audit', label: `Audit Trail Logs (SE-6)`, icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`neu-segmented-item ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '0.85rem'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Platform Overview & System Health */}
      {activeTab === 'overview' && overview && overview.users && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div className="glass-panel" style={{ padding: '22px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Users</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '6px' }}>
                {overview?.users?.total ?? 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {overview?.users?.drivers ?? 0} Drivers • {overview?.users?.operators ?? 0} Operators ({overview?.users?.pendingOperators ?? 0} Pending)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '22px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Concurrent Users (Peak Window)</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '6px' }}>
                ~{overview?.concurrentUsersEstimate ?? 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Target: &gt;2,000 capacity (PE-1)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '22px' }}>
              <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>Total Revenue Captured</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>
                ₹{overview?.financials?.totalRevenue ? Number(overview.financials.totalRevenue).toFixed(2) : '0.00'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {overview?.bookings?.total ?? 0} lifetime bookings
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '22px' }}>
              <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Stations & Infrastructure</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '6px' }}>
                {overview?.stations?.approved ?? 0} Approved
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>
                {overview?.stations?.pending ?? 0} pending approval
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="glass-panel" style={{ padding: '26px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800, marginBottom: '18px' }}>
              Charging Infrastructure Status (OCPP 2.0.1 Health)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
              {(overview?.chargers?.byStatus || []).map(st => (
                <div key={st.status} style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'var(--bg-sunken)',
                  boxShadow: 'var(--neu-sunken-sm)'
                }}>
                  <span className={`status-badge ${st.status}`}>● {st.status}</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-heading)', marginTop: '10px' }}>
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
        <div className="glass-panel" style={{ padding: '26px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>User Accounts Management</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Review registered Drivers, Station Operators, and System Admins. Deactivation prevents login and cancels pending bookings (Account.Deactivate).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Search by name, email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ width: '220px', padding: '9px 14px', fontSize: '0.85rem' }}
              />
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                style={{ width: '150px', padding: '9px 14px', fontSize: '0.85rem' }}
              >
                <option value="">All Roles</option>
                <option value="driver">Drivers</option>
                <option value="operator">Station Operators</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto', background: 'var(--bg-sunken)', borderRadius: '16px', padding: '12px', boxShadow: 'var(--neu-sunken-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(0, 0, 0, 0.08)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700 }}>
                  <th style={{ padding: '12px 10px' }}>User / Organization</th>
                  <th style={{ padding: '12px 10px' }}>Role</th>
                  <th style={{ padding: '12px 10px' }}>Contact</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Administrative Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                    <td style={{ padding: '14px 10px' }}>
                      <strong style={{ color: 'var(--text-heading)', fontSize: '0.95rem' }}>{u.name}</strong>
                      {u.organization_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{u.organization_name}</div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.id}</div>
                    </td>
                    <td style={{ padding: '14px 10px', textTransform: 'capitalize', color: 'var(--text-body)', fontWeight: 600 }}>
                      {u.role}
                    </td>
                    <td style={{ padding: '14px 10px', color: 'var(--text-muted)' }}>
                      <div style={{ color: 'var(--text-body)' }}>{u.email}</div>
                      <div style={{ fontSize: '0.8rem' }}>{u.phone}</div>
                    </td>
                    <td style={{ padding: '14px 10px' }}>
                      <span className={`status-badge ${u.status === 'active' ? 'available' : u.status === 'pending_approval' ? 'reserved' : 'faulted'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                      {/* Operator pending approval workflow */}
                      {u.role === 'operator' && u.status === 'pending_approval' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleReviewOperator(u.id, 'approved')}
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewOperator(u.id, 'rejected')}
                            className="btn-danger"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : u.role !== 'admin' ? (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={u.status === 'active' ? 'btn-danger' : 'btn-primary'}
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          {u.status === 'active' ? 'Deactivate (SE-6)' : 'Reactivate'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Admin Protected</span>
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
        <div className="glass-panel" style={{ padding: '26px' }}>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>Charging Station Approvals (Station.Approval)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Per SRS: A newly created station remains in "Pending Approval" status and does NOT appear in Driver search results until approved by an Administrator.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stationsList.map(stn => (
              <div
                key={stn.id}
                style={{
                  background: 'var(--bg-sunken)',
                  boxShadow: 'var(--neu-sunken-sm)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ fontSize: '1.15rem', color: 'var(--text-heading)', fontWeight: 800 }}>{stn.name}</h4>
                    <span className={`status-badge ${stn.approval_status === 'approved' ? 'available' : stn.approval_status === 'pending approval' ? 'reserved' : 'faulted'}`}>
                      {stn.approval_status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {stn.address} • Operating: <strong style={{ color: 'var(--text-body)' }}>{stn.operating_hours}</strong>
                  </p>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', marginTop: '6px' }}>
                    Operator: <strong style={{ color: 'var(--primary)' }}>{stn.operator_name}</strong> ({stn.operator_email}) • Chargers: <strong>{stn.chargers.length} bays deployed</strong>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {stn.approval_status !== 'approved' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'approved')}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      Approve Station
                    </button>
                  )}
                  {stn.approval_status !== 'suspended' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'suspended')}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#b45309' }}
                    >
                      Suspend
                    </button>
                  )}
                  {stn.approval_status !== 'rejected' && (
                    <button
                      onClick={() => handleReviewStation(stn.id, 'rejected')}
                      className="btn-danger"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
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
        <div className="glass-panel" style={{ padding: '26px' }}>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)', fontWeight: 800 }}>System Audit Trail (Security SE-6)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Immutable audit log of all administrative actions, account changes, approvals, and financial transactions.
            </p>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto', background: 'var(--bg-sunken)', borderRadius: '16px', padding: '12px', boxShadow: 'var(--neu-sunken-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(0, 0, 0, 0.08)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 700 }}>
                  <th style={{ padding: '10px 8px' }}>Timestamp</th>
                  <th style={{ padding: '10px 8px' }}>Action</th>
                  <th style={{ padding: '10px 8px' }}>Actor</th>
                  <th style={{ padding: '10px 8px' }}>Target</th>
                  <th style={{ padding: '10px 8px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        background: 'var(--bg-surface)',
                        boxShadow: 'var(--neu-raised-sm)',
                        color: 'var(--primary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-heading)', fontWeight: 600 }}>
                      {log.user_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>({log.user_role})</span>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--primary)', fontWeight: 600 }}>
                      {log.target_type}: {log.target_id}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-body)' }}>
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
