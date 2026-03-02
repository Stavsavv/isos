import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Eye, EyeOff, Package } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Please check your email for verification.');
      navigate('/');
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use' : 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

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
          <h1 className="font-display text-3xl font-bold">Create account</h1>
          <p className="text-surface-500 mt-2">Join thousands of happy shoppers</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input required value={form.name} onChange={update('name')} className="input pl-9" placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input type="email" required value={form.email} onChange={update('email')} className="input pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={update('password')} className="input pl-9 pr-10" placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input type="password" required value={form.confirmPassword} onChange={update('confirmPassword')} className="input pl-9" placeholder="Repeat password" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <LoadingSpinner size="sm" /> : null}
              Create Account
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-surface-500 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
