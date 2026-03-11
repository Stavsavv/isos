const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { db } = require("./lib/firebase");
const { assertAuthenticated, requireAdmin, verifyBearerToken } = require("./lib/auth");
const {
  buildCheckoutSession,
  finalizeOrderPayment,
  validateCoupon,
  getStripe,
  assertStripeWebhookSecret,
} = require("./checkout");
const {
  getAnalytics,
  updateUserRole,
  deleteUserProfile,
  saveProduct,
  deleteProduct,
  createCoupon,
  deleteCoupon,
  updateOrderStatus,
  deleteOrder,
} = require("./admin");

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await buildCheckoutSession({
      items: data?.items,
      shippingAddress: data?.shippingAddress,
      couponCode: data?.couponCode,
      userId: auth.uid,
      successUrl: data?.successUrl,
      cancelUrl: data?.cancelUrl,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.createCheckoutSessionHttp = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const decodedToken = await verifyBearerToken(req.headers.authorization || "");
      const result = await buildCheckoutSession({
        items: req.body?.items,
        shippingAddress: req.body?.shippingAddress,
        couponCode: req.body?.couponCode,
        userId: decodedToken.uid,
        successUrl: req.body?.successUrl,
        cancelUrl: req.body?.cancelUrl,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("Error creating checkout session (HTTP):", error);
      const message = error?.message || "Failed to create checkout session";
      const status = error instanceof functions.https.HttpsError ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const stripeClient = getStripe();
  const signature = req.headers["stripe-signature"];
  assertStripeWebhookSecret();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const { orderId, userId } = session.metadata || {};

    if (!orderId || !userId) {
      return res.json({ received: true });
    }

    try {
      await finalizeOrderPayment({ orderId, userId, session });
      console.log(`Order ${orderId} confirmed for user ${userId}`);
      console.log(JSON.stringify({
        event: "order.finalized",
        orderId,
        userId,
        sourceEvent: event.type,
      }));
    } catch (error) {
      if (error?.message === "ORDER_NOT_FOUND" || error?.message === "ORDER_USER_MISMATCH") {
        return res.json({ received: true });
      }
      console.error("Error processing webhook:", error);
      return res.status(500).send("Webhook processing failed");
    }
  }

  return res.json({ received: true });
});

exports.validateCoupon = functions.https.onCall(async (data, context) => {
  assertAuthenticated(context);

  try {
    return await validateCoupon({
      code: data?.code,
      subtotal: data?.subtotal,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to validate coupon:", error);
    throw new functions.https.HttpsError("internal", "Failed to validate coupon");
  }
});

exports.createOrder = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);
  const stripeSessionId = data?.stripeSessionId;
  if (!stripeSessionId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "stripeSessionId is required",
    );
  }

  try {
    const stripeClient = getStripe();
    const session = await stripeClient.checkout.sessions.retrieve(stripeSessionId);
    if (!session) {
      throw new functions.https.HttpsError("not-found", "Stripe session not found");
    }

    if (session.payment_status !== "paid") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Payment not completed",
      );
    }

    const metadata = session.metadata || {};
    const orderId = metadata.orderId;
    const userId = metadata.userId;
    if (!orderId || !userId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Missing order metadata",
      );
    }

    const actorProfile = await db.collection("users").doc(auth.uid).get();
    const isAdminUser = actorProfile.exists && actorProfile.data()?.role === "admin";
    if (!isAdminUser && auth.uid !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not allowed to finalize this order",
      );
    }

    await finalizeOrderPayment({ orderId, userId, session });
    return { orderId };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Error finalizing order:", error);
    throw new functions.https.HttpsError("internal", "Failed to finalize order");
  }
});

exports.getAnalytics = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);
  await requireAdmin(auth.uid);

  try {
    return await getAnalytics();
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    throw new functions.https.HttpsError("internal", "Failed to fetch analytics");
  }
});

exports.updateUserRole = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await updateUserRole({
      actorUid: auth.uid,
      targetUserId: data?.targetUserId,
      role: data?.role,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to update user role:", error);
    throw new functions.https.HttpsError("internal", "Failed to update user role");
  }
});

exports.deleteUserProfile = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await deleteUserProfile({
      actorUid: auth.uid,
      targetUserId: data?.targetUserId,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to delete user profile:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete user profile");
  }
});

exports.saveProduct = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await saveProduct({
      actorUid: auth.uid,
      productId: data?.productId,
      payload: data?.payload,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to save product:", error);
    throw new functions.https.HttpsError("internal", "Failed to save product");
  }
});

exports.deleteProduct = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await deleteProduct({
      actorUid: auth.uid,
      productId: data?.productId,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to delete product:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete product");
  }
});

exports.createCoupon = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await createCoupon({
      actorUid: auth.uid,
      payload: data?.payload,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to create coupon:", error);
    throw new functions.https.HttpsError("internal", "Failed to create coupon");
  }
});

exports.deleteCoupon = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await deleteCoupon({
      actorUid: auth.uid,
      couponId: data?.couponId,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to delete coupon:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete coupon");
  }
});

exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await updateOrderStatus({
      actorUid: auth.uid,
      orderId: data?.orderId,
      status: data?.status,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to update order status:", error);
    throw new functions.https.HttpsError("internal", "Failed to update order status");
  }
});

exports.deleteOrder = functions.https.onCall(async (data, context) => {
  const auth = assertAuthenticated(context);

  try {
    return await deleteOrder({
      actorUid: auth.uid,
      orderId: data?.orderId,
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Failed to delete order:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete order");
  }
});

exports.cleanupPendingOrders = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const snap = await db
      .collection("orders")
      .where("paymentStatus", "==", "pending")
      .where("createdAt", "<", cutoff)
      .get();

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Cleaned up ${snap.size} stale pending orders`);
    return null;
  });
