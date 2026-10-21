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

// Kafede şu an kaç kişi var: gerçek check-in'ler + (demo kafede) örnek kişiler.
// 007 henüz çalıştırılmadıysa demo kafeler için kimliğinden sabit bir sayı türetilir.
export function peopleCount(v: { id: string; active_count: number; is_demo?: boolean; demo_people?: number }): number {
  if (!v.is_demo) return v.active_count;
  if (typeof v.demo_people === 'number') return v.active_count + v.demo_people;
  let h = 0;
  for (let i = 0; i < v.id.length; i++) h = (h * 31 + v.id.charCodeAt(i)) >>> 0;
  return v.active_count + 1 + (h % 9);
}
