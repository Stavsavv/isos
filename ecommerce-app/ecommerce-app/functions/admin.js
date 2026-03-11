const functions = require("firebase-functions");
const { admin, db } = require("./lib/firebase");
const { requireAdmin } = require("./lib/auth");

async function getAnalytics() {
  const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("products").get(),
    db.collection("orders").get(),
  ]);

  const orders = ordersSnap.docs.map((doc) => doc.data());
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const revenue = paidOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  return {
    users: usersSnap.size,
    products: productsSnap.size,
    orders: ordersSnap.size,
    revenue: Math.round(revenue * 100) / 100,
  };
}

async function updateUserRole({ actorUid, targetUserId, role }) {
  await requireAdmin(actorUid);

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "targetUserId is required",
    );
  }

  const normalizedRole = role === "admin" ? "admin" : "user";
  const userRef = db.collection("users").doc(targetUserId);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    throw new functions.https.HttpsError("not-found", "User not found");
  }

  await userRef.set(
    {
      role: normalizedRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, role: normalizedRole };
}

async function deleteUserProfile({ actorUid, targetUserId }) {
  await requireAdmin(actorUid);

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "targetUserId is required",
    );
  }

  if (actorUid === targetUserId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You cannot delete your own profile",
    );
  }

  const userRef = db.collection("users").doc(targetUserId);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    throw new functions.https.HttpsError("not-found", "User not found");
  }

  await userRef.delete();
  return { ok: true };
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function saveProduct({ actorUid, productId, payload }) {
  await requireAdmin(actorUid);

  if (!payload || typeof payload !== "object") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Product payload is required",
    );
  }

  const name = String(payload.name || "").trim();
  const category = String(payload.category || "").trim();
  if (!name || !category) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Product name and category are required",
    );
  }

  const data = {
    name,
    description: String(payload.description || ""),
    price: normalizeNumber(payload.price),
    category,
    subcategory: String(payload.subcategory || ""),
    stock: Math.max(0, Math.floor(normalizeNumber(payload.stock))),
    images: Array.isArray(payload.images) ? payload.images.filter(Boolean) : [],
    rating: normalizeNumber(payload.rating),
    reviewCount: Math.max(0, Math.floor(normalizeNumber(payload.reviewCount))),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    shotgunShells: payload.shotgunShells ?? null,
    numbers: payload.numbers ?? null,
  };

  if (productId) {
    const productRef = db.collection("products").doc(productId);
    await productRef.set(data, { merge: true });
    return { ok: true, id: productId };
  }

  const productRef = db.collection("products").doc();
  await productRef.set({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, id: productRef.id };
}

async function deleteProduct({ actorUid, productId }) {
  await requireAdmin(actorUid);

  if (!productId || typeof productId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "productId is required",
    );
  }

  await db.collection("products").doc(productId).delete();
  return { ok: true };
}

async function createCoupon({ actorUid, payload }) {
  await requireAdmin(actorUid);

  if (!payload || typeof payload !== "object") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Coupon payload is required",
    );
  }

  const code = String(payload.code || "").trim().toUpperCase();
  if (!code) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Coupon code is required",
    );
  }

  const couponRef = db.collection("coupons").doc();
  await couponRef.set({
    code,
    type: payload.type === "fixed" ? "fixed" : "percent",
    value: normalizeNumber(payload.value),
    minOrder: normalizeNumber(payload.minOrder),
    maxUses: payload.maxUses == null ? null : Math.max(0, Math.floor(normalizeNumber(payload.maxUses))),
    usedCount: Math.max(0, Math.floor(normalizeNumber(payload.usedCount))),
    active: payload.active !== false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, id: couponRef.id };
}

async function deleteCoupon({ actorUid, couponId }) {
  await requireAdmin(actorUid);

  if (!couponId || typeof couponId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "couponId is required",
    );
  }

  await db.collection("coupons").doc(couponId).delete();
  return { ok: true };
}

async function updateOrderStatus({ actorUid, orderId, status }) {
  await requireAdmin(actorUid);

  const allowedStatuses = new Set(["processing", "shipped", "delivered"]);
  if (!orderId || typeof orderId !== "string" || !allowedStatuses.has(status)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Valid orderId and status are required",
    );
  }

  await db.collection("orders").doc(orderId).set(
    {
      orderStatus: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true };
}

async function deleteOrder({ actorUid, orderId }) {
  await requireAdmin(actorUid);

  if (!orderId || typeof orderId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "orderId is required",
    );
  }

  await db.collection("orders").doc(orderId).delete();
  return { ok: true };
}

module.exports = {
  getAnalytics,
  updateUserRole,
  deleteUserProfile,
  saveProduct,
  deleteProduct,
  createCoupon,
  deleteCoupon,
  updateOrderStatus,
  deleteOrder,
};
