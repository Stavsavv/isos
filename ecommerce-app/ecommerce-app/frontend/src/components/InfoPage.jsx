import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { siteContent } from "../content/siteContent.js";

export default function InfoPage({ pageKey }) {
  const { language } = useLanguage();
  const content = siteContent[pageKey]?.[language] || siteContent[pageKey]?.en;

  if (!content) {
    return null;
  }

  return (
    <div className="animate-fade-in">
      <section className="border-b border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div className="page-container py-16 md:py-20">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary-500">
            {content.eyebrow}
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-surface-900 dark:text-white md:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-surface-600 dark:text-surface-300">
            {content.intro}
          </p>
        </div>
      </section>

      <section className="page-container py-14 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {content.cards ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {content.cards.map((card) => (
                  <div key={card.title} className="card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">
                      {card.title}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-surface-900 dark:text-white">
                      {card.value}
                    </p>
                    <p className="mt-2 text-sm text-surface-500">{card.meta}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {content.sections.map((section) => (
              <div key={section.title} className="card p-6 md:p-7">
                <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="leading-7 text-surface-600 dark:text-surface-300">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <aside className="card h-fit p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
              ShopNow
            </p>
            <h2 className="mt-3 text-xl font-semibold text-surface-900 dark:text-white">
              {language === "el" ? "Γρήγορες διαδρομές" : "Quick links"}
            </h2>
            <div className="mt-5 space-y-3 text-sm">
              <Link to="/products" className="flex items-center justify-between rounded-lg border border-surface-200 px-4 py-3 transition-colors hover:border-primary-500 hover:text-primary-500 dark:border-surface-700">
                <span>{language === "el" ? "Προϊόντα" : "Browse products"}</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/contact" className="flex items-center justify-between rounded-lg border border-surface-200 px-4 py-3 transition-colors hover:border-primary-500 hover:text-primary-500 dark:border-surface-700">
                <span>{language === "el" ? "Επικοινωνία" : "Contact support"}</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/shipping-returns" className="flex items-center justify-between rounded-lg border border-surface-200 px-4 py-3 transition-colors hover:border-primary-500 hover:text-primary-500 dark:border-surface-700">
                <span>{language === "el" ? "Αποστολές & επιστροφές" : "Shipping & returns"}</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
