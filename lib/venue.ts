// Uygulamada sadece kafeler var.
export function categoryIcon(_key?: string | null): 'cafe' {
  return 'cafe';
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

// Demo kafelerin adındaki "Demo · " önekini gösterirken kaldırır (DEMO etiketi ayrıca gösterilir).
export function venueTitle(name: string): string {
  return name.replace(/^Demo · /, '');
}
