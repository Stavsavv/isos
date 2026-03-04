import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import ProductCard from '../components/ProductCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { SlidersHorizontal, Search } from 'lucide-react';
import { CATEGORY_OPTIONS, CATEGORY_NAME_BY_SLUG, resolveCategorySlug } from '../constants/categories.js';
import {
  FYSIGGIA_META_OPTIONS,
  FYSIGGIA_SUBCATEGORY_LABEL,
  FYSIGGIA_SUBCATEGORY_VALUE,
  PRICE_PRESET_RANGES,
  SHOT_NUMBER_STATUS,
  isFysiggiaProduct,
  normalizeShotNumberEntries,
} from '../constants/fysiggia.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const PAGE_SIZE = 12;

const emptyFacets = {
  manufacturer: [],
  type: [],
  game: [],
  caliber: [],
  specialLoad: [],
  shotSize: [],
  shotNumber: [],
  presetRanges: [],
  onSale: false,
  powderMin: null,
  powderMax: null,
  priceMin: null,
  priceMax: null,
};

function intersects(values = [], selected = []) {
  if (!selected.length) return true;
  return selected.some((value) => values.includes(value));
}

function hasPresetPriceMatch(price, selectedPresets) {
  if (!selectedPresets.length) return true;
  return selectedPresets.some((presetKey) => {
    const preset = PRICE_PRESET_RANGES.find((range) => range.key === presetKey);
    if (!preset) return false;
    return price >= preset.min && price <= preset.max;
  });
}

function getNumericBounds(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return { min: 0, max: 0 };
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

function countByOptions(products, options, getter) {
  return options.reduce((acc, option) => {
    const count = products.reduce((sum, product) => {
      const value = getter(product);
      if (Array.isArray(value)) return sum + (value.includes(option) ? 1 : 0);
      return sum + (value === option ? 1 : 0);
    }, 0);
    if (count > 0) acc[option] = count;
    return acc;
  }, {});
}

function getShotNumberValues(product, onlyAvailable = false) {
  return normalizeShotNumberEntries(
    product?.shotgunShells?.numbers || product?.numbers,
    product?.shotgunShells?.shotNumber || product?.shotNumber,
  )
    .filter((entry) => (
      onlyAvailable
        ? entry.status === SHOT_NUMBER_STATUS.AVAILABLE && (entry.stock || 0) > 0
        : entry.status !== SHOT_NUMBER_STATUS.HIDDEN
    ))
    .map((entry) => entry.value);
}

export default function Products() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [facets, setFacets] = useState(emptyFacets);

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
  const subcategory = searchParams.get('subcategory') || '';
  const isFysiggiaPage = categorySlug === 'kynigetika' && subcategory === FYSIGGIA_SUBCATEGORY_VALUE;
  const categoryName = categorySlug === 'all' ? t('products.allProducts') : t(`categories.${categorySlug}`);
  const sort = searchParams.get('sort') || 'createdAt_desc';
  const search = searchParams.get('search') || '';

  const updateParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val && val !== 'all') p.set(key, val);
    else p.delete(key);
    if (key === 'category' && val !== 'kynigetika') {
      p.delete('subcategory');
    }
    if (key === 'subcategory' && !val) {
      p.delete('subcategory');
    }
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
      setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching products:', err);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categoryAndSearchFiltered = useMemo(() => {
    let filtered = allProducts;
    if (selectedCategoryName) {
      filtered = filtered.filter((p) => p.category === selectedCategoryName);
    }
    if (subcategory) {
      filtered = filtered.filter((p) => p.subcategory === subcategory);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p) => p.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
    }
    return filtered;
  }, [allProducts, selectedCategoryName, subcategory, search]);

  const facetSourceProducts = useMemo(
    () => (isFysiggiaPage ? categoryAndSearchFiltered.filter(isFysiggiaProduct) : []),
    [categoryAndSearchFiltered, isFysiggiaPage],
  );

  const powderBounds = useMemo(
    () => getNumericBounds(facetSourceProducts.map((product) => Number(product.shotgunShells?.powderWeightGr))),
    [facetSourceProducts],
  );

  const priceBounds = useMemo(
    () => getNumericBounds(facetSourceProducts.map((product) => Number(product.price))),
    [facetSourceProducts],
  );

  useEffect(() => {
    if (!isFysiggiaPage) {
      setFacets(emptyFacets);
      return;
    }
    setFacets((prev) => ({
      ...prev,
      powderMin: prev.powderMin == null ? powderBounds.min : Math.max(prev.powderMin, powderBounds.min),
      powderMax: prev.powderMax == null ? powderBounds.max : Math.min(prev.powderMax, powderBounds.max),
      priceMin: prev.priceMin == null ? priceBounds.min : Math.max(prev.priceMin, priceBounds.min),
      priceMax: prev.priceMax == null ? priceBounds.max : Math.min(prev.priceMax, priceBounds.max),
    }));
  }, [isFysiggiaPage, powderBounds.min, powderBounds.max, priceBounds.min, priceBounds.max]);

  const filteredProducts = useMemo(() => {
    if (!isFysiggiaPage) return categoryAndSearchFiltered;

    return facetSourceProducts.filter((product) => {
      const meta = product.shotgunShells || {};
      const powderWeight = Number(meta.powderWeightGr);
      const price = Number(product.price);

      if (facets.manufacturer.length && !facets.manufacturer.includes(meta.manufacturer)) return false;
      if (facets.type.length && !facets.type.includes(meta.type)) return false;
      if (!intersects(Array.isArray(meta.game) ? meta.game : [], facets.game)) return false;
      if (facets.caliber.length && !facets.caliber.includes(meta.caliber)) return false;
      if (facets.specialLoad.length && !facets.specialLoad.includes(meta.specialLoad || '')) return false;
      if (facets.shotSize.length && !facets.shotSize.includes(meta.shotSize)) return false;
      const productShotNumbers = getShotNumberValues(product);
      if (
        facets.shotNumber.length &&
        !facets.shotNumber.some((value) => productShotNumbers.includes(value))
      ) {
        return false;
      }
      if (facets.onSale && !meta.onSale) return false;

      if (Number.isFinite(price)) {
        if (facets.priceMin != null && price < facets.priceMin) return false;
        if (facets.priceMax != null && price > facets.priceMax) return false;
      }
      if (!hasPresetPriceMatch(price, facets.presetRanges)) return false;

      if (Number.isFinite(powderWeight)) {
        if (facets.powderMin != null && powderWeight < facets.powderMin) return false;
        if (facets.powderMax != null && powderWeight > facets.powderMax) return false;
      } else if (facets.powderMin != null || facets.powderMax != null) {
        return false;
      }

      return true;
    });
  }, [categoryAndSearchFiltered, facetSourceProducts, facets, isFysiggiaPage]);

  useEffect(() => {
    setPage(1);
    setProducts(filteredProducts.slice(0, PAGE_SIZE));
    setHasMore(filteredProducts.length > PAGE_SIZE);
  }, [filteredProducts]);

  const facetCounts = useMemo(() => {
    if (!isFysiggiaPage) return null;

    const manufacturer = countByOptions(
      facetSourceProducts,
      FYSIGGIA_META_OPTIONS.manufacturer,
      (product) => product.shotgunShells?.manufacturer,
    );
    const type = countByOptions(
      facetSourceProducts,
      FYSIGGIA_META_OPTIONS.type,
      (product) => product.shotgunShells?.type,
    );
    const game = countByOptions(
      facetSourceProducts,
      FYSIGGIA_META_OPTIONS.game,
      (product) => product.shotgunShells?.game || [],
    );
    const caliber = countByOptions(
      facetSourceProducts,
      FYSIGGIA_META_OPTIONS.caliber,
      (product) => product.shotgunShells?.caliber,
    );
    const specialLoad = countByOptions(
      facetSourceProducts,
      [...FYSIGGIA_META_OPTIONS.specialLoad, ''],
      (product) => product.shotgunShells?.specialLoad || '',
    );
    const shotSize = countByOptions(
      facetSourceProducts,
      FYSIGGIA_META_OPTIONS.shotSize,
      (product) => product.shotgunShells?.shotSize,
    );
    const shotNumber = FYSIGGIA_META_OPTIONS.shotNumber.reduce((acc, option) => {
      const totalBoxes = facetSourceProducts.reduce((sum, product) => {
        const entry = normalizeShotNumberEntries(
          product?.shotgunShells?.numbers || product?.numbers,
          product?.shotgunShells?.shotNumber || product?.shotNumber,
        ).find((item) => item.value === option);
        if (!entry || entry.status !== SHOT_NUMBER_STATUS.AVAILABLE) return sum;
        return sum + (entry.stock || 0);
      }, 0);
      if (totalBoxes > 0) acc[option] = totalBoxes;
      return acc;
    }, {});

    const onSale = facetSourceProducts.reduce((sum, product) => sum + (product.shotgunShells?.onSale ? 1 : 0), 0);
    const presetRanges = PRICE_PRESET_RANGES.reduce((acc, range) => {
      const count = facetSourceProducts.reduce((sum, product) => {
        const price = Number(product.price);
        return sum + (price >= range.min && price <= range.max ? 1 : 0);
      }, 0);
      if (count > 0) acc[range.key] = count;
      return acc;
    }, {});

    return {
      manufacturer,
      type,
      game,
      caliber,
      specialLoad,
      shotSize,
      shotNumber,
      onSale,
      presetRanges,
    };
  }, [facetSourceProducts, isFysiggiaPage]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    const nextItems = filteredProducts.slice(0, nextPage * PAGE_SIZE);
    setPage(nextPage);
    setProducts(nextItems);
    setHasMore(nextItems.length < filteredProducts.length);
  };

  const toggleFacetArray = (key, value) => {
    setFacets((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const clearFysiggiaFilters = () => {
    setFacets({
      ...emptyFacets,
      powderMin: powderBounds.min,
      powderMax: powderBounds.max,
      priceMin: priceBounds.min,
      priceMax: priceBounds.max,
    });
  };

  const renderCheckboxFacet = (title, key, counts = {}, resolveLabel, formatCount) => {
    const options = Object.keys(counts);
    if (!options.length) return null;

    return (
      <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
        <h4 className="text-sm font-semibold mb-2">{title}</h4>
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option || '__empty__'} className="flex items-center justify-between text-sm gap-2">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={facets[key].includes(option)}
                  onChange={() => toggleFacetArray(key, option)}
                />
                {resolveLabel ? resolveLabel(option) : option}
              </span>
              <span className="text-xs text-surface-500">
                ({formatCount ? formatCount(counts[option]) : counts[option]})
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title">
            {isFysiggiaPage ? `${categoryName} / ${FYSIGGIA_SUBCATEGORY_LABEL}` : categoryName}
          </h1>
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
        <aside className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-72 flex-shrink-0`}>
          <div className="card p-5 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
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

            {categorySlug === 'kynigetika' && (
              <div className="pt-4 mt-4 border-t border-surface-200 dark:border-surface-700">
                <h4 className="text-sm font-semibold mb-2">Υποκατηγορίες</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => updateParam('subcategory', '')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !subcategory
                        ? 'bg-primary-500 text-white font-medium'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    Όλες
                  </button>
                  <button
                    onClick={() => updateParam('subcategory', FYSIGGIA_SUBCATEGORY_VALUE)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isFysiggiaPage
                        ? 'bg-primary-500 text-white font-medium'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {FYSIGGIA_SUBCATEGORY_LABEL}
                  </button>
                </div>
              </div>
            )}

            {isFysiggiaPage && facetCounts && (
              <>
                <div className="pt-4 mt-4 border-t border-surface-200 dark:border-surface-700">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Φίλτρα Φυσιγγίων</h4>
                    <button
                      onClick={clearFysiggiaFilters}
                      className="text-xs text-primary-500 hover:underline"
                    >
                      Καθαρισμός
                    </button>
                  </div>
                </div>

                {renderCheckboxFacet('Κατασκευαστής', 'manufacturer', facetCounts.manufacturer)}
                {renderCheckboxFacet('Είδος', 'type', facetCounts.type)}
                {renderCheckboxFacet('Θήραμα', 'game', facetCounts.game)}
                {renderCheckboxFacet('Διαμέτρημα', 'caliber', facetCounts.caliber)}

                <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="text-sm font-semibold mb-2">Βάρος Γόμωσης (gr)</h4>
                  <div className="text-xs text-surface-500 mb-2">Από: {facets.powderMin ?? powderBounds.min} / Έως: {facets.powderMax ?? powderBounds.max}</div>
                  <input
                    type="range"
                    min={powderBounds.min}
                    max={powderBounds.max}
                    step="0.1"
                    value={facets.powderMin ?? powderBounds.min}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFacets((prev) => ({ ...prev, powderMin: Math.min(next, prev.powderMax ?? powderBounds.max) }));
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={powderBounds.min}
                    max={powderBounds.max}
                    step="0.1"
                    value={facets.powderMax ?? powderBounds.max}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFacets((prev) => ({ ...prev, powderMax: Math.max(next, prev.powderMin ?? powderBounds.min) }));
                    }}
                    className="w-full mt-1"
                  />
                </div>

                {renderCheckboxFacet('Ειδικές Γομώσεις', 'specialLoad', facetCounts.specialLoad, (value) => value || '(κενό)')}
                {renderCheckboxFacet('Δράμια', 'shotSize', facetCounts.shotSize)}

                <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="text-sm font-semibold mb-2">Περιοχή Τιμών</h4>
                  <div className="text-xs text-surface-500 mb-2">Από: €{(facets.priceMin ?? priceBounds.min).toFixed(2)} / Έως: €{(facets.priceMax ?? priceBounds.max).toFixed(2)}</div>
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step="0.01"
                    value={facets.priceMin ?? priceBounds.min}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFacets((prev) => ({ ...prev, priceMin: Math.min(next, prev.priceMax ?? priceBounds.max) }));
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step="0.01"
                    value={facets.priceMax ?? priceBounds.max}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFacets((prev) => ({ ...prev, priceMax: Math.max(next, prev.priceMin ?? priceBounds.min) }));
                    }}
                    className="w-full mt-1"
                  />

                  <div className="space-y-1.5 mt-3">
                    {PRICE_PRESET_RANGES.filter((range) => facetCounts.presetRanges[range.key]).map((range) => (
                      <label key={range.key} className="flex items-center justify-between text-sm gap-2">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={facets.presetRanges.includes(range.key)}
                            onChange={() => toggleFacetArray('presetRanges', range.key)}
                          />
                          {range.label}
                        </span>
                        <span className="text-xs text-surface-500">({facetCounts.presetRanges[range.key]})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {facetCounts.onSale > 0 && (
                  <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                    <label className="flex items-center justify-between text-sm gap-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={facets.onSale}
                          onChange={(e) => setFacets((prev) => ({ ...prev, onSale: e.target.checked }))}
                        />
                        Προσφορές
                      </span>
                      <span className="text-xs text-surface-500">({facetCounts.onSale})</span>
                    </label>
                  </div>
                )}

                {renderCheckboxFacet(
                  'Νούμερο Φυσιγγίων',
                  'shotNumber',
                  facetCounts.shotNumber,
                  undefined,
                  (count) => `${count} κουτιά`,
                )}
              </>
            )}
          </div>
        </aside>

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
