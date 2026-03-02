import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Users, Tag, ChevronRight } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/coupons', icon: Tag, label: 'Coupons' },
];

export default function AdminLayout({ children, title }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-surface-900 dark:bg-surface-950 flex-col">
        <div className="p-6 border-b border-surface-800">
          <Link to="/" className="text-sm text-surface-400 hover:text-white transition-colors">← Back to store</Link>
          <h2 className="font-display font-bold text-white text-xl mt-2">Admin Panel</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  active
                    ? 'bg-primary-500 text-white font-medium'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-surface-50 dark:bg-surface-950">
        {/* Mobile nav */}
        <div className="md:hidden bg-surface-900 text-white px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  location.pathname === to ? 'bg-primary-500' : 'hover:bg-surface-800'
                }`}
              >
                <Icon size={14} /> {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="p-6">
          <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white mb-6">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
