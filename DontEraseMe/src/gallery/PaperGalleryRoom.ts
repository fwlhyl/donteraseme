import * as THREE from 'three';

/** Neutral architecture while the replacement art direction is developed.
 * Saved artwork is displayed by ArtGallery and is never tinted or retextured here. */
export function buildPaperGalleryRoom(scene: THREE.Scene, width: number, depth: number, _maxAnisotropy = 1): () => void {
    scene.background = new THREE.Color('#eeece4');
    const floor = new THREE.MeshBasicMaterial({ color: '#deddd5' });
    const wall = new THREE.MeshBasicMaterial({ color: '#f3f1e9' });
    const sideWall = new THREE.MeshBasicMaterial({ color: '#e9e7df' });
    const ink = new THREE.LineBasicMaterial({ color: '#77786f' });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
    };
    box(width, 0.2, depth, 0, -0.1, 0, floor);
    box(width + 0.4, 5, 0.2, 0, 2.5, -depth / 2, wall);
    box(width + 0.4, 5, 0.2, 0, 2.5, depth / 2, wall);
    box(0.2, 5, depth, -width / 2, 2.5, 0, sideWall);
    box(0.2, 5, depth, width / 2, 2.5, 0, sideWall);
    box(width, 0.16, depth, 0, 5, 0, wall);

    const lines: number[] = [];
    const x = width / 2 - .11, z = depth / 2 - .11;
    // Restrained room edges make orientation legible without decorative textures.
    for (const y of [.02, 4.88]) {
        lines.push(-x,y,-z, x,y,-z, x,y,-z, x,y,z,
            x,y,z, -x,y,z, -x,y,z, -x,y,-z);
    }
    for (const px of [-x,x]) for (const pz of [-z,z]) {
        lines.push(px,.02,pz, px,4.88,pz);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    scene.add(new THREE.LineSegments(geometry, ink));
    // All geometry/materials are released by ArtGallery.releaseTree; no async
    // texture loads or external art resources remain to cancel on exit.
    return () => {};
}

export function createPaperGalleryFrame(width: number, height: number, populated: boolean): THREE.Group {
    const frame = new THREE.Group();
    const backing = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.1),
        new THREE.MeshBasicMaterial({ color: '#e7e5dd' })
    );
    frame.add(backing);
    const w = width / 2 + .06, h = height / 2 + .06;
    const contour = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w, -h, .052), new THREE.Vector3(-w, h, .052),
        new THREE.Vector3(w, h, .052), new THREE.Vector3(w, -h, .052),
        new THREE.Vector3(-w, -h, .052),
    ]);
    frame.add(new THREE.Line(contour, new THREE.LineBasicMaterial({ color: populated ? '#353630' : '#a3a399' })));
    return frame;
}
