import { useMemo, useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Uygulamanın adı; isim gösteren her yer buradan okur.
export const BRAND = 'rast';
// Marka yazı tipi (App.tsx'te yüklenir) ve noktanın rengi.
export const BRAND_FONT = 'PlayfairDisplay_600SemiBold_Italic';
export const ACCENT_DOT = '#3D6BFF';

// Ekranlarda gösterilen sürüm (giriş ve profil ekranı buradan okur).
export const APP_VERSION = '0.21';

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

// Koyu tema: derin gece laciverti zemin (siyaha yakın ama soğuk lacivert tonlu), beyaz metin.
// Yüzeyler yükseldikçe bir ton açılır; vurgu açık lacivert-mavi.
export const NAVY = '#050A18';

export const darkColors: Palette = {
  scheme: 'dark',
  bg: NAVY,
  card: '#0A1328',
  cardFocus: '#0E1832',
  card2: '#121E3B',
  border: '#1C2A4D',
  line: 'rgba(255,255,255,0.035)',
  text: '#F2F5FB',
  muted: '#8A97B6',
  accent: '#A9BEFF',
  accentLight: '#BCCBFF',
  accentSoft: 'rgba(169,190,255,0.14)',
  pink: '#3D6BFF', // ikinci vurgu: kobalt (bildirim, istek)
  pinkSoft: 'rgba(61,107,255,0.20)',
  success: '#3DD6A0',
  successSoft: 'rgba(61,214,160,0.15)',
  warn: '#FBBF24',
  danger: '#FF7A8A',
  dangerSoft: 'rgba(255,122,138,0.14)',
  glass: 'rgba(10,19,40,0.97)',
  scrim: 'rgba(2,5,12,0.66)',
  shadow: '#000000',
  shadowOpacity: 0.55,
  gradient: ['#1A3A8F', '#0E2160'],
  hero: [NAVY, NAVY, '#071029'],
  blobs: ['rgba(61,107,255,0)', 'rgba(61,107,255,0)'],
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
  hero: ['#FFFFFF', '#F6F8FC', '#EEF2FA'],
  blobs: ['rgba(27,58,140,0.16)', 'rgba(47,91,234,0.03)'],
};

export const photoShade = ['rgba(8,8,20,0)', 'rgba(8,8,20,0.9)'] as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Görünüm tercihi: telefonun ayarını izle (varsayılan), ya da elle açık / koyu seç.
export type ThemePref = 'system' | 'light' | 'dark';
const PREF_KEY = 'burada.theme';
let themePref: ThemePref = 'system';
const listeners = new Set<() => void>();

function applyPref(p: ThemePref) {
  try {
    Appearance.setColorScheme(p === 'system' ? 'unspecified' : p);
  } catch {
    // eski sürümlerde yok sayılır
  }
}

export function setThemePref(p: ThemePref) {
  themePref = p;
  applyPref(p);
  listeners.forEach((l) => l());
  AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => themePref,
  );
}

AsyncStorage.getItem(PREF_KEY)
  .then((v) => {
    if (v === 'light' || v === 'dark' || v === 'system') {
      themePref = v;
      applyPref(v);
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

// Etkin tema: tercih sistemse telefonun ayarı, değilse seçilen.
export function useColors(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

// Stil fabrikasını tema değişince yeniden üretir. Fabrika modül seviyesinde tanımlanmalı.
export function useStyles<T>(factory: (c: Palette) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [factory, c]);
}
