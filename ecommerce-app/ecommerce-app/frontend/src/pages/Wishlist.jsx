import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Wishlist() {
  const { items, toggle } = useWishlist();
  const { addToCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="page-container py-20 text-center animate-fade-in">
        <Heart size={64} className="text-surface-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Your wishlist is empty</h2>
        <p className="text-surface-500 mb-6">Save items you love to your wishlist.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="page-container py-8 animate-fade-in">
      <h1 className="section-title mb-8">My Wishlist ({items.length})</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div key={item.id} className="card overflow-hidden group">
            <Link to={`/products/${item.id}`}>
              <div className="aspect-square bg-surface-100 dark:bg-surface-800 overflow-hidden">
                <img src={item.image || 'https://via.placeholder.com/300'} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            </Link>
            <div className="p-4">
              <Link to={`/products/${item.id}`} className="font-medium text-sm hover:text-primary-600 transition-colors line-clamp-2">{item.name}</Link>
              <p className="text-primary-500 font-bold mt-1">${item.price?.toFixed(2)}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => { await addToCart(item, 1); toast.success('Added to cart!'); }}
                  className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1"
                >
                  <ShoppingCart size={14} /> Add to Cart
                </button>
                <button
                  onClick={() => { toggle(item); toast.success('Removed from wishlist'); }}
                  className="p-2 text-surface-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
