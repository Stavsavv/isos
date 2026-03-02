import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import ProductCard from '../components/ProductCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { ArrowRight, Zap, Shield, Truck, RotateCcw, Search } from 'lucide-react';

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Automotive'];

const FEATURES = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders over $50' },
  { icon: RotateCcw, title: 'Easy Returns', desc: '30-day return policy' },
  { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
  { icon: Zap, title: 'Fast Delivery', desc: 'Express options available' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(8));
        const snap = await getDocs(q);
        setFeatured(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary-400 rounded-full filter blur-3xl" />
        </div>
        <div className="page-container relative py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-4 py-1.5 text-sm text-primary-300 mb-6">
              <Zap size={14} /> New arrivals every week
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Discover <span className="text-gradient">Premium</span> Products
            </h1>
            <p className="text-surface-300 text-lg md:text-xl mb-8 leading-relaxed">
              Shop the latest trends and top brands at unbeatable prices. Quality products, fast delivery, and exceptional service.
            </p>
            <form onSubmit={handleSearch} className="flex gap-3 max-w-md">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button type="submit" className="btn-primary px-5 py-3">Search</button>
            </form>
            <div className="flex gap-4 mt-8">
              <Link to="/products" className="btn-primary flex items-center gap-2">
                Shop Now <ArrowRight size={16} />
              </Link>
              <Link to="/products" className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-0">
                Browse Categories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
        <div className="page-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-primary-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-surface-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="page-container py-16">
        <h2 className="section-title mb-8">Shop by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/products?category=${encodeURIComponent(cat)}`}
              className="group card p-5 text-center hover:border-primary-500 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-primary-50 dark:bg-primary-500/10 rounded-xl mx-auto mb-3 group-hover:bg-primary-500 transition-colors flex items-center justify-center">
                <span className="text-2xl">
                  {cat === 'Electronics' ? '💻' : cat === 'Clothing' ? '👕' : cat === 'Books' ? '📚' : cat === 'Home & Garden' ? '🏡' : cat === 'Sports' ? '⚽' : cat === 'Beauty' ? '✨' : cat === 'Toys' ? '🎮' : '🚗'}
                </span>
              </div>
              <p className="font-medium text-sm group-hover:text-primary-600 transition-colors">{cat}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="page-container pb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="section-title">Featured Products</h2>
          <Link to="/products" className="flex items-center gap-1 text-primary-500 hover:text-primary-600 font-medium text-sm transition-colors">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : featured.length === 0 ? (
          <div className="text-center py-16 card">
            <p className="text-surface-400 text-lg">No products yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* CTA Banner */}
      <section className="bg-primary-500 text-white">
        <div className="page-container py-14 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Ready to start shopping?</h2>
          <p className="text-primary-100 mb-8 text-lg">Join thousands of happy customers today.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-600 font-bold px-8 py-3 rounded-lg hover:bg-primary-50 transition-colors">
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
