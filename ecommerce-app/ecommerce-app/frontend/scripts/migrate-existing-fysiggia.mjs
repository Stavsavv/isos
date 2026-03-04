import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");

function loadDotEnv(filePath) {
  const envRaw = fs.readFileSync(filePath, "utf8");
  const values = {};
  envRaw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    values[key] = value;
  });
  return values;
}

const env = loadDotEnv(path.join(frontendRoot, ".env"));

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const HUNTING_CATEGORY_NAME = "ΚΥΝΗΓΕΤΙΚΑ ΕΙΔΗ";
const FYSIGGIA_SUBCATEGORY_VALUE = "fysiggia";
const FYSIGGIA_META_OPTIONS = {
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
  shotNumber: ["1", "2", "3", "4", "5", "6", "7", "7.5", "8", "8.5", "9", "9.5", "10"],
};
const initialFysiggiaMeta = {
  manufacturer: "",
  type: "",
  game: [],
  caliber: "",
  powderWeightGr: "",
  specialLoad: "",
  shotSize: "",
  shotNumber: [],
  onSale: false,
};

const DIACRITICS_RE = /[\u0300-\u036f]/g;
const SHOT_NUMBER_VALUES = new Set(FYSIGGIA_META_OPTIONS.shotNumber);
const GREEK_VOLA = "\u03b2\u03bf\u03bb\u03b1";
const GREEK_GOMOSI = "\u03b3\u03bf\u03bc\u03c9\u03c3\u03b7";
const GREEK_NO = "\u03bd\u03bf";
const GREEK_NUMERO = "\u03bd\u03bf\u03c5\u03bc\u03b5\u03c1\u03bf";
const SHOT_SIZE_BY_NUMBER = Object.fromEntries(
  FYSIGGIA_META_OPTIONS.shotSize.map((value) => [value.replace(GREEK_VOLA, ""), value]),
);
const GAME_SYNONYMS = {
  "\u03b1\u03b3\u03c1\u03b9\u03bf\u03b3\u03bf\u03c5\u03c1\u03bf\u03c5\u03bd\u03bf":
    "\u0391\u03b3\u03c1\u03b9\u03bf\u03b3\u03bf\u03cd\u03c1\u03bf\u03c5\u03bd\u03bf",
  "\u03c4\u03c3\u03b9\u03c7\u03bb\u03b1": "\u03a4\u03c3\u03af\u03c7\u03bb\u03b1",
  "\u03bb\u03b1\u03b3\u03bf\u03c2": "\u039b\u03b1\u03b3\u03cc\u03c2",
  "\u03c6\u03b1\u03c3\u03c3\u03b1": "\u03a6\u03ac\u03c3\u03c3\u03b1",
  "\u03bc\u03c0\u03b5\u03ba\u03b1\u03c4\u03c3\u03b1": "\u039c\u03c0\u03b5\u03ba\u03ac\u03c4\u03c3\u03b1",
  "\u03c0\u03b1\u03c0\u03b9\u03b1": "\u03a0\u03ac\u03c0\u03b9\u03b1",
  "\u03c5\u03b4\u03c1\u03bf\u03b2\u03b9\u03b1": "\u03a0\u03ac\u03c0\u03b9\u03b1",
  "\u03c0\u03b5\u03c1\u03b4\u03b9\u03ba\u03b1": "\u03a0\u03ad\u03c1\u03b4\u03b9\u03ba\u03b1",
  "\u03c6\u03b1\u03c3\u03b9\u03b1\u03bd\u03bf\u03c2": "\u03a6\u03b1\u03c3\u03b9\u03b1\u03bd\u03cc\u03c2",
};

function normalizeForMatch(value = "") {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
}

function stripHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatchFromOptions(normalizedText, options) {
  return (
    options.find((option) => normalizedText.includes(normalizeForMatch(option))) ||
    ""
  );
}

function parseFysiggiaMetaFromDescription(rawDescription = "") {
  const plainText = stripHtml(rawDescription);
  const normalizedText = normalizeForMatch(plainText);
  if (!normalizedText) return null;

  const parsed = { ...initialFysiggiaMeta, game: [] };

  parsed.manufacturer = firstMatchFromOptions(
    normalizedText,
    FYSIGGIA_META_OPTIONS.manufacturer,
  );
  parsed.type = firstMatchFromOptions(normalizedText, FYSIGGIA_META_OPTIONS.type);

  const foundGames = new Set();
  Object.entries(GAME_SYNONYMS).forEach(([needle, mapped]) => {
    if (normalizedText.includes(needle)) foundGames.add(mapped);
  });
  parsed.game = FYSIGGIA_META_OPTIONS.game.filter((value) =>
    foundGames.has(value),
  );

  if (/\b9\s*mm\b/i.test(normalizedText) || /\bcal\s*9\s*mm\b/i.test(normalizedText)) {
    parsed.caliber = "Cal 9mm";
  } else {
    const caliberByGauge = {
      "12": "Cal 12",
      "16": "Cal 16",
      "20": "Cal 20",
      "28": "Cal 28",
      "36": "Cal 36",
    };
    Object.entries(caliberByGauge).some(([gauge, caliber]) => {
      if (
        new RegExp(`\\b${gauge}\\s*\\/\\s*\\d{2}\\b`).test(normalizedText) ||
        new RegExp(`\\bcal\\s*${gauge}\\b`).test(normalizedText)
      ) {
        parsed.caliber = caliber;
        return true;
      }
      return false;
    });
  }

  const powderMatch =
    normalizedText.match(
      new RegExp(`${GREEK_GOMOSI}\\s*[:\\-]?\\s*(\\d+(?:[.,]\\d+)?)\\s*gr\\b`),
    ) ||
    normalizedText.match(
      new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*gr\\b.{0,20}${GREEK_GOMOSI}`),
    );
  if (powderMatch?.[1]) {
    parsed.powderWeightGr = powderMatch[1].replace(",", ".");
  }

  parsed.specialLoad =
    ["Super Magnum", "Semi Magnum", "Magnum"].find((value) =>
      normalizedText.includes(normalizeForMatch(value)),
    ) || "";

  const shotSizeMatch = normalizedText.match(
    new RegExp(`\\b(8|9|10|12|15|27)\\s*${GREEK_VOLA}\\b`),
  );
  if (shotSizeMatch?.[1] && SHOT_SIZE_BY_NUMBER[shotSizeMatch[1]]) {
    parsed.shotSize = SHOT_SIZE_BY_NUMBER[shotSizeMatch[1]];
  }

  const shotNumberMatches = Array.from(
    normalizedText.matchAll(
      new RegExp(
        `\\b(?:${GREEK_NO}|no|n${GREEK_NO[1]}|numero|${GREEK_NUMERO})\\s*[:.]?\\s*(1|2|3|4|5|6|7(?:[.,]5)?|8(?:[.,]5)?|9(?:[.,]5)?|10)\\b`,
        "g",
      ),
    ),
  )
    .map((match) => match[1]?.replace(",", "."))
    .filter((value) => value && SHOT_NUMBER_VALUES.has(value));
  parsed.shotNumber = [...new Set(shotNumberMatches)];

  return parsed;
}

function normalizeShotNumberArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function arrayEquals(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

async function run() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@shopnow.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Signing in as ${adminEmail}...`);
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

  const productsRef = collection(db, "products");
  const huntingQuery = query(
    productsRef,
    where("category", "==", HUNTING_CATEGORY_NAME),
  );
  const snap = await getDocs(huntingQuery);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Found ${docs.length} hunting products.`);

  const updates = [];
  docs.forEach((product) => {
    const parsed = parseFysiggiaMetaFromDescription(product.description || "");
    if (!parsed) return;

    const currentMeta = {
      ...initialFysiggiaMeta,
      ...(product.shotgunShells || {}),
      game: product.shotgunShells?.game || [],
      shotNumber: normalizeShotNumberArray(product.shotgunShells?.shotNumber),
    };

    const nextMeta = {
      ...currentMeta,
      manufacturer: parsed.manufacturer || "",
      type: parsed.type || "",
      game: parsed.game || [],
      caliber: parsed.caliber || "",
      powderWeightGr: parsed.powderWeightGr || "",
      specialLoad: parsed.specialLoad || "",
      shotSize: parsed.shotSize || "",
      shotNumber: parsed.shotNumber || [],
    };

    const subcategoryChanged = product.subcategory !== FYSIGGIA_SUBCATEGORY_VALUE;
    const metaChanged =
      currentMeta.manufacturer !== nextMeta.manufacturer ||
      currentMeta.type !== nextMeta.type ||
      !arrayEquals(currentMeta.game, nextMeta.game) ||
      currentMeta.caliber !== nextMeta.caliber ||
      String(currentMeta.powderWeightGr || "") !== String(nextMeta.powderWeightGr || "") ||
      currentMeta.specialLoad !== nextMeta.specialLoad ||
      currentMeta.shotSize !== nextMeta.shotSize ||
      !arrayEquals(currentMeta.shotNumber, nextMeta.shotNumber);

    if (subcategoryChanged || metaChanged) {
      updates.push({
        id: product.id,
        subcategory: FYSIGGIA_SUBCATEGORY_VALUE,
        shotgunShells: nextMeta,
      });
    }
  });

  if (!updates.length) {
    console.log("No products required updates.");
    return;
  }

  console.log(`Updating ${updates.length} products...`);
  let batch = writeBatch(db);
  let ops = 0;
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i];
    batch.update(doc(db, "products", update.id), {
      subcategory: update.subcategory,
      shotgunShells: update.shotgunShells,
      updatedAt: serverTimestamp(),
    });
    ops++;
    if (ops === 400) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
