import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const BRAND = 'Burada';

type Grad2 = readonly [string, string];
type Grad3 = readonly [string, string, string];

export type Palette = {
  scheme: 'light' | 'dark';
  // zemin ve yüzeyler (yükseldikçe değişir)
  bg: string;
  card: string;
  cardFocus: string;
  card2: string;
  border: string;
  line: string; // dekoratif ızgara çizgisi
  // metin
  text: string;
  muted: string;
  // marka
  accent: string;
  accentLight: string; // metin/bağlantı olarak kullanılan vurgu (her temada okunur)
  accentSoft: string;
  pink: string;
  pinkSoft: string;
  // durum
  success: string;
  successSoft: string;
  warn: string;
  danger: string;
  dangerSoft: string;
  // katmanlar
  glass: string; // yüzen çubuk / kart zemini
  scrim: string; // fotoğraf üstündeki yarı saydam butonlar
  shadow: string;
  shadowOpacity: number;
  // gradyanlar
  gradient: Grad2; // marka gradyanı: mor → mercan pembe
  hero: Grad3; // karşılama zemini
  blobs: Grad2; // süzülen renk lekeleri
};

// Koyu tema: saf siyah yok, indigo tonlu antrasit. Vurgu rengi biraz yumuşatıldı.
export const darkColors: Palette = {
  scheme: 'dark',
  bg: '#0F0E1B',
  card: '#181730',
  cardFocus: '#1F1E3C',
  card2: '#232244',
  border: '#2E2D50',
  line: 'rgba(255,255,255,0.045)',
  text: '#F4F3FF',
  muted: '#A3A2C6',
  accent: '#8B6CFF',
  accentLight: '#B3A1FF',
  accentSoft: 'rgba(139,108,255,0.22)',
  pink: '#FF6B8B',
  pinkSoft: 'rgba(255,107,139,0.18)',
  success: '#3DD6A0',
  successSoft: 'rgba(61,214,160,0.16)',
  warn: '#FBBF24',
  danger: '#FF7A8A',
  dangerSoft: 'rgba(255,122,138,0.15)',
  glass: 'rgba(24,23,48,0.96)',
  scrim: 'rgba(11,11,22,0.62)',
  shadow: '#000000',
  shadowOpacity: 0.45,
  gradient: ['#8B6CFF', '#FF6B8B'],
  hero: ['#0F0E1B', '#171233', '#2A1250'],
  blobs: ['rgba(139,108,255,0.34)', 'rgba(255,107,139,0.04)'],
};

// Açık tema: lavanta tonlu beyaz, koyu indigo metin, daha doygun vurgu.
export const lightColors: Palette = {
  scheme: 'light',
  bg: '#F6F4FC',
  card: '#FFFFFF',
  cardFocus: '#FFFFFF',
  card2: '#EDEAF8',
  border: '#E0DCF0',
  line: 'rgba(60,40,140,0.06)',
  text: '#16142B',
  muted: '#625F86',
  accent: '#6A47F5',
  accentLight: '#5A3BE0',
  accentSoft: 'rgba(106,71,245,0.12)',
  pink: '#F0407A',
  pinkSoft: 'rgba(240,64,122,0.12)',
  success: '#0E9F6E',
  successSoft: 'rgba(14,159,110,0.12)',
  warn: '#C77700',
  danger: '#DC3F57',
  dangerSoft: 'rgba(220,63,87,0.10)',
  glass: 'rgba(255,255,255,0.96)',
  scrim: 'rgba(11,11,22,0.55)',
  shadow: '#2A1F6B',
  shadowOpacity: 0.16,
  gradient: ['#6A47F5', '#F0407A'],
  hero: ['#F6F4FC', '#ECE6FF', '#FFE4EE'],
  blobs: ['rgba(106,71,245,0.24)', 'rgba(240,64,122,0.05)'],
};

export const photoShade = ['rgba(8,8,20,0)', 'rgba(8,8,20,0.9)'] as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Telefonun açık/koyu ayarını otomatik takip eder (elle bir düğme yok).
export function useColors(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

// Stil fabrikasını tema değişince yeniden üretir. Fabrika modül seviyesinde tanımlanmalı.
export function useStyles<T>(factory: (c: Palette) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [factory, c]);
}
