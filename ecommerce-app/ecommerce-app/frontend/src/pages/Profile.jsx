import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { User, Package, ChevronRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  normalizeShotNumberEntries,
  SHOT_NUMBER_STATUS,
} from '../constants/fysiggia.js';

const STATUS_COLORS = {
  processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  pending: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300',
};

function getOrderItemProductId(item) {
  return item?.id || item?.productId || item?.product_id || item?.product?.id || null;
}

function getOrderItemShotNumber(item) {
  return item?.shotNumber || item?.number || item?.shot_number || item?.selectedShotNumber || null;
}

function buildReductionByProduct(orderItems) {
  const reductionByProduct = new Map();
  for (const item of orderItems || []) {
    const productId = getOrderItemProductId(item);
    if (!productId) continue;
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;
    const key = String(productId);
    if (!reductionByProduct.has(key)) {
      reductionByProduct.set(key, { total: 0, byShotNumber: {} });
    }
    const reduction = reductionByProduct.get(key);
    reduction.total += quantity;
    const shotNumber = getOrderItemShotNumber(item);
    if (shotNumber) {
      const shotKey = String(shotNumber);
      reduction.byShotNumber[shotKey] = (reduction.byShotNumber[shotKey] || 0) + quantity;
    }
  }
  return reductionByProduct;
}

function reduceProductStock(productData, reduction) {
  const byShotNumber = reduction.byShotNumber || {};
  const hasShotNumberReduction = Object.keys(byShotNumber).length > 0;
  const totalReduction = reduction.total || 0;

  if (!hasShotNumberReduction) {
    return {
      stock: Math.max(0, (Number(productData?.stock) || 0) - totalReduction),
      shotgunShells: productData?.shotgunShells ?? null,
      numbers: productData?.numbers ?? null,
    };
  }

  const normalizedNumbers = normalizeShotNumberEntries(
    productData?.shotgunShells?.numbers || productData?.numbers,
    productData?.shotgunShells?.shotNumber || productData?.shotNumber,
  );

  const nextNumbers = normalizedNumbers.map((entry) => {
    const qty = Number(byShotNumber[entry.value]) || 0;
    if (qty <= 0) return entry;
    const nextStock = Math.max(0, (entry.stock || 0) - qty);
    return {
      ...entry,
      status: nextStock > 0 ? SHOT_NUMBER_STATUS.AVAILABLE : SHOT_NUMBER_STATUS.UNAVAILABLE,
      stock: nextStock > 0 ? nextStock : 0,
    };
  });

  const totalStock = nextNumbers.reduce(
    (sum, entry) => sum + (entry.status === SHOT_NUMBER_STATUS.AVAILABLE ? (entry.stock || 0) : 0),
    0,
  );

  return {
    stock: totalStock,
    shotgunShells: {
      ...(productData?.shotgunShells || {}),
      numbers: nextNumbers,
      shotNumber: nextNumbers
        .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
        .map((entry) => entry.value),
    },
    numbers: nextNumbers,
  };
}

export default function Profile() {
  const { user, userProfile } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('order') === 'success') {
      toast.success(t('profile.orderPlaced'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    async function applyPendingStockUpdate() {
      if (!user?.uid) return;
      if (searchParams.get('order') !== 'success') return;
      const pendingOrderId = localStorage.getItem('pendingOrderId');
      if (!pendingOrderId) return;

      try {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'orders', pendingOrderId);
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists()) return;

          const orderData = orderSnap.data();
          if (orderData?.userId !== user.uid) return;
          if (orderData?.stockApplied === true) return;

          const reductionByProduct = buildReductionByProduct(orderData.items || []);
          for (const [productId, reduction] of reductionByProduct.entries()) {
            const productRef = doc(db, 'products', productId);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) continue;
            const next = reduceProductStock(productSnap.data() || {}, reduction);
            transaction.update(productRef, {
              stock: next.stock,
              shotgunShells: next.shotgunShells,
              numbers: next.numbers,
            });
          }

          transaction.update(orderRef, {
            paymentStatus: 'paid',
            stockApplied: true,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        localStorage.removeItem('pendingOrderId');
      } catch (error) {
        console.error('Stock update fallback failed:', error);
      }
    }

    applyPendingStockUpdate();
  }, [user, searchParams]);

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;
      try {
        setOrdersError('');
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
        if (err?.code === 'failed-precondition') {
          try {
            const fallbackQuery = query(
              collection(db, 'orders'),
              where('userId', '==', user.uid)
            );
            const fallbackSnap = await getDocs(fallbackQuery);
            const fallbackOrders = fallbackSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => {
                const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return bMs - aMs;
              });
            setOrders(fallbackOrders);
            setOrdersError('');
            return;
          } catch (fallbackErr) {
            console.error(fallbackErr);
            setOrdersError(t('profile.failedToLoadOrders'));
            return;
          }
        } else if (err?.code === 'permission-denied') {
          setOrdersError(t('profile.permissionDenied'));
        } else {
          setOrdersError(t('profile.failedToLoadOrders'));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [user, t]);

  return (
    <div className="page-container py-8 animate-fade-in">
      <h1 className="section-title mb-8">{t('profile.title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div>
          <div className="card p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                {(userProfile?.name || user?.email)?.[0]?.toUpperCase()}
              </div>
              <h2 className="font-display font-bold text-xl">{userProfile?.name || t('profile.user')}</h2>
              <p className="text-surface-500 text-sm mt-1">{user?.email}</p>
              {userProfile?.role === 'admin' && (
                <span className="badge bg-primary-100 dark:bg-primary-500/10 text-primary-600 mt-2">{t('profile.admin')}</span>
              )}
            </div>
            <div className="space-y-3 text-sm border-t border-surface-200 dark:border-surface-700 pt-4">
              <div className="flex items-center gap-2">
                <User size={15} className="text-surface-400" />
                <span className="text-surface-500">{t('profile.memberSince')}</span>
                <span className="ml-auto font-medium">
                  {userProfile?.createdAt?.toDate ? format(userProfile.createdAt.toDate(), 'MMM yyyy') : '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Package size={15} className="text-surface-400" />
                <span className="text-surface-500">{t('profile.totalOrders')}</span>
                <span className="ml-auto font-medium">{orders.length}</span>
              </div>
            </div>
            {user?.emailVerified === false && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                {t('profile.verifyEmail')}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display font-bold text-xl mb-4">{t('profile.orderHistory')}</h2>
          {loading ? (
            <LoadingSpinner className="py-12" />
          ) : ordersError ? (
            <div className="card py-16 text-center">
              <h3 className="font-semibold text-lg mb-2">{t('profile.couldNotLoadOrders')}</h3>
              <p className="text-surface-500 text-sm">{ordersError}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="card py-16 text-center">
              <Package size={48} className="text-surface-300 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('profile.noOrdersYet')}</h3>
              <p className="text-surface-500 text-sm mb-4">{t('profile.startShopping')}</p>
              <Link to="/products" className="btn-primary">{t('profile.browseProducts')}</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="card p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200 hover:border-primary-200 dark:hover:border-primary-500/30 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs text-surface-500">#{order.id.slice(-8).toUpperCase()}</span>
                      <span className={`badge ${STATUS_COLORS[order.orderStatus] || STATUS_COLORS.pending}`}>
                        {order.orderStatus ? t(`profile.${order.orderStatus}`) : t('profile.processing')}
                      </span>
                      {order.paymentStatus === 'paid' && (
                        <span className="badge bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                          <CheckCircle size={10} /> {t('profile.paid')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-500">
                      {order.items?.length} {t('profile.itemsCount')} · {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-primary-500">${order.totalPrice?.toFixed(2)}</p>
                  </div>
                  <ChevronRight size={16} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

