import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  ViewportSettings,
  SegmentedToothInfo,
} from '../types/dental';
import { MandibularKinematicsResult } from '../utils/articulatorKinematics';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  segmentArchGeometryTeeth,
  applyNativeToothEditsToGeometry,
  restoreNativeGeometryBeforeEdits,
  createLibraryToothGeometry,
} from '../utils/modelEditor';

export interface UseModelEditorEffectParams {
  settings: ViewportSettings;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  upperMeshRef: React.MutableRefObject<THREE.Mesh | null>;
  lowerMeshRef: React.MutableRefObject<THREE.Mesh | null>;
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

  // 1. Automatically segment 28 FDI teeth across Upper & Lower arches when STL meshes are ready
  useEffect(() => {
    if (!mapsReady) return;
    const upperGeom = upperMeshRef.current?.geometry;
    const lowerGeom = lowerMeshRef.current?.geometry;
    if (!upperGeom || !lowerGeom) return;

    // Segment from unedited baseline geometry
    restoreNativeGeometryBeforeEdits(upperGeom);
    restoreNativeGeometryBeforeEdits(lowerGeom);

    const upperTeeth = segmentArchGeometryTeeth(upperGeom, true);
    const lowerTeeth = segmentArchGeometryTeeth(lowerGeom, false);
    const allTeeth = [...upperTeeth, ...lowerTeeth];
    setSegmentedTeeth(allTeeth);
    onSegmentedTeethComputed?.(allTeeth);
  }, [mapsReady, upperMeshRef, lowerMeshRef, onSegmentedTeethComputed]);

  // 2. Apply non-destructive Native Tooth Edits (Delete -> Healed Gingival Saddle, Drag/Translate/Rotate/Scale)
  useEffect(() => {
    if (!mapsReady || segmentedTeeth.length === 0) return;
    const upperMesh = upperMeshRef.current;
    const lowerMesh = lowerMeshRef.current;
    if (!upperMesh || !lowerMesh) return;

    const nativeEdits = modelEdit.nativeEdits || {};
    const hasAnyNativeEdit = Object.values(nativeEdits).some(
      (op) =>
        op.deleted ||
        Math.abs(op.offsetMm.x) > 0.01 ||
        Math.abs(op.offsetMm.y) > 0.01 ||
        Math.abs(op.offsetMm.z) > 0.01 ||
        Math.abs(op.rotationDeg) > 0.1 ||
        Math.abs(op.scale - 1) > 0.01
    );

    if (!hasAnyNativeEdit) {
      restoreNativeGeometryBeforeEdits(upperMesh.geometry);
      restoreNativeGeometryBeforeEdits(lowerMesh.geometry);
    } else {
      applyNativeToothEditsToGeometry(upperMesh.geometry, true, segmentedTeeth, nativeEdits);
      applyNativeToothEditsToGeometry(lowerMesh.geometry, false, segmentedTeeth, nativeEdits);
    }

    // Refresh material if vertex colors were added by native edits (and Model Diff heatmap isn't overriding)
    if (!settings.modelDiff?.enabled) {
      const prevUpperMat = upperMesh.material as THREE.Material | undefined;
      upperMesh.material = createDentalMaterial(true, upperMesh.geometry);
      if (prevUpperMat && prevUpperMat !== upperMesh.material) prevUpperMat.dispose();

      const prevLowerMat = lowerMesh.material as THREE.Material | undefined;
      lowerMesh.material = createDentalMaterial(false, lowerMesh.geometry);
      if (prevLowerMat && prevLowerMat !== lowerMesh.material) prevLowerMat.dispose();
    }
  }, [
    mapsReady,
    segmentedTeeth,
    modelEdit.nativeEdits,
    settings.modelDiff?.enabled,
    upperMeshRef,
    lowerMeshRef,
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
        emissiveIntensity: isSelected ? 0.22 : 0,
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

  // 4. Synchronize Placed Teeth Groups & 3D Selection Gizmo with 6-DOF Mandibular Kinematics
  useEffect(() => {
    const upperGroup = placedUpperGroupRef.current;
    const lowerGroup = placedLowerGroupRef.current;
    const gizmoGroup = editorGizmoGroupRef.current;

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

    // Transform local arch coordinates into current articulated world coordinates
    const worldPos = localPos.clone();
    if (isUpper) {
      worldPos.z += currentKinematics.upperPosition.z;
    } else {
      const lowerMat = new THREE.Matrix4().fromArray(currentKinematics.lowerMatrixElements);
      worldPos.applyMatrix4(lowerMat);
    }

    const ringColor = isDeleted ? 0xf43f5e : 0x0ea5e9;

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
      new THREE.MeshBasicMaterial({ color: isDeleted ? 0xf43f5e : 0x38bdf8 })
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
    placedUpperGroupRef,
    placedLowerGroupRef,
    editorGizmoGroupRef,
  ]);

  return segmentedTeeth;
}
