export const CATEGORIES = [
  { key: 'cafe', label: 'Kafe', emoji: '☕' },
  { key: 'restaurant', label: 'Restoran', emoji: '🍽️' },
  { key: 'bar', label: 'Bar', emoji: '🍸' },
  { key: 'park', label: 'Park', emoji: '🌳' },
  { key: 'gym', label: 'Spor', emoji: '🏋️' },
  { key: 'library', label: 'Kütüphane', emoji: '📚' },
  { key: 'campus', label: 'Kampüs', emoji: '🎓' },
];

export function categoryEmoji(key?: string | null): string {
  return CATEGORIES.find((c) => c.key === key)?.emoji ?? '📍';
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}
