import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Props = TextInputProps & { label: string; tall?: boolean };

// Yazmaya başlayınca etiket yukarı kayar, çerçeve parlar.
const AnimatedInput = forwardRef<TextInputInstance, Props>(function AnimatedInput(
  { label, value, tall, onFocus, onBlur, style, ...rest },
  ref,
) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(value ? 1 : 0)).current;
  const active = focused || Boolean(value);
  const height = tall ? 112 : 60;

  useEffect(() => {
    Animated.timing(focus, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused, focus]);

  useEffect(() => {
    Animated.spring(lift, { toValue: active ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 4 }).start();
  }, [active, lift]);

  const borderColor = focus.interpolate({ inputRange: [0, 1], outputRange: [c.border, c.accent] });
  const backgroundColor = focus.interpolate({ inputRange: [0, 1], outputRange: [c.card, c.cardFocus] });
  const labelTop = lift.interpolate({ inputRange: [0, 1], outputRange: [18, 7] });
  const labelSize = lift.interpolate({ inputRange: [0, 1], outputRange: [16, 11] });
  const labelColor = focus.interpolate({ inputRange: [0, 1], outputRange: [c.muted, c.accentLight] });
  const shadowOpacity = focus.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] });

  return (
    <Animated.View
      style={[
        styles.box,
        { borderColor, backgroundColor, height, shadowColor: c.accent, shadowOpacity, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      ]}
    >
      <Animated.Text style={[styles.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
        {label}
      </Animated.Text>
      <TextInput
        ref={ref}
        value={value}
        multiline={tall}
        style={[styles.input, { height }, tall && styles.inputTall, style]}
        placeholderTextColor={c.muted}
        selectionColor={c.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </Animated.View>
  );
});

export default AnimatedInput;

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: { borderWidth: 1.5, borderRadius: 18, marginBottom: 14, justifyContent: 'flex-end' },
    label: { position: 'absolute', left: 16, fontWeight: '600', zIndex: 1 },
    input: { color: c.text, fontSize: 16, paddingHorizontal: 16, paddingBottom: 9, paddingTop: 24 },
    inputTall: { paddingTop: 28, textAlignVertical: 'top' },
  });
