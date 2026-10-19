import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

// Tek bir yerde toplanan GPS: izin, servis durumu, canlı konum ve check-in için taze ölçüm.

export type Fix = { lat: number; lng: number; accuracy: number; at: number };

export type GpsStatus =
  | 'idle' // henüz başlatılmadı
  | 'loading' // izin / ilk konum bekleniyor
  | 'ready' // konum var
  | 'denied' // izin verilmedi (tekrar sorulabilir)
  | 'blocked' // izin kalıcı reddedildi, Ayarlar gerekli
  | 'disabled' // telefonun konum servisi kapalı
  | 'error';

export type GpsQuality = 'good' | 'ok' | 'weak';

// ≤ 30 m iyi, ≤ 65 m orta, üstü zayıf (sunucu 80 m üstünü reddeder).
export function qualityOf(accuracy: number): GpsQuality {
  if (accuracy <= 30) return 'good';
  if (accuracy <= 65) return 'ok';
  return 'weak';
}

export const CHECKIN_MAX_ACCURACY = 65;

type FreshOptions = { maxAccuracy?: number; maxAgeMs?: number; timeoutMs?: number };

type Ctx = {
  status: GpsStatus;
  fix: Fix | null;
  start: () => Promise<void>;
  fresh: (opts?: FreshOptions) => Promise<Fix>;
};

const GpsContext = createContext<Ctx | null>(null);

function toFix(loc: Location.LocationObject): Fix {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: typeof loc.coords.accuracy === 'number' && loc.coords.accuracy >= 0 ? loc.coords.accuracy : 999,
    at: loc.timestamp || Date.now(),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [fix, setFix] = useState<Fix | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const starting = useRef(false);
  const fixRef = useRef<Fix | null>(null);

  const publish = useCallback((f: Fix) => {
    fixRef.current = f;
    setFix(f);
  }, []);

  const stopWatch = useCallback(() => {
    watcher.current?.remove();
    watcher.current = null;
  }, []);

  const start = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    try {
      if (!fixRef.current) setStatus('loading');

      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        stopWatch();
        setStatus('disabled');
        return;
      }

      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        stopWatch();
        setStatus(perm.canAskAgain ? 'denied' : 'blocked');
        return;
      }

      // Hızlı ilk görüntü için son bilinen konum (çok eskiyse kullanılmaz).
      if (!fixRef.current) {
        try {
          const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 250 });
          if (last) {
            publish(toFix(last));
            setStatus('ready');
          }
        } catch {
          // son konum yoksa canlı takip zaten başlayacak
        }
      }

      if (!watcher.current) {
        watcher.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (loc) => {
            publish(toFix(loc));
            setStatus('ready');
          },
        );
      }
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    } finally {
      starting.current = false;
    }
  }, [publish, stopWatch]);

  // Ayarlardan izin/servis açılıp uygulamaya dönülünce kendiliğinden yeniden dener.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && status !== 'idle' && status !== 'ready') start();
    });
    return () => sub.remove();
  }, [status, start]);

  useEffect(() => stopWatch, [stopWatch]);

  // Check-in gibi kritik anlar için taze ve yeterince doğru bir ölçüm.
  const fresh = useCallback(async (opts: FreshOptions = {}): Promise<Fix> => {
    const { maxAccuracy = CHECKIN_MAX_ACCURACY, maxAgeMs = 8000, timeoutMs = 12000 } = opts;

    const cur = fixRef.current;
    if (cur && Date.now() - cur.at <= maxAgeMs && cur.accuracy <= maxAccuracy) return cur;

    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
      timeoutMs,
      'Konum alınamadı. Açık bir alanda tekrar dene.',
    );
    if ((loc as { mocked?: boolean }).mocked) {
      throw new Error('Sahte konum algılandı. Gerçek konumunla tekrar dene.');
    }
    const f = toFix(loc);
    publish(f);
    if (f.accuracy > maxAccuracy) {
      throw new Error(`GPS sinyali zayıf (±${Math.round(f.accuracy)} m). Açık bir alana geçip biraz bekle, tekrar dene.`);
    }
    return f;
  }, [publish]);

  const value = useMemo<Ctx>(() => ({ status, fix, start, fresh }), [status, fix, start, fresh]);
  return <GpsContext.Provider value={value}>{children}</GpsContext.Provider>;
}

export function useGps(): Ctx {
  const ctx = useContext(GpsContext);
  if (!ctx) throw new Error('useGps, LocationProvider içinde kullanılmalı');
  return ctx;
}
