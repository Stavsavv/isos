export const CATEGORY_OPTIONS = [
  { name: "\u03A3\u03A4\u03A1\u0391\u03A4\u0399\u03A9\u03A4\u0399\u039A\u0391 \u0395\u0399\u0394\u0397", slug: "stratiotika" },
  { name: "\u0391\u03A3\u03A4\u03A5\u039D\u039F\u039C\u0399\u039A\u0391 \u0395\u0399\u0394\u0397", slug: "astynomika" },
  { name: "\u039A\u03A5\u039D\u0397\u0393\u0395\u03A4\u0399\u039A\u0391 \u0395\u0399\u0394\u0397", slug: "kynigetika" },
  { name: "CAMPING-\u0395\u03A0\u0399\u0392\u0399\u03A9\u03A3\u0397", slug: "camping" },
  { name: "\u0391\u039E\u0395\u03A3\u039F\u03A5\u0391\u03A1", slug: "accessories" },
];

export const CATEGORY_NAME_BY_SLUG = Object.fromEntries(
  CATEGORY_OPTIONS.map((category) => [category.slug, category.name])
);

export const CATEGORY_SLUG_BY_NAME = Object.fromEntries(
  CATEGORY_OPTIONS.map((category) => [category.name, category.slug])
);

export function resolveCategorySlug(value) {
  if (!value || value === "all" || value === "All") return "all";
  if (CATEGORY_NAME_BY_SLUG[value]) return value;
  return CATEGORY_SLUG_BY_NAME[value] || "all";
}
