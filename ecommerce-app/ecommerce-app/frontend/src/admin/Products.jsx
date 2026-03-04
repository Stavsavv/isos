import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase/config.js";
import AdminLayout from "../components/AdminLayout.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import toast from "react-hot-toast";
import { Plus, Edit, Trash2, X, Star } from "lucide-react";
import { CATEGORY_OPTIONS } from "../constants/categories.js";
import {
  FYSIGGIA_META_OPTIONS,
  FYSIGGIA_SUBCATEGORY_LABEL,
  FYSIGGIA_SUBCATEGORY_VALUE,
  HUNTING_CATEGORY_NAME,
  normalizeShotNumberEntries,
  initialFysiggiaMeta,
} from "../constants/fysiggia.js";
import "react-quill/dist/quill.snow.css";
const ReactQuill = lazy(() => import("react-quill"));

const CATEGORIES = CATEGORY_OPTIONS.map((category) => category.name);

const baseInitialForm = {
  name: "",
  description: "",
  price: "",
  category: CATEGORIES[0],
  subcategory: "",
  stock: "",
  images: [],
  shotgunShells: initialFysiggiaMeta,
};

const getInitialForm = () => ({
  ...baseInitialForm,
  images: [],
  shotgunShells: { ...initialFysiggiaMeta, game: [], shotNumber: [], numbers: [] },
});

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
  if (!normalizedText) return { parsed: null, signature: "" };

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
  } else {
    const shotSizeFromNo = normalizedText.match(
      new RegExp(
        `\\b(?:${GREEK_NO}|no|n${GREEK_NO[1]}|numero|${GREEK_NUMERO})\\s*[:.]?\\s*(8|9|10|12|15|27)\\b`,
      ),
    );
    if (shotSizeFromNo?.[1] && SHOT_SIZE_BY_NUMBER[shotSizeFromNo[1]]) {
      parsed.shotSize = SHOT_SIZE_BY_NUMBER[shotSizeFromNo[1]];
    }
  }

  const shotNumberMatches = Array.from(
    normalizedText.matchAll(
      new RegExp(
        `\\b(?:${GREEK_NO}|no|n${GREEK_NO[1]}|numero|${GREEK_NUMERO})\\s*[:.]?\\s*(1|2|3|4|5|6|7(?:[.,]5)?|8(?:[.,]5)?|9(?:[.,]5)?|10|11)\\b`,
        "g",
      ),
    ),
  )
    .map((match) => match[1]?.replace(",", "."))
    .filter((value) => value && SHOT_NUMBER_VALUES.has(value));
  parsed.shotNumber = [...new Set(shotNumberMatches)];

  return { parsed, signature: normalizedText };
}

function arrayEquals(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getInitialForm);
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bulkAutofilling, setBulkAutofilling] = useState(false);
  const [autofillRan, setAutofillRan] = useState(false);
  const autofillTimerRef = useRef(null);
  const lastAutofillSignatureRef = useRef("");

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc")),
    );
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const openAdd = () => {
    setEditing(null);
    setImageUrl("");
    setForm(getInitialForm());
    setAutofillRan(false);
    lastAutofillSignatureRef.current = "";
    setShowModal(true);
  };
  const openEdit = (product) => {
    setEditing(product.id);
    setImageUrl("");
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      subcategory: product.subcategory || "",
      stock: product.stock,
      images: product.images || [],
      shotgunShells: {
        ...initialFysiggiaMeta,
        ...(product.shotgunShells || {}),
        game: product.shotgunShells?.game || [],
        numbers: normalizeShotNumberEntries(
          product.shotgunShells?.numbers || product.numbers,
          product.shotgunShells?.shotNumber || product.shotNumber,
        ),
      },
    });
    setAutofillRan(false);
    lastAutofillSignatureRef.current = "";
    setShowModal(true);
  };

  const isFysiggiaForm =
    form.category === HUNTING_CATEGORY_NAME &&
    form.subcategory === FYSIGGIA_SUBCATEGORY_VALUE;

  const updateFysiggiaField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      shotgunShells: { ...prev.shotgunShells, [key]: value },
    }));
  };

  const toggleFysiggiaMulti = (key, value) => {
    const current = form.shotgunShells[key] || [];
    const next = current.includes(value)
      ? current.filter((x) => x !== value)
      : [...current, value];
    updateFysiggiaField(key, next);
  };

  const cycleShotNumberState = (value) => {
    setForm((prev) => {
      const current = normalizeShotNumberEntries(
        prev.shotgunShells?.numbers,
        prev.shotgunShells?.shotNumber,
      );
      const index = current.findIndex((entry) => entry.value === value);
      let next;

      if (index === -1) {
        next = [...current, { value, available: true }];
      } else if (current[index].available) {
        next = current.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, available: false } : entry,
        );
      } else {
        next = current.filter((entry) => entry.value !== value);
      }

      return {
        ...prev,
        shotgunShells: {
          ...prev.shotgunShells,
          numbers: next,
          shotNumber: next.map((entry) => entry.value),
        },
      };
    });
  };

  useEffect(() => {
    return () => {
      if (autofillTimerRef.current) clearTimeout(autofillTimerRef.current);
    };
  }, []);

  const runDescriptionAutofill = (description, force = false) => {
    if (!isFysiggiaForm) return;
    const { parsed, signature } = parseFysiggiaMetaFromDescription(description);
    if (!parsed || !signature) return;
    if (!force && signature === lastAutofillSignatureRef.current) return;

    setForm((prev) => ({
      ...prev,
      shotgunShells: {
        ...prev.shotgunShells,
        manufacturer: parsed.manufacturer || "",
        type: parsed.type || "",
        game: parsed.game || [],
        caliber: parsed.caliber || "",
        powderWeightGr: parsed.powderWeightGr || "",
        specialLoad: parsed.specialLoad || "",
        shotSize: parsed.shotSize || "",
        shotNumber: parsed.shotNumber || [],
        numbers: (parsed.shotNumber || []).map((value) => ({
          value,
          available: true,
        })),
      },
    }));
    lastAutofillSignatureRef.current = signature;
    setAutofillRan(true);
  };

  useEffect(() => {
    if (!showModal || !isFysiggiaForm || !form.description) return;
    if (autofillTimerRef.current) clearTimeout(autofillTimerRef.current);
    autofillTimerRef.current = setTimeout(() => {
      runDescriptionAutofill(form.description, false);
    }, 250);
  }, [showModal, isFysiggiaForm, form.description]);

  const handleAddImageUrl = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    try {
      // Basic URL validation before storing in Firestore.
      new URL(trimmed);
    } catch {
      toast.error("Please enter a valid image URL");
      return;
    }
    setForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
    setImageUrl("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.stock) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        subcategory: form.subcategory || "",
        stock: parseInt(form.stock),
        images: form.images,
        updatedAt: serverTimestamp(),
      };

      if (isFysiggiaForm) {
        const normalizedNumbers = normalizeShotNumberEntries(
          form.shotgunShells?.numbers,
          form.shotgunShells?.shotNumber,
        );
        data.shotgunShells = {
          ...form.shotgunShells,
          numbers: normalizedNumbers,
          shotNumber: normalizedNumbers.map((entry) => entry.value),
          powderWeightGr:
            form.shotgunShells.powderWeightGr === ""
              ? null
              : parseFloat(form.shotgunShells.powderWeightGr),
        };
        data.numbers = normalizedNumbers;
      } else {
        data.shotgunShells = null;
        data.numbers = null;
      }

      if (editing) {
        await updateDoc(doc(db, "products", editing), data);
        toast.success("Product updated");
      } else {
        data.rating = 0;
        data.reviewCount = 0;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "products"), data);
        toast.success("Product added");
      }
      setShowModal(false);
      fetchProducts();
    } catch {
      toast.error("Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      setProducts((p) => p.filter((x) => x.id !== id));
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleBulkAutofillAll = async () => {
    if (
      !confirm(
        "Autofill metadata for all products in ÎšÎ¥ÎÎ—Î“Î•Î¤Î™ÎšÎ‘ Î•Î™Î”Î— > Î¦Ï…ÏƒÎ¯Î³Î³Î¹Î±?",
      )
    ) {
      return;
    }

    setBulkAutofilling(true);
    try {
      const candidates = products.filter(
        (product) =>
          product.category === HUNTING_CATEGORY_NAME &&
          product.subcategory === FYSIGGIA_SUBCATEGORY_VALUE,
      );

      const updates = [];
      candidates.forEach((product) => {
        const { parsed, signature } = parseFysiggiaMetaFromDescription(
          product.description || "",
        );
        if (!parsed || !signature) return;

        const currentMeta = {
          ...initialFysiggiaMeta,
          ...(product.shotgunShells || {}),
          game: product.shotgunShells?.game || [],
          numbers: normalizeShotNumberEntries(
            product.shotgunShells?.numbers,
            product.shotgunShells?.shotNumber,
          ),
          shotNumber: normalizeShotNumberEntries(
            product.shotgunShells?.numbers,
            product.shotgunShells?.shotNumber,
          ).map((entry) => entry.value),
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
          numbers: (parsed.shotNumber || []).map((value) => ({
            value,
            available: true,
          })),
        };

        const changed =
          currentMeta.manufacturer !== nextMeta.manufacturer ||
          currentMeta.type !== nextMeta.type ||
          !arrayEquals(currentMeta.game, nextMeta.game) ||
          currentMeta.caliber !== nextMeta.caliber ||
          String(currentMeta.powderWeightGr || "") !==
            String(nextMeta.powderWeightGr || "") ||
          currentMeta.specialLoad !== nextMeta.specialLoad ||
          currentMeta.shotSize !== nextMeta.shotSize ||
          !arrayEquals(currentMeta.shotNumber, nextMeta.shotNumber) ||
          JSON.stringify(currentMeta.numbers) !== JSON.stringify(nextMeta.numbers);

        if (changed) {
          updates.push({ id: product.id, shotgunShells: nextMeta });
        }
      });

      if (!updates.length) {
        toast("No products needed metadata updates");
        return;
      }

      let batch = writeBatch(db);
      let ops = 0;
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        batch.update(doc(db, "products", update.id), {
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

      setProducts((prev) =>
        prev.map((product) => {
          const changed = updates.find((u) => u.id === product.id);
          return changed
            ? { ...product, shotgunShells: changed.shotgunShells }
            : product;
        }),
      );

      toast.success(`Autofilled metadata for ${updates.length} product(s)`);
    } catch {
      toast.error("Bulk autofill failed");
    } finally {
      setBulkAutofilling(false);
    }
  };

  return (
    <AdminLayout title="Product Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-surface-500 text-sm">
          {products.length} products total
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkAutofillAll}
            disabled={bulkAutofilling}
            className="btn-secondary text-sm"
          >
            {bulkAutofilling ? "Autofilling..." : "Autofill All Î¦Ï…ÏƒÎ¯Î³Î³Î¹Î±"}
          </button>
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="text-left p-4 text-surface-500 font-medium">
                    Product
                  </th>
                  <th className="text-left p-4 text-surface-500 font-medium">
                    Category
                  </th>
                  <th className="text-left p-4 text-surface-500 font-medium">
                    Price
                  </th>
                  <th className="text-left p-4 text-surface-500 font-medium">
                    Stock
                  </th>
                  <th className="text-left p-4 text-surface-500 font-medium">
                    Rating
                  </th>
                  <th className="text-right p-4 text-surface-500 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center p-12 text-surface-400"
                    >
                      No products yet. Add your first product!
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              product.images?.[0] ||
                              "https://via.placeholder.com/40"
                            }
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <span className="font-medium line-clamp-1 max-w-[200px]">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-surface-500">
                        {product.category}
                      </td>
                      <td className="p-4 font-medium">
                        ${product.price?.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`badge ${product.stock > 10 ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" : product.stock > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1">
                          <Star
                            size={13}
                            className="text-amber-400 fill-amber-400"
                          />{" "}
                          {product.rating || 0}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            className="p-1.5 text-surface-500 hover:text-primary-500 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-surface-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
              <h2 className="font-display font-bold text-xl">
                {editing ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  Product Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Description
                </label>
                <div className="dark:text-surface-900">
                  <Suspense
                    fallback={
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        className="input min-h-[160px] resize-y"
                        placeholder="Loading editor..."
                      />
                    }
                  >
                    <ReactQuill
                      theme="snow"
                      value={form.description}
                      onChange={(value) => {
                        setForm({ ...form, description: value });
                        if (autofillTimerRef.current) {
                          clearTimeout(autofillTimerRef.current);
                        }
                        autofillTimerRef.current = setTimeout(() => {
                          runDescriptionAutofill(value, false);
                        }, 400);
                      }}
                      onBlur={() => runDescriptionAutofill(form.description, false)}
                      className="bg-white"
                      placeholder="Product description"
                      modules={{
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ["bold", "italic", "underline", "strike"],
                          [{ list: "ordered" }, { list: "bullet" }],
                          ["clean"],
                        ],
                      }}
                    />
                  </Suspense>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Price ($) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Stock *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              {form.category === HUNTING_CATEGORY_NAME && (
                <div>
                  <label className="text-sm font-medium block mb-1">Subcategory</label>
                  <select
                    value={form.subcategory || ""}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    className="input"
                  >
                    <option value="">-</option>
                    <option value={FYSIGGIA_SUBCATEGORY_VALUE}>{FYSIGGIA_SUBCATEGORY_LABEL}</option>
                  </select>
                </div>
              )}

              {isFysiggiaForm && (
                <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Manufacturer</label>
                      <select
                        value={form.shotgunShells.manufacturer}
                        onChange={(e) => updateFysiggiaField("manufacturer", e.target.value)}
                        className="input"
                      >
                        <option value="">-</option>
                        {FYSIGGIA_META_OPTIONS.manufacturer.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Type</label>
                      <select
                        value={form.shotgunShells.type}
                        onChange={(e) => updateFysiggiaField("type", e.target.value)}
                        className="input"
                      >
                        <option value="">-</option>
                        {FYSIGGIA_META_OPTIONS.type.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Game</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FYSIGGIA_META_OPTIONS.game.map((value) => (
                        <label key={value} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={form.shotgunShells.game.includes(value)}
                            onChange={() => toggleFysiggiaMulti("game", value)}
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Caliber</label>
                      <select
                        value={form.shotgunShells.caliber}
                        onChange={(e) => updateFysiggiaField("caliber", e.target.value)}
                        className="input"
                      >
                        <option value="">-</option>
                        {FYSIGGIA_META_OPTIONS.caliber.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Powder Weight (gr)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.shotgunShells.powderWeightGr}
                        onChange={(e) => updateFysiggiaField("powderWeightGr", e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Special Load</label>
                      <select
                        value={form.shotgunShells.specialLoad}
                        onChange={(e) => updateFysiggiaField("specialLoad", e.target.value)}
                        className="input"
                      >
                        <option value="">(empty)</option>
                        {FYSIGGIA_META_OPTIONS.specialLoad.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Shot Size</label>
                      <select
                        value={form.shotgunShells.shotSize}
                        onChange={(e) => updateFysiggiaField("shotSize", e.target.value)}
                        className="input"
                      >
                        <option value="">-</option>
                        {FYSIGGIA_META_OPTIONS.shotSize.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">{"\u039D\u03BF\u03CD\u03BC\u03B5\u03C1\u03B1 \u03A6\u03C5\u03C3\u03B9\u03B3\u03B3\u03AF\u03C9\u03BD"}</label>
                      <p className="text-xs text-surface-500 mb-2">Click: available / unavailable / hidden</p>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        {FYSIGGIA_META_OPTIONS.shotNumber.map((value) => {
                          const entry = normalizeShotNumberEntries(
                            form.shotgunShells?.numbers,
                            form.shotgunShells?.shotNumber,
                          ).find((item) => item.value === value);
                          const isAvailable = entry?.available === true;
                          const isUnavailable = entry?.available === false;
                          const isHidden = !entry;
                          const stateClass = isAvailable
                            ? "bg-black text-white border-black"
                            : isUnavailable
                              ? "bg-white text-red-600 border-red-500"
                              : "bg-surface-100 text-surface-500 border-surface-300";

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => cycleShotNumberState(value)}
                              className={`rounded-md border px-2 py-1.5 font-medium transition-colors ${stateClass}`}
                            >
                              {value}
                              {isHidden ? " -" : isAvailable ? " +" : " x"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center mt-7">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={Boolean(form.shotgunShells.onSale)}
                          onChange={(e) => updateFysiggiaField("onSale", e.target.checked)}
                        />
                        On Sale
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1">Images</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="input"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Add URL
                  </button>
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  Paste public image links (https://...) for product photos.
                </p>
                {form.images.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.images.map((url, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={url}
                          alt=""
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              images: form.images.filter((_, j) => j !== i),
                            })
                          }
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {submitting && <LoadingSpinner size="sm" />}{" "}
                  {editing ? "Update" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}




