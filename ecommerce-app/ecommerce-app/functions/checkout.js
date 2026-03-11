const functions = require("firebase-functions");
const Stripe = require("stripe");
const { admin, db } = require("./lib/firebase");
const {
  CURRENCY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  EUROPE_ALLOWED_COUNTRIES,
} = require("./lib/constants");
const {
  safeStripeImage,
  getShotNumberAvailability,
  getOrderItemProductId,
  getOrderItemShotNumber,
  applyOrderStockUpdatesInTransaction,
} = require("./lib/stock");

function assertStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY must start with sk_");
  }
}

function assertStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_");
  }
}

function getStripe() {
  assertStripeSecretKey();
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function buildCheckoutSession({
  items,
  couponCode,
  userId,
  shippingAddress,
  successUrl,
  cancelUrl,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Cart is empty");
  }

  if (!successUrl || !cancelUrl) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing redirect URLs",
    );
  }

  const normalizedItems = items.map((item) => ({
    productId: getOrderItemProductId(item),
    quantity: Math.floor(Number(item.quantity) || 0),
    shotNumber: getOrderItemShotNumber(item),
  }));

  for (const item of normalizedItems) {
    if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid cart item",
      );
    }
  }

  const productIds = [...new Set(normalizedItems.map((item) => String(item.productId)))];
  const productRefs = productIds.map((id) => db.collection("products").doc(id));
  const productSnaps = await Promise.all(productRefs.map((ref) => ref.get()));
  const productsById = new Map(
    productSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() || {}]),
  );

  const validatedItems = [];
  const lineItems = [];
  let subtotal = 0;

  for (const item of normalizedItems) {
    const productData = productsById.get(String(item.productId));
    if (!productData) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Product not found",
      );
    }

    const price = Number(productData.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid product price",
      );
    }

    let availableStock = Number(productData.stock) || 0;
    if (item.shotNumber) {
      const availability = getShotNumberAvailability(productData, item.shotNumber);
      if (!availability.available) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Shot number ${item.shotNumber} is unavailable`,
        );
      }
      availableStock = availability.stock;
    }

    if (item.quantity > availableStock) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Insufficient stock",
      );
    }

    const image = safeStripeImage(productData.images?.[0]);
    lineItems.push({
      price_data: {
        currency: CURRENCY,
        product_data: {
          name: productData.name || "Product",
          ...(image ? { images: [image] } : {}),
        },
        unit_amount: Math.round(price * 100),
      },
      quantity: item.quantity,
    });

    validatedItems.push({
      productId: String(item.productId),
      name: productData.name || "Product",
      price,
      image: productData.images?.[0] || "",
      quantity: item.quantity,
      shotNumber: item.shotNumber || null,
    });

    subtotal += price * item.quantity;
  }

  if (subtotal < FREE_SHIPPING_THRESHOLD) {
    lineItems.push({
      price_data: {
        currency: CURRENCY,
        product_data: { name: "Shipping" },
        unit_amount: Math.round(SHIPPING_FEE * 100),
      },
      quantity: 1,
    });
  }

  let discountAmount = 0;
  let discounts = [];
  let couponMeta = null;

  if (couponCode) {
    const couponSnap = await db
      .collection("coupons")
      .where("code", "==", String(couponCode).toUpperCase())
      .where("active", "==", true)
      .limit(1)
      .get();

    if (!couponSnap.empty) {
      const couponDoc = couponSnap.docs[0];
      const coupon = couponDoc.data();
      const minOrder = Number(coupon.minOrder) || 0;
      const maxUses = Number(coupon.maxUses);
      const usedCount = Number(coupon.usedCount) || 0;

      if (minOrder > 0 && subtotal < minOrder) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Minimum order of ${minOrder} required`,
        );
      }

      if (Number.isFinite(maxUses) && usedCount >= maxUses) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Coupon has reached maximum uses",
        );
      }

      const stripeClient = getStripe();
      const stripeCoupon = await stripeClient.coupons.create({
        ...(coupon.type === "percent"
          ? { percent_off: coupon.value }
          : {
              amount_off: Math.round(Number(coupon.value) * 100),
              currency: CURRENCY,
            }),
        duration: "once",
      });
      discounts = [{ coupon: stripeCoupon.id }];
      discountAmount = coupon.type === "percent"
        ? (subtotal * Number(coupon.value)) / 100
        : Math.min(Number(coupon.value) || 0, subtotal);
      couponMeta = {
        id: couponDoc.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      };
    }
  }

  const orderRef = await db.collection("orders").add({
    userId,
    items: validatedItems,
    shippingAddress: shippingAddress || null,
    subtotal,
    discount: discountAmount,
    totalPrice: 0,
    paymentStatus: "pending",
    orderStatus: "processing",
    couponCode: couponMeta?.code || null,
    couponId: couponMeta?.id || null,
    currency: CURRENCY,
    stockApplied: false,
    couponApplied: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const stripeClient = getStripe();
  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    discounts,
    success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { orderId: orderRef.id, userId },
    shipping_address_collection: {
      allowed_countries: EUROPE_ALLOWED_COUNTRIES,
    },
  });

  return { sessionId: session.id, orderId: orderRef.id };
}

async function finalizeOrderPayment({ orderId, userId, session }) {
  const totalPaid = (session.amount_total || 0) / 100;
  let stockAppliedNow = false;
  let couponAppliedNow = false;

  await db.runTransaction(async (transaction) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");

    const orderData = orderSnap.data() || {};
    if (orderData.userId && orderData.userId !== userId) {
      throw new Error("ORDER_USER_MISMATCH");
    }

    const updates = {
      paymentStatus: "paid",
      orderStatus: "processing",
      totalPrice: totalPaid,
      stripeSessionId: session.id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (orderData.stockApplied !== true) {
      await applyOrderStockUpdatesInTransaction(transaction, orderData.items || []);
      updates.stockApplied = true;
      updates.stockAppliedAt = admin.firestore.FieldValue.serverTimestamp();
      stockAppliedNow = true;
    }

    if (orderData.couponId && orderData.couponApplied !== true) {
      const couponRef = db.collection("coupons").doc(orderData.couponId);
      const couponSnap = await transaction.get(couponRef);
      if (couponSnap.exists) {
        transaction.update(couponRef, {
          usedCount: admin.firestore.FieldValue.increment(1),
        });
      }
      updates.couponApplied = true;
      updates.couponAppliedAt = admin.firestore.FieldValue.serverTimestamp();
      couponAppliedNow = true;
    }

    transaction.update(orderRef, updates);
    transaction.set(db.collection("carts").doc(userId), {
      items: [],
      coupon: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(JSON.stringify({
    event: "order.finalized",
    orderId,
    userId,
    totalPaid,
    stockApplied: stockAppliedNow,
    couponApplied: couponAppliedNow,
  }));
}

async function validateCoupon({ code, subtotal }) {
  if (!code) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Coupon code is required",
    );
  }

  const couponSnap = await db
    .collection("coupons")
    .where("code", "==", String(code).toUpperCase())
    .where("active", "==", true)
    .limit(1)
    .get();

  if (couponSnap.empty) {
    return { valid: false, message: "Coupon not found or expired" };
  }

  const couponDoc = couponSnap.docs[0];
  const coupon = couponDoc.data();

  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return {
      valid: false,
      message: `Minimum order of ${coupon.minOrder} required`,
    };
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: "Coupon has reached maximum uses" };
  }

  return {
    valid: true,
    coupon: {
      id: couponDoc.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    },
  };
}

module.exports = {
  buildCheckoutSession,
  finalizeOrderPayment,
  validateCoupon,
  getStripe,
  assertStripeWebhookSecret,
};
