const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, updateDoc } = require("firebase/firestore");

const PROJECT_ID = process.env.FIRESTORE_PROJECT_ID || "shopnow-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portStr] = EMULATOR_HOST.split(":");
const port = Number(portStr || 8080);

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules: readFileSync(
        path.join(__dirname, "..", "..", "firestore.rules"),
        "utf8",
      ),
    },
  });
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.afterEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

async function seedUser(uid, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", uid), { uid, ...data });
  });
}

test("users cannot escalate role", async () => {
  const uid = "user_1";
  await seedUser(uid, { role: "user", name: "User" });

  const db = testEnv.authenticatedContext(uid).firestore();
  await assertFails(updateDoc(doc(db, "users", uid), { role: "admin" }));
  await assertSucceeds(updateDoc(doc(db, "users", uid), { name: "New Name" }));
});

test("orders creation is restricted to pending/processing/zero total", async () => {
  const uid = "user_2";
  await seedUser(uid, { role: "user", name: "User" });

  const db = testEnv.authenticatedContext(uid).firestore();
  await assertFails(
    setDoc(doc(db, "orders", "order_bad"), {
      userId: uid,
      paymentStatus: "paid",
      orderStatus: "processing",
      totalPrice: 12.34,
    }),
  );

  await assertSucceeds(
    setDoc(doc(db, "orders", "order_ok"), {
      userId: uid,
      paymentStatus: "pending",
      orderStatus: "processing",
      totalPrice: 0,
      items: [{ productId: "p1", quantity: 1 }],
    }),
  );
});

test("users can only update shipping address on their orders", async () => {
  const uid = "user_3";
  await seedUser(uid, { role: "user", name: "User" });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "orders", "order_1"), {
      userId: uid,
      paymentStatus: "pending",
      orderStatus: "processing",
      totalPrice: 0,
    });
  });

  const db = testEnv.authenticatedContext(uid).firestore();
  await assertFails(
    updateDoc(doc(db, "orders", "order_1"), { orderStatus: "shipped" }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "orders", "order_1"), {
      shippingAddress: { line1: "Main" },
      updatedAt: new Date(),
    }),
  );
});

test("coupon writes require admin role", async () => {
  const adminUid = "admin_1";
  const userUid = "user_4";
  await seedUser(adminUid, { role: "admin", name: "Admin" });
  await seedUser(userUid, { role: "user", name: "User" });

  const userDb = testEnv.authenticatedContext(userUid).firestore();
  await assertFails(
    setDoc(doc(userDb, "coupons", "coupon_1"), {
      code: "SAVE10",
      active: true,
    }),
  );

  const adminDb = testEnv.authenticatedContext(adminUid).firestore();
  await assertSucceeds(
    setDoc(doc(adminDb, "coupons", "coupon_1"), {
      code: "SAVE10",
      active: true,
    }),
  );
});
