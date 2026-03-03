import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseInitError, missingVars } from '../firebase/config';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');

  async function register(name, email, password) {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(firebaseUser, { displayName: name });
    await sendEmailVerification(firebaseUser);

    const userDoc = {
      uid: firebaseUser.uid,
      name,
      email,
      role: 'user',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
    return firebaseUser;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
    setUserProfile(null);
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function fetchUserProfile(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
        return docSnap.data();
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  }

  useEffect(() => {
    if (firebaseInitError || !auth || !db) {
      const detail = missingVars.length > 0
        ? `Missing env vars: ${missingVars.join(', ')}`
        : 'Check your Firebase web config values in .env.';
      setConfigError(`Firebase is not configured correctly. ${detail}`);
      setLoading(false);
      return () => {};
    }

    let active = true;
    const timeoutId = setTimeout(() => {
      if (active) setLoading(false);
    }, 5000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!active) return;

        setUser(firebaseUser);
        if (firebaseUser) {
          await fetchUserProfile(firebaseUser.uid);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
        clearTimeout(timeoutId);
      });
    } catch (error) {
      console.error('Error initializing auth state listener:', error);
      setLoading(false);
      clearTimeout(timeoutId);
    }

    return () => {
      active = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';

  const value = {
    user,
    userProfile,
    loading,
    isAdmin,
    register,
    login,
    logout,
    resetPassword,
    fetchUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
          <LoadingSpinner size="lg" />
        </div>
      ) : configError ? (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-6">
          <div className="max-w-2xl w-full card p-6">
            <h1 className="text-2xl font-display mb-3">Firebase Config Error</h1>
            <p className="text-surface-700 dark:text-surface-300 mb-2">{configError}</p>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Create/update `frontend/.env` and restart the dev server.
            </p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
