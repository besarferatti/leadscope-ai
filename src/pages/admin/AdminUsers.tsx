import { useEffect, useState } from 'react';
import { RefreshCw, UserX, UserCheck, Trash2, Key, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { formatDate } from '../../lib/utils';
import { getPlanBadgeColor, getSubscriptionStatusColor, PLANS, CHANGEABLE_PLANS, UserProfile, PlanId } from '../../lib/plans';

type AdminUserRow = UserProfile;

interface EditModal {
  user: AdminUserRow;
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setUsers((data ?? []) as AdminUserRow[]);
    setLoading(false);
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleUpdate(userId: string, updates: Partial<AdminUserRow>) {
    setActionLoading(userId);
    const { error: err } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (err) setError(err.message);
    else { showSuccess('User updated.'); await load(); }
    setActionLoading(null);
    setEditModal(null);
  }

  async function handleDelete(userId: string) {
    setActionLoading(userId);
    const { error: err } = await supabase.from('user_profiles').delete().eq('id', userId);
    if (err) setError(err.message);
    else { showSuccess('User deleted.'); setUsers(prev => prev.filter(u => u.id !== userId)); }
    setActionLoading(null);
    setDeleteConfirm(null);
  }

  async function handleResetUsage(userId: string) {
    await handleUpdate(userId, {
      leads_used_this_month: 0,
      audits_used_this_month: 0,
      messages_used_this_month: 0,
      usage_cycle_started_at: new Date().toISOString(),
    } as Partial<AdminUserRow>);
    showSuccess('Usage reset.');
  }

  if (loading) return <LoadingSpinner message="Loading users..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-slate-400 text-sm mt-1">{users.length} total users</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">User</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Plan</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden xl:table-cell">Usage</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Joined</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200 text-sm">{u.full_name || '—'}</div>
                    <div className="text-slate-500 text-xs truncate max-w-[180px]">{u.email}</div>
                    {!u.is_active && <span className="badge bg-red-500/20 text-red-400 text-xs mt-1">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`badge text-xs ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`badge text-xs ${getPlanBadgeColor(u.current_plan)}`}>
                      {PLANS[u.current_plan]?.name ?? u.current_plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="text-slate-400 text-xs space-y-0.5">
                      <div>Leads: {u.leads_used_this_month}</div>
                      <div>Audits: {u.audits_used_this_month}</div>
                      <div>Msgs: {u.messages_used_this_month}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`badge text-xs ${getSubscriptionStatusColor(u.subscription_status)}`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditModal({ user: u })}
                        className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                        title="Edit user"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetUsage(u.id)}
                        disabled={actionLoading === u.id}
                        className="text-slate-500 hover:text-amber-400 transition-colors p-1"
                        title="Reset usage"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                        disabled={actionLoading === u.id}
                        className="text-slate-500 hover:text-emerald-400 transition-colors p-1"
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleUpdate(u.id, { must_change_password: true })}
                        disabled={actionLoading === u.id}
                        className="text-slate-500 hover:text-violet-400 transition-colors p-1"
                        title="Force password change"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(u.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-md space-y-4">
            <h3 className="text-white font-semibold">Edit User: {editModal.user.email}</h3>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Role</label>
              <select
                className="select"
                defaultValue={editModal.user.role}
                onChange={e => setEditModal(prev => prev ? { ...prev, user: { ...prev.user, role: e.target.value as 'admin' | 'user' } } : prev)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Plan</label>
              <select
                className="select"
                defaultValue={editModal.user.current_plan}
                onChange={e => setEditModal(prev => prev ? { ...prev, user: { ...prev.user, current_plan: e.target.value as PlanId } } : prev)}
              >
                {CHANGEABLE_PLANS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Status</label>
              <select
                className="select"
                defaultValue={editModal.user.subscription_status}
                onChange={e => setEditModal(prev => prev ? { ...prev, user: { ...prev.user, subscription_status: e.target.value } } : prev)}
              >
                <option value="trialing">Trialing</option>
                <option value="active">Active</option>
                <option value="trial_expired">Trial Expired</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setEditModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => handleUpdate(editModal.user.id, {
                  role: editModal.user.role,
                  current_plan: editModal.user.current_plan,
                  subscription_status: editModal.user.subscription_status,
                })}
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-2">Delete User?</h3>
            <p className="text-slate-400 text-sm mb-6">This will permanently delete this user's profile. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
