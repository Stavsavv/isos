import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, userProfile, logout, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(
        language === "el"
          ? "Αποσυνδέθηκες επιτυχώς"
          : "Logged out successfully",
      );
      navigate("/");
    } catch {
      toast.error(
        language === "el" ? "Αποτυχία αποσύνδεσης" : "Failed to logout",
      );
    }
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "glass shadow-md border-b border-surface-200 dark:border-surface-800" : "bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800"}`}
    >
      <div className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-display font-bold text-xl text-surface-900 dark:text-white">
              Savvidis
            </span>
          </Link>

          {/* Search - desktop */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-md mx-8"
          >
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="input pl-9 pr-4 py-2 text-sm"
              />
            </div>
          </form>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/products" className="btn-ghost text-sm">
              {t("nav.products")}
            </Link>

            <button
              onClick={toggleLanguage}
              className="btn-ghost px-3 py-2 rounded-lg text-xs font-semibold"
              title={
                language === "en" ? "Switch to Greek" : "Switch to English"
              }
            >
              {language === "en" ? "EN / GR" : "GR / EN"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg"
              title={theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Wishlist */}
            {user && (
              <Link
                to="/wishlist"
                className="btn-ghost p-2 rounded-lg relative"
              >
                <Heart size={18} />
              </Link>
            )}

            {/* Cart */}
            {user && (
              <Link to="/cart" className="btn-ghost p-2 rounded-lg relative">
                <ShoppingCart size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-bounce-subtle">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* User menu */}
            {user ? (
              <div className="relative ml-1">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 btn-ghost rounded-lg px-3 py-2"
                >
                  <div className="w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {(userProfile?.name || user.email)?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium hidden lg:block max-w-24 truncate">
                    {userProfile?.name || t("nav.account")}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 card shadow-xl border animate-fade-in z-50">
                    <div className="p-3 border-b border-surface-100 dark:border-surface-800">
                      <p className="text-sm font-medium truncate">
                        {userProfile?.name}
                      </p>
                      <p className="text-xs text-surface-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg"
                      >
                        <User size={15} /> {t("nav.myProfile")}
                      </Link>
                      <Link
                        to="/cart"
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg"
                      >
                        <ShoppingCart size={15} /> {t("nav.cart")}{" "}
                        {itemCount > 0 && (
                          <span className="ml-auto badge bg-primary-100 text-primary-600">
                            {itemCount}
                          </span>
                        )}
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-primary-600"
                        >
                          <LayoutDashboard size={15} /> {t("nav.adminPanel")}
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg w-full text-left text-red-500"
                      >
                        <LogOut size={15} /> {t("nav.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link to="/login" className="btn-ghost text-sm">
                  {t("nav.login")}
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  {t("nav.signUp")}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            {user && (
              <Link to="/cart" className="relative p-2">
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-surface-200 dark:border-surface-800 animate-slide-up">
            <form onSubmit={handleSearch} className="mt-3 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                className="input pl-9"
              />
            </form>
            <div className="mt-3 space-y-1">
              <Link
                to="/products"
                className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm"
              >
                {t("nav.products")}
              </Link>
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm"
                  >
                    {t("nav.myProfile")}
                  </Link>
                  <Link
                    to="/wishlist"
                    className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm"
                  >
                    {t("nav.wishlist")}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm text-primary-600"
                    >
                      {t("nav.adminPanel")}
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm text-red-500"
                  >
                    {t("nav.logout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    to="/register"
                    className="block px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm font-medium text-primary-600"
                  >
                    {t("nav.signUp")}
                  </Link>
                </>
              )}
              <button
                onClick={toggleLanguage}
                className="px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm w-full text-left font-semibold"
              >
                {language === "en" ? "EN / GR" : "GR / EN"}
              </button>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-sm w-full"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Close user menu on outside click */}
      {userMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </nav>
  );
}
