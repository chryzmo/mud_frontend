export type ChatMessage =
  | { type: 'plain'; text: string; bold: boolean }
  | { type: 'spacer' }
  | { type: 'combat'; npcName: string; actionText: string }
  | { type: 'player'; playerName: string; actionText: string }
  | { type: 'item'; itemName: string; actionText: string }
  | { type: 'whisper'; text: string };
