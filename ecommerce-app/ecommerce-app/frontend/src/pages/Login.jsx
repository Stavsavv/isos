import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, Package } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid email or password' : 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Package size={22} className="text-white" />
            </div>
            <span className="font-display font-bold text-2xl">ShopNow</span>
          </Link>
          <h1 className="font-display text-3xl font-bold">Welcome back</h1>
          <p className="text-surface-500 mt-2">Sign in to your account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-sm text-primary-500 hover:text-primary-600">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? <LoadingSpinner size="sm" /> : null}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-surface-500 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
