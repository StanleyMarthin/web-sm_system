// ============================================================
// Shared Constants
// ============================================================

/**
 * Font keluarga serif yang dipakai di seluruh aplikasi untuk
 * angka besar, heading, dan elemen-elemen bergaya luxury.
 *
 * Gunakan via `style={{ fontFamily: FONT_SERIF }}`.
 */
export const FONT_SERIF = "'Georgia', 'Times New Roman', serif";

/**
 * Hoisted style object — avoids creating a new object on every render.
 * Use: `style={SERIF_STYLE}` instead of `style={{ fontFamily: FONT_SERIF }}`.
 */
export const SERIF_STYLE = { fontFamily: FONT_SERIF } as const;
