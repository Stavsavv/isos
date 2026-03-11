import { Link } from "react-router-dom";
import { Package, Mail, Phone, ShieldCheck } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const footerText = {
  en: {
    brand: "ShopNow",
    description:
      "A focused storefront for tactical, hunting, camping, and accessory products with a cleaner checkout and clearer support paths.",
    shop: "Shop",
    company: "Company",
    support: "Support",
    trust: "Store trust",
    contact: "Contact",
    about: "About",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    shippingReturns: "Shipping & Returns",
    browseProducts: "Browse products",
    orders: "My orders",
    register: "Create account",
    secureCheckout: "Secure checkout",
    secureCheckoutMeta: "Protected payment flow",
    supportMeta: "Business-day replies",
    rights: "All rights reserved.",
  },
  el: {
    brand: "ShopNow",
    description:
      "Ένα στοχευμένο storefront για στρατιωτικά, κυνηγετικά, camping και αξεσουάρ, με καθαρό checkout και πιο σαφείς διαδρομές υποστήριξης.",
    shop: "Αγορές",
    company: "Εταιρεία",
    support: "Υποστήριξη",
    trust: "Αξιοπιστία καταστήματος",
    contact: "Επικοινωνία",
    about: "Σχετικά",
    privacy: "Πολιτική απορρήτου",
    terms: "Όροι χρήσης",
    shippingReturns: "Αποστολές & επιστροφές",
    browseProducts: "Προϊόντα",
    orders: "Οι παραγγελίες μου",
    register: "Δημιουργία λογαριασμού",
    secureCheckout: "Ασφαλές checkout",
    secureCheckoutMeta: "Προστατευμένη ροή πληρωμής",
    supportMeta: "Απαντήσεις σε εργάσιμες ημέρες",
    rights: "Με επιφύλαξη παντός δικαιώματος.",
  },
};

export default function Footer() {
  const { language } = useLanguage();
  const copy = footerText[language] || footerText.en;

  return (
    <footer className="mt-auto border-t border-surface-200 bg-surface-900 text-surface-300 dark:border-surface-800 dark:bg-surface-950">
      <div className="page-container py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500">
                <Package size={18} className="text-white" />
              </div>
              <span className="font-display text-xl font-bold text-white">{copy.brand}</span>
            </Link>
            <p className="max-w-md text-sm leading-7 text-surface-400">{copy.description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-surface-800 bg-surface-900/70 p-4">
                <div className="flex items-center gap-2 text-white">
                  <ShieldCheck size={16} className="text-primary-400" />
                  <span className="text-sm font-semibold">{copy.secureCheckout}</span>
                </div>
                <p className="mt-2 text-xs text-surface-400">{copy.secureCheckoutMeta}</p>
              </div>
              <div className="rounded-xl border border-surface-800 bg-surface-900/70 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Mail size={16} className="text-primary-400" />
                  <span className="text-sm font-semibold">support@shopnow.example</span>
                </div>
                <p className="mt-2 text-xs text-surface-400">{copy.supportMeta}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">{copy.shop}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="transition-colors hover:text-primary-400">{copy.browseProducts}</Link></li>
              <li><Link to="/shipping-returns" className="transition-colors hover:text-primary-400">{copy.shippingReturns}</Link></li>
              <li><Link to="/profile" className="transition-colors hover:text-primary-400">{copy.orders}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">{copy.company}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="transition-colors hover:text-primary-400">{copy.about}</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-primary-400">{copy.contact}</Link></li>
              <li><Link to="/register" className="transition-colors hover:text-primary-400">{copy.register}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">{copy.trust}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="transition-colors hover:text-primary-400">{copy.privacy}</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-primary-400">{copy.terms}</Link></li>
              <li><Link to="/shipping-returns" className="transition-colors hover:text-primary-400">{copy.shippingReturns}</Link></li>
            </ul>

            <div className="mt-5 rounded-xl border border-surface-800 bg-surface-900/70 p-4 text-sm">
              <div className="flex items-center gap-2 text-white">
                <Phone size={15} className="text-primary-400" />
                <span>+30 210 000 0000</span>
              </div>
              <p className="mt-2 text-xs text-surface-400">Mon-Fri, 10:00-18:00</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-surface-800 pt-6 text-sm text-surface-500 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} ShopNow. {copy.rights}</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="transition-colors hover:text-surface-300">{copy.privacy}</Link>
            <Link to="/terms" className="transition-colors hover:text-surface-300">{copy.terms}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
