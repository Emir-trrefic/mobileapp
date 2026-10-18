import { forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors } from '../lib/theme';

type Props = TextInputProps & { label: string; tall?: boolean };

// Yazmaya başlayınca etiket yukarı kayar, çerçeve parlar.
const AnimatedInput = forwardRef<TextInput, Props>(function AnimatedInput(
  { label, value, tall, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(value ? 1 : 0)).current;
  const active = focused || Boolean(value);
  const height = tall ? 112 : 60;

  useEffect(() => {
    Animated.timing(focus, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused, focus]);

  useEffect(() => {
    Animated.timing(lift, { toValue: active ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [active, lift]);

  const borderColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accentLight] });
  const backgroundColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.card, colors.card2] });
  const labelTop = lift.interpolate({ inputRange: [0, 1], outputRange: [18, 7] });
  const labelSize = lift.interpolate({ inputRange: [0, 1], outputRange: [16, 11] });
  const labelColor = focus.interpolate({ inputRange: [0, 1], outputRange: [colors.muted, colors.accentLight] });

  return (
    <Animated.View style={[styles.box, { borderColor, backgroundColor, height }]}>
      <Animated.Text style={[styles.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
        {label}
      </Animated.Text>
      <TextInput
        ref={ref}
        value={value}
        multiline={tall}
        style={[styles.input, { height }, tall && styles.inputTall, style]}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accentLight}
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

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, borderRadius: 16, marginBottom: 14, justifyContent: 'flex-end' },
  label: { position: 'absolute', left: 16, fontWeight: '600', zIndex: 1 },
  input: { color: colors.text, fontSize: 16, paddingHorizontal: 16, paddingBottom: 9, paddingTop: 24 },
  inputTall: { paddingTop: 28, textAlignVertical: 'top' },
});
