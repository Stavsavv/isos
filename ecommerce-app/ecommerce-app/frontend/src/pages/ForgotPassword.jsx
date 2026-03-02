// ForgotPassword.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, Package } from 'lucide-react';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      toast.success('Reset email sent!');
    } catch {
      toast.error('Failed to send reset email');
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
          <h1 className="font-display text-3xl font-bold">Reset Password</h1>
          <p className="text-surface-500 mt-2">Enter your email to receive reset instructions</p>
        </div>
        <div className="card p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Email Sent!</h3>
              <p className="text-surface-500 text-sm mb-4">Check your inbox for reset instructions.</p>
              <Link to="/login" className="btn-primary">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-9" placeholder="you@example.com" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {loading ? <LoadingSpinner size="sm" /> : null} Send Reset Email
              </button>
            </form>
          )}
        </div>
        <p className="text-center mt-6">
          <Link to="/login" className="flex items-center justify-center gap-1 text-surface-500 hover:text-surface-900 dark:hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
