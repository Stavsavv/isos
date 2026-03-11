import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { CreditCard, MapPin, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EUROPE_COUNTRIES, formatCurrency, getApiUrl } from '../config/app.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const initialAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: 'GR',
};

export default function Checkout() {
  const { items, subtotal, discount, total, coupon } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState(initialAddress);
  const [processing, setProcessing] = useState(false);

  const shipping = subtotal >= 50 ? 0 : 4.99;
  const grandTotal = total + shipping;

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const update = (field) => (event) => setAddress({ ...address, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProcessing(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(getApiUrl('/api/createCheckoutSession'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items,
          shippingAddress: address,
          couponCode: coupon?.code,
          successUrl: `${window.location.origin}/profile?order=success`,
          cancelUrl: `${window.location.origin}/checkout`,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to create checkout session');
      }

      const result = await response.json();
      const sessionId = result?.sessionId;
      const orderId = result?.orderId;

      if (!sessionId) {
        throw new Error('Missing Stripe session id');
      }

      if (orderId) {
        localStorage.setItem('pendingOrderId', orderId);
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe is not configured correctly');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const fieldClass = 'input';

  return (
    <div className="page-container py-8 animate-fade-in">
      <h1 className="section-title mb-8">Checkout</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="card p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <MapPin size={18} className="text-primary-500" /> Shipping Address
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Full Name *</label>
                <input required value={address.name} onChange={update('name')} className={fieldClass} placeholder="John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Address Line 1 *</label>
                <input required value={address.line1} onChange={update('line1')} className={fieldClass} placeholder="123 Main St" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Address Line 2</label>
                <input value={address.line2} onChange={update('line2')} className={fieldClass} placeholder="Apt 4B (optional)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">City *</label>
                  <input required value={address.city} onChange={update('city')} className={fieldClass} placeholder="Athens" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">State / Region *</label>
                  <input required value={address.state} onChange={update('state')} className={fieldClass} placeholder="Attica" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">ZIP Code *</label>
                  <input required value={address.zip} onChange={update('zip')} className={fieldClass} placeholder="10552" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Country</label>
                  <select value={address.country} onChange={update('country')} className={fieldClass}>
                    {EUROPE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 border-t border-surface-200 pt-5 dark:border-surface-700">
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-300">
                    <CreditCard size={16} /> Test Payment Card
                  </p>
                  <p className="mt-1 font-mono text-blue-600 dark:text-blue-400">4242 4242 4242 4242</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Exp: any future date, CVV: any 3 digits</p>
                </div>
                <button type="submit" disabled={processing} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base">
                  {processing ? (
                    <>
                      <LoadingSpinner size="sm" /> Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} /> Pay {formatCurrency(grandTotal)}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <div className="card p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
              <ShoppingBag size={18} className="text-primary-500" /> Order Summary
            </h2>
            <div className="mb-5 space-y-3">
              {items.map((item) => (
                <div key={item.cartItemId || item.id} className="flex gap-3">
                  <img src={item.image || 'https://via.placeholder.com/50'} alt={item.name} className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-surface-500">Qty: {item.quantity}</p>
                    {item.shotNumber ? (
                      <p className="text-xs text-surface-500">Shot number: {item.shotNumber}</p>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-surface-200 pt-4 text-sm dark:border-surface-700">
              <div className="flex justify-between">
                <span className="text-surface-500">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-green-600">
                  <span>Discount {coupon ? `(${coupon.code})` : ''}</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-surface-500">Shipping</span>
                <span className={shipping === 0 ? 'text-green-600' : ''}>
                  {shipping === 0 ? 'FREE' : formatCurrency(shipping)}
                </span>
              </div>
              <div className="flex justify-between border-t border-surface-200 pt-2 text-base font-bold dark:border-surface-700">
                <span>Total</span>
                <span className="text-primary-500">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
