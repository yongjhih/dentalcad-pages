import * as THREE from 'three';

let cachedUpperArchTemplate: THREE.BufferGeometry | null = null;
let cachedLowerArchTemplate: THREE.BufferGeometry | null = null;

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
  if (isUpper && cachedUpperArchTemplate) {
    return cachedUpperArchTemplate.clone();
  }
  if (!isUpper && cachedLowerArchTemplate) {
    return cachedLowerArchTemplate.clone();
  }

  const built = buildProceduralDentalArchGeometryTemplate(isUpper);
  if (isUpper) {
    cachedUpperArchTemplate = built;
  } else {
    cachedLowerArchTemplate = built;
  }
  return built.clone();
}

function buildProceduralDentalArchGeometryTemplate(isUpper: boolean): THREE.BufferGeometry {
  // High-density subdivision for smooth anatomical gingival scallops and anti-aliased tooth-gum transitions
  const segU = 320; // High resolution along the parabolic arch (eliminates dental scallop faceting/jaggies)
  const segV = 88; // Dense cross-sectional profile (smooth clinical crown to gingival roll)

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // 14 anatomical teeth contacting continuously along arch parameter s in [-1, 1]:
  // Central:  ±0.065 (w=0.065, span [0, 0.13]) -> Broad, flat incisal edge (9.1mm)
  // Lateral:  ±0.195 (w=0.065, span [0.13, 0.26]) -> Rounded incisal edge (8.6mm)
  // Canine:   ±0.33  (w=0.070, span [0.26, 0.40]) -> Prominent pointed conical cusp (尖的虎牙, 9.6mm)
  // Premolars:±0.47, ±0.61 (w=0.070, span [0.40, 0.68]) -> Bicuspids (9.1mm, 8.8mm)
  // Molars:   ±0.76, ±0.92 (w=0.080, span [0.68, 1.00]) -> Multicuspids (8.5mm, 8.3mm)
  const toothDefs = [
    { type: 'molar',    center: -0.92, halfW: 0.080, len: 8.3, bulge: 0.95 },
    { type: 'molar',    center: -0.76, halfW: 0.080, len: 8.5, bulge: 0.98 },
    { type: 'premolar', center: -0.61, halfW: 0.070, len: 8.8, bulge: 0.92 },
    { type: 'premolar', center: -0.47, halfW: 0.070, len: 9.1, bulge: 0.92 },
    { type: 'canine',   center: -0.33, halfW: 0.070, len: 9.6, bulge: 1.10 }, // 虎牙 (尖的)
    { type: 'lateral',  center: -0.195, halfW: 0.065, len: 8.6, bulge: 0.72 }, // 側門牙 (平帶圓角)
    { type: 'central',  center: -0.065, halfW: 0.065, len: 9.1, bulge: 0.75 }, // 正中門牙 (平切緣)
    { type: 'central',  center:  0.065, halfW: 0.065, len: 9.1, bulge: 0.75 }, // 正中門牙 (平切緣)
    { type: 'lateral',  center:  0.195, halfW: 0.065, len: 8.6, bulge: 0.72 }, // 側門牙 (平帶圓角)
    { type: 'canine',   center:  0.33, halfW: 0.070, len: 9.6, bulge: 1.10 }, // 虎牙 (尖的)
    { type: 'premolar', center:  0.47, halfW: 0.070, len: 9.1, bulge: 0.92 },
    { type: 'premolar', center:  0.61, halfW: 0.070, len: 8.8, bulge: 0.92 },
    { type: 'molar',    center:  0.76, halfW: 0.080, len: 8.5, bulge: 0.98 },
    { type: 'molar',    center:  0.92, halfW: 0.080, len: 8.3, bulge: 0.95 },
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

  // Reusable scratch Color instances to avoid ~85,000 object allocations inside the vertex loop
  const vertexColor = new THREE.Color();
  const toothCol = new THREE.Color();
  const palCol = new THREE.Color();

  const lingualVertices: Array<{ x: number; y: number; z: number }> = [];
  const buccalVertices: Array<{ x: number; y: number; z: number }> = [];

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

    // Identify teeth and compute smooth continuous morphological parameters (Curve of Spee)
    let minToothU = 1.0;
    let toothProfileW = 0.8;
    let weightedLen = 0;
    let weightedBulge = 0;
    let totalInf = 0;
    let incisorAmount = 0;

    for (const t of toothDefs) {
      const dist = Math.abs(s - t.center);
      const span = t.halfW * 1.15;
      if (dist < span) {
        const u = dist / t.halfW;
        if (u < minToothU) minToothU = Math.min(1.0, u);

        const inf = Math.pow(Math.max(0, Math.cos((dist / span) * (Math.PI * 0.5))), 1.5);
        weightedLen += t.len * inf;
        weightedBulge += t.bulge * inf;
        totalInf += inf;

        if (dist < t.halfW) {
          let w = 0;
          if (t.type === 'canine') {
            w = Math.max(0.68, Math.cos(u * (Math.PI * 0.48)));
          } else if (t.type === 'central') {
            w = 1.0 - 0.20 * smoothstep(0.75, 1.0, u);
            incisorAmount = Math.max(incisorAmount, 1.0 - smoothstep(0.5, 1.0, u));
          } else if (t.type === 'lateral') {
            w = 1.0 - 0.25 * smoothstep(0.65, 1.0, u);
            incisorAmount = Math.max(incisorAmount, 1.0 - smoothstep(0.5, 1.0, u));
          } else {
            w = 1.0 - 0.22 * smoothstep(0.70, 1.0, u);
          }
          if (w > toothProfileW) toothProfileW = w;
        }
      }
    }

    const crownLen = totalInf > 0 ? weightedLen / totalInf : 8.8;
    const bulgeMagnitude = totalInf > 0 ? weightedBulge / totalInf : 0.85;

    // Continuous anatomical alveolar arch radius:
    // Narrow anterior ridge (3.7mm) smoothly widening into posterior molar table (4.8mm) with zero step
    const alveolarRadius = 3.7 + 1.1 * smoothstep(0.24, 0.70, absS);

    for (let j = 0; j <= segV; j++) {
      // v in [0, 1] from inner lingual base (0) -> crown incisal/occlusal edge (0.5) -> outer buccal base (1)
      const v = j / segV;
      const angle = (v - 0.5) * Math.PI; // -pi/2 (lingual) to +pi/2 (buccal)

      // Crown profile factor (1 at occlusal/incisal edge, 0 at root base)
      const crownFactor = Math.cos(angle);
      const crownWeight = Math.pow(crownFactor, 2.0);

      // Labial/buccal crown bulge
      const crownBulge = bulgeMagnitude * Math.pow(toothProfileW, 1.2) * crownWeight;

      // Gentle anatomical root prominence (Juga Alveolaria / 牙槽隆起):
      // Smooth, fleshy contour over tooth roots with natural soft embrasure depressions.
      // C1 continuity avoids sudden normal jumps that cause specular hairline reflections (髮絲紋).
      const isBuccal = v > 0.50;
      const sinAngle = Math.max(0, Math.sin(angle));
      const rootProminence = isBuccal
        ? 0.40 * (1.0 - minToothU * minToothU) * Math.pow(sinAngle, 2.0)
        : 0;

      // Scalloped Cervical Margin (CEJ):
      // In human anatomy, crowns are long (72% at center) and arch smoothly down to 50% at interdental contacts,
      // creating natural sharp triangular papillae filling the embrasure gaps without vertical stripes.
      const crownDist = Math.abs(v - 0.5) / 0.5; // [0, 1]
      const cervicalMargin = 0.50 + 0.22 * (1.0 - minToothU * minToothU);

      // Surface is continuous and fleshy: NO artificial paper-thin Gaussian wire ridge (eliminates hairline reflections)
      const effectiveRadius = alveolarRadius + crownBulge + rootProminence;

      const radialOffset = Math.sin(angle) * effectiveRadius;
      const px = archX + nx * radialOffset;
      const py = archY + ny * radialOffset;

      // Vertical Z morphology:
      // Smooth continuous transition from anterior incisal blade to posterior double-cusp occlusal table
      const posteriorWeight = smoothstep(0.36, 0.52, absS);
      const incisorWeight = (1.0 - posteriorWeight) * incisorAmount;

      const posteriorGroove = 1.0 - 0.20 * Math.exp(-Math.pow(angle / 0.24, 2));
      const anteriorChisel = 1.0 - 0.08 * Math.pow(angle / 0.4, 2);

      const cuspGroove =
        posteriorWeight * posteriorGroove +
        incisorWeight * anteriorChisel +
        (1.0 - posteriorWeight - incisorWeight) * 1.0;

      // Height of tooth crown (clinical height in mm)
      // Teeth form a continuous arcade touching at proximal contact points.
      // At contact boundaries, incisal embrasure is a gentle 0.3 - 0.5mm notch.
      const toothHeight = crownLen * cuspGroove;
      const embrasureDip = (1.0 - toothProfileW) * 1.0;
      const zCoronalSpan = toothHeight - embrasureDip;

      const zProjection = crownFactor * (4.2 + zCoronalSpan);

      let pz: number;
      if (isUpper) {
        pz = 14.0 - zProjection;
      } else {
        pz = -13.0 + zProjection;
      }

      positions.push(px, py, pz);

      // Enamel Weight: 1.0 inside tooth crown, 0.0 on gingiva
      // Clean anti-aliased transition across the scalloped CEJ line (NO pink bleeding onto crowns)
      const enamelWeight = 1.0 - smoothstep(cervicalMargin - 0.02, cervicalMargin + 0.02, crownDist);

      if (enamelWeight > 0.01) {
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

        vertexColor.copy(colGingivaMargin).lerp(toothCol, enamelWeight);
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
        const papillaFactor = Math.pow(minToothU, 2.0);
        if (papillaFactor > 0.30) {
          vertexColor.lerp(colGingivaMargin, (papillaFactor - 0.30) * 0.45);
        }
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);

      if (j === 0) {
        lingualVertices.push({ x: px, y: py, z: pz });
      } else if (j === segV) {
        buccalVertices.push({ x: px, y: py, z: pz });
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

  // Seal the alveolar base rim between buccal margin (j = segV) and lingual margin (j = 0)
  // using dedicated cap vertices so buccal/lingual gingival normals remain 100% smooth
  if (lingualVertices.length === segU + 1 && buccalVertices.length === segU + 1) {
    const capCols = 4;
    const capBaseIdx = positions.length / 3;
    for (let i = 0; i <= segU; i++) {
      const bV = buccalVertices[i];
      const lV = lingualVertices[i];
      for (let c = 0; c <= capCols; c++) {
        const t = c / capCols;
        const px = bV.x * (1 - t) + lV.x * t;
        const py = bV.y * (1 - t) + lV.y * t;
        const pz = bV.z * (1 - t) + lV.z * t;
        positions.push(px, py, pz);
        colors.push(colGingivaAlveolar.r, colGingivaAlveolar.g, colGingivaAlveolar.b);
      }
    }
    const capStride = capCols + 1;
    for (let i = 0; i < segU; i++) {
      for (let c = 0; c < capCols; c++) {
        const a = capBaseIdx + i * capStride + c;
        const b = capBaseIdx + (i + 1) * capStride + c;
        const d = capBaseIdx + i * capStride + (c + 1);
        const e = capBaseIdx + (i + 1) * capStride + (c + 1);
        if (isUpper) {
          indices.push(a, b, e, a, e, d);
        } else {
          indices.push(a, e, b, a, d, e);
        }
      }
    }
  }

  // Generate anatomical vaulted palate for upper arch with smooth mucosa
  if (isUpper && lingualVertices.length > 0) {
    const palRings = 12;
    const palSteps = segU;
    const palBaseIndex = positions.length / 3;

    for (let r = 0; r <= palRings; r++) {
      const ringT = r / palRings; // 0 = at lingual margin, 1 = at median raphe (X = 0)
      for (let i = 0; i <= palSteps; i++) {
        const lv = lingualVertices[i];
        const midY = lv.y * (1 - 0.12 * ringT) + 2.0 * ringT;
        const targetX = 0;
        const targetY = Math.max(-36, Math.min(6, midY));

        const px = lv.x * (1 - ringT) + targetX * ringT;
        const py = lv.y * (1 - ringT) + targetY * ringT;
        const pz = lv.z;

        positions.push(px, py, pz);

        palCol.copy(colGingivaAlveolar).lerp(colPalateMucosa, ringT);
        if (ringT > 0.75) {
          const tRaphe = (ringT - 0.75) / 0.25;
          palCol.lerp(colPalateRaphe, tRaphe * 0.75);
        }
        colors.push(palCol.r, palCol.g, palCol.b);
      }
    }

    // Connect interior palate rings (r = 0..palRings) with independent normals
    for (let r = 0; r < palRings; r++) {
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
