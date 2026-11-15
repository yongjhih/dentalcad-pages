import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import {
  ViewportSettings,
  SegmentedToothInfo,
} from '../types/dental';
import { MandibularKinematicsResult } from '../utils/articulatorKinematics';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  segmentArchGeometryTeeth,
  restoreNativeGeometryBeforeEdits,
  extractToothCrownGeometry,
  createGingivaBaseGeometry,
  createLibraryToothGeometry,
} from '../utils/modelEditor';

export interface UseModelEditorEffectParams {
  settings: ViewportSettings;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  upperMeshRef: React.MutableRefObject<THREE.Mesh | null>;
  lowerMeshRef: React.MutableRefObject<THREE.Mesh | null>;
  nativeUpperGroupRef: React.MutableRefObject<THREE.Group | null>;
  nativeLowerGroupRef: React.MutableRefObject<THREE.Group | null>;
  placedUpperGroupRef: React.MutableRefObject<THREE.Group | null>;
  placedLowerGroupRef: React.MutableRefObject<THREE.Group | null>;
  editorGizmoGroupRef: React.MutableRefObject<THREE.Group | null>;
  clippingPlaneRef: React.MutableRefObject<THREE.Plane | null>;
  mapsReady: boolean;
  currentKinematics: MandibularKinematicsResult;
  createDentalMaterial: (isUpper: boolean, geometry?: THREE.BufferGeometry) => THREE.Material;
  onSegmentedTeethComputed?: (teeth: SegmentedToothInfo[]) => void;
}

export function useModelEditorEffect({
  settings,
  upperMeshRef,
  lowerMeshRef,
  nativeUpperGroupRef,
  nativeLowerGroupRef,
  placedUpperGroupRef,
  placedLowerGroupRef,
  editorGizmoGroupRef,
  clippingPlaneRef,
  mapsReady,
  currentKinematics,
  createDentalMaterial,
  onSegmentedTeethComputed,
}: UseModelEditorEffectParams): SegmentedToothInfo[] {
  const [segmentedTeeth, setSegmentedTeeth] = useState<SegmentedToothInfo[]>([]);
  const modelEdit = settings.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;

  // Geometry caches for discrete tooth crown objects & gingiva bases
  const upperCrownCacheRef = useRef<Map<number, THREE.BufferGeometry>>(new Map());
  const lowerCrownCacheRef = useRef<Map<number, THREE.BufferGeometry>>(new Map());
  const upperGingivaBaseCacheRef = useRef<THREE.BufferGeometry | null>(null);
  const lowerGingivaBaseCacheRef = useRef<THREE.BufferGeometry | null>(null);

  // 1. Automatically segment 28 FDI teeth across Upper & Lower arches when STL meshes are ready
  useEffect(() => {
    if (!mapsReady) return;
    const upperGeom = upperMeshRef.current?.geometry;
    const lowerGeom = lowerMeshRef.current?.geometry;
    if (!upperGeom || !lowerGeom) return;

    // Reset caches on fresh mesh load
    upperCrownCacheRef.current.clear();
    lowerCrownCacheRef.current.clear();
    upperGingivaBaseCacheRef.current = null;
    lowerGingivaBaseCacheRef.current = null;

    restoreNativeGeometryBeforeEdits(upperGeom);
    restoreNativeGeometryBeforeEdits(lowerGeom);

    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const lowerTeeth = segmentArchGeometryTeeth(lowerGeom, false);
    const allTeeth = [...upperTeeth, ...lowerTeeth];
    setSegmentedTeeth(allTeeth);
    onSegmentedTeethComputed?.(allTeeth);
  }, [mapsReady, upperMeshRef, lowerMeshRef, onSegmentedTeethComputed]);

  // 2. Build and update Discrete Native Tooth Objects & Gingiva Base Mesh
  useEffect(() => {
    if (!mapsReady || segmentedTeeth.length === 0) return;
    const upperMesh = upperMeshRef.current;
    const lowerMesh = lowerMeshRef.current;
    const nativeUpperGroup = nativeUpperGroupRef.current;
    const nativeLowerGroup = nativeLowerGroupRef.current;
    if (!upperMesh || !lowerMesh || !nativeUpperGroup || !nativeLowerGroup) return;

    const clearGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0] as THREE.Mesh;
        group.remove(child);
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    };

    if (!modelEdit.enabled) {
      clearGroup(nativeUpperGroup);
      clearGroup(nativeLowerGroup);
      restoreNativeGeometryBeforeEdits(upperMesh.geometry);
      restoreNativeGeometryBeforeEdits(lowerMesh.geometry);
      upperMesh.visible = settings.showUpper;
      lowerMesh.visible = settings.showLower;
      return;
    }

    // A. Gingiva Base Mesh setup (alveolar mucosa underneath teeth)
    const forceAllRecessed = modelEdit.showToothObjects === false;
    const gingivaUpper = createGingivaBaseGeometry(
      upperMesh.geometry,
      segmentedTeeth,
      true,
      modelEdit.nativeEdits,
      forceAllRecessed
    );
    const gingivaLower = createGingivaBaseGeometry(
      lowerMesh.geometry,
      segmentedTeeth,
      false,
      modelEdit.nativeEdits,
      forceAllRecessed
    );

    const showGingiva = modelEdit.showGingivaBase !== false;
    upperMesh.visible = settings.showUpper && showGingiva;
    lowerMesh.visible = settings.showLower && showGingiva;

    const posGU = gingivaUpper.getAttribute('position');
    const colGU = gingivaUpper.getAttribute('color');
    if (posGU && upperMesh.geometry) {
      upperMesh.geometry.setAttribute('position', posGU);
      if (colGU) upperMesh.geometry.setAttribute('color', colGU);
      upperMesh.geometry.computeVertexNormals();
    }
    const posGL = gingivaLower.getAttribute('position');
    const colGL = gingivaLower.getAttribute('color');
    if (posGL && lowerMesh.geometry) {
      lowerMesh.geometry.setAttribute('position', posGL);
      if (colGL) lowerMesh.geometry.setAttribute('color', colGL);
      lowerMesh.geometry.computeVertexNormals();
    }

    // Refresh gingiva material with healthy mucosal coral-rose shading
    if (!settings.modelDiff?.enabled) {
      upperMesh.material = createDentalMaterial(true, upperMesh.geometry);
      lowerMesh.material = createDentalMaterial(false, lowerMesh.geometry);
    }

    // B. Discrete Native Tooth Objects setup
    const clippingPlanes =
      settings.clippingEnabled && clippingPlaneRef.current ? [clippingPlaneRef.current] : [];
    const showTeeth = modelEdit.showToothObjects !== false;

    const syncArchTeeth = (isUpper: boolean, group: THREE.Group) => {
      const archTeeth = segmentedTeeth.filter((t) => t.isUpper === isUpper);
      const cache = isUpper ? upperCrownCacheRef.current : lowerCrownCacheRef.current;
      const origMesh = isUpper ? upperMeshRef.current : lowerMeshRef.current;
      const origGeom = origMesh?.geometry;

      for (const t of archTeeth) {
        let crownGeom = cache.get(t.fdi);
        if (!crownGeom && origGeom) {
          // Extract the exact anatomical tooth crown from the original scan model
          crownGeom = extractToothCrownGeometry(origGeom, t);
          cache.set(t.fdi, crownGeom);
        }
        if (!crownGeom) continue;

        let toothMesh = group.children.find(
          (c) => (c as THREE.Mesh).userData?.fdi === t.fdi
        ) as THREE.Mesh | undefined;

        const edit = modelEdit.nativeEdits[t.fdi];
        const isDeleted = Boolean(edit?.deleted);
        const isSelected =
          modelEdit.selectedTarget?.kind === 'native' &&
          modelEdit.selectedTarget.fdi === t.fdi;
        const isMoved = Boolean(
          edit &&
          !isDeleted &&
          (Math.hypot(edit.offsetMm.x, edit.offsetMm.y, edit.offsetMm.z) > 0.35 ||
            Math.abs(edit.rotationDeg) > 0.5 ||
            Math.abs(edit.scale - 1.0) > 0.05)
        );

        if (!toothMesh) {
          const mat = new THREE.MeshPhysicalMaterial({
            color: isSelected ? 0xf0e8ff : 0xfcfaf2,
            emissive: isSelected ? 0x8b5cf6 : 0x000000,
            emissiveIntensity: isSelected ? 0.38 : 0,
            vertexColors: true,
            roughness: 0.22,
            metalness: 0.04,
            clearcoat: 0.55,
            clearcoatRoughness: 0.16,
            ior: 1.54,
            side: THREE.DoubleSide,
            wireframe: settings.wireframeOverlay || settings.shadingMode === 'wireframe',
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -2,
          });
          mat.clippingPlanes = clippingPlanes;

          toothMesh = new THREE.Mesh(crownGeom, mat);
          toothMesh.name = `tooth-${t.fdi}`;
          toothMesh.userData = {
            isNativeTooth: true,
            fdi: t.fdi,
            isUpper: t.isUpper,
            labelZh: t.labelZh,
            labelEn: t.labelEn,
          };
          group.add(toothMesh);
        } else {
          if (toothMesh.geometry !== crownGeom) {
            toothMesh.geometry = crownGeom;
          }
          const mat = toothMesh.material as THREE.MeshPhysicalMaterial;
          mat.color.setHex(isSelected ? 0xf0e8ff : 0xfcfaf2);
          mat.emissive.setHex(isSelected ? 0x8b5cf6 : 0x000000);
          mat.emissiveIntensity = isSelected ? 0.38 : 0;
          mat.wireframe = settings.wireframeOverlay || settings.shadingMode === 'wireframe';
          mat.clippingPlanes = clippingPlanes;
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -1;
          mat.polygonOffsetUnits = -2;
        }

        const ox = edit && !isDeleted ? edit.offsetMm.x : 0;
        const oy = edit && !isDeleted ? edit.offsetMm.y : 0;
        const oz = edit && !isDeleted ? edit.offsetMm.z : 0;
        const rotDeg = edit && !isDeleted ? edit.rotationDeg : 0;
        const scale = edit && !isDeleted ? edit.scale : 1.0;

        toothMesh.position.set(t.center.x + ox, t.center.y + oy, t.center.z + oz);
        toothMesh.rotation.set(0, 0, (rotDeg * Math.PI) / 180);
        toothMesh.scale.setScalar(scale);

        // Discrete tooth object visibility:
        // - Hidden if deleted
        // - Shown if moved (displaced from socket)
        // - Shown if selected (with emissive purple highlight)
        // - Shown if gingiva base is hidden (!showGingiva)
        // - Or if tooth objects are requested
        const shouldBeVisible =
          showTeeth &&
          !isDeleted &&
          (isMoved || isSelected || !showGingiva);

        toothMesh.visible = shouldBeVisible;
      }
    };

    syncArchTeeth(true, nativeUpperGroup);
    syncArchTeeth(false, nativeLowerGroup);
  }, [
    mapsReady,
    segmentedTeeth,
    modelEdit.enabled,
    modelEdit.selectedTarget,
    modelEdit.nativeEdits,
    modelEdit.showToothObjects,
    modelEdit.showGingivaBase,
    settings.showUpper,
    settings.showLower,
    settings.modelDiff?.enabled,
    settings.wireframeOverlay,
    settings.shadingMode,
    settings.clippingEnabled,
    upperMeshRef,
    lowerMeshRef,
    nativeUpperGroupRef,
    nativeLowerGroupRef,
    clippingPlaneRef,
    createDentalMaterial,
  ]);

  // 3. Render Placed / Pasted Library Teeth in Upper & Lower groups
  useEffect(() => {
    const upperGroup = placedUpperGroupRef.current;
    const lowerGroup = placedLowerGroupRef.current;
    if (!upperGroup || !lowerGroup) return;

    const clearGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0] as THREE.Mesh;
        group.remove(child);
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    };

    clearGroup(upperGroup);
    clearGroup(lowerGroup);

    const placedTeeth = modelEdit.placedTeeth || [];
    if (placedTeeth.length === 0) return;

    const clippingPlanes =
      settings.clippingEnabled && clippingPlaneRef.current ? [clippingPlaneRef.current] : [];

    for (const item of placedTeeth) {
      const baseGeom = createLibraryToothGeometry(item.morphology, item.isUpper);
      const isSelected =
        modelEdit.enabled &&
        modelEdit.selectedTarget?.kind === 'placed' &&
        modelEdit.selectedTarget.placedId === item.id;

      const mat = new THREE.MeshPhysicalMaterial({
        color: isSelected ? 0xe0f2fe : 0xffffff,
        emissive: isSelected ? 0x0284c7 : 0x000000,
        emissiveIntensity: isSelected ? 0.28 : 0,
        vertexColors: true,
        roughness: 0.24,
        metalness: 0.04,
        clearcoat: 0.55,
        clearcoatRoughness: 0.16,
        ior: 1.55,
        side: THREE.DoubleSide,
        wireframe: settings.wireframeOverlay || settings.shadingMode === 'wireframe',
      });
      mat.clippingPlanes = clippingPlanes;

      const mesh = new THREE.Mesh(baseGeom, mat);
      mesh.position.set(item.position.x, item.position.y, item.position.z);
      mesh.rotation.set(0, 0, (item.rotationDeg * Math.PI) / 180);
      mesh.scale.setScalar(item.scale);
      mesh.userData = {
        placedToothId: item.id,
        isUpper: item.isUpper,
      };

      if (item.isUpper) {
        upperGroup.add(mesh);
      } else {
        lowerGroup.add(mesh);
      }
    }
  }, [
    modelEdit.placedTeeth,
    modelEdit.enabled,
    modelEdit.selectedTarget,
    settings.wireframeOverlay,
    settings.shadingMode,
    settings.clippingEnabled,
    placedUpperGroupRef,
    placedLowerGroupRef,
    clippingPlaneRef,
  ]);

  // 4. Synchronize Native Teeth, Placed Teeth & Selection Gizmo with 6-DOF Mandibular Kinematics
  useEffect(() => {
    const nativeUpper = nativeUpperGroupRef.current;
    const nativeLower = nativeLowerGroupRef.current;
    const upperGroup = placedUpperGroupRef.current;
    const lowerGroup = placedLowerGroupRef.current;
    const gizmoGroup = editorGizmoGroupRef.current;

    if (nativeUpper) {
      nativeUpper.visible = settings.showUpper && modelEdit.enabled;
      nativeUpper.position.set(
        currentKinematics.upperPosition.x,
        currentKinematics.upperPosition.y,
        currentKinematics.upperPosition.z
      );
      nativeUpper.rotation.set(
        currentKinematics.upperRotation.x,
        currentKinematics.upperRotation.y,
        currentKinematics.upperRotation.z
      );
    }

    if (nativeLower) {
      nativeLower.visible = settings.showLower && modelEdit.enabled;
      nativeLower.position.set(
        currentKinematics.lowerPosition.x,
        currentKinematics.lowerPosition.y,
        currentKinematics.lowerPosition.z
      );
      nativeLower.rotation.set(
        currentKinematics.lowerRotation.x,
        currentKinematics.lowerRotation.y,
        currentKinematics.lowerRotation.z
      );
    }

    if (upperGroup) {
      upperGroup.visible = settings.showUpper;
      upperGroup.position.set(
        currentKinematics.upperPosition.x,
        currentKinematics.upperPosition.y,
        currentKinematics.upperPosition.z
      );
      upperGroup.rotation.set(
        currentKinematics.upperRotation.x,
        currentKinematics.upperRotation.y,
        currentKinematics.upperRotation.z
      );
    }

    if (lowerGroup) {
      lowerGroup.visible = settings.showLower;
      lowerGroup.position.set(
        currentKinematics.lowerPosition.x,
        currentKinematics.lowerPosition.y,
        currentKinematics.lowerPosition.z
      );
      lowerGroup.rotation.set(
        currentKinematics.lowerRotation.x,
        currentKinematics.lowerRotation.y,
        currentKinematics.lowerRotation.z
      );
    }

    if (!gizmoGroup) return;
    while (gizmoGroup.children.length > 0) {
      const child = gizmoGroup.children[0] as THREE.Mesh | THREE.Line;
      gizmoGroup.remove(child);
      child.geometry?.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    if (!modelEdit.enabled || !modelEdit.selectedTarget) {
      gizmoGroup.visible = false;
      return;
    }

    let localPos: THREE.Vector3 | null = null;
    let radius = 4.6;
    let isUpper = true;
    let isDeleted = false;

    if (modelEdit.selectedTarget.kind === 'placed') {
      const targetPlacedId = modelEdit.selectedTarget.placedId;
      const placed = modelEdit.placedTeeth.find((p) => p.id === targetPlacedId);
      if (placed) {
        localPos = new THREE.Vector3(placed.position.x, placed.position.y, placed.position.z);
        radius = 4.5 * placed.scale;
        isUpper = placed.isUpper;
      }
    } else if (modelEdit.selectedTarget.kind === 'native' && modelEdit.selectedTarget.fdi) {
      const fdi = modelEdit.selectedTarget.fdi;
      const seg = segmentedTeeth.find((t) => t.fdi === fdi);
      if (seg) {
        const edit = modelEdit.nativeEdits[fdi];
        const dx = edit?.offsetMm.x || 0;
        const dy = edit?.offsetMm.y || 0;
        const dz = edit?.offsetMm.z || 0;
        localPos = new THREE.Vector3(
          seg.center.x + dx,
          seg.center.y + dy,
          seg.zOcclusal + dz
        );
        radius = Math.max(seg.radiusXY.rx, seg.radiusXY.ry) * (edit?.scale || 1) * 0.92;
        isUpper = seg.isUpper;
        isDeleted = Boolean(edit?.deleted);
      }
    }

    if (!localPos) {
      gizmoGroup.visible = false;
      return;
    }

    gizmoGroup.visible = isUpper ? settings.showUpper : settings.showLower;

    const worldPos = localPos.clone();
    if (isUpper) {
      worldPos.z += currentKinematics.upperPosition.z;
    } else {
      const lowerMat = new THREE.Matrix4().fromArray(currentKinematics.lowerMatrixElements);
      worldPos.applyMatrix4(lowerMat);
    }

    const ringColor = isDeleted ? 0xf43f5e : 0x8b5cf6;

    // Selection Torus Ring around the tooth crown
    const ringGeom = new THREE.TorusGeometry(radius, 0.28, 12, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.92,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.copy(worldPos);
    gizmoGroup.add(ringMesh);

    // Center indicator sphere
    const centerSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 12, 12),
      new THREE.MeshBasicMaterial({ color: isDeleted ? 0xf43f5e : 0x8b5cf6 })
    );
    centerSphere.position.copy(worldPos);
    gizmoGroup.add(centerSphere);

    // X / Y / Z mini drag axis crossbars
    const axisLen = radius + 2.2;
    const xLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(worldPos.x - axisLen, worldPos.y, worldPos.z),
        new THREE.Vector3(worldPos.x + axisLen, worldPos.y, worldPos.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0xef4444 })
    );
    const yLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(worldPos.x, worldPos.y - axisLen, worldPos.z),
        new THREE.Vector3(worldPos.x, worldPos.y + axisLen, worldPos.z),
      ]),
      new THREE.LineBasicMaterial({ color: 0x10b981 })
    );
    const zLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z - 3.5),
        new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z + 3.5),
      ]),
      new THREE.LineBasicMaterial({ color: 0x38bdf8 })
    );
    gizmoGroup.add(xLine, yLine, zLine);
  }, [
    modelEdit.enabled,
    modelEdit.selectedTarget,
    modelEdit.placedTeeth,
    modelEdit.nativeEdits,
    segmentedTeeth,
    settings.showUpper,
    settings.showLower,
    currentKinematics,
    nativeUpperGroupRef,
    nativeLowerGroupRef,
    placedUpperGroupRef,
    placedLowerGroupRef,
    editorGizmoGroupRef,
  ]);

  return segmentedTeeth;
}
