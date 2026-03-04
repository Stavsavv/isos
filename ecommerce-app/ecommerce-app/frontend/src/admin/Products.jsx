import { useState, useEffect, lazy, Suspense } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
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
  SHOT_NUMBER_STATUS,
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
const DEFAULT_SHOT_NUMBER_STOCK = 0;

function mergeShotNumberEntries(existing = [], incoming = []) {
  const merged = new Map();
  existing.forEach((entry) => {
    merged.set(entry.value, entry);
  });
  incoming.forEach((entry) => {
    merged.set(entry.value, entry);
  });
  return FYSIGGIA_META_OPTIONS.shotNumber
    .map((value) => merged.get(value))
    .filter(Boolean);
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getInitialForm);
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
        
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

  const normalizedShotNumbers = normalizeShotNumberEntries(
    form.shotgunShells?.numbers,
    form.shotgunShells?.shotNumber,
  );
  const totalShotNumberStock = normalizedShotNumbers.reduce((sum, entry) => (
    entry.status === SHOT_NUMBER_STATUS.AVAILABLE ? sum + (entry.stock || 0) : sum
  ), 0);

  const cycleShotNumberState = (value) => {
    setForm((prev) => {
      const current = normalizeShotNumberEntries(
        prev.shotgunShells?.numbers,
        prev.shotgunShells?.shotNumber,
      );
      const index = current.findIndex((entry) => entry.value === value);
      let next;

      if (index === -1) {
        next = [
          ...current,
          { value, status: SHOT_NUMBER_STATUS.AVAILABLE, stock: DEFAULT_SHOT_NUMBER_STOCK },
        ];
      } else if (current[index].status === SHOT_NUMBER_STATUS.AVAILABLE) {
        next = current.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, status: SHOT_NUMBER_STATUS.UNAVAILABLE, stock: 0 }
            : entry,
        );
      } else if (current[index].status === SHOT_NUMBER_STATUS.UNAVAILABLE) {
        next = current.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, status: SHOT_NUMBER_STATUS.HIDDEN, stock: 0 }
            : entry,
        );
      } else {
        next = current.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, status: SHOT_NUMBER_STATUS.AVAILABLE, stock: DEFAULT_SHOT_NUMBER_STOCK }
            : entry,
        );
      }

      return {
        ...prev,
        shotgunShells: {
          ...prev.shotgunShells,
          numbers: next,
          shotNumber: next
            .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
            .map((entry) => entry.value),
        },
      };
    });
  };

  const updateShotNumberStock = (value, stockInput) => {
    const parsed = Number(stockInput);
    const stock = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    const status = stock > 0 ? SHOT_NUMBER_STATUS.AVAILABLE : SHOT_NUMBER_STATUS.UNAVAILABLE;

    setForm((prev) => {
      const current = normalizeShotNumberEntries(
        prev.shotgunShells?.numbers,
        prev.shotgunShells?.shotNumber,
      );
      const index = current.findIndex((entry) => entry.value === value);
      const next = index === -1
        ? [
          ...current,
          { value, status, stock },
        ]
        : current.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, status, stock }
            : entry,
        );

      return {
        ...prev,
        shotgunShells: {
          ...prev.shotgunShells,
          numbers: next,
          shotNumber: next
            .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
            .map((entry) => entry.value),
        },
      };
    });
  };
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
    if (
      !form.name ||
      !form.price ||
      (!isFysiggiaForm && (form.stock === "" || form.stock === null || form.stock === undefined))
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const existingProduct = editing
        ? products.find((product) => product.id === editing)
        : null;
      const existingNumbers = normalizeShotNumberEntries(
        existingProduct?.shotgunShells?.numbers || existingProduct?.numbers,
        existingProduct?.shotgunShells?.shotNumber || existingProduct?.shotNumber,
      );
      const normalizedNumbersInput = normalizeShotNumberEntries(
        form.shotgunShells?.numbers,
        form.shotgunShells?.shotNumber,
      );
      const normalizedNumbers = mergeShotNumberEntries(existingNumbers, normalizedNumbersInput);
      const computedStock = normalizedNumbers.reduce((sum, entry) => (
        entry.status === SHOT_NUMBER_STATUS.AVAILABLE ? sum + (entry.stock || 0) : sum
      ), 0);
      const data = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        subcategory: form.subcategory || "",
        stock: isFysiggiaForm ? computedStock : parseInt(form.stock, 10),
        images: form.images,
        updatedAt: serverTimestamp(),
      };

      if (isFysiggiaForm) {
        data.shotgunShells = {
          ...form.shotgunShells,
          numbers: normalizedNumbers,
          shotNumber: normalizedNumbers
            .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
            .map((entry) => entry.value),
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
        const changedFields = { updatedAt: serverTimestamp() };
        const previous = existingProduct || {};
        if (previous.name !== data.name) changedFields.name = data.name;
        if (previous.description !== data.description) changedFields.description = data.description;
        if (Number(previous.price) !== Number(data.price)) changedFields.price = data.price;
        if (previous.category !== data.category) changedFields.category = data.category;
        if ((previous.subcategory || "") !== (data.subcategory || "")) changedFields.subcategory = data.subcategory;
        if (Number(previous.stock) !== Number(data.stock)) changedFields.stock = data.stock;
        if (JSON.stringify(previous.images || []) !== JSON.stringify(data.images || [])) {
          changedFields.images = data.images;
        }
        if (JSON.stringify(previous.shotgunShells || null) !== JSON.stringify(data.shotgunShells || null)) {
          changedFields.shotgunShells = data.shotgunShells;
        }
        if (JSON.stringify(previous.numbers || null) !== JSON.stringify(data.numbers || null)) {
          changedFields.numbers = normalizedNumbers;
        }
        await updateDoc(doc(db, "products", editing), changedFields);
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

  return (
    <AdminLayout title="Product Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-surface-500 text-sm">
          {products.length} products total
        </p>
        <div className="flex items-center gap-2">
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
                      }}
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
                  <label className="text-sm font-medium block mb-1">
                    {isFysiggiaForm ? "Total Stock (auto)" : "Stock *"}
                  </label>
                  <input
                    required={!isFysiggiaForm}
                    type="number"
                    min="0"
                    readOnly={isFysiggiaForm}
                    value={isFysiggiaForm ? String(totalShotNumberStock) : form.stock}
                    onChange={(e) => {
                      if (!isFysiggiaForm) {
                        setForm({ ...form, stock: e.target.value });
                      }
                    }}
                    className="input"
                    placeholder="0"
                  />
                  {isFysiggiaForm && (
                    <p className="text-xs text-surface-500 mt-1">
                      Calculated as the sum of available stock by number.
                    </p>
                  )}
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
                      <div className="space-y-2 text-sm">
                        {FYSIGGIA_META_OPTIONS.shotNumber.map((value) => {
                          const entry = normalizedShotNumbers.find((item) => item.value === value);
                          const status = entry?.status || SHOT_NUMBER_STATUS.HIDDEN;
                          const stateClass = status === SHOT_NUMBER_STATUS.AVAILABLE
                            ? "bg-black text-white border-black"
                            : status === SHOT_NUMBER_STATUS.UNAVAILABLE
                              ? "bg-white text-red-600 border-red-500"
                              : "bg-surface-100 text-surface-500 border-surface-300";

                          return (
                            <div key={value} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => cycleShotNumberState(value)}
                                className={`min-w-12 rounded-md border px-2 py-1.5 font-medium transition-colors ${stateClass}`}
                              >
                                {value}
                              </button>
                              {status === SHOT_NUMBER_STATUS.AVAILABLE && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-surface-500">qty:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={entry?.stock || 0}
                                    onChange={(e) => updateShotNumberStock(value, e.target.value)}
                                    className="input !py-1 !px-2 w-20 text-sm"
                                  />
                                </div>
                              )}
                              {status === SHOT_NUMBER_STATUS.UNAVAILABLE && (
                                <span className="text-xs text-red-600 font-medium">unavailable</span>
                              )}
                              {status === SHOT_NUMBER_STATUS.HIDDEN && (
                                <span className="text-xs text-surface-500">hidden</span>
                              )}
                            </div>
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





