import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  getAvailableStockForShotNumber,
  normalizeShotNumberEntries,
  SHOT_NUMBER_STATUS,
} from '../constants/fysiggia.js';

const CartContext = createContext(null);

function createCartItemId(productId, shotNumber) {
  return `${productId}::${shotNumber || ''}`;
}

function normalizeCartItem(item) {
  const shotNumber = item?.shotNumber || null;
  const perNumberStock = Number(item?.shotNumberStock);
  const normalizedStock = Number.isFinite(perNumberStock) && perNumberStock >= 0
    ? perNumberStock
    : Number(item?.stock) || 0;
  return {
    ...item,
    productId: item?.productId || item?.id,
    cartItemId: item?.cartItemId || createCartItemId(item?.productId || item?.id, shotNumber),
    shotNumber,
    stock: normalizedStock,
    shotNumberStock: shotNumber ? normalizedStock : null,
  };
}

function resolveItemStock(product, shotNumber) {
  if (!shotNumber) return Number(product?.stock) || 0;
  return getAvailableStockForShotNumber(
    product?.shotgunShells || { numbers: product?.numbers, shotNumber: product?.shotNumber },
    shotNumber,
  );
}

function hasVisibleShotNumbers(product) {
  return normalizeShotNumberEntries(
    product?.shotgunShells?.numbers || product?.numbers,
    product?.shotgunShells?.shotNumber || product?.shotNumber,
  ).some((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN);
}

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
    const unsubscribe = onSnapshot(
      cartRef,
      (snap) => {
        if (snap.exists()) {
          setItems((snap.data().items || []).map(normalizeCartItem));
          setCoupon(snap.data().coupon || null);
        } else {
          setItems([]);
        }
      },
      (error) => {
        console.error('Cart listener error:', error);
        setItems([]);
        setCoupon(null);
      }
    );

    return unsubscribe;
  }, [user]);

  const saveCart = useCallback(async (newItems, newCoupon = coupon) => {
    if (!user) return;
    const cartRef = doc(db, 'carts', user.uid);
    await setDoc(cartRef, { items: newItems, coupon: newCoupon, updatedAt: new Date() });
  }, [user, coupon]);

  const addToCart = useCallback(async (product, quantity = 1, options = {}) => {
    const shotNumber = options?.shotNumber || null;
    if (!shotNumber && hasVisibleShotNumbers(product)) {
      throw new Error("Παρακαλώ επιλέξτε Νούμερο");
    }
    const availableStock = resolveItemStock(product, shotNumber);
    if (shotNumber && availableStock <= 0) {
      throw new Error(`Διαθέσιμα μόνο 0 κουτιά για το Νούμερο ${shotNumber}`);
    }
    const cartItemId = createCartItemId(product.id, shotNumber);
    const existing = items.find((i) => (i.cartItemId || createCartItemId(i.id, i.shotNumber)) === cartItemId);
    let newItems;
    if (existing) {
      const nextQty = existing.quantity + quantity;
      if (nextQty > availableStock) {
        throw new Error(`Διαθέσιμα μόνο ${availableStock} κουτιά για το Νούμερο ${shotNumber}`);
      }
      newItems = items.map((i) =>
        (i.cartItemId || createCartItemId(i.id, i.shotNumber)) === cartItemId
          ? { ...i, quantity: nextQty, stock: availableStock, shotNumberStock: shotNumber ? availableStock : null }
          : i
      );
    } else {
      if (quantity > availableStock) {
        if (shotNumber) throw new Error(`Διαθέσιμα μόνο ${availableStock} κουτιά για το Νούμερο ${shotNumber}`);
        throw new Error(`Διαθέσιμα μόνο ${availableStock} κουτιά`);
      }
      newItems = [
        ...items,
        {
          cartItemId,
          productId: product.id,
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || '',
          quantity,
          stock: availableStock,
          shotNumber,
          shotNumberStock: shotNumber ? availableStock : null,
        },
      ];
    }
    setItems(newItems);
    if (user) await saveCart(newItems);
  }, [items, user, saveCart]);

  const removeFromCart = useCallback(async (cartItemId) => {
    const newItems = items.filter((i) => (i.cartItemId || createCartItemId(i.id, i.shotNumber)) !== cartItemId);
    setItems(newItems);
    if (user) await saveCart(newItems);
  }, [items, user, saveCart]);

  const updateQuantity = useCallback(async (cartItemId, quantity) => {
    if (quantity <= 0) return removeFromCart(cartItemId);
    const newItems = items.map((i) => (
      (i.cartItemId || createCartItemId(i.id, i.shotNumber)) === cartItemId
        ? { ...i, quantity: Math.min(quantity, i.stock || 0) }
        : i
    ));
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
