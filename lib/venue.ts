export type CategoryIcon = 'cafe' | 'restaurant' | 'beer' | 'leaf' | 'barbell' | 'library' | 'school' | 'location';

export const CATEGORIES: { key: string; label: string; icon: CategoryIcon }[] = [
  { key: 'cafe', label: 'Kafe', icon: 'cafe' },
  { key: 'restaurant', label: 'Restoran', icon: 'restaurant' },
  { key: 'bar', label: 'Bar', icon: 'beer' },
  { key: 'park', label: 'Park', icon: 'leaf' },
  { key: 'gym', label: 'Spor', icon: 'barbell' },
  { key: 'library', label: 'Kütüphane', icon: 'library' },
  { key: 'campus', label: 'Kampüs', icon: 'school' },
];

export function categoryIcon(key?: string | null): CategoryIcon {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? 'location';
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
