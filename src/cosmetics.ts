// Cosmetics are keys into a fixed set, never styling the server (or a sticker) supplies. The same
// lists are in mud_server/src/internal/worldfile/codes.go; a key that is not here draws nothing.
export const COLORS = ['gold', 'crimson', 'azure', 'emerald', 'violet', 'amber', 'rose', 'silver'] as const;
export const BADGES = ['star', 'crown', 'key', 'lantern', 'bell', 'gear', 'quill', 'flame'] as const;

// Placeholder glyphs until the owner picks the badge art.
const GLYPHS: Record<(typeof BADGES)[number], string> = {
  star: '★', crown: '♛', key: '⚷', lantern: '✧', bell: '♫', gear: '⚙', quill: '✎', flame: '♨',
};

// The CSS class for a colour key ("nc-gold", defined in index.css), or undefined for anything else.
export const colorClass = (key?: string): string | undefined =>
  (COLORS as readonly string[]).includes(key ?? '') ? `nc-${key}` : undefined;

export const badgeGlyph = (key?: string): string | undefined =>
  (BADGES as readonly string[]).includes(key ?? '') ? GLYPHS[key as (typeof BADGES)[number]] : undefined;

// What the player owns and wears, from the `cosmetics` frame.
export interface Cosmetics {
  colors: string[];
  badges: string[];
  color?: string;
  badge?: string;
}
