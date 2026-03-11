import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const ShippingReturns = lazy(() => import('./pages/ShippingReturns.jsx'));

// Admin pages
const AdminDashboard = lazy(() => import('./admin/Dashboard.jsx'));
const AdminProducts = lazy(() => import('./admin/Products.jsx'));
const AdminOrders = lazy(() => import('./admin/Orders.jsx'));
const AdminUsers = lazy(() => import('./admin/Users.jsx'));
const AdminCoupons = lazy(() => import('./admin/Coupons.jsx'));

function App() {
  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/shipping-returns" element={<ShippingReturns />} />

              {/* Protected user routes */}
              <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
              <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/admin/coupons" element={<AdminRoute><AdminCoupons /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
