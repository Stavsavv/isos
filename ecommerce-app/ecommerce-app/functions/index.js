const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

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
      for (const item of orderData.items) {
        const productRef = db.collection('products').doc(item.id);
        batch.update(productRef, {
          stock: admin.firestore.FieldValue.increment(-item.quantity),
        });
      }

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
    for (const item of items) {
      const productRef = db.collection('products').doc(item.id);
      batch.update(productRef, {
        stock: admin.firestore.FieldValue.increment(-item.quantity),
      });
    }

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
