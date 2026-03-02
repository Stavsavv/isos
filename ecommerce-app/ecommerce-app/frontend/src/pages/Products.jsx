import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, orderBy, limit, getDocs, startAfter,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import ProductCard from '../components/ProductCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive'];
const SORT_OPTIONS = [
  { label: 'Newest', value: 'createdAt_desc' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating_desc' },
];
const PAGE_SIZE = 12;

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get('category') || 'All';
  const sort = searchParams.get('sort') || 'createdAt_desc';
  const search = searchParams.get('search') || '';

  const updateParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val && val !== 'All') p.set(key, val);
    else p.delete(key);
    p.delete('page');
    setSearchParams(p);
    setPage(1);
  };

  const fetchProducts = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const [sortField, sortDir] = sort.split('_');
      let constraints = [orderBy(sortField, sortDir)];
      if (category && category !== 'All') constraints.unshift(where('category', '==', category));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(PAGE_SIZE + 1));

      const q = query(collection(db, 'products'), ...constraints);
      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, PAGE_SIZE).map((d) => ({ id: d.id, ...d.data() }));

      let filtered = docs;
      if (search) {
        const s = search.toLowerCase();
        filtered = docs.filter((p) => p.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
      }

      if (reset) {
        setProducts(filtered);
      } else {
        setProducts((prev) => [...prev, ...filtered]);
      }
      setHasMore(snap.docs.length > PAGE_SIZE);
      setLastDoc(snap.docs[PAGE_SIZE - 1] || null);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [category, sort, search]);

  useEffect(() => {
    fetchProducts(true);
  }, [category, sort, search]);

  return (
    <div className="page-container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title">{category === 'All' ? 'All Products' : category}</h1>
          {search && <p className="text-surface-500 mt-1">Search results for "<span className="text-primary-500">{search}</span>"</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden btn-secondary flex items-center gap-2"
          >
            <SlidersHorizontal size={16} /> Filters
          </button>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="input w-auto text-sm"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters */}
        <aside className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-52 flex-shrink-0`}>
          <div className="card p-5 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Categories</h3>
              {category !== 'All' && (
                <button onClick={() => updateParam('category', 'All')} className="text-xs text-primary-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateParam('category', cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    category === cat
                      ? 'bg-primary-500 text-white font-medium'
                      : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Product grid */}
        <div className="flex-1">
          {loading && page === 1 ? (
            <LoadingSpinner className="py-20" />
          ) : products.length === 0 ? (
            <div className="card py-20 text-center">
              <Search size={48} className="text-surface-300 mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">No products found</h3>
              <p className="text-surface-500">Try adjusting your search or filters</p>
              {(search || category !== 'All') && (
                <button
                  onClick={() => setSearchParams({})}
                  className="btn-primary mt-4"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => { setPage(p => p + 1); fetchProducts(false); }}
                    disabled={loading}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : null}
                    Load More Products
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
