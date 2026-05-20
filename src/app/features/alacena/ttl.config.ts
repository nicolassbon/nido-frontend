export interface TtlInfo {
  days: number;
  openedDays: number | null;
  hint: string;
}

const FALLBACK: TtlInfo = {
  days: 30,
  openedDays: null,
  hint: 'Verificá la fecha de vencimiento del envase.',
};

const TTL_RULES: { keywords: string[]; info: TtlInfo }[] = [
  // ── Carnes y pescados ────────────────────────────────────────
  {
    keywords: ['meat', 'beef', 'pork', 'chicken', 'poultry', 'fish', 'seafood',
               'carne', 'pollo', 'cerdo', 'pescado', 'marisco'],
    info: { days: 3, openedDays: null, hint: 'Carne fresca. Si no se usa en 3 días, congelar.' },
  },
  // ── Congelados ───────────────────────────────────────────────
  {
    keywords: ['frozen', 'congelado'],
    info: { days: 180, openedDays: 1, hint: 'Una vez descongelado, consumir en el día.' },
  },
  // ── Leche y derivados líquidos ───────────────────────────────
  {
    keywords: ['dairy', 'dairi', 'milk', 'leche', 'lacteo'],
    info: { days: 7, openedDays: 3, hint: 'Una vez abierto, dura 3 días en heladera.' },
  },
  // ── Yogur ────────────────────────────────────────────────────
  {
    keywords: ['yogurt', 'yoghurt', 'yogur'],
    info: { days: 14, openedDays: 2, hint: 'Una vez abierto, consumir en 2 días.' },
  },
  // ── Queso ────────────────────────────────────────────────────
  {
    keywords: ['cheese', 'queso'],
    info: { days: 30, openedDays: 7, hint: 'Una vez abierto, dura 7 días en heladera.' },
  },
  // ── Dulce de leche, manjar, cajeta ───────────────────────────
  {
    keywords: ['dulce-de-leche', 'dulce_de_leche', 'manjar', 'cajeta'],
    info: { days: 365, openedDays: 30, hint: 'Una vez abierto, refrigerar y consumir en 1 mes.' },
  },
  // ── Mermeladas y jaleas ──────────────────────────────────────
  {
    keywords: ['jam', 'jelly', 'marmalade', 'mermelada', 'confitura'],
    info: { days: 730, openedDays: 90, hint: 'Una vez abierto, refrigerar y consumir en 3 meses.' },
  },
  // ── Bebidas ──────────────────────────────────────────────────
  {
    keywords: ['beverage', 'drink', 'juice', 'soda', 'jugo', 'bebida', 'refresco'],
    info: { days: 365, openedDays: 3, hint: 'Una vez abierto, dura 3 días en heladera.' },
  },
  // ── Cereales y avena ─────────────────────────────────────────
  {
    keywords: ['cereal', 'oat', 'avena', 'granola'],
    info: { days: 180, openedDays: 30, hint: 'Una vez abierto, dura 1 mes en lugar seco.' },
  },
  // ── Snacks y galletitas ──────────────────────────────────────
  {
    keywords: ['snack', 'chip', 'cracker', 'cookie', 'galleta', 'alfajor', 'bizcocho'],
    info: { days: 90, openedDays: 14, hint: 'Una vez abierto, dura 2 semanas en lugar seco.' },
  },
  // ── Conservas y latas ────────────────────────────────────────
  {
    keywords: ['canned', 'conserva', 'lata', 'en-lata', 'tinned'],
    info: { days: 730, openedDays: 5, hint: 'Una vez abierto, refrigerar y consumir en 5 días.' },
  },
  // ── Pan ──────────────────────────────────────────────────────
  {
    keywords: ['bread', 'pan', 'baguette', 'toast', 'tostada'],
    info: { days: 5, openedDays: 3, hint: 'Consumir en 3–5 días.' },
  },
  // ── Huevos ───────────────────────────────────────────────────
  {
    keywords: ['egg', 'huevo'],
    info: { days: 30, openedDays: null, hint: 'Conservar en heladera.' },
  },
  // ── Salsas y condimentos ─────────────────────────────────────
  {
    keywords: ['sauce', 'ketchup', 'mayonnaise', 'salsa', 'mayonesa', 'condiment', 'mustard', 'mostaza'],
    info: { days: 365, openedDays: 30, hint: 'Una vez abierto, dura 1 mes en heladera.' },
  },
  // ── Café, té, yerba ──────────────────────────────────────────
  {
    keywords: ['coffee', 'cafe', 'café', 'tea', 'mate', 'yerba'],
    info: { days: 180, openedDays: 60, hint: 'Una vez abierto, dura 2 meses en lugar seco y sellado.' },
  },
  // ── Aceites ──────────────────────────────────────────────────
  {
    keywords: ['oil', 'aceite', 'olive'],
    info: { days: 365, openedDays: 90, hint: 'Una vez abierto, dura 3 meses en lugar fresco y oscuro.' },
  },
  // ── Pastas y arroces ─────────────────────────────────────────
  {
    keywords: ['pasta', 'rice', 'arroz', 'fideo', 'noodle', 'spaghetti'],
    info: { days: 730, openedDays: 180, hint: 'Una vez abierto, conservar en recipiente sellado.' },
  },
  // ── Chocolates y dulces ──────────────────────────────────────
  {
    keywords: ['chocolate', 'candy', 'dulce', 'caramelo', 'sweet'],
    info: { days: 180, openedDays: 30, hint: 'Una vez abierto, consumir en 1 mes.' },
  },
];

export function getTtlForCategory(categoriesTags: string[]): TtlInfo {
  const normalized = categoriesTags.map(t => t.toLowerCase());
  for (const rule of TTL_RULES) {
    const matches = rule.keywords.some(kw => normalized.some(tag => tag.includes(kw)));
    if (matches) return rule.info;
  }
  return FALLBACK;
}
