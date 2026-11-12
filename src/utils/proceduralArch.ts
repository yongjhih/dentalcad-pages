import * as THREE from 'three';

/**
 * Generate a realistic anatomical 3D dental arch BufferGeometry (14 teeth + alveolar gingiva + upper palate)
 * in the standard coordinate system (Anterior = -Y, Posterior = +Y, Left = +X, Right = -X).
 *
 * Anatomical Characteristics:
 * 1. Incisors (Central 11/21 & Lateral 12/22) have flat, chisel-like incisal edges (水平切緣，非尖形).
 * 2. Only Canines (13/23 "虎牙") have prominent, pointed conical cusp tips (尖銳犬齒尖).
 * 3. Premolars & Molars have broad bicuspid/multicuspid occlusal tables with central fissures.
 * 4. Interdental Papillae (齒間乳頭): Pointed triangular gingival peaks located specifically at tooth gaps (牙縫處尖起).
 * 5. Facial Gingival Margin (唇側齒頸緣): Smooth concave parabolic scallops at the facial center of each tooth crown.
 */
export function createProceduralDentalArchGeometry(isUpper: boolean): THREE.BufferGeometry {
  // High-density subdivision for smooth anatomical gingival scallops and anti-aliased tooth-gum transitions
  const segU = 320; // High resolution along the parabolic arch (eliminates dental scallop faceting/jaggies)
  const segV = 88; // Dense cross-sectional profile (smooth clinical crown to gingival roll)

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // 14 teeth along arch parameter s in [-1, 1]:
  // Incisors: ±0.07 (Central), ±0.22 (Lateral) -> Flat incisal edge!
  // Canines:  ±0.36 (Canine/虎牙) -> Pointed conical cusp!
  // Premolars: ±0.49 (1st PM), ±0.62 (2nd PM) -> Bicuspid
  // Molars:   ±0.76 (1st M), ±0.91 (2nd M) -> Multicuspid
  const toothDefs = [
    { type: 'molar',   center: -0.91, halfW: 0.072 },
    { type: 'molar',   center: -0.76, halfW: 0.072 },
    { type: 'premolar',center: -0.62, halfW: 0.062 },
    { type: 'premolar',center: -0.49, halfW: 0.058 },
    { type: 'canine',  center: -0.36, halfW: 0.058 }, // 虎牙 (尖的)
    { type: 'lateral', center: -0.22, halfW: 0.052 }, // 門牙 (平的)
    { type: 'central', center: -0.07, halfW: 0.056 }, // 門牙 (平的)
    { type: 'central', center:  0.07, halfW: 0.056 }, // 門牙 (平的)
    { type: 'lateral', center:  0.22, halfW: 0.052 }, // 門牙 (平的)
    { type: 'canine',  center:  0.36, halfW: 0.058 }, // 虎牙 (尖的)
    { type: 'premolar',center:  0.49, halfW: 0.058 },
    { type: 'premolar',center:  0.62, halfW: 0.062 },
    { type: 'molar',   center:  0.76, halfW: 0.072 },
    { type: 'molar',   center:  0.91, halfW: 0.072 },
  ];

  // Interdental gap centers (where gingival papillae form pointed triangular peaks)
  const gapCenters = [
    -0.835, -0.69, -0.555, -0.425, -0.29, -0.145, 0.0,
     0.145,  0.29,  0.425,  0.555,  0.69,  0.835,
  ];

  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Anatomical color palette matching clinical reference photography
  const colToothBody = new THREE.Color(0xfcfaf5); // Luminous pearl-white enamel
  const colToothIncisal = new THREE.Color(0xecf4f8); // Translucent bluish-white incisal edge
  const colToothCervical = new THREE.Color(0xf7efe0); // Warm cervical neck enamel
  const colGingivaMargin = new THREE.Color(0xf6899e); // Healthy vibrant light-coral pink (free gingival margin)
  const colGingivaAttached = new THREE.Color(0xee6982); // Vibrant coral attached gingiva
  const colGingivaAlveolar = new THREE.Color(0xdb4c68); // Rich alveolar mucosa
  const colPalateMucosa = new THREE.Color(0xe87a90); // Palatal mucosa
  const colPalateRaphe = new THREE.Color(0xf49ba8); // Pale median palatine raphe

  const lingualVertices: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i <= segU; i++) {
    // s in [-1, 1] from Patient Right Posterior (+Y, -X) -> Anterior (-Y, 0) -> Patient Left Posterior (+Y, +X)
    const s = (i / segU) * 2 - 1;
    const absS = Math.abs(s);

    // Parabolic arch centerline in (X, Y):
    const archWidth = isUpper ? 29.5 : 27.5;
    const archX = Math.sign(s) * Math.pow(absS, 0.78) * archWidth;
    const archY = -43.5 + Math.pow(absS, 1.55) * 50.0 + (isUpper ? -1.2 : 0.6);

    // Tangent & outward normal in XY plane
    const dX = 0.78 * Math.pow(Math.max(0.02, absS), -0.22) * archWidth;
    const dY = Math.sign(s) * 1.55 * Math.pow(Math.max(0.02, absS), 0.55) * 50.0;
    const len = Math.hypot(dX, dY) || 1;
    const nx = dY / len;
    const ny = -dX / len;

    // Identify nearest tooth and compute crown morphology
    let bestToothWeight = 0;
    let toothType = 'molar';

    for (const t of toothDefs) {
      const dist = Math.abs(s - t.center);
      if (dist < t.halfW) {
        const u = dist / t.halfW; // 0 at tooth center, 1 at embrasure margin
        let w = 0;
        if (t.type === 'canine') {
          // Canine: Pointed conical cusp (尖銳犬齒)
          w = Math.cos(u * (Math.PI * 0.5));
        } else if (t.type === 'central' || t.type === 'lateral') {
          // Incisors: Flat chisel incisal edge (平切緣，非尖形!)
          // Flat plateau across 75% of tooth width, then rounding at line angles
          if (u < 0.75) {
            w = 1.0;
          } else {
            const corner = (u - 0.75) / 0.25;
            w = Math.cos(corner * (Math.PI * 0.5));
          }
        } else {
          // Premolar / Molar: Broad occlusal table
          if (u < 0.68) {
            w = 1.0;
          } else {
            const edge = (u - 0.68) / 0.32;
            w = Math.cos(edge * (Math.PI * 0.5));
          }
        }

        if (w > bestToothWeight) {
          bestToothWeight = w;
          toothType = t.type;
        }
      }
    }

    // Interdental papilla factor: peaks pointedly at tooth gaps (牙縫處尖起)
    let papillaPeak = 0;
    for (const gc of gapCenters) {
      const dGap = Math.abs(s - gc);
      if (dGap < 0.045) {
        // Sharp triangular peak in the gap
        const p = 1.0 - dGap / 0.045;
        if (p > papillaPeak) papillaPeak = p;
      }
    }

    const isPosterior = absS > 0.42;
    const isCanine = toothType === 'canine';
    const isIncisor = toothType === 'central' || toothType === 'lateral';

    // Alveolar bone base has smooth anatomical radius with root prominences (Juga alveolaria)
    const alveolarRadius = isPosterior ? 4.9 : 3.5;

    for (let j = 0; j <= segV; j++) {
      // v in [0, 1] from inner lingual base (0) -> crown incisal/occlusal edge (0.5) -> outer buccal base (1)
      const v = j / segV;
      const angle = (v - 0.5) * Math.PI; // -pi/2 (lingual) to +pi/2 (buccal)

      // Crown profile factor (1 at occlusal/incisal edge, 0 at root base)
      const crownFactor = Math.cos(angle);
      const crownWeight = Math.pow(crownFactor, 2.0);

      // Labial/buccal crown bulge
      const bulgeMagnitude = isCanine ? 1.15 : isPosterior ? 1.0 : 0.65;
      const crownBulge = bulgeMagnitude * Math.pow(bestToothWeight, 1.2) * crownWeight;

      // Anatomical Juga Alveolaria (牙槽隆起):
      // Facial root prominence over tooth center; gentle interdental depression at the tooth gaps
      const isBuccal = v > 0.50;
      const sinAngle = Math.max(0, Math.sin(angle));
      const rootProminence = isBuccal
        ? (0.85 * Math.pow(bestToothWeight, 1.4) - 0.40 * papillaPeak) * Math.pow(sinAngle, 1.8)
        : 0;

      // Scalloped Cervical Margin (CEJ):
      // In human anatomy, clinical crowns occupy ~66% of total height at the tooth center (prominent full crowns),
      // while interdental papillae shoot coronally down between adjacent teeth to fill embrasures (crownDist ≈ 0.32).
      const crownDist = Math.abs(v - 0.5) / 0.5; // [0, 1]
      const cervicalMargin = 0.66 - 0.34 * Math.pow(papillaPeak, 1.2);

      // 3D Marginal Gingival Collar (游離齦緣卷邊):
      // A rounded 0.36mm outward lip precisely along the scalloped gingival margin
      const distToCervical = Math.abs(crownDist - cervicalMargin);
      const marginalCollar = isBuccal ? 0.36 * Math.exp(-Math.pow(distToCervical / 0.06, 2)) : 0;

      const effectiveRadius = alveolarRadius + crownBulge + rootProminence + marginalCollar;

      const radialOffset = Math.sin(angle) * effectiveRadius;
      const px = archX + nx * radialOffset;
      const py = archY + ny * radialOffset;

      // Vertical Z morphology:
      // Incisors: thin blade labio-lingually, flat incisal edge
      // Canines: pointed cusp tip extending 0.9mm longer
      // Posterior: double cusps with central occlusal groove
      let cuspGroove = 1.0;
      if (isPosterior) {
        // Double cusp groove along occlusal table
        cuspGroove = 1.0 - 0.28 * Math.exp(-Math.pow(angle / 0.22, 2));
      } else if (isIncisor) {
        // Chisel incisal edge: thin at the incisal edge (v ≈ 0.5)
        cuspGroove = 1.0 - 0.08 * Math.pow(angle / 0.4, 2);
      }

      // Height of tooth crown
      let crownLen = isCanine ? 9.2 : isPosterior ? 7.6 : 8.5;
      if (toothType === 'central') crownLen = 8.8; // Central incisor is broad and long
      if (toothType === 'lateral') crownLen = 8.1; // Lateral incisor is slightly shorter

      // Coronal projection:
      // At tooth center: full crown length down to incisal edge
      // At tooth gap: interdental papilla reaches down towards the contact point (4.8mm)
      const toothHeight = crownLen * cuspGroove;
      const papillaCoronalReach = 5.2; // mm coronal extension into embrasure
      const zCoronalSpan =
        (1.0 - papillaPeak) * toothHeight * (0.35 + 0.65 * bestToothWeight) +
        papillaPeak * papillaCoronalReach;

      const zProjection = crownFactor * (4.4 + zCoronalSpan);

      let pz: number;
      if (isUpper) {
        pz = 14.2 - zProjection;
      } else {
        pz = -13.2 + zProjection;
      }

      positions.push(px, py, pz);

      // Enamel Weight: 1.0 inside tooth crown, 0.0 on gingiva
      const enamelWeight =
        (1.0 - smoothstep(cervicalMargin - 0.035, cervicalMargin + 0.025, crownDist)) *
        smoothstep(0.08, 0.28, bestToothWeight) *
        (1.0 - 0.95 * papillaPeak);

      const vertexColor = new THREE.Color();

      if (enamelWeight > 0.01) {
        const toothCol = new THREE.Color();
        if (crownDist < 0.16) {
          // Incisal edge translucency
          const tInc = 1 - crownDist / 0.16;
          toothCol.copy(colToothBody).lerp(colToothIncisal, tInc * 0.7);
        } else if (crownDist > 0.45) {
          // Warm cervical enamel near the margin
          const tCerv = Math.min(1, Math.max(0, (crownDist - 0.45) / 0.20));
          toothCol.copy(colToothBody).lerp(colToothCervical, tCerv * 0.65);
        } else {
          toothCol.copy(colToothBody);
        }

        const marginCol = new THREE.Color().copy(colGingivaMargin);
        vertexColor.copy(marginCol).lerp(toothCol, enamelWeight);
      } else {
        // Continuous gingival gradient:
        // Free margin (pale pink) -> Attached gingiva (coral) -> Alveolar mucosa (deep rose)
        const gingivaT = smoothstep(cervicalMargin, 0.95, crownDist);
        if (gingivaT < 0.45) {
          const t = gingivaT / 0.45;
          vertexColor.copy(colGingivaMargin).lerp(colGingivaAttached, t);
        } else {
          const t = (gingivaT - 0.45) / 0.55;
          vertexColor.copy(colGingivaAttached).lerp(colGingivaAlveolar, t);
        }

        // Interdental papilla has delicate light mucosal tip
        if (papillaPeak > 0.15) {
          vertexColor.lerp(colGingivaMargin, papillaPeak * 0.5);
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
