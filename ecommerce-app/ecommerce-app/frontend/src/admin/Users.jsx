import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import AdminLayout from '../components/AdminLayout.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Trash2, Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const promoteToAdmin = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`${newRole === 'admin' ? 'Promote' : 'Demote'} this user to ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers((u) => u.map((x) => x.id === userId ? { ...x, role: newRole } : x));
      toast.success(`User role updated to ${newRole}`);
    } catch {
      toast.error('Failed to update role');
    }
  };

  const deleteUser = async (userId) => {
    if (userId === currentUser?.uid) { toast.error("Can't delete yourself"); return; }
    if (!confirm('Delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers((u) => u.filter((x) => x.id !== userId));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  return (
    <AdminLayout title="User Management">
      <p className="text-surface-500 text-sm mb-6">{users.length} registered users</p>

      {loading ? <LoadingSpinner className="py-20" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="text-left p-4 text-surface-500 font-medium">User</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Email</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Role</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Joined</th>
                  <th className="text-right p-4 text-surface-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-12 text-surface-400">No users found</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name || 'Unknown'}</span>
                        {u.id === currentUser?.uid && <span className="badge bg-surface-100 dark:bg-surface-800 text-xs">(you)</span>}
                      </div>
                    </td>
                    <td className="p-4 text-surface-500">{u.email}</td>
                    <td className="p-4">
                      <span className={`badge ${u.role === 'admin' ? 'bg-primary-100 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400' : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'}`}>
                        {u.role === 'admin' ? <Shield size={10} className="inline mr-1" /> : <User size={10} className="inline mr-1" />}
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4 text-surface-500">
                      {u.createdAt?.toDate ? format(u.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => promoteToAdmin(u.id, u.role)}
                          disabled={u.id === currentUser?.uid}
                          title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                          className={`p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${u.role === 'admin' ? 'text-primary-500 hover:text-surface-500' : 'text-surface-500 hover:text-primary-500'}`}
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={u.id === currentUser?.uid}
                          className="p-1.5 text-surface-500 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
