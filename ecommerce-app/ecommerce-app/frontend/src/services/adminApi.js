import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config.js";

function requireDb() {
  if (!db) {
    throw new Error("Firestore is not configured");
  }

  return db;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function updateUserRole(targetUserId, role) {
  if (!targetUserId) {
    throw new Error("targetUserId is required");
  }

  const database = requireDb();
  const userRef = doc(database, "users", targetUserId);
  await setDoc(userRef, {
    role: role === "admin" ? "admin" : "user",
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { ok: true };
}

export async function deleteUserProfile(targetUserId) {
  if (!targetUserId) {
    throw new Error("targetUserId is required");
  }

  await deleteDoc(doc(requireDb(), "users", targetUserId));
  return { ok: true };
}

export async function saveProduct(productId, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Product payload is required");
  }

  const database = requireDb();
  const now = serverTimestamp();
  const productData = {
    name: String(payload.name || "").trim(),
    description: String(payload.description || ""),
    price: normalizeNumber(payload.price),
    category: String(payload.category || "").trim(),
    subcategory: String(payload.subcategory || "").trim(),
    stock: Math.max(0, Math.floor(normalizeNumber(payload.stock))),
    images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
    rating: normalizeNumber(payload.rating),
    reviewCount: Math.max(0, Math.floor(normalizeNumber(payload.reviewCount))),
    shotgunShells: payload.shotgunShells ?? null,
    numbers: payload.numbers ?? null,
    updatedAt: now,
  };

  if (productId) {
    await setDoc(doc(database, "products", productId), productData, { merge: true });
    return { ok: true, id: productId };
  }

  const newRef = await addDoc(collection(database, "products"), {
    ...productData,
    createdAt: now,
  });
  return { ok: true, id: newRef.id };
}

export async function deleteProduct(productId) {
  if (!productId) {
    throw new Error("productId is required");
  }

  await deleteDoc(doc(requireDb(), "products", productId));
  return { ok: true };
}

export async function createCoupon(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Coupon payload is required");
  }

  const database = requireDb();
  const couponRef = await addDoc(collection(database, "coupons"), {
    code: String(payload.code || "").trim().toUpperCase(),
    type: payload.type === "fixed" ? "fixed" : "percent",
    value: normalizeNumber(payload.value),
    minOrder: normalizeNumber(payload.minOrder),
    maxUses: payload.maxUses == null ? null : Math.max(0, Math.floor(normalizeNumber(payload.maxUses))),
    usedCount: Math.max(0, Math.floor(normalizeNumber(payload.usedCount))),
    active: payload.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ok: true, id: couponRef.id };
}

export async function deleteCoupon(couponId) {
  if (!couponId) {
    throw new Error("couponId is required");
  }

  await deleteDoc(doc(requireDb(), "coupons", couponId));
  return { ok: true };
}

export async function updateOrderStatus(orderId, status) {
  if (!orderId) {
    throw new Error("orderId is required");
  }

  await setDoc(doc(requireDb(), "orders", orderId), {
    orderStatus: status,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { ok: true };
}

export async function deleteOrder(orderId) {
  if (!orderId) {
    throw new Error("orderId is required");
  }

  await deleteDoc(doc(requireDb(), "orders", orderId));
  return { ok: true };
}

export async function getAnalytics() {
  const database = requireDb();
  const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(database, "users")),
    getDocs(collection(database, "products")),
    getDocs(query(collection(database, "orders"))),
  ]);

  const revenue = ordersSnap.docs.reduce((sum, orderDoc) => {
    const order = orderDoc.data();
    if (order.paymentStatus !== "paid") return sum;
    return sum + (Number(order.totalPrice) || 0);
  }, 0);

  return {
    users: usersSnap.size,
    products: productsSnap.size,
    orders: ordersSnap.size,
    revenue: Math.round(revenue * 100) / 100,
  };
}
