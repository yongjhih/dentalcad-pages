import * as THREE from 'three';
import { OcclusogramStats, Point3D } from '../types/dental';
import {
  MandibularKinematicsResult,
  transformPoint3DByMatrix4,
} from './articulatorKinematics';

export interface OcclusalMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface OcclusalElevationMap {
  isUpper: boolean;
  resolution: number;
  bounds: OcclusalMapBounds;
  /** Z height in mm for each cell; NaN if cell has no occlusal surface */
  heights: Float32Array;
  /** Area of a single grid cell in mm^2 */
  cellAreaMm2: number;
}

export const DEFAULT_OCCLUSAL_BOUNDS: OcclusalMapBounds = {
  minX: -36,
  maxX: 36,
  minY: -50,
  maxY: 14,
  minZ: -25,
  maxZ: 25,
};

/**
 * Map an inter-arch clearance distance (in mm) to an RGB color [r, g, b] in 0..1
 * following the clinical Occlusogram color scale.
 * Returns null if clearance exceeds maxRangeMm (no occlusal contact).
 */
export function clearanceToOcclusogramRGB(
  clearanceMm: number,
  maxRangeMm = 1.6
): [number, number, number] | null {
  if (!Number.isFinite(clearanceMm) || clearanceMm > maxRangeMm) {
    return null;
  }

  // <= 0.0 mm: Heavy contact / penetration (Red / Magenta-Red)
  if (clearanceMm <= 0.0) {
    return [0.94, 0.18, 0.22]; // #ef2e38
  }

  const stops: Array<{ d: number; rgb: [number, number, number] }> = [
    { d: 0.0, rgb: [0.94, 0.18, 0.22] }, // Red (0.0 mm collision)
    { d: 0.25, rgb: [0.98, 0.45, 0.09] }, // Orange (0.25 mm tight contact)
    { d: 0.55, rgb: [0.92, 0.72, 0.05] }, // Yellow (0.55 mm moderate contact)
    { d: 0.95, rgb: [0.13, 0.77, 0.37] }, // Green (0.95 mm functional contact)
    { d: Math.max(1.1, maxRangeMm), rgb: [0.02, 0.65, 0.91] }, // Cyan-Blue (light clearance)
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clearanceMm >= a.d && clearanceMm <= b.d) {
      const t = (clearanceMm - a.d) / Math.max(0.0001, b.d - a.d);
      return [
        Number((a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t).toFixed(4)),
        Number((a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t).toFixed(4)),
        Number((a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t).toFixed(4)),
      ];
    }
  }

  return stops[stops.length - 1].rgb;
}

/**
 * Build a 2D XY Occlusal Elevation Map from 3D vertex positions (and optional normals).
 * - For Upper arch (isUpper = true): captures the minimum (most inferior/occlusal) Z per XY cell.
 * - For Lower arch (isUpper = false): captures the maximum (most superior/occlusal) Z per XY cell.
 */
export function buildOcclusalElevationMap(
  positions: ArrayLike<number>,
  normals: ArrayLike<number> | null | undefined,
  isUpper: boolean,
  bounds: OcclusalMapBounds = DEFAULT_OCCLUSAL_BOUNDS,
  resolution = 96
): OcclusalElevationMap {
  const res = Math.max(8, resolution);
  const heights = new Float32Array(res * res);
  heights.fill(NaN);

  const spanX = Math.max(0.001, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.001, bounds.maxY - bounds.minY);
  const cellAreaMm2 = (spanX / res) * (spanY / res);

  const vertexCount = Math.floor(positions.length / 3);
  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    // Filter out base/gingival vertices far from occlusal plane
    if (isUpper && z > 8.5) continue;
    if (!isUpper && z < -6.5) continue;

    // If normals are provided, prefer occlusal-facing vertices
    if (normals && normals.length >= idx + 3) {
      const nz = normals[idx + 2];
      if (isUpper && nz > 0.25) continue;
      if (!isUpper && nz < -0.25) continue;
    }

    const gx = Math.floor(((x - bounds.minX) / spanX) * res);
    const gy = Math.floor(((y - bounds.minY) / spanY) * res);
    if (gx < 0 || gx >= res || gy < 0 || gy >= res) continue;

    const cellIdx = gy * res + gx;
    const current = heights[cellIdx];
    if (Number.isNaN(current)) {
      heights[cellIdx] = z;
    } else if (isUpper) {
      // Upper arch occlusal cusps point downward (-Z)
      if (z < current) heights[cellIdx] = z;
    } else {
      // Lower arch occlusal cusps point upward (+Z)
      if (z > current) heights[cellIdx] = z;
    }
  }

  // 1-pass 3x3 morphological smoothing/dilation to fill tiny sub-cell triangle gaps
  const filled = new Float32Array(heights);
  for (let y = 1; y < res - 1; y++) {
    for (let x = 1; x < res - 1; x++) {
      const cIdx = y * res + x;
      if (!Number.isNaN(heights[cIdx])) continue;

      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nVal = heights[(y + dy) * res + (x + dx)];
          if (!Number.isNaN(nVal)) {
            sum += nVal;
            count++;
          }
        }
      }
      if (count >= 4) {
        filled[cIdx] = sum / count;
      }
    }
  }

  return {
    isUpper,
    resolution: res,
    bounds,
    heights: filled,
    cellAreaMm2,
  };
}

/**
 * Sample height Z (in mm) at (x, y) from an OcclusalElevationMap.
 * Returns NaN if out of bounds or no occlusal surface at (x, y).
 */
export function sampleElevationMapAtXY(
  map: OcclusalElevationMap,
  x: number,
  y: number
): number {
  const { bounds, resolution, heights } = map;
  const u = (x - bounds.minX) / Math.max(0.001, bounds.maxX - bounds.minX);
  const v = (y - bounds.minY) / Math.max(0.001, bounds.maxY - bounds.minY);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return NaN;

  const gx = Math.min(resolution - 1, Math.max(0, Math.floor(u * resolution)));
  const gy = Math.min(resolution - 1, Math.max(0, Math.floor(v * resolution)));
  return heights[gy * resolution + gx];
}

/**
 * Compute real-time Occlusogram contact statistics given Upper & Lower elevation maps
 * and the current MandibularKinematicsResult.
 */
export function computeOcclusogramStats(
  upperMap: OcclusalElevationMap,
  lowerMap: OcclusalElevationMap,
  kinematics: MandibularKinematicsResult,
  maxRangeMm = 1.6
): OcclusogramStats {
  const { resolution, bounds, heights: lowerHeights, cellAreaMm2 } = lowerMap;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  let minClearance = Infinity;
  let clearanceSum = 0;
  let contactCount = 0;
  let heavyCollisionCount = 0;
  let leftContacts = 0;
  let rightContacts = 0;
  let anteriorContacts = 0;
  let posteriorContacts = 0;

  for (let gy = 0; gy < resolution; gy++) {
    const localY = bounds.minY + ((gy + 0.5) / resolution) * spanY;
    for (let gx = 0; gx < resolution; gx++) {
      const localZ = lowerHeights[gy * resolution + gx];
      if (Number.isNaN(localZ)) continue;

      const localX = bounds.minX + ((gx + 0.5) / resolution) * spanX;
      const worldLower: Point3D = transformPoint3DByMatrix4(
        { x: localX, y: localY, z: localZ },
        kinematics.lowerMatrixElements
      );

      const upperLocalZ = sampleElevationMapAtXY(upperMap, worldLower.x, worldLower.y);
      if (Number.isNaN(upperLocalZ)) continue;

      const worldUpperZ = upperLocalZ + kinematics.upperPosition.z;
      const clearance = worldUpperZ - worldLower.z;

      if (clearance < minClearance) {
        minClearance = clearance;
      }

      if (clearance <= maxRangeMm) {
        contactCount++;
        clearanceSum += Math.max(0, clearance);

        if (clearance <= 0.2) {
          heavyCollisionCount++;
        }
        if (worldLower.x >= 0) {
          leftContacts++;
        } else {
          rightContacts++;
        }
        if (worldLower.y >= -15) {
          anteriorContacts++;
        } else {
          posteriorContacts++;
        }
      }
    }
  }

  const totalLR = leftContacts + rightContacts;
  const totalAP = anteriorContacts + posteriorContacts;

  return {
    minClearanceMm: Number.isFinite(minClearance) ? Number(minClearance.toFixed(2)) : 99.9,
    meanContactClearanceMm:
      contactCount > 0 ? Number((clearanceSum / contactCount).toFixed(2)) : 0,
    contactAreaMm2: Number((contactCount * cellAreaMm2).toFixed(1)),
    heavyCollisionAreaMm2: Number((heavyCollisionCount * cellAreaMm2).toFixed(1)),
    leftContactPercent: totalLR > 0 ? Math.round((leftContacts / totalLR) * 100) : 50,
    rightContactPercent:
      totalLR > 0 ? 100 - Math.round((leftContacts / totalLR) * 100) : 50,
    anteriorContactPercent:
      totalAP > 0 ? Math.round((anteriorContacts / totalAP) * 100) : 0,
    posteriorContactPercent:
      totalAP > 0 ? 100 - Math.round((anteriorContacts / totalAP) * 100) : 0,
    totalContactPoints: contactCount,
  };
}

/**
 * Encode an OcclusalElevationMap into a 16-bit fixed-point RGBA DataTexture for WebGL shaders.
 * R = high byte, G = low byte, A = 255 if valid cell, 0 if empty.
 */
export function createElevationDataTexture(map: OcclusalElevationMap): THREE.DataTexture {
  const { resolution, heights, bounds } = map;
  const data = new Uint8Array(resolution * resolution * 4);
  const spanZ = Math.max(0.001, bounds.maxZ - bounds.minZ);

  for (let i = 0; i < resolution * resolution; i++) {
    const z = heights[i];
    const base = i * 4;
    if (Number.isNaN(z)) {
      data[base] = 0;
      data[base + 1] = 0;
      data[base + 2] = 0;
      data[base + 3] = 0;
    } else {
      const norm = Math.max(0, Math.min(1, (z - bounds.minZ) / spanZ));
      const int16 = Math.round(norm * 65535);
      data[base] = (int16 >> 8) & 0xff;
      data[base + 1] = int16 & 0xff;
      data[base + 2] = 128;
      data[base + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a Three.js MeshPhysicalMaterial that renders real-time 60 FPS Occlusogram
 * contact heatmaps on the occlusal surfaces as the jaw moves along its articulation curve.
 */
export function createOcclusogramMaterial(params: {
  isUpper: boolean;
  opposingElevationTex: THREE.DataTexture;
  bounds: OcclusalMapBounds;
  maxRangeMm: number;
  lowerMatrix: THREE.Matrix4;
  lowerInverseMatrix: THREE.Matrix4;
  upperZOffset: number;
  wireframe: boolean;
  clippingPlanes: THREE.Plane[];
  baseColor?: number;
  baseRoughness?: number;
  baseMetalness?: number;
  baseIor?: number;
  baseTransmission?: number;
  baseOpacity?: number;
  pentaTextures?: import('./pentaTextureShader').LoadedPentaTextures | null;
  archBox?: THREE.Box3 | null;
  combinedBox?: THREE.Box3 | null;
}): {
  material: THREE.MeshPhysicalMaterial;
  updateKinematicsUniforms: (
    lowerMat: THREE.Matrix4,
    lowerInvMat: THREE.Matrix4,
    upperZ: number,
    maxRange: number
  ) => void;
} {
  const {
    isUpper,
    opposingElevationTex,
    bounds,
    maxRangeMm,
    lowerMatrix,
    lowerInverseMatrix,
    upperZOffset,
    wireframe,
    clippingPlanes,
    baseColor = 0xf8fafc,
    baseRoughness = 0.26,
    baseMetalness = 0.03,
    baseIor = 1.54,
    baseTransmission = 0.0,
    baseOpacity = 1.0,
    pentaTextures = null,
    archBox = null,
    combinedBox = null,
  } = params;

  const mat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: baseRoughness,
    metalness: baseMetalness,
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
    ior: baseIor,
    transmission: baseTransmission,
    opacity: baseOpacity,
    transparent: baseTransmission > 0 || baseOpacity < 1,
    side: THREE.DoubleSide,
    wireframe,
  });
  mat.clippingPlanes = clippingPlanes;

  const uniformsRef = {
    uOpposingTex: { value: opposingElevationTex },
    uBoundsMin: { value: new THREE.Vector3(bounds.minX, bounds.minY, bounds.minZ) },
    uBoundsMax: { value: new THREE.Vector3(bounds.maxX, bounds.maxY, bounds.maxZ) },
    uLowerMatrix: { value: lowerMatrix.clone() },
    uLowerInvMatrix: { value: lowerInverseMatrix.clone() },
    uUpperZOffset: { value: upperZOffset },
    uMaxRangeMm: { value: maxRangeMm },
    uIsUpper: { value: isUpper ? 1.0 : 0.0 },
  };

  const hasPenta = Boolean(
    pentaTextures &&
      archBox &&
      combinedBox &&
      (pentaTextures.front ||
        pentaTextures.upper ||
        pentaTextures.lower ||
        pentaTextures.right ||
        pentaTextures.left)
  );

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformsRef);

    if (hasPenta && pentaTextures && archBox && combinedBox) {
      const occlusalTex = isUpper ? pentaTextures.upper : pentaTextures.lower;
      const occlusalRect = isUpper ? pentaTextures.rects.upper : pentaTextures.rects.lower;

      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 2;
      dummyCanvas.height = 2;
      const dummyTex = new THREE.CanvasTexture(dummyCanvas);

      shader.uniforms.uTexFront = { value: pentaTextures.front || dummyTex };
      shader.uniforms.uTexOcclusal = { value: occlusalTex || dummyTex };
      shader.uniforms.uTexRight = { value: pentaTextures.right || dummyTex };
      shader.uniforms.uTexLeft = { value: pentaTextures.left || dummyTex };

      shader.uniforms.uRectFront = { value: pentaTextures.rects.front };
      shader.uniforms.uRectOcclusal = { value: occlusalRect };
      shader.uniforms.uRectRight = { value: pentaTextures.rects.right };
      shader.uniforms.uRectLeft = { value: pentaTextures.rects.left };

      shader.uniforms.uArchMin = { value: archBox.min.clone() };
      shader.uniforms.uArchMax = { value: archBox.max.clone() };
      shader.uniforms.uCombMin = { value: combinedBox.min.clone() };
      shader.uniforms.uCombMax = { value: combinedBox.max.clone() };
    }

    shader.vertexShader =
      `
      varying vec3 vOccLocalPos;
      varying vec3 vOccLocalNormal;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vOccLocalPos = position;
        vOccLocalNormal = objectNormal;
        `
      );

    const pentaHeader = hasPenta
      ? `
      uniform sampler2D uTexFront;
      uniform sampler2D uTexOcclusal;
      uniform sampler2D uTexRight;
      uniform sampler2D uTexLeft;

      uniform vec4 uRectFront;
      uniform vec4 uRectOcclusal;
      uniform vec4 uRectRight;
      uniform vec4 uRectLeft;

      uniform vec3 uArchMin;
      uniform vec3 uArchMax;
      uniform vec3 uCombMin;
      uniform vec3 uCombMax;

      float pentaForegroundMask(vec4 col, vec2 uv, vec4 rect) {
        if (uv.x < rect.x - 0.005 || uv.x > rect.y + 0.005 || uv.y < rect.z - 0.005 || uv.y > rect.w + 0.005) {
          return 0.0;
        }
        if (col.a < 0.1) {
          return 0.0;
        }
        float maxC = max(col.r, max(col.g, col.b));
        float minC = min(col.r, min(col.g, col.b));
        float diff = maxC - minC;
        float lightBg = smoothstep(0.88, 0.98, minC) * (1.0 - smoothstep(0.04, 0.14, diff));
        float darkBg = (1.0 - smoothstep(0.06, 0.18, maxC)) * (1.0 - smoothstep(0.03, 0.08, diff));
        return clamp((1.0 - lightBg - darkBg) * col.a, 0.0, 1.0);
      }
      `
      : '';

    const pentaBlendBody = hasPenta
      ? `
        {
          vec3 P = vOccLocalPos;
          vec3 N = normalize(vOccLocalNormal);
          vec3 combSpan = max(uCombMax - uCombMin, vec3(0.001));
          vec3 archSpan = max(uArchMax - uArchMin, vec3(0.001));
          vec3 nComb = clamp((P - uCombMin) / combSpan, 0.0, 1.0);
          vec3 nArch = clamp((P - uArchMin) / archSpan, 0.0, 1.0);

          float vOcc = uIsUpper > 0.5
            ? mix(uRectOcclusal.w, uRectOcclusal.z, nArch.y)
            : mix(uRectOcclusal.z, uRectOcclusal.w, nArch.y);
          vec2 uvOcclusal = vec2(mix(uRectOcclusal.x, uRectOcclusal.y, nArch.x), vOcc);
          vec2 uvFront = vec2(mix(uRectFront.x, uRectFront.y, nComb.x), mix(uRectFront.z, uRectFront.w, nComb.z));
          vec2 uvRight = vec2(mix(uRectRight.y, uRectRight.x, nComb.y), mix(uRectRight.z, uRectRight.w, nComb.z));
          vec2 uvLeft  = vec2(mix(uRectLeft.x, uRectLeft.y, nComb.y), mix(uRectLeft.z, uRectLeft.w, nComb.z));

          vec4 texOcc = texture2D(uTexOcclusal, uvOcclusal);
          vec4 texFront = texture2D(uTexFront, uvFront);
          vec4 texRight = texture2D(uTexRight, uvRight);
          vec4 texLeft = texture2D(uTexLeft, uvLeft);

          vec3 colOcc = texOcc.rgb;
          vec3 colFront = texFront.rgb;
          vec3 colRight = texRight.rgb;
          vec3 colLeft = texLeft.rgb;

          float maskOcc = pentaForegroundMask(texOcc, uvOcclusal, uRectOcclusal);
          float maskFront = pentaForegroundMask(texFront, uvFront, uRectFront);
          float maskRight = pentaForegroundMask(texRight, uvRight, uRectRight);
          float maskLeft = pentaForegroundMask(texLeft, uvLeft, uRectLeft);

          vec2 archCenter = vec2(0.0, -14.0);
          vec2 radialDir = normalize(P.xy - archCenter + vec2(0.0001));
          vec2 horizNorm = normalize(N.xy + vec2(0.0001));
          float outward = smoothstep(0.05, 0.45, dot(radialDir, horizNorm));

          float isOcclusalZone = uIsUpper > 0.5
            ? (1.0 - smoothstep(5.0, 10.0, P.z))
            : smoothstep(-10.0, -5.0, P.z);

          float wFront = pow(max(0.0, -N.y), 1.6) * outward * (1.0 - smoothstep(-35.0, -18.0, P.y)) * maskFront;
          float wRight = pow(max(0.0, -N.x), 1.5) * outward * (1.0 - smoothstep(-16.0, -4.0, P.x)) * smoothstep(-42.0, -22.0, P.y) * maskRight;
          float wLeft  = pow(max(0.0,  N.x), 1.5) * outward * smoothstep(4.0, 16.0, P.x) * smoothstep(-42.0, -22.0, P.y) * maskLeft;
          float wOcc   = (pow(abs(N.z), 1.2) * 1.5 + max(0.0, 0.75 - outward) * 1.2 + 0.08) * isOcclusalZone * maskOcc;

          float totalW = wFront + wRight + wLeft + wOcc;
          vec3 gingivaBaseColor = vec3(0.82, 0.44, 0.50);
          vec3 fallbackColor = isOcclusalZone > 0.5 ? vec3(0.92, 0.88, 0.82) : gingivaBaseColor;

          if (totalW > 0.001) {
            diffuseColor.rgb = (colFront * wFront + colRight * wRight + colLeft * wLeft + colOcc * wOcc) / totalW;
          } else if (maskOcc > 0.01 && isOcclusalZone > 0.1) {
            diffuseColor.rgb = colOcc;
          } else {
            diffuseColor.rgb = fallbackColor;
          }
        }
      `
      : '';

    shader.fragmentShader =
      pentaHeader +
      `
      uniform sampler2D uOpposingTex;
      uniform vec3 uBoundsMin;
      uniform vec3 uBoundsMax;
      uniform mat4 uLowerMatrix;
      uniform mat4 uLowerInvMatrix;
      uniform float uUpperZOffset;
      uniform float uMaxRangeMm;
      uniform float uIsUpper;

      varying vec3 vOccLocalPos;
      varying vec3 vOccLocalNormal;

      vec3 occlusogramHeatColor(float d, float maxR) {
        if (d <= 0.0) {
          return vec3(0.94, 0.15, 0.22); // Heavy contact / collision red
        }
        if (d <= 0.25) {
          return mix(vec3(0.94, 0.15, 0.22), vec3(0.98, 0.48, 0.08), d / 0.25);
        }
        if (d <= 0.55) {
          return mix(vec3(0.98, 0.48, 0.08), vec3(0.92, 0.78, 0.05), (d - 0.25) / 0.30);
        }
        if (d <= 0.95) {
          return mix(vec3(0.92, 0.78, 0.05), vec3(0.12, 0.78, 0.36), (d - 0.55) / 0.40);
        }
        return mix(vec3(0.12, 0.78, 0.36), vec3(0.02, 0.65, 0.92), clamp((d - 0.95) / max(0.15, maxR - 0.95), 0.0, 1.0));
      }
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        ` +
        pentaBlendBody +
        `
        {
          vec3 N = normalize(vOccLocalNormal);
          // Only shade occlusal-facing surfaces
          float occFacing = uIsUpper > 0.5
            ? smoothstep(0.15, -0.25, N.z) * smoothstep(7.5, 4.0, vOccLocalPos.z)
            : smoothstep(-0.15, 0.25, N.z) * smoothstep(-5.5, -2.0, vOccLocalPos.z);

          if (occFacing > 0.01) {
            vec3 span = max(uBoundsMax - uBoundsMin, vec3(0.001));
            float clearance = 99.0;
            float validSample = 0.0;

            if (uIsUpper > 0.5) {
              vec3 worldUpper = vec3(vOccLocalPos.x, vOccLocalPos.y, vOccLocalPos.z + uUpperZOffset);
              vec3 lowerLocal = (uLowerInvMatrix * vec4(worldUpper, 1.0)).xyz;
              vec2 uv = (lowerLocal.xy - uBoundsMin.xy) / span.xy;
              if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                vec4 enc = texture2D(uOpposingTex, uv);
                if (enc.a > 0.5) {
                  float normZ = (enc.r * 255.0 * 256.0 + enc.g * 255.0) / 65535.0;
                  float oppLocalZ = uBoundsMin.z + normZ * span.z;
                  clearance = lowerLocal.z - oppLocalZ;
                  validSample = 1.0;
                }
              }
            } else {
              vec3 worldLower = (uLowerMatrix * vec4(vOccLocalPos, 1.0)).xyz;
              vec2 uv = (worldLower.xy - uBoundsMin.xy) / span.xy;
              if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                vec4 enc = texture2D(uOpposingTex, uv);
                if (enc.a > 0.5) {
                  float normZ = (enc.r * 255.0 * 256.0 + enc.g * 255.0) / 65535.0;
                  float upperZ = uBoundsMin.z + normZ * span.z + uUpperZOffset;
                  clearance = upperZ - worldLower.z;
                  validSample = 1.0;
                }
              }
            }

            if (validSample > 0.5 && clearance <= uMaxRangeMm) {
              vec3 heatCol = occlusogramHeatColor(clearance, uMaxRangeMm);
              float fade = 1.0 - smoothstep(uMaxRangeMm * 0.78, uMaxRangeMm, clearance);
              diffuseColor.rgb = mix(diffuseColor.rgb, heatCol, occFacing * clamp(fade + 0.15, 0.0, 1.0));
            }
          }
        }
        `
      );
  };

  mat.customProgramCacheKey = () =>
    `dentalcad-occlusogram-${isUpper ? 'u' : 'l'}-${wireframe ? 'w' : 's'}-${hasPenta ? 'p' : 'n'}-${baseRoughness}-${baseTransmission}`;

  return {
    material: mat,
    updateKinematicsUniforms: (lowerMat, lowerInvMat, upperZ, maxRange) => {
      uniformsRef.uLowerMatrix.value.copy(lowerMat);
      uniformsRef.uLowerInvMatrix.value.copy(lowerInvMat);
      uniformsRef.uUpperZOffset.value = upperZ;
      uniformsRef.uMaxRangeMm.value = maxRange;
    },
  };
}
