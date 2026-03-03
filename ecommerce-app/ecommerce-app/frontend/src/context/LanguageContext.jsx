import { createContext, useContext, useMemo, useState } from "react";

const LANGUAGE_STORAGE_KEY = "language";

const translations = {
  en: {
    nav: {
      products: "Products",
      searchPlaceholder: "Search products...",
      myProfile: "My Profile",
      wishlist: "Wishlist",
      cart: "Cart",
      adminPanel: "Admin Panel",
      logout: "Logout",
      login: "Login",
      signUp: "Sign Up",
      darkMode: "Dark Mode",
      lightMode: "Light Mode",
      account: "Account",
    },
    home: {
      newArrivals: "New arrivals every week",
      discover: "Discover",
      premium: "Premium",
      products: "Products",
      heroDesc:
        "Shop the latest trends and top brands at unbeatable prices. Quality products, fast delivery, and exceptional service.",
      search: "Search",
      shopNow: "Shop Now",
      browseCategories: "Browse Categories",
      shopByCategory: "Shop by Category",
      featuredProducts: "Featured Products",
      viewAll: "View all",
      noProductsYet: "No products yet. Check back soon!",
      readyToStart: "Ready to start shopping?",
      joinCustomers: "Join thousands of happy customers today.",
      getStarted: "Get Started Free",
      features: {
        freeShippingTitle: "Free Shipping",
        freeShippingDesc: "On orders over $50",
        easyReturnsTitle: "Easy Returns",
        easyReturnsDesc: "30-day return policy",
        securePaymentTitle: "Secure Payment",
        securePaymentDesc: "100% secure checkout",
        fastDeliveryTitle: "Fast Delivery",
        fastDeliveryDesc: "Express options available",
      },
    },
    products: {
      allProducts: "All Products",
      filters: "Filters",
      categories: "Categories",
      clear: "Clear",
      noProductsFound: "No products found",
      tryAdjusting: "Try adjusting your search or filters",
      clearAllFilters: "Clear all filters",
      loadMore: "Load More Products",
      searchResultsFor: "Search results for",
      sort: {
        newest: "Newest",
        lowHigh: "Price: Low to High",
        highLow: "Price: High to Low",
        rating: "Rating",
      },
      all: "All",
    },
    footer: {
      description:
        "Discover amazing products at unbeatable prices. Quality guaranteed.",
      shop: "Shop",
      account: "Account",
      support: "Support",
      allProducts: "All Products",
      newArrivals: "New Arrivals",
      bestSellers: "Best Sellers",
      sale: "Sale",
      register: "Register",
      myOrders: "My Orders",
      faq: "FAQ",
      shippingPolicy: "Shipping Policy",
      returns: "Returns",
      contactUs: "Contact Us",
      rightsReserved: "All rights reserved.",
      privacyPolicy: "Privacy Policy",
      terms: "Terms of Service",
    },
    profile: {
      title: "My Profile",
      user: "User",
      admin: "Admin",
      memberSince: "Member since",
      totalOrders: "Total orders",
      verifyEmail: "Please verify your email address.",
      orderHistory: "Order History",
      couldNotLoadOrders: "Could not load orders",
      failedToLoadOrders: "Failed to load orders.",
      permissionDenied: "Cannot read orders due to Firestore permissions.",
      noOrdersYet: "No orders yet",
      startShopping: "Start shopping to see your orders here",
      browseProducts: "Browse Products",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      paid: "Paid",
      itemsCount: "item(s)",
      orderPlaced: "Order placed successfully!",
    },
    categories: {
      stratiotika: "Military Gear",
      astynomika: "Police Gear",
      kynigetika: "Hunting Gear",
      camping: "Camping & Survival",
      accessories: "Accessories",
    },
  },
  el: {
    nav: {
      products: "Προϊόντα",
      searchPlaceholder: "Αναζήτηση προϊόντων...",
      myProfile: "Το προφίλ μου",
      wishlist: "Αγαπημένα",
      cart: "Καλάθι",
      adminPanel: "Admin Panel",
      logout: "Αποσύνδεση",
      login: "Σύνδεση",
      signUp: "Εγγραφή",
      darkMode: "Σκούρο θέμα",
      lightMode: "Ανοιχτό θέμα",
      account: "Λογαριασμός",
    },
    home: {
      newArrivals: "Νέες αφίξεις κάθε εβδομάδα",
      discover: "Ανακάλυψε",
      premium: "Premium",
      products: "Προϊόντα",
      heroDesc:
        "Αγόρασε τις τελευταίες τάσεις και κορυφαία brands στις καλύτερες τιμές. Ποιότητα, γρήγορη παράδοση και άριστη εξυπηρέτηση.",
      search: "Αναζήτηση",
      shopNow: "Αγόρασε τώρα",
      browseCategories: "Κατηγορίες",
      shopByCategory: "Αγορές ανά κατηγορία",
      featuredProducts: "Προτεινόμενα προϊόντα",
      viewAll: "Προβολή όλων",
      noProductsYet: "Δεν υπάρχουν προϊόντα ακόμα. Δοκίμασε ξανά σύντομα!",
      readyToStart: "Έτοιμος/η για αγορές;",
      joinCustomers: "Γίνε κι εσύ ένας από τους ευχαριστημένους πελάτες μας.",
      getStarted: "Ξεκίνα τώρα",
      features: {
        freeShippingTitle: "Δωρεάν μεταφορικά",
        freeShippingDesc: "Για παραγγελίες άνω των 50€",
        easyReturnsTitle: "Εύκολες επιστροφές",
        easyReturnsDesc: "Πολιτική επιστροφών 30 ημερών",
        securePaymentTitle: "Ασφαλής πληρωμή",
        securePaymentDesc: "100% ασφαλές checkout",
        fastDeliveryTitle: "Γρήγορη παράδοση",
        fastDeliveryDesc: "Διαθέσιμες επιλογές express",
      },
    },
    products: {
      allProducts: "Όλα τα προϊόντα",
      filters: "Φίλτρα",
      categories: "Κατηγορίες",
      clear: "Καθαρισμός",
      noProductsFound: "Δεν βρέθηκαν προϊόντα",
      tryAdjusting: "Δοκίμασε άλλη αναζήτηση ή φίλτρα",
      clearAllFilters: "Καθαρισμός όλων των φίλτρων",
      loadMore: "Φόρτωση περισσότερων",
      searchResultsFor: "Αποτελέσματα αναζήτησης για",
      sort: {
        newest: "Νεότερα",
        lowHigh: "Τιμή: από χαμηλή σε υψηλή",
        highLow: "Τιμή: από υψηλή σε χαμηλή",
        rating: "Αξιολόγηση",
      },
      all: "Όλα",
    },
    footer: {
      description:
        "Ανακάλυψε ποιοτικά προϊόντα σε εξαιρετικές τιμές. Εγγυημένη ποιότητα.",
      shop: "Αγορές",
      account: "Λογαριασμός",
      support: "Υποστήριξη",
      allProducts: "Όλα τα προϊόντα",
      newArrivals: "Νέες αφίξεις",
      bestSellers: "Best sellers",
      sale: "Προσφορές",
      register: "Εγγραφή",
      myOrders: "Οι παραγγελίες μου",
      faq: "Συχνές ερωτήσεις",
      shippingPolicy: "Πολιτική αποστολών",
      returns: "Επιστροφές",
      contactUs: "Επικοινωνία",
      rightsReserved: "Με επιφύλαξη παντός δικαιώματος.",
      privacyPolicy: "Πολιτική απορρήτου",
      terms: "Όροι χρήσης",
    },
    profile: {
      title: "Το προφίλ μου",
      user: "Χρήστης",
      admin: "Διαχειριστής",
      memberSince: "Μέλος από",
      totalOrders: "Σύνολο παραγγελιών",
      verifyEmail: "Παρακαλώ επιβεβαίωσε το email σου.",
      orderHistory: "Ιστορικό παραγγελιών",
      couldNotLoadOrders: "Δεν ήταν δυνατή η φόρτωση παραγγελιών",
      failedToLoadOrders: "Αποτυχία φόρτωσης παραγγελιών.",
      permissionDenied: "Δεν έχεις δικαίωμα πρόσβασης στις παραγγελίες.",
      noOrdersYet: "Δεν υπάρχουν παραγγελίες ακόμα",
      startShopping: "Ξεκίνα αγορές για να δεις τις παραγγελίες σου εδώ",
      browseProducts: "Προβολή προϊόντων",
      processing: "Σε επεξεργασία",
      shipped: "Απεστάλη",
      delivered: "Παραδόθηκε",
      paid: "Πληρωμένη",
      itemsCount: "προϊόν(τα)",
      orderPlaced: "Η παραγγελία καταχωρήθηκε επιτυχώς!",
    },
    categories: {
      stratiotika: "ΣΤΡΑΤΙΩΤΙΚΑ ΕΙΔΗ",
      astynomika: "ΑΣΤΥΝΟΜΙΚΑ ΕΙΔΗ",
      kynigetika: "ΚΥΝΗΓΕΤΙΚΑ ΕΙΔΗ",
      camping: "CAMPING-ΕΠΙΒΙΩΣΗ",
      accessories: "ΑΞΕΣΟΥΑΡ",
    },
  },
};

const LanguageContext = createContext(null);

function getByPath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en");

  const value = useMemo(() => {
    const t = (key) => {
      const current = getByPath(translations[language], key);
      if (current !== undefined) return current;
      const fallback = getByPath(translations.en, key);
      return fallback !== undefined ? fallback : key;
    };

    const toggleLanguage = () => {
      setLanguage((prev) => {
        const next = prev === "en" ? "el" : "en";
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        return next;
      });
    };

    return { language, setLanguage, toggleLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
