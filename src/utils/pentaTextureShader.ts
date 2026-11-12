import * as THREE from 'three';
import { ClinicalPhoto } from '../types/dental';

export interface LoadedPentaTextures {
  front?: THREE.Texture;
  upper?: THREE.Texture;
  lower?: THREE.Texture;
  right?: THREE.Texture;
  left?: THREE.Texture;
  rects: {
    front: THREE.Vector4;
    upper: THREE.Vector4;
    lower: THREE.Vector4;
    right: THREE.Vector4;
    left: THREE.Vector4;
  };
}

/**
 * Scan an image on an offscreen canvas to find the normalized WebGL UV bounding box
 * [uMin, uMax, vMin, vMax] of non-white pixels (the dental model silhouette).
 */
export function computeImageContentUVRect(img: HTMLImageElement): THREE.Vector4 {
  try {
    const w = 480;
    const h = Math.max(1, Math.round((img.height / img.width) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Vector4(0.15, 0.85, 0.15, 0.85);

    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Non-white and non-transparent pixel (exact logic from 7c782036)
        if (a > 20 && (r < 245 || g < 245 || b < 245)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found || maxX <= minX || maxY <= minY) {
      return new THREE.Vector4(0.15, 0.85, 0.15, 0.85);
    }

    const uMin = minX / w;
    const uMax = maxX / w;
    // WebGL flipY = true: v=0 is bottom (y=h), v=1 is top (y=0)
    const vMin = 1.0 - maxY / h;
    const vMax = 1.0 - minY / h;

    return new THREE.Vector4(uMin, uMax, vMin, vMax);
  } catch {
    return new THREE.Vector4(0.15, 0.85, 0.15, 0.85);
  }
}

function loadSingleTextureWithRect(
  url?: string
): Promise<{ texture?: THREE.Texture; rect: THREE.Vector4 }> {
  if (!url) {
    return Promise.resolve({ rect: new THREE.Vector4(0, 1, 0, 1) });
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rect = computeImageContentUVRect(img);
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      resolve({ texture: tex, rect });
    };
    img.onerror = () => {
      resolve({ rect: new THREE.Vector4(0, 1, 0, 1) });
    };
    img.src = url;
  });
}

/**
 * Load all 5 penta view textures from ClinicalPhoto array and compute their content bounding rects
 */
export async function loadPentaViewTextures(
  photos: ClinicalPhoto[]
): Promise<LoadedPentaTextures> {
  const findSrc = (id: string) => photos.find((p) => p.id === id)?.src;

  const [frontRes, upperRes, lowerRes, rightRes, leftRes] = await Promise.all([
    loadSingleTextureWithRect(findSrc('front')),
    loadSingleTextureWithRect(findSrc('upper')),
    loadSingleTextureWithRect(findSrc('lower')),
    loadSingleTextureWithRect(findSrc('patientright')),
    loadSingleTextureWithRect(findSrc('patientleft')),
  ]);

  return {
    front: frontRes.texture,
    upper: upperRes.texture,
    lower: lowerRes.texture,
    right: rightRes.texture,
    left: leftRes.texture,
    rects: {
      front: frontRes.rect,
      upper: upperRes.rect,
      lower: lowerRes.rect,
      right: rightRes.rect,
      left: leftRes.rect,
    },
  };
}

/**
 * Pure helper to compute the exact WebGL UV coordinates for each of the 5 clinical views
 * given a 3D vertex position P, arch bounding box, and combined bounding box.
 * Exported for deterministic unit testing of 3D-to-2D orthographic registration.
 */
export function computePentaProjectedUVs(params: {
  point: { x: number; y: number; z: number };
  isUpper: boolean;
  archMin: { x: number; y: number; z: number };
  archMax: { x: number; y: number; z: number };
  combMin: { x: number; y: number; z: number };
  combMax: { x: number; y: number; z: number };
  rects: {
    front: { x: number; y: number; z: number; w: number };
    occlusal: { x: number; y: number; z: number; w: number };
    right: { x: number; y: number; z: number; w: number };
    left: { x: number; y: number; z: number; w: number };
  };
}) {
  const { point: P, isUpper, archMin, archMax, combMin, combMax, rects } = params;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;

  const nArch = {
    x: clamp01((P.x - archMin.x) / Math.max(0.001, archMax.x - archMin.x)),
    y: clamp01((P.y - archMin.y) / Math.max(0.001, archMax.y - archMin.y)),
    z: clamp01((P.z - archMin.z) / Math.max(0.001, archMax.z - archMin.z)),
  };

  const nComb = {
    x: clamp01((P.x - combMin.x) / Math.max(0.001, combMax.x - combMin.x)),
    y: clamp01((P.y - combMin.y) / Math.max(0.001, combMax.y - combMin.y)),
    z: clamp01((P.z - combMin.z) / Math.max(0.001, combMax.z - combMin.z)),
  };

  // In STL coordinates:
  // - Anterior (Incisors) is at Y_min (-47.4 mm, nY = 0.0)
  // - Posterior (Molars) is at Y_max (+10.7 mm, nY = 1.0)
  // - Patient Right is at X_min (-32.3 mm, nX = 0.0)
  // - Patient Left is at X_max (+34.9 mm, nX = 1.0)
  //
  // 1. Upper Occlusal (penta_upper): Anterior (nY=0) is at TOP (vMax = w), Posterior (nY=1) is at BOTTOM (vMin = z)
  // 2. Lower Occlusal (penta_lower): Anterior (nY=0) is at BOTTOM (vMin = z), Posterior (nY=1) is at TOP (vMax = w)
  const uvOcclusal = {
    u: mix(rects.occlusal.x, rects.occlusal.y, nArch.x),
    v: isUpper
      ? mix(rects.occlusal.w, rects.occlusal.z, nArch.y)
      : mix(rects.occlusal.z, rects.occlusal.w, nArch.y),
  };

  // 3. Front (penta_front): X_min (nX=0) is LEFT (uMin = x), X_max (nX=1) is RIGHT (uMax = y)
  const uvFront = {
    u: mix(rects.front.x, rects.front.y, nComb.x),
    v: mix(rects.front.z, rects.front.w, nComb.z),
  };

  // 4. Right Buccal (penta_patientright, X < 0 side):
  //    Anterior (nY=0) is on the RIGHT (uMax = y), Posterior (nY=1) is on the LEFT (uMin = x)
  const uvRight = {
    u: mix(rects.right.y, rects.right.x, nComb.y),
    v: mix(rects.right.z, rects.right.w, nComb.z),
  };

  // 5. Left Buccal (penta_patientleft, X > 0 side):
  //    Anterior (nY=0) is on the LEFT (uMin = x), Posterior (nY=1) is on the RIGHT (uMax = y)
  const uvLeft = {
    u: mix(rects.left.x, rects.left.y, nComb.y),
    v: mix(rects.left.z, rects.left.w, nComb.z),
  };

  return { uvOcclusal, uvFront, uvRight, uvLeft };
}

/**
 * Create a Three.js MeshPhysicalMaterial that projects the 5-view clinical photos
 * onto the 3D upper or lower dental arch using multi-view normal-weighted projection.
 */
export function createPentaTexturedMaterial(params: {
  isUpper: boolean;
  textures: LoadedPentaTextures;
  archBox: THREE.Box3;
  combinedBox: THREE.Box3;
  wireframe: boolean;
  clippingPlanes: THREE.Plane[];
}): THREE.MeshPhysicalMaterial {
  const { isUpper, textures, archBox, combinedBox, wireframe, clippingPlanes } = params;

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.02,
    clearcoat: 0.38,
    clearcoatRoughness: 0.22,
    ior: 1.52,
    side: THREE.DoubleSide,
    wireframe,
  });
  mat.clippingPlanes = clippingPlanes;

  const occlusalTex = isUpper ? textures.upper : textures.lower;
  const occlusalRect = isUpper ? textures.rects.upper : textures.rects.lower;

  // Fallback 2x2 white texture if any view is missing
  const dummyCanvas = document.createElement('canvas');
  dummyCanvas.width = 2;
  dummyCanvas.height = 2;
  const dummyTex = new THREE.CanvasTexture(dummyCanvas);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTexFront = { value: textures.front || dummyTex };
    shader.uniforms.uTexOcclusal = { value: occlusalTex || dummyTex };
    shader.uniforms.uTexRight = { value: textures.right || dummyTex };
    shader.uniforms.uTexLeft = { value: textures.left || dummyTex };

    shader.uniforms.uRectFront = { value: textures.rects.front };
    shader.uniforms.uRectOcclusal = { value: occlusalRect };
    shader.uniforms.uRectRight = { value: textures.rects.right };
    shader.uniforms.uRectLeft = { value: textures.rects.left };

    shader.uniforms.uArchMin = { value: archBox.min.clone() };
    shader.uniforms.uArchMax = { value: archBox.max.clone() };
    shader.uniforms.uCombMin = { value: combinedBox.min.clone() };
    shader.uniforms.uCombMax = { value: combinedBox.max.clone() };
    shader.uniforms.uIsUpper = { value: isUpper ? 1.0 : 0.0 };

    shader.vertexShader =
      `
      varying vec3 vStlPos;
      varying vec3 vStlNormal;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vStlPos = position;
        vStlNormal = objectNormal;
        `
      );

    shader.fragmentShader =
      `
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
      uniform float uIsUpper;

      varying vec3 vStlPos;
      varying vec3 vStlNormal;

      // Return foreground weight with smooth feathered borders (eliminates jagged edge clipping)
      float pentaForegroundMask(vec4 col, vec2 uv, vec4 rect) {
        float edgeX = smoothstep(rect.x, rect.x + 0.012, uv.x) * (1.0 - smoothstep(rect.y - 0.012, rect.y, uv.x));
        float edgeY = smoothstep(rect.z, rect.z + 0.012, uv.y) * (1.0 - smoothstep(rect.w - 0.012, rect.w, uv.y));
        float borderWeight = edgeX * edgeY;
        if (borderWeight < 0.001 || col.a < 0.1) {
          return 0.0;
        }
        float minChannel = min(col.r, min(col.g, col.b));
        return (1.0 - smoothstep(0.90, 0.965, minChannel)) * col.a * borderWeight;
      }
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        {
          vec3 P = vStlPos;
          vec3 N = normalize(vStlNormal);

          vec3 combSpan = max(uCombMax - uCombMin, vec3(0.001));
          vec3 archSpan = max(uArchMax - uArchMin, vec3(0.001));

          vec3 nComb = clamp((P - uCombMin) / combSpan, 0.0, 1.0);
          vec3 nArch = clamp((P - uArchMin) / archSpan, 0.0, 1.0);

          // 1. Occlusal UV (penta_upper has Anterior nArch.y=0 at TOP vMax=w;
          //                 penta_lower has Anterior nArch.y=0 at BOTTOM vMin=z)
          float vOcc = uIsUpper > 0.5
            ? mix(uRectOcclusal.w, uRectOcclusal.z, nArch.y)
            : mix(uRectOcclusal.z, uRectOcclusal.w, nArch.y);
          vec2 uvOcclusal = vec2(
            mix(uRectOcclusal.x, uRectOcclusal.y, nArch.x),
            vOcc
          );

          // 2. Front UV (Anterior is -Y looking toward +Y; X_min is left, X_max is right)
          vec2 uvFront = vec2(
            mix(uRectFront.x, uRectFront.y, nComb.x),
            mix(uRectFront.z, uRectFront.w, nComb.z)
          );

          // 3. Right Buccal UV (X < 0 side: Anterior nComb.y=0 is on the RIGHT uMax=y)
          vec2 uvRight = vec2(
            mix(uRectRight.y, uRectRight.x, nComb.y),
            mix(uRectRight.z, uRectRight.w, nComb.z)
          );

          // 4. Left Buccal UV (X > 0 side: Anterior nComb.y=0 is on the LEFT uMin=x)
          vec2 uvLeft = vec2(
            mix(uRectLeft.x, uRectLeft.y, nComb.y),
            mix(uRectLeft.z, uRectLeft.w, nComb.z)
          );

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

          // Determine outward labial/buccal orientation from palatal/lingual arch center (0, -14)
          vec2 archCenter = vec2(0.0, -14.0);
          vec2 radialDir = normalize(P.xy - archCenter + vec2(0.0001));
          vec2 horizNorm = normalize(N.xy + vec2(0.0001));
          float outward = smoothstep(0.05, 0.45, dot(radialDir, horizNorm));

          // Guard against closed-bite overlap near the occlusal plane (Z ≈ 0) in side/front views
          float archZMask = uIsUpper > 0.5
            ? smoothstep(-0.2, 2.5, P.z)
            : smoothstep(0.2, -2.2, P.z);

          // Directional weights:
          // Front: Anterior is -Y (labial faces -Y so -N.y > 0)
          float wFront = pow(max(0.0, -N.y), 1.5) * outward * (1.0 - smoothstep(-32.0, -18.0, P.y)) * archZMask * maskFront;
          // Right Buccal: Patient Right is -X (buccal faces -X so -N.x > 0)
          float wRight = pow(max(0.0, -N.x), 1.5) * outward * (1.0 - smoothstep(-14.0, -4.0, P.x)) * archZMask * maskRight;
          // Left Buccal: Patient Left is +X (buccal faces +X so N.x > 0)
          float wLeft  = pow(max(0.0,  N.x), 1.5) * outward * smoothstep( 4.0,  14.0, P.x) * archZMask * maskLeft;
          // Occlusal: Top/bottom occlusal table + lingual/palatal anatomy
          float wOcc   = (pow(abs(N.z), 0.9) + (1.0 - outward * archZMask) * 1.15 + 0.18) * maskOcc;

          float totalW = wFront + wRight + wLeft + wOcc;
          vec3 fallbackColor = vec3(0.88, 0.78, 0.74);

          vec3 blended = totalW > 0.001
            ? (colFront * wFront + colRight * wRight + colLeft * wLeft + colOcc * wOcc) / totalW
            : (maskOcc > 0.01 ? colOcc : fallbackColor);

          diffuseColor.rgb = blended;
        }
        `
      );
  };

  mat.customProgramCacheKey = () => `penta-tex-${isUpper ? 'u' : 'l'}-${wireframe ? 'w' : 's'}`;
  return mat;
}
