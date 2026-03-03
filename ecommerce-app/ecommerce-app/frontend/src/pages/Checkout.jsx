import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { loadStripe } from '@stripe/stripe-js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { CreditCard, MapPin, ShoppingBag } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const initialAddress = { name: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'GR' };
const EUROPE_COUNTRIES = [
  { code: 'GR', label: 'Greece' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'IT', label: 'Italy' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'PT', label: 'Portugal' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'AT', label: 'Austria' },
  { code: 'IE', label: 'Ireland' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MT', label: 'Malta' },
  { code: 'SI', label: 'Slovenia' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'CZ', label: 'Czechia' },
  { code: 'PL', label: 'Poland' },
  { code: 'HU', label: 'Hungary' },
  { code: 'RO', label: 'Romania' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'HR', label: 'Croatia' },
  { code: 'SE', label: 'Sweden' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'EE', label: 'Estonia' },
  { code: 'LV', label: 'Latvia' },
  { code: 'LT', label: 'Lithuania' },
];

function formatEUR(amount) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export default function Checkout() {
  const { items, subtotal, discount, total, coupon, clearCart } = useCart();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = await user.getIdToken();
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/createCheckoutSession`, {
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
      if (!sessionId) throw new Error('Missing Stripe session id');

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const fieldClass = 'input';
  const update = (field) => (e) => setAddress({ ...address, [field]: e.target.value });

  return (
    <div className="page-container py-8 animate-fade-in">
      <h1 className="section-title mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shipping form */}
        <div>
          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
              <MapPin size={18} className="text-primary-500" /> Shipping Address
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Full Name *</label>
                <input required value={address.name} onChange={update('name')} className={fieldClass} placeholder="John Doe" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Address Line 1 *</label>
                <input required value={address.line1} onChange={update('line1')} className={fieldClass} placeholder="123 Main St" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Address Line 2</label>
                <input value={address.line2} onChange={update('line2')} className={fieldClass} placeholder="Apt 4B (optional)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">City *</label>
                  <input required value={address.city} onChange={update('city')} className={fieldClass} placeholder="New York" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">State *</label>
                  <input required value={address.state} onChange={update('state')} className={fieldClass} placeholder="NY" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">ZIP Code *</label>
                  <input required value={address.zip} onChange={update('zip')} className={fieldClass} placeholder="10001" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Country</label>
                  <select value={address.country} onChange={update('country')} className={fieldClass}>
                    {EUROPE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-surface-200 dark:border-surface-700 pt-5 mt-5">
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 mb-4 text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <CreditCard size={16} /> Test Payment Card
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 mt-1 font-mono">4242 4242 4242 4242</p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs">Exp: Any future date · CVV: Any 3 digits</p>
                </div>
                <button type="submit" disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3">
                  {processing ? (
                    <><LoadingSpinner size="sm" /> Processing...</>
                  ) : (
                    <><CreditCard size={18} /> Pay {formatEUR(grandTotal)}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Order summary */}
        <div>
          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary-500" /> Order Summary
            </h2>
            <div className="space-y-3 mb-5">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img src={item.image || 'https://via.placeholder.com/50'} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                    <p className="text-xs text-surface-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{formatEUR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm border-t border-surface-200 dark:border-surface-700 pt-4">
              <div className="flex justify-between">
                <span className="text-surface-500">Subtotal</span>
                <span>{formatEUR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount {coupon && `(${coupon.code})`}</span>
                  <span>-{formatEUR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-surface-500">Shipping</span>
                <span className={shipping === 0 ? 'text-green-600' : ''}>{shipping === 0 ? 'FREE' : formatEUR(shipping)}</span>
              </div>
              <div className="border-t border-surface-200 dark:border-surface-700 pt-2 flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary-500">{formatEUR(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
