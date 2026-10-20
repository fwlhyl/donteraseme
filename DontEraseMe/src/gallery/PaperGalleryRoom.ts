import * as THREE from 'three';
import floorTextureUrl from '../assets/paper-scenes/floor-clarity-v1.webp';
import wallTextureUrl from '../assets/paper-scenes/gallery-wall-clarity-v1.webp';

/** Static paper architecture only. Never touches the image material on an artwork. */
export function buildPaperGalleryRoom(scene: THREE.Scene, width: number, depth: number, maxAnisotropy = 1): () => void {
    scene.background = new THREE.Color('#252621');
    const hemisphere = new THREE.HemisphereLight('#ece9df', '#a8aa9d', 1.65);
    const light = new THREE.DirectionalLight('#e4e2d9', 0.95);
    light.position.set(-4, 7, 4);
    scene.add(hemisphere, light);

    const loader = new THREE.TextureLoader();
    let disposed = false;
    const pendingTextures = new Set<THREE.Texture>();
    const floor = new THREE.MeshBasicMaterial({ color: '#303229' });
    const wall = new THREE.MeshLambertMaterial({ color: '#555247' });
    const paperMap = (url: string, x: number, y: number, material: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial, tint: string) => {
        const texture = loader.load(url, loaded => {
            if (disposed) { loaded.dispose(); return; }
            material.map = loaded;
            material.color.set(tint);
            material.needsUpdate = true;
        });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(x, y);
        // Improve oblique wall/floor sampling without increasing the renderer's
        // pixel ratio or texture size. Keep mipmaps to avoid distant shimmer.
        texture.anisotropy = Math.max(1, Math.min(4, maxAnisotropy));
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.name = `paper-architecture:${url.includes('gallery-wall') ? 'wall' : 'floor'}`;
        pendingTextures.add(texture);
    };
    // Untextured charcoal fallbacks stay legible during loading or network
    // failure. A late image load after exit must never reattach to a new room.
    paperMap(floorTextureUrl, 3, 3, floor, '#ffffff');
    paperMap(wallTextureUrl, 4, 1, wall, '#d5cfbb');
    const structure = new THREE.MeshLambertMaterial({ color: '#414238' });
    const ink = new THREE.MeshBasicMaterial({ color: '#1c1e19' });
    const bone = new THREE.MeshBasicMaterial({ color: '#7b7866' });
    const red = new THREE.MeshBasicMaterial({ color: '#8e4234' });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    };
    box(width, 0.2, depth, 0, -0.1, 0, floor);
    box(width + 0.4, 5, 0.2, 0, 2.5, -depth / 2, wall);
    box(width + 0.4, 5, 0.2, 0, 2.5, depth / 2, wall);
    box(0.2, 5, depth, -width / 2, 2.5, 0, wall);
    box(0.2, 5, depth, width / 2, 2.5, 0, wall);
    // A dark ceiling and shallow ribs give the paper room depth without new
    // obstacles, real-time shadows, post-processing or additional lights.
    box(width, 0.16, depth, 0, 5, 0, floor);
    for (const z of [-5, 0, 5]) box(width, 0.12, 0.08, 0, 4.9, z, ink);
    for (const z of [-depth / 2 + 0.14, depth / 2 - 0.14]) {
        box(width, 0.2, 0.12, 0, 0.1, z, ink);
        box(width, 0.1, 0.12, 0, 3.8, z, structure);
        box(width, 0.014, 0.14, 0, 3.72, z, bone);
        for (const x of [-width / 2 + 0.2, 0, width / 2 - 0.2]) {
            box(0.13, 5, 0.17, x, 2.5, z, structure);
        }
    }
    for (const x of [-width / 2 + 0.14, width / 2 - 0.14]) {
        box(0.12, 0.2, depth, x, 0.1, 0, ink);
        box(0.12, 0.1, depth, x, 3.8, 0, structure);
        box(0.14, 0.014, depth, x, 3.72, 0, bone);
    }
    // Reserved marks are attached to architecture, not painted over the works.
    box(0.7, 0.055, 0.018, -0.58, 3.42, -depth / 2 + 0.12, red);
    box(0.24, 0.055, 0.018, 0.06, 3.42, -depth / 2 + 0.12, bone);

    const lines: number[] = [];
    for (let index = 0; index < 30; index++) {
        const x = ((index * 47) % 97) / 97 * (width - 1) - (width - 1) / 2;
        const z = ((index * 31) % 89) / 89 * (depth - 1) - (depth - 1) / 2;
        lines.push(x, 0.005, z, x + 0.12 + index % 3 * 0.06, 0.005, z - 0.05);
    }
    const scuffs = new THREE.BufferGeometry();
    scuffs.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    scene.add(new THREE.LineSegments(scuffs, new THREE.LineBasicMaterial({ color: '#45463b' })));
    return () => {
        disposed = true;
        for (const texture of pendingTextures) texture.dispose();
        pendingTextures.clear();
    };
}

export function createPaperGalleryFrame(width: number, height: number, populated: boolean): THREE.Group {
    const frame = new THREE.Group();
    const backing = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.18, height + 0.18, 0.1),
        new THREE.MeshBasicMaterial({ color: '#171a16' })
    );
    frame.add(backing);
    const w = width / 2 + 0.065;
    const h = height / 2 + 0.065;
    // Deliberately restrained, slightly interrupted dry-ink outline.
    const contour = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w, -h, 0.052), new THREE.Vector3(-w - 0.008, h, 0.052),
        new THREE.Vector3(-w + 0.03, h + 0.003, 0.052), new THREE.Vector3(w, h, 0.052),
        new THREE.Vector3(w, h - 0.02, 0.052), new THREE.Vector3(w + 0.005, -h, 0.052),
        new THREE.Vector3(w - 0.025, -h - 0.004, 0.052), new THREE.Vector3(-w, -h, 0.052),
    ]);
    frame.add(new THREE.LineSegments(contour, new THREE.LineBasicMaterial({ color: populated ? '#d6ccb0' : '#6c6c5c' })));
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.055), new THREE.MeshBasicMaterial({ color: '#a14a38' }));
    tab.position.set(-w + 0.16, h + 0.015, 0.054);
    tab.rotation.z = 0.035;
    frame.add(tab);
    return frame;
}
