import Stripe from 'stripe';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const EUROPE_ALLOWED_COUNTRIES = [
  'GR', 'CY', 'IT', 'DE', 'FR', 'ES', 'PT', 'NL', 'BE', 'AT', 'IE', 'LU',
  'MT', 'SI', 'SK', 'CZ', 'PL', 'HU', 'RO', 'BG', 'HR', 'SE', 'DK', 'FI',
  'EE', 'LV', 'LT',
];

function initAdmin() {
  if (getApps().length > 0) return;

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

function safeStripeImage(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { items, shippingAddress, couponCode, successUrl, cancelUrl } = req.body || {};
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const db = getFirestore();

    const lineItems = items.map((item) => {
      const stripeImage = safeStripeImage(item.image);
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            ...(stripeImage ? { images: [stripeImage] } : {}),
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal < 50) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Shipping' },
          unit_amount: 499,
        },
        quantity: 1,
      });
    }

    let discounts = [];
    if (couponCode) {
      const couponSnap = await db.collection('coupons')
        .where('code', '==', couponCode.toUpperCase())
        .where('active', '==', true)
        .limit(1)
        .get();

      if (!couponSnap.empty) {
        const coupon = couponSnap.docs[0].data();
        const stripeCoupon = await stripe.coupons.create({
          ...(coupon.type === 'percent'
            ? { percent_off: coupon.value }
            : { amount_off: Math.round(coupon.value * 100), currency: 'eur' }),
          duration: 'once',
        });
        discounts = [{ coupon: stripeCoupon.id }];
      }
    }

    const orderRef = await db.collection('orders').add({
      userId,
      items,
      shippingAddress,
      totalPrice: 0,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      discounts,
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { orderId: orderRef.id, userId },
      shipping_address_collection: {
        allowed_countries: EUROPE_ALLOWED_COUNTRIES,
      },
    });

    return res.status(200).json({ sessionId: session.id, orderId: orderRef.id });
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return res.status(500).json({ error: error.message || 'Payment session failed' });
  }
}
