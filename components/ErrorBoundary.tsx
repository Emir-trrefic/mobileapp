import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };

// Yakalanmayan (async / olay) hataları da ekranda göster.
const reporters = new Set<(e: Error) => void>();
try {
  const eu = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: Error, f?: boolean) => void; setGlobalHandler: (h: (e: Error, f?: boolean) => void) => void } }).ErrorUtils;
  if (eu) {
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((e, fatal) => {
      reporters.forEach((r) => r(e));
      prev(e, fatal);
    });
  }
} catch {
  // desteklenmiyorsa yok say
}
type State = { error: Error | null; info: string };

// Bir ekran çökerse beyaz ekran yerine hatayı yazıyla gösterir ve tekrar denemeye izin verir.
// (Tema bilgisine bağlı değil: tema kodunun kendisi hata verse bile çalışsın diye sabit renkler kullanır.)
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  componentDidMount() {
    reporters.add(this.report);
  }

  componentWillUnmount() {
    reporters.delete(this.report);
  }

  report = (error: Error) => this.setState({ error, info: 'Yakalanmayan hata' });

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: (info.componentStack ?? '').split('\n').slice(0, 8).join('\n') });
    console.error('Uygulama hatası:', error.message, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Bir hata oluştu</Text>
        <ScrollView style={styles.box} contentContainerStyle={{ padding: 14 }}>
          <Text style={styles.msg}>{error.message}</Text>
          {info ? <Text style={styles.stack}>{info}</Text> : null}
        </ScrollView>
        <Pressable style={styles.btn} onPress={() => this.setState({ error: null, info: '' })}>
          <Text style={styles.btnText}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050A18', padding: 24, paddingTop: 80 },
  title: { color: '#F4F6FB', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  box: { flex: 1, backgroundColor: '#0A1328', borderRadius: 14, marginBottom: 16 },
  msg: { color: '#FF7A8A', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  stack: { color: '#93A0BF', fontSize: 12, lineHeight: 18, marginTop: 12 },
  btn: { height: 52, borderRadius: 26, backgroundColor: '#F4F6FB', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  btnText: { color: '#050A18', fontSize: 16, fontWeight: '700' },
});
