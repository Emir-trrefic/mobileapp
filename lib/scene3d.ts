import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { HAIR_COLORS, SKIN_TONES, TOP_COLORS } from './avatar';
import type { AvatarConfig } from './avatar';

// three.js'i expo-gl bağlamıyla çalıştırır (tarayıcı canvas'ı yok, yerine sahte bir canvas verilir).
export function createRenderer(gl: ExpoWebGLRenderingContext, background: string) {
  // three.js (r163+) bağlam "WebGLRenderingContext" sınıfındansa WebGL 1 sanıp reddeder.
  // expo-gl, OpenGL ES 3 üstünde WebGL 2 yöntemlerini sağlar ama kendi sınıfını o global ada atar.
  // Renderer kurulurken o adı geçici olarak boş bir sınıfla değiştirip sonra geri koyuyoruz.
  const g = globalThis as unknown as { WebGLRenderingContext?: unknown };
  const original = g.WebGLRenderingContext;
  g.WebGLRenderingContext = class NotWebGL1 {};
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const canvas = {
    width: w,
    height: h,
    style: {},
    clientWidth: w,
    clientHeight: h,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGLRenderingContext, antialias: true, precision: 'highp' });
  } finally {
    g.WebGLRenderingContext = original;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.setClearColor(new THREE.Color(background), 1);
  return { renderer, width: w, height: h };
}

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

// Basit, sevimli, mat bir karakter (yaklaşık 1,7 birim boy). Ayakta durur; kökü ayak hizasındadır.
export function buildAvatar(cfg: AvatarConfig): THREE.Group {
  const g = new THREE.Group();
  const skin = mat(SKIN_TONES[cfg.skin]);
  const top = mat(TOP_COLORS[cfg.top]);
  const hair = mat(HAIR_COLORS[cfg.hairColor]);
  const legs = mat('#1B2440');
  const dark = mat('#0A1128');

  // bacaklar
  for (const x of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 4, 10), legs);
    leg.position.set(x, 0.33, 0);
    g.add(leg);
  }
  // gövde
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.38, 6, 16), top);
  body.position.y = 1.0;
  g.add(body);
  // kollar
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 10), top);
    arm.position.set(0.31 * s, 0.98, 0);
    arm.rotation.z = 0.12 * s;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin);
    hand.position.set(0.34 * s, 0.7, 0);
    g.add(hand);
  }
  // baş
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.5;
  headGroup.name = 'head';
  g.add(headGroup);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), skin);
  headGroup.add(head);
  for (const x of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), dark);
    eye.position.set(x, 0.02, 0.2);
    headGroup.add(eye);
  }

  // saç
  const cap = (scale = 1.07) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    m.rotation.x = -0.25;
    m.position.y = 0.02;
    return m;
  };
  if (cfg.hair === 0) {
    headGroup.add(cap());
  } else if (cfg.hair === 1) {
    headGroup.add(cap());
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 4, 14), hair);
    back.position.set(0, -0.14, -0.08);
    back.scale.set(1.12, 1, 0.55);
    headGroup.add(back);
  } else if (cfg.hair === 2) {
    headGroup.add(cap());
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), hair);
    bun.position.set(0, 0.2, -0.12);
    headGroup.add(bun);
  } else if (cfg.hair === 3) {
    const curls = [
      [0, 0.2, 0], [0.12, 0.16, 0.04], [-0.12, 0.16, 0.04], [0.15, 0.08, -0.08], [-0.15, 0.08, -0.08],
      [0, 0.15, -0.14], [0.07, 0.2, 0.1], [-0.07, 0.2, 0.1], [0.1, 0.05, -0.17], [-0.1, 0.05, -0.17],
    ];
    for (const [x, y, z] of curls) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), hair);
      c.position.set(x, y, z);
      headGroup.add(c);
    }
  } else {
    const shaved = cap(1.015);
    headGroup.add(shaved);
  }

  if (cfg.glasses) {
    for (const x of [-0.075, 0.075]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.011, 8, 20), dark);
      ring.position.set(x, 0.02, 0.215);
      headGroup.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), dark);
    bridge.position.set(0, 0.025, 0.22);
    headGroup.add(bridge);
  }
  return g;
}

export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight('#DCE4FF', '#0B1530', 1.25));
  const sun = new THREE.DirectionalLight('#FFFFFF', 1.1);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#9DB4FF', 0.5);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
}

function buildTable(): THREE.Group {
  const t = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 32), mat('#E4E9F4'));
  top.position.y = 0.74;
  t.add(top);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 12), mat('#0B1F4B'));
  stem.position.y = 0.37;
  t.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), mat('#0B1F4B'));
  foot.position.y = 0.015;
  t.add(foot);
  for (const [x, z] of [[0.15, 0.05], [-0.12, -0.1]]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 16), mat('#FFFFFF'));
    cup.position.set(x, 0.81, z);
    t.add(cup);
  }
  return t;
}

export type CafeScene = {
  scene: THREE.Scene;
  people: THREE.Group[];
  // her karede çağrılır (t: saniye)
  update: (t: number) => void;
};

// Kafe sahnesi: yuvarlak zemin, masalar ve masaların çevresinde avatarlar (en fazla 12 kişi çizilir).
export function buildCafeScene(avatars: AvatarConfig[], background: string): CafeScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  addLights(scene);

  // Zemin: ince bir silindir (düz daire bazı GPU'larda ışınsal bantlanma yapıyor).
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.06, 96), new THREE.MeshLambertMaterial({ color: '#12234D' }));
  floor.position.y = -0.03;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.2, 64), mat('#2A4FB8'));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  scene.add(ring);

  const shown = avatars.slice(0, 12);
  const tableCount = Math.max(1, Math.min(4, Math.ceil(shown.length / 3)));
  const tables: THREE.Vector3[] = [];
  for (let i = 0; i < tableCount; i++) {
    const a = (i / tableCount) * Math.PI * 2 + 0.4;
    const r = tableCount === 1 ? 0 : 1.7;
    const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    tables.push(p);
    const t = buildTable();
    t.position.copy(p);
    scene.add(t);
  }

  const people: THREE.Group[] = [];
  shown.forEach((cfg, i) => {
    const table = tables[i % tableCount];
    const seat = Math.floor(i / tableCount);
    const a = seat * ((Math.PI * 2) / 3) + i * 0.35;
    const p = buildAvatar(cfg);
    p.position.set(table.x + Math.cos(a) * 0.85, 0, table.z + Math.sin(a) * 0.85);
    p.lookAt(table.x, 0, table.z);
    p.scale.setScalar(0.001);
    p.userData.delay = 0.15 + i * 0.09;
    p.userData.phase = i * 1.3;
    scene.add(p);
    people.push(p);
  });

  return {
    scene,
    people,
    update: (t) => {
      for (const p of people) {
        const k = Math.min(1, Math.max(0, (t - p.userData.delay) / 0.45));
        // yaylanarak belirme
        const s = k === 0 ? 0.001 : 1 + Math.sin(k * Math.PI) * 0.18 * (1 - k);
        p.scale.setScalar(Math.max(0.001, k * s));
        p.position.y = Math.abs(Math.sin(t * 1.6 + p.userData.phase)) * 0.025;
        const head = p.getObjectByName('head');
        if (head) head.rotation.y = Math.sin(t * 0.7 + p.userData.phase) * 0.35;
      }
    },
  };
}

// Tek avatarın önizleme sahnesi (avatar oluşturucu).
export function buildAvatarScene(cfg: AvatarConfig, background: string) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  addLights(scene);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 48), mat('#12234D'));
  base.position.y = -0.04;
  scene.add(base);
  const avatar = buildAvatar(cfg);
  scene.add(avatar);
  return { scene, avatar };
}

// Sahnedeki tüm geometri ve malzemeleri bırakır (bellek sızmasın).
export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const material = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((x) => x.dispose());
    else if (material) material.dispose();
  });
}
