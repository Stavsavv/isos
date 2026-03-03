import Stripe from "stripe";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { orderId, userId } = session.metadata || {};
      if (!orderId || !userId) return res.status(200).json({ received: true });

      const db = getFirestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) return res.status(200).json({ received: true });

      const orderData = orderSnap.data();
      const totalPaid = (session.amount_total || 0) / 100;

      const batch = db.batch();
      batch.update(orderRef, {
        paymentStatus: "paid",
        orderStatus: "processing",
        totalPrice: totalPaid,
        stripeSessionId: session.id,
        paidAt: FieldValue.serverTimestamp(),
      });

      for (const item of orderData.items || []) {
        const productRef = db.collection("products").doc(item.id);
        batch.update(productRef, {
          stock: FieldValue.increment(-item.quantity),
        });
      }

      batch.set(db.collection("carts").doc(userId), {
        items: [],
        coupon: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
      console.log(`Order ${orderId} marked as paid`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("stripeWebhook error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
}
