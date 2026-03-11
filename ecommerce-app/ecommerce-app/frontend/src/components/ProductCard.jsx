import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { normalizeShotNumberEntries, SHOT_NUMBER_STATUS } from '../constants/fysiggia.js';
import { formatCurrency } from '../config/app.js';
import toast from 'react-hot-toast';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { user } = useAuth();
  const [selectedShotNumber, setSelectedShotNumber] = useState('');

  const shotNumberOptions = useMemo(
    () => normalizeShotNumberEntries(
      product.shotgunShells?.numbers || product.numbers,
      product.shotgunShells?.shotNumber || product.shotNumber,
    )
      .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
      .sort((a, b) => Number(a.value) - Number(b.value)),
    [product],
  );
  const hasShotNumbers = shotNumberOptions.length > 0;

  const shortDescription = useMemo(() => {
    const raw = String(product.description || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) return '-';
    return raw.length > 90 ? `${raw.slice(0, 90)}...` : raw;
  }, [product.description]);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please login to add items to cart'); return; }
    if (product.stock === 0) { toast.error('Out of stock'); return; }
    if (hasShotNumbers && !selectedShotNumber) { toast.error('Παρακαλώ επιλέξτε Νούμερο'); return; }
    try {
      await addToCart(product, 1, { shotNumber: hasShotNumbers ? selectedShotNumber : null });
      toast.success('Added to cart!');
    } catch (err) {
      toast.error(err?.message || 'Failed to add to cart');
    }
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please login to use wishlist'); return; }
    await toggle(product);
    toast.success(isWishlisted(product.id) ? 'Removed from wishlist' : 'Added to wishlist!');
  };

  const wishlisted = isWishlisted(product.id);

  return (
    <Link to={`/products/${product.id}`} className="group block">
      <div className="card overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="relative aspect-square overflow-hidden bg-surface-100 dark:bg-surface-800">
          <img
            src={product.images?.[0] || 'https://via.placeholder.com/400x400?text=No+Image'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="badge bg-red-500 text-white px-3 py-1">Out of Stock</span>
            </div>
          )}
          <button
            onClick={handleWishlist}
            className={`absolute top-3 right-3 p-2 rounded-full shadow-md transition-all duration-200 ${wishlisted ? 'bg-red-500 text-white' : 'bg-white dark:bg-surface-800 text-surface-500 hover:text-red-500'}`}
          >
            <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-xs text-primary-500 font-medium uppercase tracking-wide mb-1">{product.category}</p>
          <p className="text-[11px] text-surface-500 font-semibold">Product Name</p>
          <h3 className="font-medium text-surface-900 dark:text-surface-50 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
          <p className="text-[11px] text-surface-500 font-semibold">Description</p>
          <p className="text-xs text-surface-500 line-clamp-2 mb-2">{shortDescription}</p>

          {hasShotNumbers && (
            <div className="mb-3">
              <p className="text-[11px] text-surface-500 font-semibold mb-1">Νούμερα Φυσιγγίων</p>
              <div className="flex flex-wrap gap-1.5">
                {shotNumberOptions.map((entry) => {
                  const available =
                    entry.status === SHOT_NUMBER_STATUS.AVAILABLE && (entry.stock || 0) > 0;
                  const selected = selectedShotNumber === entry.value;
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!available) return;
                        setSelectedShotNumber(entry.value);
                      }}
                      disabled={!available}
                      className={`min-w-8 h-8 px-2 rounded border text-xs font-semibold ${
                        selected
                          ? 'bg-black border-black text-white'
                          : available
                            ? 'bg-white border-black text-black'
                            : 'bg-white border-red-500 text-red-600 cursor-not-allowed'
                      }`}
                    >
                      {entry.value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 mb-3">
            <div className="flex">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < Math.round(product.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-surface-300'}
                />
              ))}
            </div>
            <span className="text-xs text-surface-400">({product.reviewCount || 0})</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-surface-900 dark:text-white">
              {formatCurrency(product.price)}
            </span>
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
