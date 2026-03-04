import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';
import { Minus, Plus, Trash2, ShoppingBag, Tag, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';

export default function Cart() {
  const { items, updateQuantity, removeFromCart, subtotal, discount, total, coupon, applyCoupon } = useCart();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const handleValidateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const validateCoupon = httpsCallable(functions, 'validateCoupon');
      const result = await validateCoupon({ code: couponCode.toUpperCase(), subtotal });
      if (result.data.valid) {
        await applyCoupon(result.data.coupon);
        toast.success(`Coupon applied! You save $${result.data.coupon.type === 'percent' ? ((subtotal * result.data.coupon.value) / 100).toFixed(2) : result.data.coupon.value.toFixed(2)}`);
        setCouponCode('');
      } else {
        toast.error(result.data.message || 'Invalid coupon');
      }
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page-container py-20 text-center animate-fade-in">
        <ShoppingBag size={64} className="text-surface-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-surface-500 mb-6">Looks like you haven't added anything yet.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="page-container py-8 animate-fade-in">
      <h1 className="section-title mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.cartItemId || item.id} className="card p-4 flex gap-4 animate-slide-up">
              <img
                src={item.image || 'https://via.placeholder.com/100'}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.productId || item.id}`} className="font-medium hover:text-primary-600 transition-colors line-clamp-2">
                  {item.name}
                </Link>
                <p className="text-primary-500 font-bold mt-1">${item.price.toFixed(2)}</p>
                {item.shotNumber && (
                  <p className="text-xs text-surface-500 mt-1">
                    Νούμερο: {item.shotNumber} | Ποσότητα: {item.quantity} κουτί | Απόθεμα: {item.stock}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-7 h-7 rounded border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                    <button
                      onClick={() => removeFromCart(item.cartItemId || item.id)}
                      className="p-1.5 text-surface-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          {/* Coupon */}
          <div className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Tag size={16} /> Coupon Code
            </h3>
            {coupon ? (
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg px-3 py-2">
                <div>
                  <p className="text-green-700 dark:text-green-400 font-medium text-sm">{coupon.code}</p>
                  <p className="text-green-600 dark:text-green-500 text-xs">
                    {coupon.type === 'percent' ? `${coupon.value}% off` : `$${coupon.value} off`}
                  </p>
                </div>
                <button onClick={() => applyCoupon(null)} className="text-surface-400 hover:text-red-500"><X size={16} /></button>
              </div>
            ) : (
              <form onSubmit={handleValidateCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                  className="input flex-1 text-sm"
                />
                <button type="submit" disabled={validatingCoupon} className="btn-secondary text-sm px-4">
                  {validatingCoupon ? <LoadingSpinner size="sm" /> : 'Apply'}
                </button>
              </form>
            )}
          </div>

          {/* Order summary */}
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-surface-500">Shipping</span>
                <span className={subtotal >= 50 ? 'text-green-600' : ''}>{subtotal >= 50 ? 'FREE' : '$4.99'}</span>
              </div>
              <div className="border-t border-surface-200 dark:border-surface-700 pt-2 flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary-500">${(total + (subtotal >= 50 ? 0 : 4.99)).toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/checkout')}
              className="btn-primary w-full mt-5"
            >
              Proceed to Checkout
            </button>
            <Link to="/products" className="btn-secondary w-full mt-2 text-center block">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
