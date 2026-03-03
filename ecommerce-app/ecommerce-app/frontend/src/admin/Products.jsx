import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import AdminLayout from '../components/AdminLayout.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, X, Star, Upload } from 'lucide-react';

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive'];

const initialForm = { name: '', description: '', price: '', category: CATEGORIES[0], stock: '', images: [] };
const TARGET_IMAGE_BYTES = 250 * 1024;
const MAX_IMAGE_BYTES = 450 * 1024;
const MAX_IMAGE_SIDE = 1200;

function dataUrlSizeBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlSizeBytes(output) > TARGET_IMAGE_BYTES && quality > 0.45) {
    quality -= 0.1;
    output = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrlSizeBytes(output) > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large even after compression');
  }

  return output;
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [imageUrl, setImageUrl] = useState('');
  const [processingImages, setProcessingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
    setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  const openAdd = () => {
    setEditing(null);
    setImageUrl('');
    setForm(initialForm);
    setShowModal(true);
  };
  const openEdit = (product) => {
    setEditing(product.id);
    setImageUrl('');
    setForm({ name: product.name, description: product.description, price: product.price, category: product.category, stock: product.stock, images: product.images || [] });
    setShowModal(true);
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    try {
      // Basic URL validation before storing in Firestore.
      new URL(trimmed);
    } catch {
      toast.error('Please enter a valid image URL');
      return;
    }
    setForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
    setImageUrl('');
  };

  const handleImagePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalid = files.find((file) => !file.type.startsWith('image/'));
    if (invalid) {
      toast.error('Only image files are allowed');
      e.target.value = '';
      return;
    }

    setProcessingImages(true);
    try {
      const compressed = [];
      for (const file of files) {
        const dataUrl = await compressImageFile(file);
        compressed.push(dataUrl);
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...compressed] }));
      toast.success(`${compressed.length} image(s) added from your PC`);
    } catch (error) {
      toast.error(error.message || 'Failed to process selected image(s)');
    } finally {
      setProcessingImages(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.stock) { toast.error('Please fill all required fields'); return; }
    setSubmitting(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        stock: parseInt(form.stock),
        images: form.images,
        rating: editing ? undefined : 0,
        reviewCount: editing ? undefined : 0,
        updatedAt: serverTimestamp(),
      };
      if (!editing) data.createdAt = serverTimestamp();

      if (editing) {
        await updateDoc(doc(db, 'products', editing), data);
        toast.success('Product updated');
      } else {
        await addDoc(collection(db, 'products'), data);
        toast.success('Product added');
      }
      setShowModal(false);
      fetchProducts();
    } catch {
      toast.error('Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      setProducts((p) => p.filter((x) => x.id !== id));
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <AdminLayout title="Product Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-surface-500 text-sm">{products.length} products total</p>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {loading ? <LoadingSpinner className="py-20" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="text-left p-4 text-surface-500 font-medium">Product</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Category</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Price</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Stock</th>
                  <th className="text-left p-4 text-surface-500 font-medium">Rating</th>
                  <th className="text-right p-4 text-surface-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-12 text-surface-400">No products yet. Add your first product!</td></tr>
                ) : products.map((product) => (
                  <tr key={product.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={product.images?.[0] || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        <span className="font-medium line-clamp-1 max-w-[200px]">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-surface-500">{product.category}</td>
                    <td className="p-4 font-medium">${product.price?.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`badge ${product.stock > 10 ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : product.stock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" /> {product.rating || 0}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(product)} className="p-1.5 text-surface-500 hover:text-primary-500 transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 text-surface-500 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <h2 className="font-display font-bold text-xl">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Product Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Product name" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px] resize-none" placeholder="Product description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Price ($) *</label>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Stock *</label>
                  <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Images</label>
                <label className="inline-flex items-center gap-2 btn-secondary cursor-pointer mb-2">
                  {processingImages ? <LoadingSpinner size="sm" /> : <Upload size={16} />}
                  {processingImages ? 'Processing...' : 'Add From PC'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImagePick}
                    disabled={processingImages}
                  />
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="input"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button type="button" onClick={handleAddImageUrl} className="btn-secondary whitespace-nowrap">
                    Add URL
                  </button>
                </div>
                <p className="text-xs text-surface-500 mt-1">
                  You can add from your PC or paste a public URL. Local files are compressed before save.
                </p>
                {form.images.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.images.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {submitting && <LoadingSpinner size="sm" />} {editing ? 'Update' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
