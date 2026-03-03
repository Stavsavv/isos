import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import ProductCard from '../components/ProductCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { SlidersHorizontal, Search } from 'lucide-react';
import { CATEGORY_OPTIONS, CATEGORY_NAME_BY_SLUG, resolveCategorySlug } from '../constants/categories.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const PAGE_SIZE = 12;

export default function Products() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const CATEGORIES = [
    { name: t('products.all'), slug: 'all' },
    ...CATEGORY_OPTIONS.map((category) => ({
      ...category,
      name: t(`categories.${category.slug}`),
    })),
  ];
  const SORT_OPTIONS = [
    { label: t('products.sort.newest'), value: 'createdAt_desc' },
    { label: t('products.sort.lowHigh'), value: 'price_asc' },
    { label: t('products.sort.highLow'), value: 'price_desc' },
    { label: t('products.sort.rating'), value: 'rating_desc' },
  ];

  const categorySlug = resolveCategorySlug(searchParams.get('category'));
  const selectedCategoryName = categorySlug === 'all' ? null : CATEGORY_NAME_BY_SLUG[categorySlug];
  const categoryName = categorySlug === 'all' ? t('products.allProducts') : t(`categories.${categorySlug}`);
  const sort = searchParams.get('sort') || 'createdAt_desc';
  const search = searchParams.get('search') || '';

  const updateParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val && val !== 'all') p.set(key, val);
    else p.delete(key);
    p.delete('page');
    setSearchParams(p);
    setPage(1);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [sortField, sortDir] = sort.split('_');
      const q = query(collection(db, 'products'), orderBy(sortField, sortDir));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      let filtered = docs;
      if (selectedCategoryName) {
        filtered = filtered.filter((p) => p.category === selectedCategoryName);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter((p) => p.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
      }

      setFilteredProducts(filtered);
      setPage(1);
      setProducts(filtered.slice(0, PAGE_SIZE));
      setHasMore(filtered.length > PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching products:', err);
      setFilteredProducts([]);
      setProducts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryName, sort, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    const nextItems = filteredProducts.slice(0, nextPage * PAGE_SIZE);
    setPage(nextPage);
    setProducts(nextItems);
    setHasMore(nextItems.length < filteredProducts.length);
  };

  return (
    <div className="page-container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title">{categoryName}</h1>
          {search && <p className="text-surface-500 mt-1">{t('products.searchResultsFor')} "<span className="text-primary-500">{search}</span>"</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden btn-secondary flex items-center gap-2"
          >
            <SlidersHorizontal size={16} /> {t('products.filters')}
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
              <h3 className="font-semibold text-sm">{t('products.categories')}</h3>
              {categorySlug !== 'all' && (
                <button onClick={() => updateParam('category', 'all')} className="text-xs text-primary-500 hover:underline">
                  {t('products.clear')}
                </button>
              )}
            </div>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => updateParam('category', cat.slug)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    categorySlug === cat.slug
                      ? 'bg-primary-500 text-white font-medium'
                      : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  {cat.name}
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
              <h3 className="font-display text-xl font-semibold mb-2">{t('products.noProductsFound')}</h3>
              <p className="text-surface-500">{t('products.tryAdjusting')}</p>
              {(search || categorySlug !== 'all') && (
                <button
                  onClick={() => setSearchParams({})}
                  className="btn-primary mt-4"
                >
                  {t('products.clearAllFilters')}
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
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : null}
                    {t('products.loadMore')}
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
