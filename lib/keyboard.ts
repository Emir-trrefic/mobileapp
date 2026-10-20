import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';

// Açık klavyenin yüksekliği (kapalıyken 0). Alttaki düğmeyi klavyenin hemen üstüne oturtmak için.
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    // Düzen değişikliği klavyeyle aynı hızda kayar.
    const animate = (duration?: number) => {
      if (Platform.OS === 'ios') LayoutAnimation.configureNext(LayoutAnimation.create(duration || 250, 'keyboard', 'opacity'));
    };
    const a = Keyboard.addListener(showEvt, (e) => {
      animate(e.duration);
      setH(e.endCoordinates.height);
    });
    const b = Keyboard.addListener(hideEvt, (e) => {
      animate(e.duration);
      setH(0);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  return h;
}
