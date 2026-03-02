import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="text-center">
        <div className="font-display text-[120px] md:text-[180px] font-black text-surface-100 dark:text-surface-800 leading-none select-none">
          404
        </div>
        <div className="-mt-8 relative z-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-surface-900 dark:text-white mb-3">
            Page not found
          </h1>
          <p className="text-surface-500 text-lg mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => window.history.back()} className="btn-secondary flex items-center gap-2">
              <ArrowLeft size={16} /> Go Back
            </button>
            <Link to="/" className="btn-primary flex items-center gap-2">
              <Home size={16} /> Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
