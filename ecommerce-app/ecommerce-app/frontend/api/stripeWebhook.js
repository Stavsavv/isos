import Stripe from "stripe";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SHOT_NUMBER_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  HIDDEN: "hidden",
};

function normalizeShotNumberEntries(value, fallbackShotNumbers = []) {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const normalizedValue = String(entry.value ?? "").trim();
      if (!normalizedValue) return null;
      const status =
        entry.status === SHOT_NUMBER_STATUS.HIDDEN ||
        entry.status === SHOT_NUMBER_STATUS.UNAVAILABLE ||
        entry.status === SHOT_NUMBER_STATUS.AVAILABLE
          ? entry.status
          : entry.available === false
            ? SHOT_NUMBER_STATUS.UNAVAILABLE
            : SHOT_NUMBER_STATUS.AVAILABLE;
      const rawStock = Number(entry.stock);
      const stock = Number.isFinite(rawStock) && rawStock > 0 ? Math.floor(rawStock) : 0;
      return {
        value: normalizedValue,
        status,
        stock: status === SHOT_NUMBER_STATUS.AVAILABLE ? stock : 0,
      };
    })
    .filter(Boolean);

  if (normalized.length) {
    const seen = new Set();
    return normalized.filter((entry) => {
      if (seen.has(entry.value)) return false;
      seen.add(entry.value);
      return true;
    });
  }

  const fallbackValues = Array.isArray(fallbackShotNumbers)
    ? fallbackShotNumbers
    : fallbackShotNumbers
      ? [fallbackShotNumbers]
      : [];
  const seen = new Set();
  return fallbackValues
    .map((shotNumber) => String(shotNumber))
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .map((value) => ({
      value,
      status: SHOT_NUMBER_STATUS.AVAILABLE,
      stock: 0,
    }));
}

function reduceProductStock(productData, reduction) {
  const totalReduction = reduction.total || 0;
  const byShotNumber = reduction.byShotNumber || {};
  const hasShotNumberReduction = Object.keys(byShotNumber).length > 0;

  if (!hasShotNumberReduction) {
    const currentStock = Number(productData?.stock) || 0;
    return {
      stock: Math.max(0, currentStock - totalReduction),
      shotgunShells: productData?.shotgunShells ?? null,
      numbers: productData?.numbers ?? null,
    };
  }

  const normalizedNumbers = normalizeShotNumberEntries(
    productData?.shotgunShells?.numbers || productData?.numbers,
    productData?.shotgunShells?.shotNumber || productData?.shotNumber,
  );

  const nextNumbers = normalizedNumbers.map((entry) => {
    const qty = Number(byShotNumber[entry.value]) || 0;
    if (qty <= 0) return entry;
    const nextStock = Math.max(0, (entry.stock || 0) - qty);
    return {
      ...entry,
      status:
        nextStock > 0 ? SHOT_NUMBER_STATUS.AVAILABLE : SHOT_NUMBER_STATUS.UNAVAILABLE,
      stock: nextStock > 0 ? nextStock : 0,
    };
  });

  const totalStock = nextNumbers.reduce((sum, entry) => (
    entry.status === SHOT_NUMBER_STATUS.AVAILABLE ? sum + (entry.stock || 0) : sum
  ), 0);

  return {
    stock: totalStock,
    shotgunShells: {
      ...(productData?.shotgunShells || {}),
      numbers: nextNumbers,
      shotNumber: nextNumbers
        .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
        .map((entry) => entry.value),
    },
    numbers: nextNumbers,
  };
}

function getOrderItemProductId(item) {
  return item?.id || item?.productId || item?.product_id || item?.product?.id || null;
}

function getOrderItemShotNumber(item) {
  return item?.shotNumber || item?.number || item?.shot_number || item?.selectedShotNumber || null;
}

function buildReductionByProduct(orderItems) {
  const reductionByProduct = new Map();

  for (const item of orderItems || []) {
    const productId = getOrderItemProductId(item);
    if (!productId) continue;
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;
    const key = String(productId);
    if (!reductionByProduct.has(key)) {
      reductionByProduct.set(key, { total: 0, byShotNumber: {} });
    }
    const reduction = reductionByProduct.get(key);
    reduction.total += quantity;
    const shotNumber = getOrderItemShotNumber(item);
    if (shotNumber) {
      const shotKey = String(shotNumber);
      reduction.byShotNumber[shotKey] = (reduction.byShotNumber[shotKey] || 0) + quantity;
    }
  }

  return reductionByProduct;
}

async function applyOrderStockUpdatesInTransaction(db, transaction, orderItems) {
  const reductionByProduct = buildReductionByProduct(orderItems);
  if (!reductionByProduct.size) return;

  for (const [productId, reduction] of reductionByProduct.entries()) {
    const productRef = db.collection("products").doc(productId);
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists) continue;
    const next = reduceProductStock(productSnap.data() || {}, reduction);
    transaction.update(productRef, {
      stock: next.stock,
      shotgunShells: next.shotgunShells,
      numbers: next.numbers,
    });
  }
}

function initAdmin() {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

function assertStripeEnv() {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!key.startsWith("sk_")) throw new Error("STRIPE_SECRET_KEY must start with sk_");
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_");
  }
}

function assertAdminEnv() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing Firebase Admin env vars");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    assertStripeEnv();
    assertAdminEnv();
    initAdmin();

    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).send("Missing Stripe signature");

    // Read raw body directly from stream
    const rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const { orderId, userId } = session.metadata || {};
      if (!orderId || !userId) return res.status(200).json({ received: true });

      const db = getFirestore();
      const totalPaid = (session.amount_total || 0) / 100;

      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");

        const orderData = orderSnap.data() || {};
        const updates = {
          paymentStatus: "paid",
          orderStatus: "processing",
          totalPrice: totalPaid,
          stripeSessionId: session.id,
          paidAt: FieldValue.serverTimestamp(),
        };

        if (orderData.stockApplied !== true) {
          await applyOrderStockUpdatesInTransaction(
            db,
            transaction,
            orderData.items || [],
          );
          updates.stockApplied = true;
          updates.stockAppliedAt = FieldValue.serverTimestamp();
        }

        if (orderData.couponId && orderData.couponApplied !== true) {
          const couponRef = db.collection("coupons").doc(orderData.couponId);
          const couponSnap = await transaction.get(couponRef);
          if (couponSnap.exists) {
            transaction.update(couponRef, {
              usedCount: FieldValue.increment(1),
            });
          }
          updates.couponApplied = true;
          updates.couponAppliedAt = FieldValue.serverTimestamp();
        }

        transaction.update(orderRef, updates);
        transaction.set(db.collection("carts").doc(userId), {
          items: [],
          coupon: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      console.log(`Order ${orderId} marked as paid`);
      console.log(JSON.stringify({
        event: "order.finalized",
        orderId,
        userId,
        totalPaid,
        sourceEvent: event.type,
      }));
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    if (error?.message === "ORDER_NOT_FOUND") {
      return res.status(200).json({ received: true });
    }
    console.error("stripeWebhook error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
}



