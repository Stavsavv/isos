import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import AdminLayout from '../components/AdminLayout.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Plus, Trash2, Tag, X } from 'lucide-react';
import { format } from 'date-fns';
import { createCoupon, deleteCoupon as deleteCouponById } from '../services/adminApi.js';
import { formatCurrency } from '../config/app.js';

const initialForm = { code: '', type: 'percent', value: '', minOrder: '', maxUses: '', active: true };

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchCoupons() {
      const snap = await getDocs(query(collection(db, 'coupons'), orderBy('createdAt', 'desc')));
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchCoupons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.value) { toast.error('Please fill required fields'); return; }
    setSubmitting(true);
    try {
      const data = {
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(form.value),
        minOrder: form.minOrder ? parseFloat(form.minOrder) : 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        usedCount: 0,
        active: form.active,
      };
      const result = await createCoupon(data);
      setCoupons([{ id: result.id, ...data, createdAt: { toDate: () => new Date() } }, ...coupons]);
      toast.success('Coupon created!');
      setShowModal(false);
      setForm(initialForm);
    } catch {
      toast.error('Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await deleteCouponById(id);
      setCoupons((c) => c.filter((x) => x.id !== id));
      toast.success('Coupon deleted');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete coupon');
    }
  };

  return (
    <AdminLayout title="Coupon Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-surface-500 text-sm">{coupons.length} coupons</p>
        <button onClick={() => { setForm(initialForm); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {loading ? <LoadingSpinner className="py-20" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.length === 0 ? (
            <div className="col-span-3 card py-16 text-center">
              <Tag size={48} className="text-surface-300 mx-auto mb-4" />
              <p className="text-surface-400">No coupons yet. Create your first one!</p>
            </div>
          ) : coupons.map((coupon) => (
            <div key={coupon.id} className={`card p-5 ${!coupon.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono font-bold text-lg text-primary-500">{coupon.code}</span>
                  <span className={`badge ml-2 ${coupon.active ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-surface-100 text-surface-500'}`}>
                    {coupon.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button onClick={() => deleteCoupon(coupon.id)} className="text-surface-400 hover:text-red-500 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="space-y-1.5 text-sm text-surface-600 dark:text-surface-300">
                <p><span className="text-surface-400">Discount:</span> {coupon.type === 'percent' ? `${coupon.value}%` : `${formatCurrency(coupon.value)}`} off</p>
                {coupon.minOrder > 0 && <p><span className="text-surface-400">Min order:</span> {formatCurrency(coupon.minOrder)}</p>}
                <p><span className="text-surface-400">Used:</span> {coupon.usedCount || 0}{coupon.maxUses ? `/${coupon.maxUses}` : ''} times</p>
                <p className="text-xs text-surface-400">
                  Created {coupon.createdAt?.toDate ? format(coupon.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
              <h2 className="font-display font-bold text-xl">Create Coupon</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Coupon Code *</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input font-mono uppercase" placeholder="SAVE20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Value *</label>
                  <input required type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" placeholder={form.type === 'percent' ? '20' : '10.00'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Min Order</label>
                  <input type="number" min="0" step="0.01" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} className="input" placeholder="0 (any)" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Max Uses</label>
                  <input type="number" min="0" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className="input" placeholder="∞ (unlimited)" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-primary-500" />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {submitting && <LoadingSpinner size="sm" />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
