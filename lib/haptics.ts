import * as Haptics from 'expo-haptics';

// Titreşim geri bildirimi. Cihaz desteklemiyorsa sessizce yok sayılır.
export function tap() {
  Haptics.selectionAsync().catch(() => {});
}

export function impact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
