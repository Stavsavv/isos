import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.uid) { setItems([]); return; }
    const ref = doc(db, 'wishlists', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setItems(snap.data().items || []);
        else setItems([]);
      },
      (error) => {
        if (error?.code !== 'permission-denied') {
          console.error('Wishlist listener error:', error);
        }
        setItems([]);
      }
    );
    return () => unsub();
  }, [user]);

  const save = useCallback(async (newItems) => {
    if (!user?.uid) return;
    await setDoc(doc(db, 'wishlists', user.uid), { items: newItems });
  }, [user]);

  const toggle = useCallback(async (product) => {
    const exists = items.find((i) => i.id === product.id);
    const newItems = exists
      ? items.filter((i) => i.id !== product.id)
      : [...items, { id: product.id, name: product.name, price: product.price, image: product.images?.[0] || '' }];
    setItems(newItems);
    try {
      await save(newItems);
    } catch (error) {
      if (error?.code !== 'permission-denied') {
        console.error('Wishlist save error:', error);
      }
      setItems(items);
    }
  }, [items, save]);

  const isWishlisted = useCallback((id) => items.some((i) => i.id === id), [items]);

  return (
    <WishlistContext.Provider value={{ items, toggle, isWishlisted }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
