import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import AnimatedButton from './AnimatedButton';
import Chip from './Chip';
import { CAFE_BG, buildCafeHtml } from '../lib/cafe3dHtml';
import {
  ACCENTS,
  COUNTER_LABELS,
  FLOORS,
  LIMITS,
  SIZE_LABELS,
  STYLE_LABELS,
  WALLS,
  normalizeLayout,
} from '../lib/cafeLayout';
import type { CafeLayout, CafeSize, CafeStyle, CounterSide } from '../lib/cafeLayout';
import { success, tap, warning } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Venue } from '../lib/types';
import { peopleCount, venueTitle } from '../lib/venue';

type Props = {
  venue: Venue | null; // null: kapalı
  onClose: () => void;
  onSaved: (layout: CafeLayout) => void;
};

const MAX_TABLES: Record<CafeSize, number> = { s: 4, m: 6, l: 8 };
const MAX_PHOTOS = 3;

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: number; onPick: (i: number) => void; label: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.swatches}>
      {colors.map((col, i) => (
        <Pressable
          key={col}
          onPress={() => {
            tap();
            onPick(i);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${i + 1}`}
          accessibilityState={{ selected: i === value }}
          hitSlop={4}
          style={[styles.swatchRing, i === value && styles.swatchRingOn]}
        >
          <View style={[styles.swatch, { backgroundColor: col }]} />
        </Pressable>
      ))}
    </View>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const step = (d: number) => {
    const v = Math.max(min, Math.min(max, value + d));
    if (v !== value) {
      tap();
      onChange(v);
    }
  };
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable style={[styles.stepBtn, value <= min && styles.stepOff]} onPress={() => step(-1)} accessibilityLabel={`${label} azalt`} hitSlop={6}>
        <Ionicons name="remove" size={20} color={c.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable style={[styles.stepBtn, value >= max && styles.stepOff]} onPress={() => step(1)} accessibilityLabel={`${label} artır`} hitSlop={6}>
        <Ionicons name="add" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}

// Kafeyi tara: birkaç fotoğraftan tema renkleri alınır (paletteki en yakın renklere), ölçü / yerleşim / stil
// canlı 3D önizlemeyle seçilir ve kafenin 3D profili kaydedilir. Fotoğraflar telefonda işlenir, yüklenmez.
export default function CafeScanner({ venue, onClose, onSaved }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const { height } = useWindowDimensions();
  const web = useRef<WebView>(null);
  const [layout, setLayout] = useState<CafeLayout | null>(null);
  const [ready, setReady] = useState(false);
  const [photos, setPhotos] = useState<{ uri: string; data: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venue) return;
    setLayout(normalizeLayout(venue.layout, venue.id));
    setReady(false);
    setPhotos([]);
    setNote(null);
  }, [venue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Önizlemede en az birkaç kişi olsun ki ölçek anlaşılsın.
  const people = venue ? Math.max(4, peopleCount(venue)) : 0;
  const html = useMemo(
    () => (venue && layout ? buildCafeHtml({ people, seed: venue.id, layout, mode: 'edit' }) : ''),
    [venue?.id, layout !== null], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Profil değişince önizleme sayfa yenilenmeden güncellenir.
  useEffect(() => {
    if (!ready || !layout) return;
    const t = setTimeout(() => {
      web.current?.injectJavaScript(`window.applyScene && window.applyScene(${JSON.stringify(layout)}, ${people}); true;`);
    }, 90);
    return () => clearTimeout(t);
  }, [layout, ready, people]);

  const set = (patch: Partial<CafeLayout>) => setLayout((l) => (l ? { ...l, ...patch } : l));

  function setSize(size: CafeSize) {
    setLayout((l) => (l ? { ...l, size, tables: Math.min(l.tables, MAX_TABLES[size]) } : l));
  }

  async function addPhotos(fromCamera: boolean) {
    if (photos.length >= MAX_PHOTOS) return;
    // Galeriden seçim için izin gerekmez (sistem seçicisi sadece seçilen fotoğrafı verir); kamera için gerekir.
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Kamera izni gerekli', 'Kafeyi taramak için Ayarlar’dan kamera iznini aç ya da galeriden seç.');
        return;
      }
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          allowsMultipleSelection: true,
          selectionLimit: MAX_PHOTOS - photos.length,
        });
    if (res.canceled || !res.assets.length) return;
    setAnalyzing(true);
    setNote(null);
    try {
      const added: { uri: string; data: string }[] = [];
      for (const a of res.assets.slice(0, MAX_PHOTOS - photos.length)) {
        // Renk bulmak için küçük bir kopya yeter (hızlı ve hafif).
        const ctx = ImageManipulator.manipulate(a.uri);
        ctx.resize({ width: 160 });
        const img = await ctx.renderAsync();
        const out = await img.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.7 });
        if (out.base64) added.push({ uri: out.uri, data: `data:image/jpeg;base64,${out.base64}` });
      }
      const all = [...photos, ...added];
      setPhotos(all);
      web.current?.injectJavaScript(`window.analyzePhotos && window.analyzePhotos(${JSON.stringify(all.map((p) => p.data))}); true;`);
    } catch (e) {
      setAnalyzing(false);
      Alert.alert('Fotoğraf işlenemedi', e instanceof Error ? e.message : String(e));
    }
  }

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; wall?: number | null; floor?: number | null; accent?: number | null } = {};
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'colors') {
      setAnalyzing(false);
      const patch: Partial<CafeLayout> = {};
      if (typeof m.wall === 'number') patch.wall = m.wall;
      if (typeof m.floor === 'number') patch.floor = m.floor;
      if (typeof m.accent === 'number') patch.accent = m.accent;
      if (Object.keys(patch).length) {
        set(patch);
        success();
        setNote('Renkler fotoğraflardan alındı. İstersen aşağıdan değiştirebilirsin.');
      } else {
        setNote('Fotoğraflardan renk çıkarılamadı, renkleri aşağıdan seçebilirsin.');
      }
    }
  }

  async function save() {
    if (!venue || !layout) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_venue_layout', { p_venue: venue.id, p_layout: layout });
    setSaving(false);
    if (error) {
      warning();
      Alert.alert(
        'Kaydedilemedi',
        error.code === 'PGRST202' || error.message.includes('set_venue_layout')
          ? 'Önce Supabase SQL Editor’de supabase/migrations/008_kafe_profili.sql dosyasını çalıştır.'
          : error.message,
      );
      return;
    }
    success();
    onSaved(layout);
  }

  const previewH = Math.round(height * 0.42);

  return (
    <Modal visible={!!venue} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.preview, { height: previewH }]}>
          {html ? (
            <WebView
              ref={web}
              key={venue?.id}
              style={styles.web}
              containerStyle={styles.web}
              source={{ html }}
              originWhitelist={['*']}
              onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
              onMessage={onMessage}
              javaScriptEnabled
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              setSupportMultipleWindows={false}
              allowsLinkPreview={false}
            />
          ) : null}
          {!ready ? (
            <View style={styles.previewLoading} pointerEvents="none">
              <ActivityIndicator color="#9DB4FF" />
            </View>
          ) : null}
          <View style={[styles.header, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
            <Pressable style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
              <Ionicons name="close" size={22} color="#F4F6FB" />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Kafeyi tara</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {venue ? venueTitle(venue.name) : ''}
              </Text>
            </View>
          </View>
        </View>

        {layout ? (
          <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>1 · Fotoğraflar</Text>
            <Text style={styles.help}>
              Kafenin içinden 1-3 fotoğraf çek ya da seç. Duvar, zemin ve vurgu renkleri fotoğraftan alınır ve temaya uyarlanır.
              Fotoğraflar sadece telefonda işlenir, yüklenmez.
            </Text>
            <View style={styles.photoRow}>
              {photos.map((p) => (
                <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} />
              ))}
              {photos.length < MAX_PHOTOS ? (
                <>
                  <Pressable style={styles.addPhoto} onPress={() => addPhotos(true)} accessibilityLabel="Fotoğraf çek">
                    <Ionicons name="camera-outline" size={22} color={c.accentLight} />
                    <Text style={styles.addPhotoText}>Çek</Text>
                  </Pressable>
                  <Pressable style={styles.addPhoto} onPress={() => addPhotos(false)} accessibilityLabel="Galeriden seç">
                    <Ionicons name="images-outline" size={22} color={c.accentLight} />
                    <Text style={styles.addPhotoText}>Seç</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
            {analyzing ? (
              <View style={styles.noteRow}>
                <ActivityIndicator size="small" color={c.accentLight} />
                <Text style={styles.note}>Renkler bulunuyor…</Text>
              </View>
            ) : note ? (
              <Text style={styles.note}>{note}</Text>
            ) : null}

            <Text style={styles.section}>2 · Yerleşim</Text>
            <Text style={styles.label}>Ölçü</Text>
            <View style={styles.chips}>
              {(Object.keys(SIZE_LABELS) as CafeSize[]).map((s) => (
                <Chip key={s} label={SIZE_LABELS[s]} selected={layout.size === s} onPress={() => setSize(s)} />
              ))}
            </View>
            <Text style={styles.label}>Tezgâh</Text>
            <View style={styles.chips}>
              {(Object.keys(COUNTER_LABELS) as CounterSide[]).map((s) => (
                <Chip key={s} label={COUNTER_LABELS[s]} selected={layout.counter === s} onPress={() => set({ counter: s })} />
              ))}
            </View>
            <Stepper label="Masa" value={layout.tables} min={LIMITS.tables[0]} max={MAX_TABLES[layout.size]} onChange={(v) => set({ tables: v })} />
            <Stepper label="Pencere" value={layout.windows} min={LIMITS.windows[0]} max={LIMITS.windows[1]} onChange={(v) => set({ windows: v })} />
            <Stepper label="Bitki" value={layout.plants} min={LIMITS.plants[0]} max={LIMITS.plants[1]} onChange={(v) => set({ plants: v })} />

            <Text style={styles.section}>3 · Tarz ve renkler</Text>
            <Text style={styles.label}>Stil</Text>
            <View style={styles.chips}>
              {(Object.keys(STYLE_LABELS) as CafeStyle[]).map((s) => (
                <Chip key={s} label={STYLE_LABELS[s]} selected={layout.style === s} onPress={() => set({ style: s })} />
              ))}
            </View>
            <Text style={styles.label}>Duvar</Text>
            <Swatches colors={WALLS} value={layout.wall} onPick={(v) => set({ wall: v })} label="Duvar rengi" />
            <Text style={styles.label}>Zemin</Text>
            <Swatches colors={FLOORS} value={layout.floor} onPick={(v) => set({ floor: v })} label="Zemin rengi" />
            <Text style={styles.label}>Vurgu (tezgâh, kapı, süpürgelik)</Text>
            <Swatches colors={ACCENTS} value={layout.accent} onPick={(v) => set({ accent: v })} label="Vurgu rengi" />
          </ScrollView>
        ) : null}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <AnimatedButton title="Kaydet" icon="checkmark" onPress={save} loading={saving} disabled={!layout} />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    preview: { backgroundColor: CAFE_BG },
    web: { flex: 1, backgroundColor: CAFE_BG },
    previewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    header: { position: 'absolute', top: 0, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
    close: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(8,16,40,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(183,200,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      marginLeft: 10,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: 'rgba(8,16,40,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(183,200,255,0.18)',
      flexShrink: 1,
    },
    headerTitle: { color: '#F4F6FB', fontSize: 18, fontWeight: '800' },
    headerSub: { color: '#A9B4CF', fontSize: 13, fontWeight: '600', marginTop: 1 },
    panel: { flex: 1 },
    panelContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    section: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 6, letterSpacing: -0.2 },
    help: { color: c.muted, fontSize: 13.5, lineHeight: 19 },
    label: { color: c.muted, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: c.card2 },
    addPhoto: {
      width: 72,
      height: 72,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPhotoText: { color: c.accentLight, fontSize: 12, fontWeight: '700', marginTop: 2 },
    noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    note: { color: c.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: c.accentLight },
    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border },
    stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    stepLabel: { color: c.text, fontSize: 16, fontWeight: '600', flex: 1 },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepOff: { opacity: 0.35 },
    stepValue: { color: c.text, fontSize: 18, fontWeight: '800', width: 44, textAlign: 'center' },
    footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.bg },
  });
