export const APP_NAME = import.meta.env.VITE_APP_NAME || "ShopNow";
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const APP_CURRENCY = "EUR";
export const APP_LOCALE = "el-GR";

export const EUROPE_COUNTRIES = [
  { code: "GR", label: "Greece" },
  { code: "CY", label: "Cyprus" },
  { code: "IT", label: "Italy" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "PT", label: "Portugal" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "AT", label: "Austria" },
  { code: "IE", label: "Ireland" },
  { code: "LU", label: "Luxembourg" },
  { code: "MT", label: "Malta" },
  { code: "SI", label: "Slovenia" },
  { code: "SK", label: "Slovakia" },
  { code: "CZ", label: "Czechia" },
  { code: "PL", label: "Poland" },
  { code: "HU", label: "Hungary" },
  { code: "RO", label: "Romania" },
  { code: "BG", label: "Bulgaria" },
  { code: "HR", label: "Croatia" },
  { code: "SE", label: "Sweden" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "EE", label: "Estonia" },
  { code: "LV", label: "Latvia" },
  { code: "LT", label: "Lithuania" },
];

export function formatCurrency(amount) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: APP_CURRENCY,
  }).format(amount || 0);
}

export function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
