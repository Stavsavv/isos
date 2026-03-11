import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config.js";
import { useCart } from "../context/CartContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import {
  SHOT_NUMBER_STATUS,
  normalizeShotNumberEntries,
} from "../constants/fysiggia.js";
import { formatCurrency } from "../config/app.js";
import toast from "react-hot-toast";
import {
  Star,
  ShoppingCart,
  Heart,
  Minus,
  Plus,
  ArrowLeft,
} from "lucide-react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedShotNumber, setSelectedShotNumber] = useState("");
  const [shotNumberError, setShotNumberError] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });

  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          navigate("/404");
          return;
        }
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } catch (err) {
        console.error(err);
        toast.error("Failed to load product");
        return;
      }

      try {
        const reviewsQ = query(
          collection(db, "products", id, "reviews"),
          orderBy("createdAt", "desc"),
        );
        const reviewsSnap = await getDocs(reviewsQ);
        setReviews(reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (err?.code !== "permission-denied") {
          console.error(err);
          toast.error("Failed to load reviews");
        }
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    if (!product) return;
    const options = normalizeShotNumberEntries(
      product.shotgunShells?.numbers || product.numbers,
      product.shotgunShells?.shotNumber || product.shotNumber,
    ).filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN);
    if (!options.length) return;
    if (!selectedShotNumber) {
      setQuantity(1);
      return;
    }
    const selectedEntry = options.find((entry) => entry.value === selectedShotNumber);
    const selectedStock =
      selectedEntry?.status === SHOT_NUMBER_STATUS.AVAILABLE
        ? selectedEntry.stock || 0
        : 0;
    const nextMax = selectedStock > 0 ? selectedStock : 1;
    setQuantity((prev) => Math.min(prev, nextMax));
  }, [product, selectedShotNumber]);

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please login");
      return;
    }
    if (hasShotNumbers && !selectedShotNumber) {
      setShotNumberError("Παρακαλώ επιλέξτε Νούμερο");
      return;
    }
    try {
      await addToCart(product, quantity, { shotNumber: selectedShotNumber || null });
      setShotNumberError("");
      toast.success("Added to cart!");
    } catch (err) {
      toast.error(err?.message || "Failed to add to cart");
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to review");
      return;
    }
    if (!reviewData.comment.trim()) {
      toast.error("Please write a comment");
      return;
    }
    setSubmittingReview(true);
    try {
      await addDoc(collection(db, "products", id, "reviews"), {
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        rating: reviewData.rating,
        comment: reviewData.comment,
        createdAt: serverTimestamp(),
      });
      // Update rating
      const totalReviews = reviews.length + 1;
      const newRating =
        (reviews.reduce((s, r) => s + r.rating, 0) + reviewData.rating) /
        totalReviews;
      setReviews([
        {
          id: Date.now(),
          ...reviewData,
          userId: user.uid,
          userName: user.displayName || "Anonymous",
          createdAt: { toDate: () => new Date() },
        },
        ...reviews,
      ]);
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              rating: Math.round(newRating * 10) / 10,
              reviewCount: (prev.reviewCount || 0) + 1,
            }
          : prev,
      );
      setReviewData({ rating: 5, comment: "" });
      toast.success("Review submitted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-[60vh]" />;
  if (!product) return null;

  const wishlisted = isWishlisted(product.id);
  const shotNumberOptions = normalizeShotNumberEntries(
    product.shotgunShells?.numbers || product.numbers,
    product.shotgunShells?.shotNumber || product.shotNumber,
  )
    .filter((entry) => entry.status !== SHOT_NUMBER_STATUS.HIDDEN)
    .sort((a, b) => Number(a.value) - Number(b.value));
  const hasShotNumbers = shotNumberOptions.length > 0;
  const selectedShotNumberEntry = shotNumberOptions.find(
    (entry) => entry.value === selectedShotNumber,
  );
  const selectedShotNumberStock =
    selectedShotNumberEntry?.status === SHOT_NUMBER_STATUS.AVAILABLE
      ? selectedShotNumberEntry.stock || 0
      : 0;
  const maxAllowedQuantity = hasShotNumbers
    ? selectedShotNumberStock
    : Number(product.stock) || 0;

  return (
    <div className="page-container py-8 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-surface-500 hover:text-surface-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-surface-100 dark:bg-surface-800 mb-4">
            <img
              src={
                product.images?.[selectedImage] ||
                "https://via.placeholder.com/600?text=No+Image"
              }
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImage === i
                      ? "border-primary-500"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-sm font-semibold text-surface-500 mb-1">Product Name</p>
          <h1 className="font-display text-3xl font-bold text-surface-900 dark:text-white mb-3">
            {product.name}
          </h1>

          <p className="text-3xl font-bold text-primary-500 mb-4">
            {formatCurrency(product.price)}
          </p>

          {/* Rich Text Description */}
          <p className="text-sm font-semibold text-surface-500 mb-1">Description</p>
          {product.description ? (
            <div
              className="prose prose-sm max-w-none mb-6 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-surface-600 dark:text-surface-300 leading-relaxed mb-6">
              {product.description}
            </p>
          )}

          {hasShotNumbers && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-surface-500 mb-1">Νούμερα Φυσιγγίων</p>
              <div className="flex flex-wrap items-center gap-2">
                {shotNumberOptions.map((entry) => {
                  const isSelected = selectedShotNumber === entry.value;
                  const isAvailable =
                    entry.status === SHOT_NUMBER_STATUS.AVAILABLE &&
                    (entry.stock || 0) > 0;
                  const stateClass = isSelected && isAvailable
                    ? "bg-black border-black text-white"
                    : isAvailable
                      ? "bg-white border-black text-black hover:bg-surface-100"
                      : "bg-white border-red-500 text-red-600 cursor-not-allowed";

                  return (
                    <button
                      key={entry.value}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedShotNumber(entry.value);
                        setShotNumberError("");
                      }}
                      className={`min-w-10 h-9 px-2 rounded-md border text-sm font-medium transition-colors ${stateClass}`}
                    >
                      {entry.value}
                    </button>
                  );
                })}
              </div>
              {selectedShotNumberEntry && selectedShotNumberStock > 10 && (
                <p className="text-xs text-green-600 mt-1">
                  Διαθέσιμα: {selectedShotNumberStock} κουτιά
                </p>
              )}
              {selectedShotNumberEntry &&
                selectedShotNumberStock > 0 &&
                selectedShotNumberStock <= 10 && (
                <p className="text-xs text-amber-600 mt-1">
                  Προσοχή: Απομένουν μόνο {selectedShotNumberStock} κουτιά!
                </p>
              )}
              {selectedShotNumberEntry && selectedShotNumberStock === 0 && (
                <p className="text-xs text-red-600 mt-1">Μη διαθέσιμο</p>
              )}
              {shotNumberError && (
                <p className="text-xs text-red-600 mt-1">{shotNumberError}</p>
              )}
            </div>
          )}

          {/* Quantity */}
          {maxAllowedQuantity > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(maxAllowedQuantity, quantity + 1))
                  }
                  className="w-9 h-9 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!hasShotNumbers && product.stock === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              {!hasShotNumbers && product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </button>
            <button
              onClick={() => {
                if (!user) {
                  toast.error("Please login");
                  return;
                }
                toggle(product);
                toast.success(
                  wishlisted ? "Removed from wishlist" : "Added to wishlist!",
                );
              }}
              className={`p-3 rounded-lg border transition-colors ${wishlisted ? "bg-red-50 border-red-200 text-red-500 dark:bg-red-500/10 dark:border-red-500/30" : "border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800"}`}
            >
              <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="border-t border-surface-200 dark:border-surface-800 pt-12">
        <h2 className="font-display text-2xl font-bold mb-8">
          Customer Reviews ({reviews.length})
        </h2>

        {/* Submit review */}
        {user && (
          <form onSubmit={handleSubmitReview} className="card p-6 mb-8">
            <h3 className="font-semibold mb-4">Write a Review</h3>
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, rating: n })}
                  >
                    <Star
                      size={24}
                      className={
                        n <= reviewData.rating
                          ? "text-amber-400 fill-amber-400"
                          : "text-surface-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Comment</label>
              <textarea
                value={reviewData.comment}
                onChange={(e) =>
                  setReviewData({ ...reviewData, comment: e.target.value })
                }
                className="input min-h-[100px] resize-none"
                placeholder="Share your experience..."
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="btn-primary flex items-center gap-2"
            >
              {submittingReview && <LoadingSpinner size="sm" />} Submit Review
            </button>
          </form>
        )}

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <p className="text-surface-500 text-center py-8">
            No reviews yet. Be the first to review!
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {review.userName?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">
                      {review.userName}
                    </span>
                  </div>
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < review.rating
                            ? "text-amber-400 fill-amber-400"
                            : "text-surface-300"
                        }
                      />
                    ))}
                  </div>
                </div>
                <p className="text-surface-600 dark:text-surface-300 text-sm">
                  {review.comment}
                </p>
                {review.createdAt?.toDate && (
                  <p className="text-xs text-surface-400 mt-2">
                    {review.createdAt.toDate().toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
