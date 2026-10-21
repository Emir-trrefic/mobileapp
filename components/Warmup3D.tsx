import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildWarmupHtml } from '../lib/cafe3dHtml';

const HTML = buildWarmupHtml();

// Uygulama açılınca görünmez bir sayfada three.js'i indirip önbelleğe alır; kafeye dokununca 3D hızlı açılır.
// İş bitince (ya da 20 sn sonra) kendini kaldırır.
export default function Warmup3D() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 20000);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ html: HTML }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
        onMessage={() => setDone(true)}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, left: -10, top: -10, opacity: 0 },
});
