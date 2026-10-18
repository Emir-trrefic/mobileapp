import { Platform, StatusBar, useWindowDimensions } from 'react-native';

// Ek paket gerektirmeden güvenli alan boşlukları.
// iPhone 17 Pro: 402 x 874 pt, Dynamic Island üstte ~62 pt, ana ekran çubuğu altta 34 pt.
export function useInsets() {
  const { height } = useWindowDimensions();

  if (Platform.OS === 'ios') {
    if (height >= 850) return { top: 62, bottom: 34 }; // Dynamic Island'lı modeller (17 Pro dahil)
    if (height >= 780) return { top: 47, bottom: 34 }; // çentikli modeller
    return { top: 20, bottom: 0 };
  }
  return { top: StatusBar.currentHeight ?? 24, bottom: 0 };
}
