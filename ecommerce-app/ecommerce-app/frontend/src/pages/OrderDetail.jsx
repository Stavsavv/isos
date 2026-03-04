import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { ArrowLeft, MapPin, Package, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STEPS = ['processing', 'shipped', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      const snap = await getDoc(doc(db, 'orders', id));
      if (snap.exists() && snap.data().userId === user?.uid) {
        setOrder({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    }
    fetchOrder();
  }, [id, user]);

  if (loading) return <LoadingSpinner className="min-h-[60vh]" />;
  if (!order) return (
    <div className="page-container py-20 text-center">
      <h2 className="font-display text-2xl font-bold mb-4">Order not found</h2>
      <Link to="/profile" className="btn-primary">Back to Profile</Link>
    </div>
  );

  const stepIndex = STATUS_STEPS.indexOf(order.orderStatus || 'processing');

  return (
    <div className="page-container py-8 animate-fade-in">
      <Link to="/profile" className="flex items-center gap-2 text-surface-500 hover:text-surface-900 dark:hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Profile
      </Link>

      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-bold">Order #{id.slice(-8).toUpperCase()}</h1>
        <span className="text-surface-500 text-sm">
          {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMMM d, yyyy') : ''}
        </span>
      </div>

      {/* Status tracker */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-6 flex items-center gap-2"><Package size={18} className="text-primary-500" /> Order Status</h2>
        <div className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex flex-col items-center ${i < STATUS_STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${i <= stepIndex ? 'bg-primary-500 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-500'}`}>
                  {i + 1}
                </div>
                <span className={`text-xs mt-2 capitalize font-medium ${i <= stepIndex ? 'text-primary-500' : 'text-surface-400'}`}>{step}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 -mt-5 ${i < stepIndex ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Items */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Items Ordered</h2>
          <div className="space-y-4">
            {order.items?.map((item, i) => (
              <div key={i} className="flex gap-3">
                <img src={item.image || 'https://via.placeholder.com/50'} alt={item.name} className="w-14 h-14 object-cover rounded-lg" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-surface-500 text-xs">Qty: {item.quantity} × ${item.price?.toFixed(2)}</p>
                  {item.shotNumber && (
                    <p className="text-surface-500 text-xs">Νούμερο: {item.shotNumber}</p>
                  )}
                </div>
                <span className="font-semibold text-sm">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-200 dark:border-surface-700 mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary-500">${order.totalPrice?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping + Payment */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><MapPin size={16} className="text-primary-500" /> Shipping Address</h2>
            {order.shippingAddress ? (
              <address className="not-italic text-sm text-surface-600 dark:text-surface-300 space-y-1">
                <p className="font-medium text-surface-900 dark:text-white">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </address>
            ) : <p className="text-surface-500 text-sm">No address on file</p>}
          </div>
          <div className="card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><CreditCard size={16} className="text-primary-500" /> Payment</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Status</span>
                <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-green-500' : 'text-amber-500'}`}>
                  {order.paymentStatus === 'paid' ? '✓ Paid' : 'Pending'}
                </span>
              </div>
              {order.stripeSessionId && (
                <div className="flex justify-between">
                  <span className="text-surface-500">Transaction</span>
                  <span className="font-mono text-xs">{order.stripeSessionId.slice(-12)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
