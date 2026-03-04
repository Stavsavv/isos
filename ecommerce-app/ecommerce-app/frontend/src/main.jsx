import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                  },
                  success: { iconTheme: { primary: '#e55a28', secondary: '#fff' } },
                }}
              />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  </BrowserRouter>
);
