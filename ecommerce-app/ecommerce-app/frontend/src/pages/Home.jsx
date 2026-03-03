import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase/config.js";
import ProductCard from "../components/ProductCard.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { ArrowRight, Zap, Shield, Truck, RotateCcw, Search } from "lucide-react";
import { CATEGORY_OPTIONS } from "../constants/categories.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const CATEGORY_IMAGE_BY_SLUG = {
  stratiotika: "https://res.cloudinary.com/dha8p7ypa/image/upload/v1772538405/army_soxnsv.webp",
  astynomika: "https://res.cloudinary.com/dha8p7ypa/image/upload/v1772538414/police_drpia3.jpg",
  kynigetika: "https://res.cloudinary.com/dha8p7ypa/image/upload/v1772538405/hunt_i2hmrw.jpg",
  camping: "https://res.cloudinary.com/dha8p7ypa/image/upload/v1772538405/camp_vqfan0.jpg",
  accessories: "https://res.cloudinary.com/dha8p7ypa/image/upload/v1772538708/ChatGPT_Image_Mar_3_2026_01_51_23_PM_qdqtnp.png",
};

const categoryItems = CATEGORY_OPTIONS.map((category) => ({
  ...category,
  image: CATEGORY_IMAGE_BY_SLUG[category.slug],
}));

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const FEATURES = [
    { icon: Truck, title: t("home.features.freeShippingTitle"), desc: t("home.features.freeShippingDesc") },
    { icon: RotateCcw, title: t("home.features.easyReturnsTitle"), desc: t("home.features.easyReturnsDesc") },
    { icon: Shield, title: t("home.features.securePaymentTitle"), desc: t("home.features.securePaymentDesc") },
    { icon: Zap, title: t("home.features.fastDeliveryTitle"), desc: t("home.features.fastDeliveryDesc") },
  ];

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(8));
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
      <section className="relative overflow-hidden bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary-400 rounded-full filter blur-3xl" />
        </div>
        <div className="page-container relative py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-4 py-1.5 text-sm text-primary-300 mb-6">
              <Zap size={14} /> {t("home.newArrivals")}
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              {t("home.discover")} <span className="text-gradient">{t("home.premium")}</span> {t("home.products")}
            </h1>
            <p className="text-surface-300 text-lg md:text-xl mb-8 leading-relaxed">
              {t("home.heroDesc")}
            </p>
            <form onSubmit={handleSearch} className="flex gap-3 max-w-md">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("nav.searchPlaceholder")}
                  className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button type="submit" className="btn-primary px-5 py-3">{t("home.search")}</button>
            </form>
            <div className="flex gap-4 mt-8">
              <Link to="/products" className="btn-primary flex items-center gap-2">
                {t("home.shopNow")} <ArrowRight size={16} />
              </Link>
              <Link to="/products" className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-0">
                {t("home.browseCategories")}
              </Link>
            </div>
          </div>
        </div>
      </section>

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

      <section className="page-container py-20">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-12">
          {t("home.shopByCategory")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {categoryItems.map((cat, i) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link to={`/products?category=${cat.slug}`} className="group block">
                <div className="aspect-[3/4] overflow-hidden mb-3">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-center text-sm uppercase tracking-widest font-medium">
                  {t(`categories.${cat.slug}`)}
                </h3>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="page-container pb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="section-title">{t("home.featuredProducts")}</h2>
          <Link to="/products" className="flex items-center gap-1 text-primary-500 hover:text-primary-600 font-medium text-sm transition-colors">
            {t("home.viewAll")} <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : featured.length === 0 ? (
          <div className="text-center py-16 card">
            <p className="text-surface-400 text-lg">{t("home.noProductsYet")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {!user && (
        <section className="bg-primary-500 text-white">
          <div className="page-container py-14 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">{t("home.readyToStart")}</h2>
            <p className="text-primary-100 mb-8 text-lg">{t("home.joinCustomers")}</p>
            <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-600 font-bold px-8 py-3 rounded-lg hover:bg-primary-50 transition-colors">
              {t("home.getStarted")} <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
