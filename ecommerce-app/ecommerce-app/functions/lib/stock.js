const { db } = require("./firebase");
const { SHOT_NUMBER_STATUS } = require("./constants");

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
      const stock = Number.isFinite(rawStock) && rawStock > 0
        ? Math.floor(rawStock)
        : 0;
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

function safeStripeImage(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
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
      status: nextStock > 0
        ? SHOT_NUMBER_STATUS.AVAILABLE
        : SHOT_NUMBER_STATUS.UNAVAILABLE,
      stock: nextStock > 0 ? nextStock : 0,
    };
  });

  const totalStock = nextNumbers.reduce(
    (sum, entry) => (
      entry.status === SHOT_NUMBER_STATUS.AVAILABLE ? sum + (entry.stock || 0) : sum
    ),
    0,
  );

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

async function applyOrderStockUpdatesInTransaction(transaction, orderItems) {
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

async function applyOrderStockUpdatesAtomic(orderItems) {
  const reductionByProduct = buildReductionByProduct(orderItems);
  if (!reductionByProduct.size) return;

  await db.runTransaction(async (transaction) => {
    await applyOrderStockUpdatesInTransaction(transaction, orderItems);
  });
}

module.exports = {
  safeStripeImage,
  getShotNumberAvailability,
  getOrderItemProductId,
  getOrderItemShotNumber,
  applyOrderStockUpdatesAtomic,
  applyOrderStockUpdatesInTransaction,
};
