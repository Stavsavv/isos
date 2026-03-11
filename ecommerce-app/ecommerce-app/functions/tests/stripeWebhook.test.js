const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GCLOUD_PROJECT = process.env.FIRESTORE_PROJECT_ID || "shopnow-test";
process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_fake_key";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const functionsIndex = require("..");

const db = admin.firestore();

async function clearCollection(name) {
  const refs = await db.collection(name).listDocuments();
  await Promise.all(refs.map((ref) => ref.delete()));
}

async function clearAll() {
  await clearCollection("products");
  await clearCollection("orders");
  await clearCollection("coupons");
  await clearCollection("carts");
  await clearCollection("users");
}

function createMockReqRes(payload, signature) {
  const req = {
    method: "POST",
    headers: { "stripe-signature": signature },
    rawBody: Buffer.from(payload),
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };

  return { req, res };
}

test("stripeWebhook applies stock and coupon only once", async () => {
  await clearAll();

  const productRef = db.collection("products").doc("product_1");
  await productRef.set({
    name: "Test Product",
    price: 10,
    stock: 5,
    images: [],
  });

  const couponRef = db.collection("coupons").doc("coupon_1");
  await couponRef.set({
    code: "SAVE10",
    type: "percent",
    value: 10,
    usedCount: 0,
    active: true,
  });

  const orderRef = db.collection("orders").doc("order_1");
  await orderRef.set({
    userId: "user_1",
    items: [
      {
        productId: "product_1",
        name: "Test Product",
        price: 10,
        quantity: 2,
        image: "",
      },
    ],
    couponId: "coupon_1",
    couponApplied: false,
    stockApplied: false,
    paymentStatus: "pending",
    orderStatus: "processing",
    totalPrice: 0,
  });

  const eventPayload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        amount_total: 2000,
        metadata: { orderId: "order_1", userId: "user_1" },
      },
    },
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  const { req, res } = createMockReqRes(eventPayload, signature);
  await functionsIndex.stripeWebhook(req, res);
  assert.equal(res.statusCode, 200);

  const productSnap = await productRef.get();
  assert.equal(productSnap.data().stock, 3);

  const couponSnap = await couponRef.get();
  assert.equal(couponSnap.data().usedCount, 1);

  const orderSnap = await orderRef.get();
  assert.equal(orderSnap.data().paymentStatus, "paid");
  assert.equal(orderSnap.data().stockApplied, true);
  assert.equal(orderSnap.data().couponApplied, true);

  const { req: req2, res: res2 } = createMockReqRes(eventPayload, signature);
  await functionsIndex.stripeWebhook(req2, res2);
  assert.equal(res2.statusCode, 200);

  const productSnap2 = await productRef.get();
  assert.equal(productSnap2.data().stock, 3);

  const couponSnap2 = await couponRef.get();
  assert.equal(couponSnap2.data().usedCount, 1);
});
