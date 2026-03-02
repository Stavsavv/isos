import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState(null);

  // Sync cart with Firestore when user logs in
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const cartRef = doc(db, 'carts', user.uid);
    const unsubscribe = onSnapshot(cartRef, (snap) => {
      if (snap.exists()) {
        setItems(snap.data().items || []);
        setCoupon(snap.data().coupon || null);
      } else {
        setItems([]);
      }
    });

    return unsubscribe;
  }, [user]);

  const saveCart = useCallback(async (newItems, newCoupon = coupon) => {
    if (!user) return;
    const cartRef = doc(db, 'carts', user.uid);
    await setDoc(cartRef, { items: newItems, coupon: newCoupon, updatedAt: new Date() });
  }, [user, coupon]);

  const addToCart = useCallback(async (product, quantity = 1) => {
    const existing = items.find((i) => i.id === product.id);
    let newItems;
    if (existing) {
      newItems = items.map((i) =>
        i.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i
      );
    } else {
      newItems = [
        ...items,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '',
          quantity,
          stock: product.stock,
        },
      ];
    }
    setItems(newItems);
    if (user) await saveCart(newItems);
  }, [items, user, saveCart]);

  const removeFromCart = useCallback(async (productId) => {
    const newItems = items.filter((i) => i.id !== productId);
    setItems(newItems);
    if (user) await saveCart(newItems);
  }, [items, user, saveCart]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    if (quantity <= 0) return removeFromCart(productId);
    const newItems = items.map((i) => (i.id === productId ? { ...i, quantity } : i));
    setItems(newItems);
    if (user) await saveCart(newItems);
  }, [items, user, saveCart, removeFromCart]);

  const clearCart = useCallback(async () => {
    setItems([]);
    setCoupon(null);
    if (user) {
      const cartRef = doc(db, 'carts', user.uid);
      await setDoc(cartRef, { items: [], coupon: null, updatedAt: new Date() });
    }
  }, [user]);

  const applyCoupon = useCallback(async (couponData) => {
    setCoupon(couponData);
    if (user) await saveCart(items, couponData);
  }, [items, user, saveCart]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = coupon
    ? coupon.type === 'percent'
      ? (subtotal * coupon.value) / 100
      : Math.min(coupon.value, subtotal)
    : 0;
  const total = Math.max(0, subtotal - discount);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        coupon,
        subtotal,
        discount,
        total,
        itemCount,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
