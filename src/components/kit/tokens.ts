/**
 * Layout-Tokens: einheitliche Raster und Abstände.
 * Neue Seiten verwenden diese Klassen statt eigener Werte.
 */
export const grids = {
  /** Geräte- und Karten-Raster */
  cards: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
  /** Kennzahlen / Sensorwerte */
  stats: "grid grid-cols-2 gap-3 lg:grid-cols-4",
  /** Zwei Spalten (Formulare, Fakten) */
  pairs: "grid gap-3 sm:grid-cols-2",
} as const;

export const stacks = {
  /** Abstand zwischen Seitenabschnitten */
  page: "space-y-8",
  /** Kompaktere Seiten (Detail-/Formularseiten) */
  pageTight: "space-y-6",
  /** Inhalt innerhalb eines Abschnitts */
  section: "space-y-3",
} as const;
