import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import AdminLayout from '../components/AdminLayout.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Trash2, Eye, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['processing', 'shipped', 'delivered'];
const STATUS_COLORS = {
  processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    async function fetchOrders() {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchOrders();
  }, []);

  const updateStatus = async (orderId, status) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { orderStatus: status });
      setOrders((o) => o.map((x) => x.id === orderId ? { ...x, orderStatus: status } : x));
      toast.success('Order status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!confirm('Delete this order?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setOrders((o) => o.filter((x) => x.id !== orderId));
      toast.success('Order deleted');
    } catch {
      toast.error('Failed to delete order');
    }
  };

  const filtered = filterStatus === 'all' ? orders : orders.filter((o) => (o.orderStatus || 'processing') === filterStatus);

  return (
    <AdminLayout title="Order Management">
      <div className="flex items-center justify-between mb-6">
        <p className="text-surface-500 text-sm">{filtered.length} orders</p>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input w-auto text-sm">
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner className="py-20" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="text-left p-4 text-surface-500 font-medium">Order ID</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Date</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Items</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Payment</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Status</th>
                  <th className="text-right p-4 text-surface-500 font-medium">Total</th>
                  <th className="text-right p-4 text-surface-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="7" className="text-center p-12 text-surface-400">No orders found</td></tr>
                ) : filtered.map((order) => (
                  <tr key={order.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="p-4 font-mono text-xs">{order.id.slice(-8).toUpperCase()}</td>
                    <td className="p-4 text-surface-500">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="p-4">{order.items?.length}</td>
                    <td className="p-4">
                      <span className={`badge ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-amber-100 text-amber-700'}`}>
                        {order.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={order.orderStatus || 'processing'}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_COLORS[order.orderStatus || 'processing']}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s} className="bg-white dark:bg-surface-900 text-surface-900">{s}</option>)}
                      </select>
                    </td>
                    <td className="p-4 text-right font-medium">${order.totalPrice?.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedOrder(order)} className="p-1.5 text-surface-500 hover:text-primary-500 transition-colors">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => deleteOrder(order.id)} className="p-1.5 text-surface-500 hover:text-red-500 transition-colors">
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

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
              <h2 className="font-display font-bold text-xl">Order #{selectedOrder.id.slice(-8).toUpperCase()}</h2>
              <button onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-surface-500 uppercase tracking-wide mb-3">Items</h3>
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex gap-3 mb-2">
                    <img src={item.image || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-surface-500">×{item.quantity} — ${item.price?.toFixed(2)}</p>
                    </div>
                    <span className="text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {selectedOrder.shippingAddress && (
                <div>
                  <h3 className="font-semibold text-sm text-surface-500 uppercase tracking-wide mb-2">Shipping</h3>
                  <address className="not-italic text-sm text-surface-600 dark:text-surface-300">
                    <p>{selectedOrder.shippingAddress.name}</p>
                    <p>{selectedOrder.shippingAddress.line1}</p>
                    <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.zip}</p>
                  </address>
                </div>
              )}
              <div className="border-t border-surface-200 dark:border-surface-700 pt-4 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary-500">${selectedOrder.totalPrice?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
