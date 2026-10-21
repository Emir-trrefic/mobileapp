export type RequestStatus = 'pending' | 'accepted' | 'declined';

export type Venue = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  radius_m: number;
  distance_m: number;
  active_count: number;
  is_demo?: boolean; // test için eklenen demo kafe
  demo_people?: number; // demo kafede 3D sahnede gösterilen örnek kişi sayısı (007)
  model_url?: string | null; // kafenin kendi 3D modeli (007); boşsa profilden çizilir
  layout?: unknown; // kafenin 3D profili (008) → lib/cafeLayout.ts normalizeLayout
  my_visits?: number; // bu kullanıcının bu kafeye kaç kez gittiği (009)
  can_edit?: boolean; // bu kullanıcı kafenin 3D profilini düzenleyebilir mi (008)
};

export type ActiveCheckin = {
  checkin_id: string;
  venue_id: string;
  venue_name: string;
  expires_at: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type Profile = {
  id: string;
  display_name: string;
  birth_year: number | null;
  bio: string | null;
  job: string | null;
  interests: string[];
  avatar_url: string | null;
  phone: string | null;
  instagram: string | null;
  last_name?: string | null; // gizli: kimseye gösterilmez (010)
  tiktok?: string | null;
  x_handle?: string | null;
  linkedin?: string | null;
};

export type Person = {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  job: string | null;
  interests: string[];
  request_status: RequestStatus | null;
  request_direction: 'sent' | 'received' | null;
};

export type IncomingRequest = {
  request_id: string;
  from_user: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  job: string | null;
  interests: string[];
  venue_id: string;
  created_at: string;
};

// Benimle ilgili bir tanisma istegi (gelen ya da giden). Telefon / Instagram sadece
// benim gonderdigim ve kabul edilmis isteklerde dolu gelir.
export type Connection = {
  request_id: string;
  direction: 'sent' | 'received';
  status: RequestStatus;
  other_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  job: string | null;
  interests: string[];
  venue_id: string;
  venue_name: string;
  created_at: string;
  responded_at: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok?: string | null;
  x_handle?: string | null;
  linkedin?: string | null;
};

export const PROFILE_COLUMNS = 'id, display_name, birth_year, bio, job, interests, avatar_url, phone, instagram, last_name, tiktok, x_handle, linkedin';
// 010 çalıştırılmadıysa yeni sütunlar yoktur; profil yine de okunabilsin diye yedek liste.
export const PROFILE_COLUMNS_BASE = 'id, display_name, birth_year, bio, job, interests, avatar_url, phone, instagram';
