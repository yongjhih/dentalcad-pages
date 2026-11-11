import * as THREE from 'three';

/**
 * Generate a realistic anatomical 3D dental arch BufferGeometry (14 teeth + alveolar gingiva)
 * in the standard coordinate system (Anterior = -Y, Posterior = +Y, Left = +X, Right = -X).
 * Used as an automatic zero-dependency fallback on GitHub Pages when private patient STL files
 * are not committed to the public repository.
 */
export function createProceduralDentalArchGeometry(isUpper: boolean): THREE.BufferGeometry {
  const segU = 140; // Along the parabolic arch (from Right 2nd Molar to Left 2nd Molar)
  const segV = 44; // Cross-sectional profile (from lingual gingiva -> crown cusps -> buccal gingiva)

  const positions: number[] = [];
  const indices: number[] = [];

  // 14 teeth along the arch parameter s in [-1, 1]
  const toothCenters = [
    -0.91, -0.76, -0.62, -0.49, -0.36, -0.22, -0.07,
     0.07,  0.22,  0.36,  0.49,  0.62,  0.76,  0.91,
  ];

  for (let i = 0; i <= segU; i++) {
    // u in [-1, 1] from Patient Right Posterior (+Y, -X) -> Anterior (-Y, 0) -> Patient Left Posterior (+Y, +X)
    const s = (i / segU) * 2 - 1;
    const absS = Math.abs(s);

    // Parabolic arch centerline in (X, Y):
    // Anterior incisors at (0, -43.5), Posterior molars at (±28.5, +6.5)
    const archWidth = isUpper ? 29.5 : 27.5;
    const archX = Math.sign(s) * Math.pow(absS, 0.78) * archWidth;
    const archY = -43.5 + Math.pow(absS, 1.55) * 50.0 + (isUpper ? -1.2 : 0.6);

    // Tangent & outward normal in XY plane
    const dX = 0.78 * Math.pow(Math.max(0.02, absS), -0.22) * archWidth;
    const dY = Math.sign(s) * 1.55 * Math.pow(Math.max(0.02, absS), 0.55) * 50.0;
    const len = Math.hypot(dX, dY) || 1;
    // Outward buccal/labial normal in XY
    const nx = dY / len;
    const ny = -dX / len;

    // Determine tooth crown envelope & interproximal embrasures
    let toothEnv = 0;
    let isMolar = absS > 0.42;
    for (const tc of toothCenters) {
      const dist = Math.abs(s - tc);
      const halfW = Math.abs(tc) > 0.42 ? 0.068 : 0.052;
      if (dist < halfW) {
        const local = 1 - Math.pow(dist / halfW, 2.2);
        if (local > toothEnv) toothEnv = local;
      }
    }

    const baseRadius = (isMolar ? 5.2 : 3.6) * (0.75 + 0.25 * toothEnv);

    for (let j = 0; j <= segV; j++) {
      // v in [0, 1] from inner palatal/lingual base -> occlusal table -> outer buccal/labial base
      const v = j / segV;
      const angle = (v - 0.5) * Math.PI; // -pi/2 (lingual) to +pi/2 (buccal)

      const radialOffset = Math.sin(angle) * baseRadius;
      const px = archX + nx * radialOffset;
      const py = archY + ny * radialOffset;

      // Vertical Z profile: gingiva base vs tooth crown + buccal/lingual cusps
      const crownProfile = Math.cos(angle);
      // Double-cusp groove on posterior molars/premolars
      const cuspGroove = isMolar
        ? 1.0 - 0.28 * Math.exp(-Math.pow(angle / 0.22, 2))
        : 1.0;

      const crownHeight = (isMolar ? 7.8 : 8.8) * (0.45 + 0.55 * toothEnv) * cuspGroove;
      let pz: number;
      if (isUpper) {
        // Upper arch: base at Z = +14.5 mm, occlusal cusps extend down to Z ≈ +0.15 mm
        pz = 14.5 - crownProfile * (6.2 + crownHeight);
      } else {
        // Lower arch: base at Z = -13.5 mm, occlusal cusps extend up to Z ≈ -0.05 mm
        pz = -13.5 + crownProfile * (5.6 + crownHeight);
      }

      positions.push(px, py, pz);
    }
  }

  const stride = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);

      if (isUpper) {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}
