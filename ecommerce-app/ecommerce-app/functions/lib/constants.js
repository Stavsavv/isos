const CURRENCY = "eur";
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FEE = 4.99;
const EUROPE_ALLOWED_COUNTRIES = [
  "GR", "CY", "IT", "DE", "FR", "ES", "PT", "NL", "BE", "AT", "IE", "LU",
  "MT", "SI", "SK", "CZ", "PL", "HU", "RO", "BG", "HR", "SE", "DK", "FI",
  "EE", "LV", "LT",
];

const SHOT_NUMBER_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  HIDDEN: "hidden",
};

module.exports = {
  CURRENCY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  EUROPE_ALLOWED_COUNTRIES,
  SHOT_NUMBER_STATUS,
};
