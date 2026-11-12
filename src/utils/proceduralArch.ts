import * as THREE from 'three';

/**
 * Generate a realistic anatomical 3D dental arch BufferGeometry (14 teeth + alveolar gingiva + upper palate)
 * in the standard coordinate system (Anterior = -Y, Posterior = +Y, Left = +X, Right = -X).
 * Used as an automatic zero-dependency fallback on GitHub Pages when private patient STL files
 * are not committed to the public repository.
 */
export function createProceduralDentalArchGeometry(isUpper: boolean): THREE.BufferGeometry {
  const segU = 160; // Along the parabolic arch (from Right 2nd Molar to Left 2nd Molar)
  const segV = 50; // Cross-sectional profile (from lingual gingiva -> crown cusps -> buccal gingiva)

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // 14 teeth along the arch parameter s in [-1, 1]
  const toothCenters = [
    -0.91, -0.76, -0.62, -0.49, -0.36, -0.22, -0.07,
     0.07,  0.22,  0.36,  0.49,  0.62,  0.76,  0.91,
  ];

  // Smoothstep helper for continuous transitions without discrete banding
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Anatomical color palette
  const colToothBody = new THREE.Color(0xf6f3ea); // VITA A1/A2 Body Enamel
  const colToothIncisal = new THREE.Color(0xdce7ef); // Translucent incisal edge
  const colToothCervical = new THREE.Color(0xeee2c9); // Warm cervical neck enamel
  const colGingivaMargin = new THREE.Color(0xdf798b); // Free gingival margin collar
  const colGingivaAttached = new THREE.Color(0xce6577); // Stippled attached gingiva
  const colGingivaAlveolar = new THREE.Color(0xb2384a); // Deeper alveolar mucosa / vestibule
  const colPalateMucosa = new THREE.Color(0xd46e7f); // Palatal mucosa
  const colPalateRaphe = new THREE.Color(0xe59aa8); // Pale median palatine raphe

  const lingualVertices: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i <= segU; i++) {
    // s in [-1, 1] from Patient Right Posterior (+Y, -X) -> Anterior (-Y, 0) -> Patient Left Posterior (+Y, +X)
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
    const nx = dY / len;
    const ny = -dX / len;

    // Continuous tooth crown envelope & interproximal embrasures
    let toothEnv = 0;
    const isMolar = absS > 0.42;
    for (const tc of toothCenters) {
      const dist = Math.abs(s - tc);
      const halfW = Math.abs(tc) > 0.42 ? 0.072 : 0.054;
      if (dist < halfW) {
        // Smooth cosine tooth crown envelope
        const local = Math.cos((dist / halfW) * (Math.PI * 0.5));
        if (local > toothEnv) toothEnv = local;
      }
    }

    // Decouple alveolar base radius from tooth corrugation to eliminate vertical fluting:
    // Alveolar gingiva base is smooth and continuous; only the crown bulges anatomically
    const alveolarRadius = isMolar ? 4.9 : 3.5;

    for (let j = 0; j <= segV; j++) {
      // v in [0, 1] from inner palatal/lingual base (0) -> crown cusps (0.5) -> outer buccal base (1)
      const v = j / segV;
      const angle = (v - 0.5) * Math.PI; // -pi/2 (lingual) to +pi/2 (buccal)

      // Crown profile factor: 1 at occlusal/incisal edge (v=0.5), 0 at alveolar margins (v=0 and v=1)
      const crownFactor = Math.cos(angle); // [0, 1]
      // Crown influence fades smoothly towards the gingiva base so the alveolar wall remains uniform
      const crownWeight = Math.pow(crownFactor, 2.0);

      // Radial crown projection (bulges only where tooth is present and near crown)
      const toothBulge = (isMolar ? 1.0 : 0.75) * Math.pow(toothEnv, 1.2) * crownWeight;
      const effectiveRadius = alveolarRadius + toothBulge;

      const radialOffset = Math.sin(angle) * effectiveRadius;
      const px = archX + nx * radialOffset;
      const py = archY + ny * radialOffset;

      // Vertical Z profile:
      // Base alveolar height is smooth across the entire arch (no vertical creases)
      // Only the crown cusps project downward (upper) or upward (lower)
      const cuspGroove = isMolar
        ? 1.0 - 0.25 * Math.exp(-Math.pow(angle / 0.22, 2))
        : 1.0;

      // Crown length extends from the scalloped cervical margin down to the biting table
      const toothLength = (isMolar ? 7.6 : 8.5) * cuspGroove;
      // Between teeth (embrasure papilla), the height only dips slightly; cusps reach Z ≈ 0.2
      const zProjection = crownFactor * (5.5 + toothLength * (0.35 + 0.65 * toothEnv));

      let pz: number;
      if (isUpper) {
        pz = 14.2 - zProjection;
      } else {
        pz = -13.2 + zProjection;
      }

      positions.push(px, py, pz);

      // Compute smooth continuous anatomical vertex coloring (Zero discrete step functions)
      // Normalized distance from crown center (0 at cusp/incisal edge, 1 at gingival base)
      const crownDist = Math.abs(v - 0.5) / 0.5; // [0, 1]

      // Anatomical cervical line (scalloped gingival margin)
      // Cervical line is higher at tooth center (crownDist ~ 0.52) and dips interdentally (crownDist ~ 0.38)
      const cervicalLine = 0.36 + 0.22 * toothEnv;
      // Smooth enamel transition factor [0 = pure gingiva, 1 = pure tooth enamel]
      const enamelWeight = smoothstep(cervicalLine - 0.08, cervicalLine + 0.04, 1 - crownDist) * smoothstep(0.08, 0.25, toothEnv);

      const vertexColor = new THREE.Color();

      if (enamelWeight > 0.01) {
        // Enamel gradient: Cervical -> Body -> Incisal edge
        const toothCol = new THREE.Color();
        if (crownDist < 0.18) {
          // Incisal edge translucency
          const tInc = 1 - crownDist / 0.18;
          toothCol.copy(colToothBody).lerp(colToothIncisal, tInc * 0.7);
        } else if (crownDist > 0.35) {
          // Warm cervical enamel near the margin
          const tCerv = Math.min(1, (crownDist - 0.35) / 0.25);
          toothCol.copy(colToothBody).lerp(colToothCervical, tCerv * 0.7);
        } else {
          toothCol.copy(colToothBody);
        }

        // Gingiva color for blending at the cervical margin
        const marginCol = new THREE.Color().copy(colGingivaMargin);
        vertexColor.copy(marginCol).lerp(toothCol, enamelWeight);
      } else {
        // Continuous gingival mucosal gradient:
        // Margin (light coral pink) -> Attached gingiva (stippled rose) -> Alveolar mucosa (deep vascular pink)
        const gingivaT = smoothstep(0.48, 0.95, crownDist);
        if (gingivaT < 0.45) {
          const t = gingivaT / 0.45;
          vertexColor.copy(colGingivaMargin).lerp(colGingivaAttached, t);
        } else {
          const t = (gingivaT - 0.45) / 0.55;
          vertexColor.copy(colGingivaAttached).lerp(colGingivaAlveolar, t);
        }
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);

      if (isUpper && j === 0) {
        lingualVertices.push({ x: px, y: py, z: pz });
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

  // Generate anatomical vaulted palate for upper arch with smooth mucosa
  if (isUpper && lingualVertices.length > 0) {
    const palRings = 12;
    const palSteps = segU;
    const palBaseIndex = positions.length / 3;

    for (let r = 1; r <= palRings; r++) {
      const ringT = r / palRings; // 0 = at lingual margin, 1 = at median raphe (X = 0)
      for (let i = 0; i <= palSteps; i++) {
        const lv = lingualVertices[i];
        const midY = lv.y * (1 - 0.12 * ringT) + 2.0 * ringT;
        const targetX = 0;
        const targetY = Math.max(-36, Math.min(6, midY));
        const targetZ = 13.5; // Vault ceiling height

        const px = lv.x * (1 - ringT) + targetX * ringT;
        const py = lv.y * (1 - ringT) + targetY * ringT;
        const pz = lv.z * (1 - ringT) + targetZ * ringT + Math.sin(ringT * Math.PI) * 1.6;

        positions.push(px, py, pz);

        const col = new THREE.Color().copy(colPalateMucosa);
        if (ringT > 0.75) {
          const tRaphe = (ringT - 0.75) / 0.25;
          col.lerp(colPalateRaphe, tRaphe * 0.85);
        }
        colors.push(col.r, col.g, col.b);
      }
    }

    // Connect lingual boundary ring to palate ring 1
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
