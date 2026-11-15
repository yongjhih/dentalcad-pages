import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type SupportedMeshFormat = 'stl' | 'ply' | 'obj';

/**
 * Infers the 3D mesh format ('stl' | 'ply' | 'obj') from a filename, URL, or buffer header.
 */
export function detectMeshFormat(
  urlOrFilename?: string,
  buffer?: ArrayBuffer
): SupportedMeshFormat {
  if (urlOrFilename) {
    const clean = urlOrFilename.split('?')[0].split('#')[0].toLowerCase();
    if (clean.endsWith('.ply')) return 'ply';
    if (clean.endsWith('.obj')) return 'obj';
    if (clean.endsWith('.stl')) return 'stl';
  }

  if (buffer && buffer.byteLength >= 16) {
    const header = new TextDecoder('utf-8', { fatal: false })
      .decode(new Uint8Array(buffer, 0, Math.min(128, buffer.byteLength)))
      .trimStart()
      .toLowerCase();
    if (header.startsWith('ply')) return 'ply';
    if (
      header.startsWith('#') ||
      header.startsWith('v ') ||
      header.startsWith('o ') ||
      header.startsWith('g ') ||
      header.startsWith('mtllib ')
    ) {
      return 'obj';
    }
  }

  return 'stl';
}

/**
 * Parses an ArrayBuffer into a `THREE.BufferGeometry` supporting `.stl`, `.ply`, and `.obj` formats.
 * Guarantees vertex normals and bounding box are computed.
 */
export function parseMeshGeometryBuffer(
  buffer: ArrayBuffer,
  formatHint?: SupportedMeshFormat | string
): THREE.BufferGeometry {
  const fmt: SupportedMeshFormat =
    formatHint === 'ply' || formatHint === 'obj' || formatHint === 'stl'
      ? formatHint
      : detectMeshFormat(formatHint, buffer);

  let geometry: THREE.BufferGeometry;

  if (fmt === 'ply') {
    const loader = new PLYLoader();
    geometry = loader.parse(buffer);
  } else if (fmt === 'obj') {
    const loader = new OBJLoader();
    const text = new TextDecoder('utf-8').decode(buffer);
    const group = loader.parse(text);
    const geometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          geometries.push(mesh.geometry.clone());
        }
      }
    });
    if (geometries.length === 0) {
      geometry = new THREE.BufferGeometry();
    } else if (geometries.length === 1) {
      geometry = geometries[0];
    } else {
      geometry = mergeGeometries(geometries, false) || geometries[0];
    }
  } else {
    const loader = new STLLoader();
    geometry = loader.parse(buffer);
  }

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Asynchronously loads a 3D mesh URL (`http(s):`, `blob:`, or relative path) into a `THREE.BufferGeometry`.
 * Supports `.stl`, `.ply`, and `.obj`.
 */
export async function loadMeshGeometryFromUrl(
  url: string,
  filenameHint?: string
): Promise<THREE.BufferGeometry> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch 3D mesh (${response.status}): ${url}`);
  }
  const buffer = await response.arrayBuffer();
  const format = detectMeshFormat(filenameHint || url, buffer);
  return parseMeshGeometryBuffer(buffer, format);
}
