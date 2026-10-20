import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleProp, View, ViewStyle } from 'react-native';
import { GLView } from 'expo-gl';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { createRenderer, disposeScene } from '../lib/scene3d';

type Built = { scene: THREE.Scene; update?: (t: number) => void };

type Props = {
  build: () => Built; // sahneyi kurar (değişince sahne yeniden kurulur)
  buildKey: string; // build'in neye bağlı olduğunu belirten anahtar
  background: string;
  target?: [number, number, number]; // kameranın baktığı nokta
  distance: number; // kameranın uzaklığı
  height: number; // kameranın yüksekliği
  autoRotate?: number; // saniyede radyan (parmakla çevrilmiyorken)
  style?: StyleProp<ViewStyle>;
};

// expo-gl + three.js sahnesi: kendiliğinden yavaşça döner, parmakla sağa sola çevrilebilir.
export default function Scene3D({ build, buildKey, background, target = [0, 0.9, 0], distance, height, autoRotate = 0.25, style }: Props) {
  const angle = useRef(0.6);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const builtRef = useRef<Built | null>(null);
  const startRef = useRef(0);
  const frame = useRef<number | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  // GLView, bir pencere (Modal) açılış animasyonu sürerken kurulursa iOS'ta hiç çizmiyor.
  // Bu yüzden görünüm yerine oturup boyutu belli olduktan kısa süre sonra kurulur.
  const [ready, setReady] = useState(false);
  const [sized, setSized] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(t);
  }, []);

  const pan = useRef(
    PanResponder.create({
      // Sadece yatay sürükleme sahneyi çevirir; dikey kaydırma üstteki listeye kalır.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (_, g) => {
        dragging.current = true;
        lastX.current = g.x0;
      },
      onPanResponderMove: (_, g) => {
        angle.current -= (g.moveX - lastX.current) * 0.012;
        lastX.current = g.moveX;
      },
      onPanResponderRelease: () => {
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
    }),
  ).current;

  // Ayarlar değişince (ör. avatar rengi) sahneyi yeniden kur.
  useEffect(() => {
    if (!glRef.current) return;
    if (builtRef.current) disposeScene(builtRef.current.scene);
    builtRef.current = buildRef.current();
    startRef.current = Date.now();
  }, [buildKey]);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (builtRef.current) disposeScene(builtRef.current.scene);
      rendererRef.current?.dispose();
    },
    [],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      setup(gl);
    } catch (e) {
      console.error('3D sahne kurulamadı', e instanceof Error ? e.message : String(e));
    }
  };

  const setup = (gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    const { renderer, width, height: h } = createRenderer(gl, background);
    rendererRef.current = renderer;
    const camera = new THREE.PerspectiveCamera(38, width / h, 0.1, 100);
    cameraRef.current = camera;
    builtRef.current = buildRef.current();
    startRef.current = Date.now();
    let last = Date.now();

    const loop = () => {
      frame.current = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!dragging.current) angle.current += autoRotate * dt;
      const t = (now - startRef.current) / 1000;
      camera.position.set(
        target[0] + Math.sin(angle.current) * distance,
        height,
        target[2] + Math.cos(angle.current) * distance,
      );
      camera.lookAt(target[0], target[1], target[2]);
      const built = builtRef.current;
      if (built) {
        built.update?.(t);
        renderer.render(built.scene, camera);
      }
      gl.endFrameEXP();
    };
    loop();
  };

  return (
    <View
      style={style}
      onLayout={(e) => setSized(e.nativeEvent.layout.width > 0 && e.nativeEvent.layout.height > 0)}
      {...pan.panHandlers}
    >
      {ready && sized ? <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} /> : null}
    </View>
  );
}
