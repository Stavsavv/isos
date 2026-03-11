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
const CURRENCY = 'eur';
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FEE = 4.99;
const SHOT_NUMBER_STATUS = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  HIDDEN: 'hidden',
};

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

function assertStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!key.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY must start with sk_');
}

function assertAdminEnv() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error('Missing Firebase Admin env vars');
  }
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

function getShotNumberAvailability(productData, shotNumber) {
  if (!shotNumber) return { available: false, stock: 0 };
  const normalizedNumbers = normalizeShotNumberEntries(
    productData?.shotgunShells?.numbers || productData?.numbers,
    productData?.shotgunShells?.shotNumber || productData?.shotNumber,
  );
  const entry = normalizedNumbers.find((item) => item.value === String(shotNumber));
  if (!entry || entry.status !== SHOT_NUMBER_STATUS.AVAILABLE) {
    return { available: false, stock: 0 };
  }
  const stock = Number(entry.stock) || 0;
  return { available: stock > 0, stock };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    assertStripeSecretKey();
    assertAdminEnv();
    initAdmin();
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { items, shippingAddress, couponCode, successUrl, cancelUrl } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing redirect URLs' });
    }

    const db = getFirestore();

    const normalizedItems = items.map((item) => ({
      productId: item?.productId || item?.id,
      quantity: Math.floor(Number(item?.quantity) || 0),
      shotNumber: item?.shotNumber || item?.number || null,
    }));

    for (const item of normalizedItems) {
      if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ error: 'Invalid cart item' });
      }
    }

    const productIds = [...new Set(normalizedItems.map((item) => String(item.productId)))];
    const productRefs = productIds.map((id) => db.collection('products').doc(id));
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
        return res.status(400).json({ error: 'Product not found' });
      }

      const price = Number(productData.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: 'Invalid product price' });
      }

      let availableStock = Number(productData.stock) || 0;
      if (item.shotNumber) {
        const availability = getShotNumberAvailability(productData, item.shotNumber);
        if (!availability.available) {
          return res.status(400).json({ error: `Shot number ${item.shotNumber} is unavailable` });
        }
        availableStock = availability.stock;
      }

      if (item.quantity > availableStock) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }

      const stripeImage = safeStripeImage(productData.images?.[0]);
      lineItems.push({
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: productData.name || 'Product',
            ...(stripeImage ? { images: [stripeImage] } : {}),
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity,
      });

      validatedItems.push({
        productId: String(item.productId),
        name: productData.name || 'Product',
        price,
        image: productData.images?.[0] || '',
        quantity: item.quantity,
        shotNumber: item.shotNumber || null,
      });

      subtotal += price * item.quantity;
    }

    if (subtotal < FREE_SHIPPING_THRESHOLD) {
      lineItems.push({
        price_data: {
          currency: CURRENCY,
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(SHIPPING_FEE * 100),
        },
        quantity: 1,
      });
    }

    let discountAmount = 0;
    let discounts = [];
    let couponMeta = null;
    if (couponCode) {
      const couponSnap = await db.collection('coupons')
        .where('code', '==', couponCode.toUpperCase())
        .where('active', '==', true)
        .limit(1)
        .get();

      if (!couponSnap.empty) {
        const couponDoc = couponSnap.docs[0];
        const coupon = couponDoc.data();
        const minOrder = Number(coupon.minOrder) || 0;
        const maxUses = Number(coupon.maxUses);
        const usedCount = Number(coupon.usedCount) || 0;

        if (minOrder > 0 && subtotal < minOrder) {
          return res.status(400).json({ error: `Minimum order of ${minOrder} required` });
        }
        if (Number.isFinite(maxUses) && usedCount >= maxUses) {
          return res.status(400).json({ error: 'Coupon has reached maximum uses' });
        }

        const stripeCoupon = await stripe.coupons.create({
          ...(coupon.type === 'percent'
            ? { percent_off: coupon.value }
            : { amount_off: Math.round(Number(coupon.value) * 100), currency: CURRENCY }),
          duration: 'once',
        });
        discounts = [{ coupon: stripeCoupon.id }];
        discountAmount = coupon.type === 'percent'
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

    const orderRef = await db.collection('orders').add({
      userId,
      items: validatedItems,
      shippingAddress: shippingAddress || null,
      subtotal,
      discount: discountAmount,
      totalPrice: 0,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      couponCode: couponMeta?.code || null,
      couponId: couponMeta?.id || null,
      currency: CURRENCY,
      stockApplied: false,
      couponApplied: false,
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

    console.log(JSON.stringify({
      event: 'checkout.session.created',
      orderId: orderRef.id,
      userId,
      subtotal,
      discount: discountAmount,
      currency: CURRENCY,
      couponCode: couponMeta?.code || null,
    }));

    return res.status(200).json({ sessionId: session.id, orderId: orderRef.id });
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return res.status(500).json({ error: error.message || 'Payment session failed' });
  }
}
