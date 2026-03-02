import { Link } from 'react-router-dom';
import { Package, Twitter, Instagram, Facebook, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-surface-900 dark:bg-surface-950 text-surface-300 mt-auto">
      <div className="page-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Package size={18} className="text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">ShopNow</span>
            </Link>
            <p className="text-sm leading-relaxed text-surface-400">
              Discover amazing products at unbeatable prices. Quality guaranteed.
            </p>
            <div className="flex gap-3 mt-4">
              {[Twitter, Instagram, Facebook, Github].map((Icon, i) => (
                <a key={i} href="#" className="p-2 rounded-lg bg-surface-800 hover:bg-primary-500 transition-colors">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Shop</h4>
            <ul className="space-y-2 text-sm">
              {['All Products', 'New Arrivals', 'Best Sellers', 'Sale'].map((item) => (
                <li key={item}>
                  <Link to="/products" className="hover:text-primary-400 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Account</h4>
            <ul className="space-y-2 text-sm">
              {[['Login', '/login'], ['Register', '/register'], ['My Profile', '/profile'], ['My Orders', '/profile']].map(([item, to]) => (
                <li key={item}>
                  <Link to={to} className="hover:text-primary-400 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-sm">
              {['FAQ', 'Shipping Policy', 'Returns', 'Contact Us'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-primary-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-surface-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-surface-500">
          <p>© {new Date().getFullYear()} ShopNow. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-surface-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-surface-300 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
