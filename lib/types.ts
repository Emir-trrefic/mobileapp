export type Venue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  distance_m: number;
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

export type Person = {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  request_status: 'pending' | 'accepted' | 'declined' | null;
};

export type IncomingRequest = {
  request_id: string;
  from_user: string;
  display_name: string;
  bio: string | null;
  venue_id: string;
  created_at: string;
};
