import { useMemo, useState } from 'react';
import { deleteUserAccount, getUsers, registerUser, updateUser } from '../lib/api.js';
import { getAuthState } from '../lib/access.js';
import { useApi } from '../hooks/useApi.js';
import { ErrorMsg, Loading } from '../components/UI.jsx';
import { useToast } from '../components/Toast.jsx';

const EMPTY_FORM = {
  id: '',
  username: '',
  password: '',
  role: 'user',
  assigned_rm: '',
  fullAccess: false,
  discrepancyView: false,
  discrepancyRmTracking: false,
  renewalView: false,
  renewalRmTracking: false,
};

function formFromUser(user) {
  const permissions = user.permissions || {};
  return {
    id: user.id,
    username: user.username,
    password: '',
    role: user.role || 'user',
    assigned_rm: user.assigned_rm || '',
    fullAccess: Boolean(permissions.fullAccess),
    discrepancyView: Boolean(permissions.discrepancy?.view),
    discrepancyRmTracking: Boolean(permissions.discrepancy?.rmTracking),
    renewalView: Boolean(permissions.renewal?.view),
    renewalRmTracking: Boolean(permissions.renewal?.rmTracking),
  };
}

function buildPayload(form) {
  return {
    username: form.username.trim(),
    ...(form.password ? { password: form.password } : {}),
    role: form.role,
    assigned_rm: form.assigned_rm.trim(),
    permissions: {
      fullAccess: form.fullAccess,
      discrepancy: {
        view: form.fullAccess || form.discrepancyView,
        rmTracking: form.fullAccess || form.discrepancyRmTracking,
      },
      renewal: {
        view: form.fullAccess || form.renewalView,
        rmTracking: form.fullAccess || form.renewalRmTracking,
      },
    },
  };
}

function permissionSummary(user) {
  if (user.role === 'admin') return 'Admin';
  if (user.permissions?.fullAccess) return 'Full access';

  const labels = [];
  if (user.permissions?.discrepancy?.view) labels.push('Discrepancy View');
  else if (user.permissions?.discrepancy?.rmTracking) labels.push('Discrepancy RM');
  if (user.permissions?.renewal?.view) labels.push('Renewal View');
  else if (user.permissions?.renewal?.rmTracking) labels.push('Renewal RM');
  return labels.join(', ') || 'No access';
}

export default function AccessControl() {
  const toast = useToast();
  const auth = getAuthState();
  const users = useApi(() => getUsers(), []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(form.id);
  const list = users.data || [];

  const sortedUsers = useMemo(
    () => [...list].sort((a, b) => a.username.localeCompare(b.username)),
    [list]
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const reset = () => setForm(EMPTY_FORM);

  const submit = async () => {
    if (!form.username.trim()) {
      toast('Username is required', 'error');
      return;
    }
    if (!editing && !form.password) {
      toast('Password is required for new users', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) {
        await updateUser(form.id, payload);
        toast(`Updated access for ${form.username}`);
      } else {
        await registerUser(payload);
        toast(`Created user ${form.username}`);
      }
      reset();
      await users.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    try {
      await deleteUserAccount(user.id);
      toast(`Deleted ${user.username}`);
      if (form.id === user.id) reset();
      await users.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Users & Access</div>
          <div className="page-desc">Create users, assign RM scope, and control which module each person can see</div>
        </div>
      </div>

      <div className="content" style={{ display: 'grid', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">{editing ? `Edit ${form.username}` : 'Create User'}</div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-control" value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{editing ? 'New Password (optional)' : 'Password'}</label>
              <input className="form-control" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-control" value={form.role} onChange={(e) => set('role', e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned RM Name</label>
              <input className="form-control" placeholder="Optional RM name for scoped access" value={form.assigned_rm} onChange={(e) => set('assigned_rm', e.target.value)} />
            </div>
            <div className="form-group full">
              <label className="form-label">Access Rights</label>
              <div style={{ display: 'grid', gap: 10, color: 'var(--text2)' }}>
                <label><input type="checkbox" checked={form.fullAccess} disabled={form.role === 'admin'} onChange={(e) => set('fullAccess', e.target.checked)} /> Full App Access</label>
                <label><input type="checkbox" checked={form.discrepancyView} disabled={form.role === 'admin' || form.fullAccess} onChange={(e) => set('discrepancyView', e.target.checked)} /> Discrepancy View</label>
                <label><input type="checkbox" checked={form.discrepancyRmTracking} disabled={form.role === 'admin' || form.fullAccess} onChange={(e) => set('discrepancyRmTracking', e.target.checked)} /> Discrepancy RM Tracking</label>
                <label><input type="checkbox" checked={form.renewalView} disabled={form.role === 'admin' || form.fullAccess} onChange={(e) => set('renewalView', e.target.checked)} /> Renewal View</label>
                <label><input type="checkbox" checked={form.renewalRmTracking} disabled={form.role === 'admin' || form.fullAccess} onChange={(e) => set('renewalRmTracking', e.target.checked)} /> Renewal RM Tracking</label>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                Admins always have full control. Full App Access gives a non-admin complete data access, while the module checkboxes keep users read-only.
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ paddingInline: 0, paddingBottom: 0 }}>
            {editing && <button className="btn" onClick={reset}>Cancel</button>}
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update User' : 'Create User'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Existing Users</div>
          </div>
          {users.loading && <Loading />}
          {users.error && <ErrorMsg msg={users.error} />}
          {!users.loading && !users.error && (
            sortedUsers.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text3)' }}>No users found yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Assigned RM</th>
                      <th>Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.username}</strong>
                          {user.username === auth.username ? (
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Current login</div>
                          ) : null}
                        </td>
                        <td>{user.role}</td>
                        <td>{user.assigned_rm || '–'}</td>
                        <td>{permissionSummary(user)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn sm" onClick={() => setForm(formFromUser(user))}>Edit</button>
                          <button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => removeUser(user)} disabled={user.username === auth.username}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
