const functions = require("firebase-functions");
const { admin, db } = require("./firebase");

function assertAuthenticated(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated",
    );
  }

  return context.auth;
}

async function requireAdmin(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin access required",
    );
  }

  return userSnap.data();
}

async function verifyBearerToken(authHeader = "") {
  if (!authHeader.startsWith("Bearer ")) {
    throw new functions.https.HttpsError("unauthenticated", "Unauthorized");
  }

  const idToken = authHeader.substring("Bearer ".length);
  return admin.auth().verifyIdToken(idToken);
}

module.exports = {
  assertAuthenticated,
  requireAdmin,
  verifyBearerToken,
};
