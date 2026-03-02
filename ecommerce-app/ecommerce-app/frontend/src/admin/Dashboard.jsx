import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import AdminLayout from '../components/AdminLayout.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { Users, Package, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

function StatCard({ icon: Icon, label, value, change, color }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={22} className="text-white" />
        </div>
        {change !== undefined && (
          <span className={`text-sm font-medium flex items-center gap-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            <TrendingUp size={14} /> {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-surface-500 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold font-display">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, revenue: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'products')),
          getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
        ]);

        const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const revenue = orders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalPrice || 0), 0);

        setStats({ users: usersSnap.size, products: productsSnap.size, orders: orders.length, revenue });
        setRecentOrders(orders.slice(0, 5));

        // Monthly chart data - last 6 months
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(new Date(), i);
          const start = startOfMonth(monthDate);
          const end = endOfMonth(monthDate);
          const monthOrders = orders.filter((o) => {
            const date = o.createdAt?.toDate?.();
            return date && date >= start && date <= end;
          });
          const monthRevenue = monthOrders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalPrice || 0), 0);
          months.push({ month: format(monthDate, 'MMM'), orders: monthOrders.length, revenue: Math.round(monthRevenue) });
        }
        setMonthlyData(months);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <AdminLayout title="Dashboard"><LoadingSpinner className="py-20" /></AdminLayout>;

  return (
    <AdminLayout title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Users" value={stats.users} color="bg-blue-500" />
        <StatCard icon={Package} label="Products" value={stats.products} color="bg-violet-500" />
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.orders} color="bg-amber-500" />
        <StatCard icon={DollarSign} label="Revenue" value={`$${stats.revenue.toFixed(2)}`} color="bg-primary-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Orders per Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#e55a28" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Revenue per Month ($)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#e55a28" strokeWidth={2} dot={{ fill: '#e55a28' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <p className="text-surface-500 text-sm text-center py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-3 text-surface-500 font-medium">Order ID</th>
                  <th className="text-left py-3 text-surface-500 font-medium">Items</th>
                  <th className="text-left py-3 text-surface-500 font-medium">Status</th>
                  <th className="text-right py-3 text-surface-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-3 font-mono text-xs">{order.id.slice(-8).toUpperCase()}</td>
                    <td className="py-3">{order.items?.length} item(s)</td>
                    <td className="py-3">
                      <span className="badge bg-surface-100 dark:bg-surface-800 capitalize">{order.orderStatus || 'processing'}</span>
                    </td>
                    <td className="py-3 text-right font-medium">${order.totalPrice?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
