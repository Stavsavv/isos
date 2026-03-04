const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();
const SHOT_NUMBER_STATUS = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  HIDDEN: 'hidden',
};

function normalizeShotNumberEntries(value, fallbackShotNumbers = []) {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const normalizedValue = String(entry.value ?? '').trim();
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

async function applyOrderStockUpdatesAtomic(orderItems) {
  const reductionByProduct = buildReductionByProduct(orderItems);
  if (!reductionByProduct.size) return;

  await db.runTransaction(async (transaction) => {
    for (const [productId, reduction] of reductionByProduct.entries()) {
      const productRef = db.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) continue;
      const next = reduceProductStock(productSnap.data() || {}, reduction);
      transaction.update(productRef, {
        stock: next.stock,
        shotgunShells: next.shotgunShells,
        numbers: next.numbers,
      });
    }
  });
}

// Initialize Stripe with secret key from Firebase config
const getStripe = () => stripe(functions.config().stripe.secret_key);

// ==========================================
// CREATE STRIPE CHECKOUT SESSION
// ==========================================
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { items, shippingAddress, couponCode, userId, successUrl, cancelUrl } = data;

  if (!items || items.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Cart is empty');
  }

  try {
    const stripeClient = getStripe();

    // Build line items for Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add shipping if needed
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (subtotal < 50) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping' },
          unit_amount: 499, // $4.99
        },
        quantity: 1,
      });
    }

    // Apply coupon if provided
    let discounts = [];
    if (couponCode) {
      const couponSnap = await db.collection('coupons')
        .where('code', '==', couponCode.toUpperCase())
        .where('active', '==', true)
        .limit(1)
        .get();

      if (!couponSnap.empty) {
        const coupon = couponSnap.docs[0].data();
        // Create Stripe coupon
        const stripeCoupon = await stripeClient.coupons.create({
          ...(coupon.type === 'percent'
            ? { percent_off: coupon.value }
            : { amount_off: Math.round(coupon.value * 100), currency: 'usd' }),
          duration: 'once',
        });
        discounts = [{ coupon: stripeCoupon.id }];
      }
    }

    // Store pending order data in Firestore
    const orderRef = await db.collection('orders').add({
      userId,
      items,
      shippingAddress,
      totalPrice: 0, // Will be updated after payment
      paymentStatus: 'pending',
      orderStatus: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create Stripe checkout session
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      discounts,
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        orderId: orderRef.id,
        userId,
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
      },
    });

    return { sessionId: session.id, orderId: orderRef.id };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ==========================================
// STRIPE WEBHOOK - Handle payment events
// ==========================================
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const stripeClient = getStripe();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = functions.config().stripe.webhook_secret;

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orderId, userId } = session.metadata;

    try {
      const batch = db.batch();

      // Update order
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) throw new Error('Order not found');

      const orderData = orderSnap.data();
      const totalPaid = session.amount_total / 100;

      batch.update(orderRef, {
        paymentStatus: 'paid',
        orderStatus: 'processing',
        totalPrice: totalPaid,
        stripeSessionId: session.id,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Reduce stock for each item
      await applyOrderStockUpdatesAtomic(orderData.items);

      // Clear user cart
      const cartRef = db.collection('carts').doc(userId);
      batch.set(cartRef, { items: [], coupon: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      await batch.commit();
      console.log(`Order ${orderId} confirmed for user ${userId}`);
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).send('Webhook processing failed');
    }
  }

  res.json({ received: true });
});

// ==========================================
// VALIDATE COUPON
// ==========================================
exports.validateCoupon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { code, subtotal } = data;

  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Coupon code is required');
  }

  try {
    const couponSnap = await db.collection('coupons')
      .where('code', '==', code.toUpperCase())
      .where('active', '==', true)
      .limit(1)
      .get();

    if (couponSnap.empty) {
      return { valid: false, message: 'Coupon not found or expired' };
    }

    const couponDoc = couponSnap.docs[0];
    const coupon = couponDoc.data();

    // Check min order
    if (coupon.minOrder && subtotal < coupon.minOrder) {
      return { valid: false, message: `Minimum order of $${coupon.minOrder} required` };
    }

    // Check max uses
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, message: 'Coupon has reached maximum uses' };
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
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to validate coupon');
  }
});

// ==========================================
// CREATE ORDER (Secure server-side)
// ==========================================
exports.createOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { items, shippingAddress, totalPrice, stripeSessionId } = data;

  if (!items || items.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Items are required');
  }

  try {
    const orderRef = await db.collection('orders').add({
      userId: context.auth.uid,
      items,
      shippingAddress,
      totalPrice,
      stripeSessionId: stripeSessionId || null,
      paymentStatus: 'paid',
      orderStatus: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Reduce stock
    const batch = db.batch();
    await applyOrderStockUpdatesAtomic(items);

    // Clear cart
    batch.set(db.collection('carts').doc(context.auth.uid), {
      items: [],
      coupon: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return { orderId: orderRef.id };
  } catch (error) {
    console.error('Error creating order:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create order');
  }
});

// ==========================================
// GET ADMIN ANALYTICS
// ==========================================
exports.getAnalytics = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Verify admin role
  const userSnap = await db.collection('users').doc(context.auth.uid).get();
  if (!userSnap.exists || userSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  try {
    const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('products').get(),
      db.collection('orders').get(),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data());
    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
    const revenue = paidOrders.reduce((s, o) => s + (o.totalPrice || 0), 0);

    return {
      users: usersSnap.size,
      products: productsSnap.size,
      orders: ordersSnap.size,
      revenue: Math.round(revenue * 100) / 100,
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to fetch analytics');
  }
});

// ==========================================
// SCHEDULED: Clean up old pending orders
// ==========================================
exports.cleanupPendingOrders = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (ctx) => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48); // 48 hours old

    const snap = await db.collection('orders')
      .where('paymentStatus', '==', 'pending')
      .where('createdAt', '<', cutoff)
      .get();

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    console.log(`Cleaned up ${snap.size} stale pending orders`);
    return null;
  });



