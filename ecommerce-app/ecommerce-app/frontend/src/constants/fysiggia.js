export const HUNTING_CATEGORY_NAME = "ΚΥΝΗΓΕΤΙΚΑ ΕΙΔΗ";
export const FYSIGGIA_SUBCATEGORY_VALUE = "fysiggia";
export const FYSIGGIA_SUBCATEGORY_LABEL = "Φυσίγγια";

export const FYSIGGIA_META_OPTIONS = {
  manufacturer: [
    "Lambro",
    "Kirgias",
    "Fiocchi",
    "Nobel Sport",
    "Winchester",
    "Remington",
    "Rottweil",
    "Sigma III International",
  ],
  type: ["Μονόβολα", "Δράμια", "Διασποράς", "Αδρανείας"],
  game: ["Αγριογούρουνο", "Τσίχλα", "Λαγός", "Φάσσα", "Μπεκάτσα", "Πάπια", "Πέρδικα", "Φασιανός"],
  caliber: ["Cal 9mm", "Cal 12", "Cal 16", "Cal 20", "Cal 28", "Cal 36"],
  specialLoad: ["Magnum", "Super Magnum", "Semi Magnum"],
  shotSize: ["8βολα", "9βολα", "10βολα", "12βολα", "15βολα", "27βολα"],
  shotNumber: ["1", "2", "3", "4", "5", "6", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11"],
};

export const PRICE_PRESET_RANGES = [
  { key: "lt15", label: "Έως 15€", min: 0, max: 15 },
  { key: "15to20", label: "15-20€", min: 15, max: 20 },
  { key: "20to25", label: "20-25€", min: 20, max: 25 },
  { key: "gte25", label: "Από 25€ και άνω", min: 25, max: Infinity },
];

export const initialFysiggiaMeta = {
  manufacturer: "",
  type: "",
  game: [],
  caliber: "",
  powderWeightGr: "",
  specialLoad: "",
  shotSize: "",
  shotNumber: [],
  numbers: [],
  onSale: false,
};

export const SHOT_NUMBER_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  HIDDEN: "hidden",
};

export function normalizeShotNumberArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

export function normalizeShotNumberEntries(value, fallbackShotNumbers = []) {
  const optionSet = new Set(FYSIGGIA_META_OPTIONS.shotNumber);
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const normalizedValue = String(entry.value ?? "").trim();
      if (!optionSet.has(normalizedValue)) return null;
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

  const fallbackValues = normalizeShotNumberArray(fallbackShotNumbers);
  const fallbackEntries = fallbackValues
    .filter((shotNumber) => optionSet.has(shotNumber))
    .filter((shotNumber, index, arr) => arr.indexOf(shotNumber) === index)
    .map((shotNumber) => ({
      value: shotNumber,
      status: SHOT_NUMBER_STATUS.AVAILABLE,
      stock: 0,
    }));
  return fallbackEntries;
}

export function getDefinedShotNumberValues(meta) {
  return normalizeShotNumberEntries(meta?.numbers, meta?.shotNumber)
    .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
    .map((entry) => entry.value);
}

export function getAllShotNumberEntries(meta) {
  const normalized = normalizeShotNumberEntries(meta?.numbers, meta?.shotNumber);
  const byValue = new Map(normalized.map((entry) => [entry.value, entry]));
  return FYSIGGIA_META_OPTIONS.shotNumber.map((value) => (
    byValue.get(value) || { value, status: SHOT_NUMBER_STATUS.HIDDEN, stock: 0 }
  ));
}

export function getAvailableStockForShotNumber(meta, shotNumber) {
  const entry = normalizeShotNumberEntries(meta?.numbers, meta?.shotNumber)
    .find((item) => item.value === String(shotNumber));
  if (!entry || entry.status !== SHOT_NUMBER_STATUS.AVAILABLE) return 0;
  return entry.stock || 0;
}

export function isFysiggiaProduct(product) {
  return (
    product?.category === HUNTING_CATEGORY_NAME &&
    product?.subcategory === FYSIGGIA_SUBCATEGORY_VALUE
  );
}
