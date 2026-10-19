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
  pink: string; // ikinci vurgu (kobalt): bildirim rozeti, gelen istek
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
  gradient: Grad2; // marka gradyanı: lacivert tonları
  hero: Grad3; // karşılama zemini
  blobs: Grad2; // süzülen renk lekeleri
};

// Koyu tema: lacivert tonlu siyah, beyaz metin. Tek vurgu: açık gök mavisi/lacivert tonları.
export const darkColors: Palette = {
  scheme: 'dark',
  bg: '#070B16',
  card: '#0E1527',
  cardFocus: '#121B33',
  card2: '#17223D',
  border: '#222F4F',
  line: 'rgba(255,255,255,0.04)',
  text: '#F4F6FB',
  muted: '#93A0BF',
  accent: '#9DB4FF',
  accentLight: '#B7C8FF',
  accentSoft: 'rgba(157,180,255,0.16)',
  pink: '#3D6BFF', // ikinci vurgu: kobalt (bildirim, istek)
  pinkSoft: 'rgba(61,107,255,0.20)',
  success: '#3DD6A0',
  successSoft: 'rgba(61,214,160,0.16)',
  warn: '#FBBF24',
  danger: '#FF7A8A',
  dangerSoft: 'rgba(255,122,138,0.15)',
  glass: 'rgba(14,21,39,0.96)',
  scrim: 'rgba(4,7,16,0.62)',
  shadow: '#000000',
  shadowOpacity: 0.5,
  gradient: ['#2447A8', '#0F2260'],
  hero: ['#070B16', '#0A1230', '#0F1B4A'],
  blobs: ['rgba(61,107,255,0.28)', 'rgba(157,180,255,0.03)'],
};

// Açık tema: beyaz zemin, siyaha yakın lacivert metin, lacivert vurgu.
export const lightColors: Palette = {
  scheme: 'light',
  bg: '#F4F6FA',
  card: '#FFFFFF',
  cardFocus: '#FFFFFF',
  card2: '#EBEFF6',
  border: '#DCE2EE',
  line: 'rgba(10,17,40,0.06)',
  text: '#0A1128',
  muted: '#5A667F',
  accent: '#0B1F4B',
  accentLight: '#1B3A8C',
  accentSoft: 'rgba(11,31,75,0.08)',
  pink: '#2F5BEA',
  pinkSoft: 'rgba(47,91,234,0.10)',
  success: '#0E9F6E',
  successSoft: 'rgba(14,159,110,0.12)',
  warn: '#B76E00',
  danger: '#D6334C',
  dangerSoft: 'rgba(214,51,76,0.10)',
  glass: 'rgba(255,255,255,0.96)',
  scrim: 'rgba(4,7,16,0.55)',
  shadow: '#0A1A47',
  shadowOpacity: 0.14,
  gradient: ['#1B3A8C', '#0A1A47'],
  hero: ['#FFFFFF', '#EEF2FB', '#D9E2F6'],
  blobs: ['rgba(27,58,140,0.16)', 'rgba(47,91,234,0.03)'],
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
