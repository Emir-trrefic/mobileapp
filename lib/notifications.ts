import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { Connection } from './types';

// Telefon bildirimleri.
// - Uzak bildirim (push): sunucu (supabase/functions/notify) gönderir; uygulama kapalıyken de gelir.
//   Bunun için app.json'da EAS proje kimliği olmalı (docs/BILDIRIM.md). Yoksa sadece yerel bildirim çalışır.
// - Yerel bildirim: uygulama açıkken / arka plana yeni alınmışken yeni istek gelirse telefonun kendisi gösterir.
// - Tanışma isteği bildiriminde iki düğme var: "Tanışalım" ve "Şimdi değil".

export const MEET_CATEGORY = 'meet_request';
export const ACTION_ACCEPT = 'accept';
export const ACTION_DECLINE = 'decline';

export type NotifData = { type?: 'request' | 'accepted' | 'message'; request_id?: string };

// Uygulama önündeyken sistem afişi gösterilmez; onun yerine uygulama içi afiş çıkar (RequestToast).
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const inApp = AppState.currentState === 'active';
    return {
      shouldShowBanner: !inApp,
      shouldShowList: true,
      shouldPlaySound: !inApp,
      shouldSetBadge: false,
    };
  },
});

let categoriesReady = false;
export async function setupNotificationCategories() {
  if (categoriesReady) return;
  categoriesReady = true;
  try {
    await Notifications.setNotificationCategoryAsync(MEET_CATEGORY, [
      { identifier: ACTION_ACCEPT, buttonTitle: 'Tanışalım', options: { opensAppToForeground: true } },
      { identifier: ACTION_DECLINE, buttonTitle: 'Şimdi değil', options: { opensAppToForeground: false, isDestructive: true } },
    ]);
  } catch {
    categoriesReady = false;
  }
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<PermissionState> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

export async function askNotificationPermission(): Promise<PermissionState> {
  try {
    const p = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

let pushToken: string | null = null;
export const hasRemotePush = () => pushToken !== null;

// İzin varsa cihazın uzak bildirim adresini alıp sunucuya yazar. EAS proje kimliği yoksa null.
export async function registerPush(): Promise<string | null> {
  try {
    if ((await notificationPermission()) !== 'granted') return null;
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('set_push_token', {
      p_token: data,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    pushToken = error ? null : data;
    return pushToken;
  } catch {
    return null;
  }
}

export async function unregisterPush() {
  if (!pushToken) return;
  const t = pushToken;
  pushToken = null;
  await supabase.rpc('clear_push_token', { p_token: t });
}

function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}

const venueName = (n: string) => n.replace(/^Demo · /, '');

export async function notifyRequestLocally(x: Connection) {
  if ((await notificationPermission()) !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${firstName(x.display_name)} seninle tanışmak istiyor`,
      body: `${venueName(x.venue_name)} kafesindesiniz. Tanışalım mı?`,
      categoryIdentifier: MEET_CATEGORY,
      data: { type: 'request', request_id: x.request_id },
      sound: true,
    },
    trigger: null,
  }).catch(() => {});
}

export async function notifyAcceptedLocally(x: Connection) {
  if ((await notificationPermission()) !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${firstName(x.display_name)} isteğini kabul etti`,
      body: 'Tanıştınız! Sohbete ilk mesajı sen yazabilirsin.',
      data: { type: 'accepted', request_id: x.request_id },
      sound: true,
    },
    trigger: null,
  }).catch(() => {});
}
