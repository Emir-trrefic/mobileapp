import { Platform, StatusBar, useWindowDimensions } from 'react-native';

// Çentik / Dynamic Island boşlukları (safe-area paketi olmadan).
// iPhone 17 Pro gibi Dynamic Island'lı modellerde üst ~62, alt ~34 pt.
export function useInsets() {
  const { height } = useWindowDimensions();
  if (Platform.OS === 'ios') {
    if (height >= 850) return { top: 62, bottom: 34 };
    if (height >= 780) return { top: 47, bottom: 34 };
    return { top: 20, bottom: 0 };
  }
  return { top: StatusBar.currentHeight ?? 24, bottom: 0 };
}

export const TAB_H = 60;

// Alt sekme çubuğunun ekranın altından uzaklığı.
export function useTabBarOffset() {
  const { bottom } = useInsets();
  return bottom > 0 ? bottom - 14 : 12;
}

// Ekranların içeriği sekme çubuğunun altında kalmasın diye ayırması gereken boşluk.
export function useTabBarSpace() {
  return useTabBarOffset() + TAB_H + 10;
}
