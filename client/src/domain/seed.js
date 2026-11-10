// Reproducible synthetic retail network. No customer or employer data.
export const locations = [
  {
    id: "blr",
    name: "Bengaluru",
    short: "BLR",
    type: "Flagship",
    x: 390,
    y: 284,
  },
  {
    id: "mum",
    name: "Mumbai",
    short: "BOM",
    type: "Distribution hub",
    x: 242,
    y: 194,
  },
  { id: "del", name: "Delhi", short: "DEL", type: "Flagship", x: 352, y: 69 },
  {
    id: "hyd",
    name: "Hyderabad",
    short: "HYD",
    type: "Fulfillment center",
    x: 421,
    y: 214,
  },
  {
    id: "chn",
    name: "Chennai",
    short: "MAA",
    type: "City store",
    x: 464,
    y: 301,
  },
  {
    id: "pune",
    name: "Pune",
    short: "PNQ",
    type: "City store",
    x: 286,
    y: 225,
  },
];
const catalog = [
  [
    "SC-101",
    "Everyday linen shirt",
    "Apparel",
    1899,
    810,
    "shirt",
    "#e9e4d9",
    [24, 280, 48, 196, 32, 145],
    [16, 8, 14, 6, 9, 5],
  ],
  [
    "SC-102",
    "Studio wireless headphones",
    "Electronics",
    6499,
    2450,
    "headphones",
    "#d8e1e0",
    [14, 96, 19, 120, 38, 72],
    [9, 4, 11, 3, 6, 3],
  ],
  [
    "SC-103",
    "Terra ceramic mug",
    "Home & living",
    899,
    360,
    "cup",
    "#e7d9cb",
    [180, 12, 144, 26, 126, 18],
    [5, 13, 4, 10, 3, 8],
  ],
  [
    "SC-104",
    "Trail everyday backpack",
    "Accessories",
    2999,
    1180,
    "backpack",
    "#dde2ce",
    [22, 210, 28, 154, 34, 130],
    [12, 5, 10, 4, 8, 3],
  ],
  [
    "SC-105",
    "Cloud knit sneakers",
    "Footwear",
    4299,
    1750,
    "shoe",
    "#dedbd6",
    [160, 18, 142, 22, 108, 12],
    [4, 14, 5, 12, 3, 9],
  ],
  [
    "SC-106",
    "Arc desk lamp",
    "Home & living",
    3499,
    1350,
    "lamp",
    "#e8dfb9",
    [12, 124, 16, 110, 24, 88],
    [8, 3, 9, 4, 7, 3],
  ],
  [
    "SC-107",
    "Weekender cotton tote",
    "Accessories",
    799,
    290,
    "bag",
    "#d7ddda",
    [112, 94, 98, 86, 72, 68],
    [5, 4, 5, 4, 3, 3],
  ],
  [
    "SC-108",
    "Ritual insulated bottle",
    "Home & living",
    1499,
    580,
    "bottle",
    "#d6dcce",
    [140, 102, 116, 98, 86, 72],
    [6, 5, 6, 4, 4, 3],
  ],
];
export function createSeed() {
  const products = catalog.map(
    (
      [id, name, category, price, margin, icon, color, stocks, velocities],
      p,
    ) => ({
      id,
      name,
      category,
      price,
      margin,
      icon,
      color,
      nodes: locations.map((l, i) => ({
        location: l.id,
        stock: stocks[i],
        leadDays: 5 + (i % 3),
        history: Array.from({ length: 84 }, (_, d) =>
          Math.max(
            0,
            Math.round(
              velocities[i] *
                (1 +
                  0.19 * Math.sin((d + p) * 1.7) +
                  0.12 * Math.cos(d * 0.63) +
                  (d % 7 > 4 ? 0.18 : -0.07)),
            ),
          ),
        ),
      })),
    }),
  );
  return {
    version: 1,
    products,
    decisions: [],
    audit: [],
    createdAt: "2026-11-10T08:30:00.000Z",
  };
}
