import * as THREE from 'three';

/**
 * Generate a realistic anatomical 3D dental arch BufferGeometry (14 teeth + alveolar gingiva + upper palate)
 * in the standard coordinate system (Anterior = -Y, Posterior = +Y, Left = +X, Right = -X).
 * Used as an automatic zero-dependency fallback on GitHub Pages when private patient STL files
 * are not committed to the public repository.
 */
export function createProceduralDentalArchGeometry(isUpper: boolean): THREE.BufferGeometry {
  const segU = 140; // Along the parabolic arch (from Right 2nd Molar to Left 2nd Molar)
  const segV = 44; // Cross-sectional profile (from lingual gingiva -> crown cusps -> buccal gingiva)

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // 14 teeth along the arch parameter s in [-1, 1]
  const toothCenters = [
    -0.91, -0.76, -0.62, -0.49, -0.36, -0.22, -0.07,
     0.07,  0.22,  0.36,  0.49,  0.62,  0.76,  0.91,
  ];

  // Helper colors
  const colToothBody = new THREE.Color(0xf6f3ea); // VITA A1/A2 Enamel
  const colToothIncisal = new THREE.Color(0xe0ebf3); // Incisal translucent edge
  const colToothCervical = new THREE.Color(0xeee3cc); // Cervical neck enamel
  const colGingivaAttached = new THREE.Color(0xcf697b); // Healthy coral pink attached gingiva
  const colGingivaMargin = new THREE.Color(0xdb7788); // Free gingival margin
  const colGingivaAlveolar = new THREE.Color(0xb53c4e); // Deeper alveolar mucosa
  const colPalateMucosa = new THREE.Color(0xd77182); // Upper palatal mucosa
  const colPalateRaphe = new THREE.Color(0xe69ea9); // Median palatine raphe

  // Keep track of lingual margin vertices for upper palate mesh generation
  const lingualVertices: Array<{ x: number; y: number; z: number; color: THREE.Color }> = [];

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
    const isMolar = absS > 0.42;
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

      // Compute vertex color based on tooth vs gingiva
      const vertexColor = new THREE.Color();
      // v in [0.22, 0.78] is the crown zone
      if (v >= 0.22 && v <= 0.78 && toothEnv > 0.12) {
        // Tooth crown region
        const crownDist = 1 - Math.abs(v - 0.5) / 0.28; // 1 at cusp/incisal edge, 0 at cervical margin
        const toothWeight = toothEnv * Math.pow(crownDist, 0.7);

        // Mix cervical to body to incisal edge
        if (crownDist > 0.82) {
          const tInc = (crownDist - 0.82) / 0.18;
          vertexColor.copy(colToothBody).lerp(colToothIncisal, tInc * 0.75);
        } else if (crownDist < 0.35) {
          const tCerv = 1 - crownDist / 0.35;
          vertexColor.copy(colToothBody).lerp(colToothCervical, tCerv * 0.6);
        } else {
          vertexColor.copy(colToothBody);
        }

        // Slight blend near cervical gingival margin
        if (toothWeight < 0.4) {
          vertexColor.lerp(colGingivaMargin, (0.4 - toothWeight) / 0.4);
        }
      } else {
        // Gingiva region
        if (v > 0.88 || v < 0.12) {
          // Deeper alveolar mucosa
          vertexColor.copy(colGingivaAlveolar);
        } else if (v > 0.78 || v < 0.22) {
          // Attached gingiva / interdental papilla
          vertexColor.copy(colGingivaAttached).lerp(colGingivaMargin, 0.35);
        } else {
          // Interdental gap between teeth
          vertexColor.copy(colGingivaMargin).lerp(colGingivaAttached, 0.5);
        }
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);

      if (isUpper && j === 0) {
        lingualVertices.push({ x: px, y: py, z: pz, color: colPalateMucosa.clone() });
      }
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

  // Generate anatomical vaulted palate for upper arch
  if (isUpper && lingualVertices.length > 0) {
    const palRings = 10;
    const palSteps = segU;
    const palBaseIndex = positions.length / 3;

    // Palatal vault ceiling along median line (X = 0)
    for (let r = 1; r <= palRings; r++) {
      const ringT = r / palRings; // 0 = at lingual margin, 1 = at median raphe (X = 0)
      for (let i = 0; i <= palSteps; i++) {
        const lv = lingualVertices[i];
        // Target point on median line
        const midY = lv.y * (1 - 0.12 * ringT) + 2.0 * ringT;
        const targetX = 0;
        const targetY = Math.max(-36, Math.min(6, midY));
        const targetZ = 13.5; // Vault ceiling height

        const px = lv.x * (1 - ringT) + targetX * ringT;
        const py = lv.y * (1 - ringT) + targetY * ringT;
        // Natural parabolic vault curvature
        const pz = lv.z * (1 - ringT) + targetZ * ringT + Math.sin(ringT * Math.PI) * 1.5;

        positions.push(px, py, pz);

        const col = new THREE.Color().copy(colPalateMucosa);
        if (ringT > 0.8) {
          col.lerp(colPalateRaphe, (ringT - 0.8) / 0.2);
        }
        colors.push(col.r, col.g, col.b);
      }
    }

    // Connect lingual boundary ring (r=0, which is index i * stride) to palate ring 1
    for (let i = 0; i < palSteps; i++) {
      const a = i * stride; // j = 0 on arch
      const b = (i + 1) * stride;
      const c = palBaseIndex + (i + 1);
      const d = palBaseIndex + i;
      indices.push(a, c, b, a, d, c);
    }

    // Connect interior palate rings
    for (let r = 0; r < palRings - 1; r++) {
      const curRow = palBaseIndex + r * (palSteps + 1);
      const nextRow = palBaseIndex + (r + 1) * (palSteps + 1);
      for (let i = 0; i < palSteps; i++) {
        const a = curRow + i;
        const b = curRow + (i + 1);
        const c = nextRow + (i + 1);
        const d = nextRow + i;
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}
