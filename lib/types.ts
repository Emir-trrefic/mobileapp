export type Venue = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  radius_m: number;
  distance_m: number;
  active_count: number;
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
};

export type Person = {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  job: string | null;
  interests: string[];
  request_status: 'pending' | 'accepted' | 'declined' | null;
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

export const PROFILE_COLUMNS = 'id, display_name, birth_year, bio, job, interests, avatar_url';
