import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ViewportSettings,
  CameraPreset,
  MeshGeometryStats,
  ClinicalPhoto,
  ThemeMode,
  OcclusogramStats,
  OrthoArchMetrics,
  Point3D,
  CaliperMeasurement,
  LocaleMode,
  DentalCaseBundle,
  ModelDiffStats,
  SegmentedToothInfo,
  SelectedToothTarget,
  PlacedLibraryTooth,
  ToothMorphologyType,
  ModelEditSnapshot,
  FdiToothNumber,
} from '../types/dental';
import { DEFAULT_MODEL_DIFF_SETTINGS } from '../utils/modelDiff';
import {
  DEFAULT_MODEL_EDIT_SETTINGS,
  identifyToothAtPoint3D,
  exportEditedArchToBinaryStl,
  getLibraryItemMeta,
  createModelEditSnapshot,
  pushModelEditSnapshot,
} from '../utils/modelEditor';
import { tr } from '../utils/i18n';
import {
  LoadedPentaTextures,
  loadPentaViewTextures,
  createPentaTexturedMaterial,
} from '../utils/pentaTextureShader';
import {
  computeMandibularKinematics,
  sampleArticulationTrajectory,
} from '../utils/articulatorKinematics';
import {
  OcclusalElevationMap,
  DEFAULT_OCCLUSAL_BOUNDS,
  buildOcclusalElevationMap,
  computeOcclusogramStats,
  createElevationDataTexture,
  createOcclusogramMaterial,
} from '../utils/occlusogram';
import { computeOrthoArchMetrics } from '../utils/archMeasurements';
import { createProceduralDentalArchGeometry } from '../utils/proceduralArch';
import { CameraTransform } from '../utils/urlState';
import { useModelDiffEffect } from '../hooks/useModelDiffEffect';
import { useModelEditorEffect } from '../hooks/useModelEditorEffect';
import { ViewportCaliperBanner } from './viewport/ViewportCaliperBanner';
import { ViewportDiffBanner } from './viewport/ViewportDiffBanner';
import { ViewportEditorBanner } from './viewport/ViewportEditorBanner';
import { MandibularJoystickBar } from './viewport/MandibularJoystickBar';
import { ViewportBottomHud } from './viewport/ViewportBottomHud';
import {
  Maximize2,
  Minimize2,
  Camera,
  RotateCcw,
  Eye,
  EyeOff,
  Compass,
  Upload,
  AlertCircle,
  Ruler,
  Activity,
  Trash2,
  GitCompare,
  Wand2,
} from 'lucide-react';

interface DentalViewer3DProps {
  upperStlUrl: string;
  lowerStlUrl: string;
  photos: ClinicalPhoto[];
  theme: ThemeMode;
  settings: ViewportSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  activePreset: CameraPreset;
  onPresetSelect: (preset: CameraPreset) => void;
  onMeshStatsComputed?: (stats: MeshGeometryStats) => void;
  onOcclusogramStatsComputed?: (stats: OcclusogramStats) => void;
  onArchMetricsComputed?: (metrics: OrthoArchMetrics) => void;
  caliperMeasurements?: CaliperMeasurement[];
  onAddCaliperMeasurement?: (pointA: Point3D, pointB: Point3D) => void;
  onClearCaliperMeasurements?: () => void;
  onCustomFilesDrop?: (files: FileList) => void;
  locale?: LocaleMode;
  initialCamera?: CameraTransform;
  onCameraChange?: (camera: CameraTransform) => void;
  cases?: DentalCaseBundle[];
  activeCaseId?: string;
  diffStats?: ModelDiffStats;
  onModelDiffStatsComputed?: (stats: ModelDiffStats) => void;
  onSegmentedTeethComputed?: (teeth: SegmentedToothInfo[]) => void;
  onRegisterStlExporter?: (exporter: (isUpper: boolean) => void) => void;
  onOpenEditorPanel?: () => void;
}

export const DentalViewer3D: React.FC<DentalViewer3DProps> = ({
  upperStlUrl,
  lowerStlUrl,
  photos,
  theme,
  settings,
  onSettingsChange,
  activePreset,
  onPresetSelect,
  onMeshStatsComputed,
  onOcclusogramStatsComputed,
  onArchMetricsComputed,
  caliperMeasurements = [],
  onAddCaliperMeasurement,
  onClearCaliperMeasurements,
  onCustomFilesDrop,
  locale = 'en',
  initialCamera,
  onCameraChange,
  cases = [],
  activeCaseId,
  diffStats,
  onModelDiffStatsComputed,
  onSegmentedTeethComputed,
  onRegisterStlExporter,
  onOpenEditorPanel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Mesh & BoundingBox refs
  const upperMeshRef = useRef<THREE.Mesh | null>(null);
  const lowerMeshRef = useRef<THREE.Mesh | null>(null);
  const upperBoxRef = useRef<THREE.Box3>(
    new THREE.Box3(new THREE.Vector3(-32, -47, -2), new THREE.Vector3(35, 4, 18))
  );
  const lowerBoxRef = useRef<THREE.Box3>(
    new THREE.Box3(new THREE.Vector3(-32, -44, -16), new THREE.Vector3(33, 11, 7))
  );
  const combinedBoxRef = useRef<THREE.Box3>(
    new THREE.Box3(new THREE.Vector3(-32, -47, -16), new THREE.Vector3(35, 11, 18))
  );
  const pentaTexturesRef = useRef<LoadedPentaTextures | null>(null);
  const clippingPlaneRef = useRef<THREE.Plane | null>(null);

  // Occlusogram Elevation Maps & DataTextures
  const upperElevationMapRef = useRef<OcclusalElevationMap | null>(null);
  const lowerElevationMapRef = useRef<OcclusalElevationMap | null>(null);
  const upperElevationTexRef = useRef<THREE.DataTexture | null>(null);
  const lowerElevationTexRef = useRef<THREE.DataTexture | null>(null);
  const upperOccUpdaterRef = useRef<
    ((lMat: THREE.Matrix4, lInv: THREE.Matrix4, uZ: number, maxR: number) => void) | null
  >(null);
  const lowerOccUpdaterRef = useRef<
    ((lMat: THREE.Matrix4, lInv: THREE.Matrix4, uZ: number, maxR: number) => void) | null
  >(null);

  // 3D Articulator Trajectory & Caliper Gizmo Groups
  const trajectoryGroupRef = useRef<THREE.Group | null>(null);
  const caliperGroupRef = useRef<THREE.Group | null>(null);
  const pendingCaliperPointRef = useRef<Point3D | null>(null);
  const [pendingCaliperPoint, setPendingCaliperPoint] = useState<Point3D | null>(null);

  // 3D Model Diff Ghost Overlay Meshes
  const diffUpperOverlayMeshRef = useRef<THREE.Mesh | null>(null);
  const diffLowerOverlayMeshRef = useRef<THREE.Mesh | null>(null);

  // 3D Model Editor Discrete Tooth Objects, Placed Teeth & Selection Gizmo Groups
  const nativeUpperGroupRef = useRef<THREE.Group | null>(null);
  const nativeLowerGroupRef = useRef<THREE.Group | null>(null);
  const placedUpperGroupRef = useRef<THREE.Group | null>(null);
  const placedLowerGroupRef = useRef<THREE.Group | null>(null);
  const editorGizmoGroupRef = useRef<THREE.Group | null>(null);
  const activeToothDragRef = useRef<{
    target: SelectedToothTarget;
    isUpper: boolean;
    startWorldPt: THREE.Vector3;
    initialPosOrOffset: Point3D;
  } | null>(null);
  const dragStartSnapshotRef = useRef<ModelEditSnapshot | null>(null);
  const hasDraggedRef = useRef<boolean>(false);

  // Animation & Lerp
  const animFrameIdRef = useRef<number | null>(null);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetCamUpRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(1.29, -18.36, 1.24));
  const lerpFramesRef = useRef<number>(0);
  const userInteractingRef = useRef<boolean>(false);
  const initialCameraAppliedRef = useRef<boolean>(false);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<{ upper: number; lower: number }>({
    upper: 0,
    lower: 0,
  });
  const [textureRevision, setTextureRevision] = useState<number>(0);
  const [mapsReady, setMapsReady] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [triangleStats, setTriangleStats] = useState({ upper: 0, lower: 0 });
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Dynamic dental occlusion center computed from loaded STL bounding boxes
  const centerTarget = useRef(new THREE.Vector3(1.29, -18.36, 1.24));
  const lastOcclusogramStatsKeyRef = useRef<string>('');

  const clearAndDisposeGroup = useCallback((group: THREE.Group) => {
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh | THREE.Line;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }, []);

  // Compute current 6-DOF mandibular kinematics
  const currentKinematics = useMemo(
    () => computeMandibularKinematics(settings.articulator),
    [settings.articulator]
  );

  // Load 5-view clinical textures whenever photos change (synchronously clear old textures first)
  useEffect(() => {
    let cancelled = false;

    // Synchronously dispose and clear previous textures so deleted/switched cases never leak textures
    if (pentaTexturesRef.current) {
      const prev = pentaTexturesRef.current;
      prev.front?.dispose();
      prev.upper?.dispose();
      prev.lower?.dispose();
      prev.right?.dispose();
      prev.left?.dispose();
      pentaTexturesRef.current = null;
    }
    setTextureRevision((r) => r + 1);

    if (!photos || photos.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    loadPentaViewTextures(photos).then((loaded) => {
      if (cancelled) return;
      pentaTexturesRef.current = loaded;
      setTextureRevision((r) => r + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  // Articulator Playback Loop (smoothly advances articulator.progress when isPlaying is true)
  useEffect(() => {
    if (!settings.articulator.isPlaying) return;

    let lastTime = performance.now();
    let rafId = 0;
    let direction = 1;

    const stepPlayback = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      onSettingsChange((prev) => {
        if (!prev.articulator.isPlaying) return prev;
        const speed = prev.articulator.playbackSpeed * 0.42;
        let nextP = prev.articulator.progress + dt * speed * direction;

        if (prev.articulator.mode === 'chewing') {
          // Continuous loop 0 -> 1 -> 0
          if (nextP > 1) nextP -= 1;
        } else {
          // Ping-pong opening and closing
          if (nextP >= 1) {
            nextP = 1;
            direction = -1;
          } else if (nextP <= 0) {
            nextP = 0;
            direction = 1;
          }
        }

        const rounded = Number(nextP.toFixed(3));
        return {
          ...prev,
          occlusionSeparation: Math.round(rounded * 35),
          articulator: {
            ...prev.articulator,
            progress: rounded,
          },
        };
      });

      rafId = requestAnimationFrame(stepPlayback);
    };

    rafId = requestAnimationFrame(stepPlayback);
    return () => cancelAnimationFrame(rafId);
  }, [settings.articulator.isPlaying, onSettingsChange]);

  // Build Material based on settings, Occlusogram state & loaded 5-view textures
  const createDentalMaterial = useCallback(
    (isUpper: boolean, geometry?: THREE.BufferGeometry) => {
      const {
        shadingMode,
        photoTextureMapped,
        occlusogramEnabled,
        occlusogramMaxRangeMm,
        archDistinction,
        wireframeOverlay,
        clippingEnabled,
      } = settings;
      const clippingPlanes =
        clippingEnabled && clippingPlaneRef.current ? [clippingPlaneRef.current] : [];

      const activeGeom =
        geometry || (isUpper ? upperMeshRef.current?.geometry : lowerMeshRef.current?.geometry);
      const hasVertexColors = Boolean(activeGeom?.attributes?.color);

      if (isUpper) {
        upperOccUpdaterRef.current = null;
      } else {
        lowerOccUpdaterRef.current = null;
      }

      // 3D Model Diff Signed Deviation Heatmap Mode:
      // Uses the per-vertex signed deviation color buffer ('color') directly on the reference mesh
      if (
        settings.modelDiff?.enabled &&
        (settings.modelDiff.displayMode === 'heatmap' ||
          settings.modelDiff.displayMode === 'both') &&
        hasVertexColors
      ) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.26,
          metalness: 0.03,
          clearcoat: 0.35,
          clearcoatRoughness: 0.2,
          ior: 1.5,
          side: THREE.DoubleSide,
          wireframe: wireframeOverlay || shadingMode === 'wireframe',
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      // Check whether 5-view photo textures are available and active
      const hasAnyPentaTexture = Boolean(
        photos.length > 0 &&
          pentaTexturesRef.current &&
          (pentaTexturesRef.current.front ||
            pentaTexturesRef.current.upper ||
            pentaTexturesRef.current.lower ||
            pentaTexturesRef.current.right ||
            pentaTexturesRef.current.left)
      );
      const shouldUseTexture =
        (shadingMode === 'texture' || photoTextureMapped) && hasAnyPentaTexture;

      // Layered Occlusogram Real-time Bite Contact Heatmap:
      // Overlays the contact heatmap directly ON TOP of the active material / shader / texture
      if (
        occlusogramEnabled &&
        upperElevationTexRef.current &&
        lowerElevationTexRef.current
      ) {
        let baseColor = isUpper
          ? archDistinction
            ? 0xfffaf0
            : 0xf8fafc
          : archDistinction
          ? 0xf0fdf4
          : 0xf8fafc;
        let baseRoughness = 0.28;
        let baseMetalness = 0.04;
        let baseIor = 1.55;
        let baseTransmission = 0.0;
        let baseOpacity = 1.0;

        if (shouldUseTexture) {
          baseColor = 0xffffff;
          baseRoughness = 0.35;
          baseMetalness = 0.02;
        } else if (shadingMode === 'plaster') {
          baseColor = isUpper
            ? archDistinction
              ? 0xfef3c7
              : 0xf1f5f9
            : archDistinction
            ? 0xdbeafe
            : 0xf1f5f9;
          baseRoughness = 0.75;
          baseMetalness = 0.02;
        } else if (shadingMode === 'translucent') {
          baseColor = isUpper
            ? archDistinction
              ? 0xbae6fd
              : 0xe2e8f0
            : archDistinction
            ? 0xbfdbfe
            : 0xe2e8f0;
          baseRoughness = 0.15;
          baseTransmission = 0.65;
          baseOpacity = 0.6;
        } else if (shadingMode === 'wireframe') {
          baseColor = isUpper ? 0x0284c7 : 0x6366f1;
        }

        const lowerMat = new THREE.Matrix4().fromArray(currentKinematics.lowerMatrixElements);
        const lowerInvMat = new THREE.Matrix4().fromArray(
          currentKinematics.lowerInverseMatrixElements
        );
        const opposingTex = isUpper
          ? lowerElevationTexRef.current
          : upperElevationTexRef.current;

        const { material, updateKinematicsUniforms } = createOcclusogramMaterial({
          isUpper,
          opposingElevationTex: opposingTex,
          bounds: DEFAULT_OCCLUSAL_BOUNDS,
          maxRangeMm: occlusogramMaxRangeMm,
          lowerMatrix: lowerMat,
          lowerInverseMatrix: lowerInvMat,
          upperZOffset: currentKinematics.upperPosition.z,
          wireframe: wireframeOverlay || shadingMode === 'wireframe',
          clippingPlanes,
          baseColor,
          baseRoughness,
          baseMetalness,
          baseIor,
          baseTransmission,
          baseOpacity,
          pentaTextures: shouldUseTexture ? pentaTexturesRef.current : null,
          archBox: isUpper ? upperBoxRef.current : lowerBoxRef.current,
          combinedBox: combinedBoxRef.current,
        });

        if (isUpper) {
          upperOccUpdaterRef.current = updateKinematicsUniforms;
        } else {
          lowerOccUpdaterRef.current = updateKinematicsUniforms;
        }
        return material;
      }

      // Base Materials (when Occlusogram is off or elevation maps are still calculating):
      if (shouldUseTexture && pentaTexturesRef.current) {
        return createPentaTexturedMaterial({
          isUpper,
          textures: pentaTexturesRef.current,
          archBox: isUpper ? upperBoxRef.current : lowerBoxRef.current,
          combinedBox: combinedBoxRef.current,
          wireframe: wireframeOverlay || shadingMode === 'wireframe',
          clippingPlanes,
        });
      }

      if (shadingMode === 'normal') {
        const mat = new THREE.MeshNormalMaterial({
          side: THREE.DoubleSide,
          wireframe: wireframeOverlay,
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      if (shadingMode === 'wireframe') {
        const color = isUpper ? 0x0284c7 : 0x6366f1;
        const mat = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      if (shadingMode === 'translucent') {
        const color = isUpper
          ? archDistinction
            ? 0xbae6fd
            : 0xe2e8f0
          : archDistinction
          ? 0xbfdbfe
          : 0xe2e8f0;
        const mat = new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.15,
          transmission: 0.65,
          opacity: 0.6,
          transparent: true,
          ior: 1.45,
          side: THREE.DoubleSide,
          wireframe: wireframeOverlay,
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      if (shadingMode === 'plaster') {
        const defaultColor = isUpper
          ? archDistinction
            ? 0xfef3c7
            : 0xf1f5f9
          : archDistinction
          ? 0xdbeafe
          : 0xf1f5f9;
        const mat = new THREE.MeshStandardMaterial({
          color: hasVertexColors ? 0xffffff : defaultColor,
          vertexColors: hasVertexColors,
          roughness: 0.75,
          metalness: 0.02,
          side: THREE.DoubleSide,
          wireframe: wireframeOverlay,
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      // Default: Clinical Enamel
      const defaultColor = isUpper
        ? archDistinction
          ? 0xfffaf0
          : 0xf8fafc
        : archDistinction
        ? 0xf0fdf4
        : 0xf8fafc;
      const mat = new THREE.MeshPhysicalMaterial({
        color: hasVertexColors ? 0xffffff : defaultColor,
        vertexColors: hasVertexColors,
        roughness: 0.28,
        metalness: 0.04,
        clearcoat: 0.45,
        clearcoatRoughness: 0.18,
        ior: 1.55,
        side: THREE.DoubleSide,
        wireframe: wireframeOverlay,
      });
      mat.clippingPlanes = clippingPlanes;
      return mat;
    },
    [
      photos,
      settings.shadingMode,
      settings.photoTextureMapped,
      settings.occlusogramEnabled,
      settings.occlusogramMaxRangeMm,
      settings.archDistinction,
      settings.wireframeOverlay,
      settings.clippingEnabled,
      settings.modelDiff?.enabled,
      settings.modelDiff?.displayMode,
      textureRevision,
      mapsReady,
    ]
  );

  // Apply Camera Presets (supports smooth lerp or immediate snap; keeps Z-up consistent with OrbitControls)
  const applyCameraPreset = useCallback((preset: CameraPreset, immediate = false) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;

    const c = centerTarget.current;
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1);

    switch (preset) {
      case 'front':
        pos.set(c.x, c.y - 130, c.z);
        break;
      case 'upper':
        // Maxillary occlusal table faces -Z (downward); looking up from below at the upper biting surface
        pos.set(c.x, c.y - 24, c.z - 135);
        break;
      case 'lower':
        // Mandibular occlusal table faces +Z (upward); looking down from above at the lower biting surface
        pos.set(c.x, c.y - 24, c.z + 135);
        break;
      case 'right':
        pos.set(c.x - 130, c.y, c.z);
        break;
      case 'left':
        pos.set(c.x + 130, c.y, c.z);
        break;
      case 'isometric':
      default:
        pos.set(c.x - 75, c.y - 95, c.z + 65);
        break;
    }

    if (immediate) {
      targetCamPosRef.current = null;
      targetCamUpRef.current = null;
      lerpFramesRef.current = 0;
      cam.up.copy(up);
      cam.position.copy(pos);
      ctrl.target.copy(c);
      ctrl.update();
      return;
    }

    lerpFramesRef.current = 0;
    targetCamPosRef.current = pos;
    targetCamUpRef.current = up;
    targetLookAtRef.current.copy(c);
  }, []);

  const prevPresetRef = useRef<CameraPreset>(activePreset);
  useEffect(() => {
    if (prevPresetRef.current !== activePreset) {
      prevPresetRef.current = activePreset;
      applyCameraPreset(activePreset, false);
    }
  }, [activePreset, applyCameraPreset]);

  // Update 3D Scene Background & Grid on Theme change (Light vs Dark)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.background = new THREE.Color(theme === 'dark' ? 0x090d16 : 0xf1f5f9);

    if (gridHelperRef.current) {
      const oldPos = gridHelperRef.current.position.clone();
      scene.remove(gridHelperRef.current);
      gridHelperRef.current.dispose();

      const gridColor1 = theme === 'dark' ? 0x1e293b : 0xcbd5e1;
      const gridColor2 = theme === 'dark' ? 0x0f172a : 0xe2e8f0;
      const newGrid = new THREE.GridHelper(160, 16, gridColor1, gridColor2);
      newGrid.rotation.x = Math.PI / 2;
      newGrid.position.copy(oldPos);
      scene.add(newGrid);
      gridHelperRef.current = newGrid;
    }
  }, [theme]);

  // Update clipping plane equation in-place without recreating materials or recompiling shaders on slider drag
  useEffect(() => {
    if (!settings.clippingEnabled) {
      clippingPlaneRef.current = null;
    } else {
      if (!clippingPlaneRef.current) {
        clippingPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
      }
      const offset = settings.clippingOffset;
      if (settings.clippingAxis === 'z') {
        clippingPlaneRef.current.normal.set(0, 0, -1);
      } else if (settings.clippingAxis === 'y') {
        clippingPlaneRef.current.normal.set(0, -1, 0);
      } else {
        clippingPlaneRef.current.normal.set(-1, 0, 0);
      }
      clippingPlaneRef.current.constant = offset;
    }

    const activePlanes =
      settings.clippingEnabled && clippingPlaneRef.current ? [clippingPlaneRef.current] : [];

    if (upperMeshRef.current?.material) {
      (upperMeshRef.current.material as THREE.Material).clippingPlanes = activePlanes;
    }
    if (lowerMeshRef.current?.material) {
      (lowerMeshRef.current.material as THREE.Material).clippingPlanes = activePlanes;
    }
    if (diffUpperOverlayMeshRef.current?.material) {
      (diffUpperOverlayMeshRef.current.material as THREE.Material).clippingPlanes = activePlanes;
    }
    if (diffLowerOverlayMeshRef.current?.material) {
      (diffLowerOverlayMeshRef.current.material as THREE.Material).clippingPlanes = activePlanes;
    }
  }, [settings.clippingEnabled, settings.clippingAxis, settings.clippingOffset]);

  // Rebuild dental materials only when shading mode, textures, or Occlusogram state changes
  useEffect(() => {
    if (upperMeshRef.current) {
      const prevMat = upperMeshRef.current.material as THREE.Material | undefined;
      upperMeshRef.current.material = createDentalMaterial(true);
      if (prevMat && prevMat !== upperMeshRef.current.material) prevMat.dispose();
    }
    if (lowerMeshRef.current) {
      const prevMat = lowerMeshRef.current.material as THREE.Material | undefined;
      lowerMeshRef.current.material = createDentalMaterial(false);
      if (prevMat && prevMat !== lowerMeshRef.current.material) prevMat.dispose();
    }
  }, [createDentalMaterial]);

  // Apply 6-DOF Mandibular Kinematics to Upper & Lower Meshes + Update Occlusogram Stats
  useEffect(() => {
    if (upperMeshRef.current) {
      upperMeshRef.current.visible = settings.showUpper;
      upperMeshRef.current.position.set(
        currentKinematics.upperPosition.x,
        currentKinematics.upperPosition.y,
        currentKinematics.upperPosition.z
      );
      upperMeshRef.current.rotation.set(
        currentKinematics.upperRotation.x,
        currentKinematics.upperRotation.y,
        currentKinematics.upperRotation.z
      );
    }

    if (lowerMeshRef.current) {
      lowerMeshRef.current.visible = settings.showLower;
      lowerMeshRef.current.position.set(
        currentKinematics.lowerPosition.x,
        currentKinematics.lowerPosition.y,
        currentKinematics.lowerPosition.z
      );
      lowerMeshRef.current.rotation.set(
        currentKinematics.lowerRotation.x,
        currentKinematics.lowerRotation.y,
        currentKinematics.lowerRotation.z
      );
    }

    // Keep 3D Model Diff Ghost Overlay Meshes synchronized with 6-DOF jaw articulation
    if (diffUpperOverlayMeshRef.current) {
      diffUpperOverlayMeshRef.current.visible =
        settings.showUpper &&
        Boolean(
          settings.modelDiff?.enabled &&
            (settings.modelDiff.displayMode === 'overlay' ||
              settings.modelDiff.displayMode === 'both')
        );
      diffUpperOverlayMeshRef.current.position.set(
        currentKinematics.upperPosition.x,
        currentKinematics.upperPosition.y,
        currentKinematics.upperPosition.z
      );
      diffUpperOverlayMeshRef.current.rotation.set(
        currentKinematics.upperRotation.x,
        currentKinematics.upperRotation.y,
        currentKinematics.upperRotation.z
      );
    }

    if (diffLowerOverlayMeshRef.current) {
      diffLowerOverlayMeshRef.current.visible =
        settings.showLower &&
        Boolean(
          settings.modelDiff?.enabled &&
            (settings.modelDiff.displayMode === 'overlay' ||
              settings.modelDiff.displayMode === 'both')
        );
      diffLowerOverlayMeshRef.current.position.set(
        currentKinematics.lowerPosition.x,
        currentKinematics.lowerPosition.y,
        currentKinematics.lowerPosition.z
      );
      diffLowerOverlayMeshRef.current.rotation.set(
        currentKinematics.lowerRotation.x,
        currentKinematics.lowerRotation.y,
        currentKinematics.lowerRotation.z
      );
    }

    // Update GPU Occlusogram uniforms in real time if active
    const lowerMat = new THREE.Matrix4().fromArray(currentKinematics.lowerMatrixElements);
    const lowerInvMat = new THREE.Matrix4().fromArray(
      currentKinematics.lowerInverseMatrixElements
    );
    if (upperOccUpdaterRef.current) {
      upperOccUpdaterRef.current(
        lowerMat,
        lowerInvMat,
        currentKinematics.upperPosition.z,
        settings.occlusogramMaxRangeMm
      );
    }
    if (lowerOccUpdaterRef.current) {
      lowerOccUpdaterRef.current(
        lowerMat,
        lowerInvMat,
        currentKinematics.upperPosition.z,
        settings.occlusogramMaxRangeMm
      );
    }

    // Compute & report real-time Occlusogram contact statistics (deduplicated to avoid redundant React state updates)
    if (
      onOcclusogramStatsComputed &&
      upperElevationMapRef.current &&
      lowerElevationMapRef.current
    ) {
      const stats = computeOcclusogramStats(
        upperElevationMapRef.current,
        lowerElevationMapRef.current,
        currentKinematics,
        settings.occlusogramMaxRangeMm
      );
      const statsKey = `${stats.minClearanceMm}|${stats.meanContactClearanceMm}|${stats.contactAreaMm2}|${stats.heavyCollisionAreaMm2}|${stats.leftContactPercent}|${stats.anteriorContactPercent}|${stats.totalContactPoints}`;
      if (lastOcclusogramStatsKeyRef.current !== statsKey) {
        lastOcclusogramStatsKeyRef.current = statsKey;
        onOcclusogramStatsComputed(stats);
      }
    }
  }, [
    settings.showUpper,
    settings.showLower,
    settings.occlusogramMaxRangeMm,
    settings.modelDiff?.enabled,
    settings.modelDiff?.displayMode,
    currentKinematics,
    mapsReady,
    onOcclusogramStatsComputed,
  ]);

  // 3D Model Diff: Compute Per-Vertex Signed Deviations, Apply Heatmap Vertex Colors & Render Ghost Overlay Meshes
  const activeDiffStats = useModelDiffEffect({
    settings,
    sceneRef,
    rendererRef,
    upperMeshRef,
    lowerMeshRef,
    diffUpperOverlayMeshRef,
    diffLowerOverlayMeshRef,
    clippingPlaneRef,
    mapsReady,
    cases,
    activeCaseId,
    createDentalMaterial,
    diffStats,
    onModelDiffStatsComputed,
  });

  // 3D Model Editor: Segment 28 FDI Teeth, Discrete Native Tooth Objects & Placed Teeth + Gizmos
  const segmentedTeeth = useModelEditorEffect({
    settings,
    sceneRef,
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
  });

  // Register binary STL exporter for edited Upper / Lower arches
  useEffect(() => {
    if (!onRegisterStlExporter) return;
    const handleExportStl = (isUpper: boolean) => {
      const mesh = isUpper ? upperMeshRef.current : lowerMeshRef.current;
      if (!mesh) return;
      const placed = settings.modelEdit?.placedTeeth || [];
      const nativeEdits = settings.modelEdit?.nativeEdits || {};
      const buffer = exportEditedArchToBinaryStl(
        mesh.geometry,
        placed,
        isUpper,
        segmentedTeeth,
        nativeEdits
      );
      const blob = new Blob([buffer], { type: 'application/sla' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${isUpper ? 'Upper' : 'Lower'}_Edited_${Date.now()}.stl`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    onRegisterStlExporter(handleExportStl);
  }, [onRegisterStlExporter, settings.modelEdit?.placedTeeth, settings.modelEdit?.nativeEdits, segmentedTeeth]);

  // Render 3D Articulation Trajectory Curve & TMJ Hinge Axis Gizmo inside the 3D scene
  useEffect(() => {
    const group = trajectoryGroupRef.current;
    if (!group) return;

    // Clear and dispose previous gizmo objects
    clearAndDisposeGroup(group);

    if (!settings.articulator.showTrajectoryGizmo) {
      group.visible = false;
      return;
    }

    group.visible = true;
    const samples = sampleArticulationTrajectory(settings.articulator, 36);

    // 1. Incisal Motion Trajectory Curve (Posselt / Excursion path)
    const curvePoints = samples.map(
      (s) => new THREE.Vector3(s.incisalWorld.x, s.incisalWorld.y, s.incisalWorld.z)
    );
    const curveGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const curveLine = new THREE.Line(curveGeom, curveMat);
    group.add(curveLine);

    // 2. Current Incisal Point Sphere
    const incisalSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    incisalSphere.position.set(
      currentKinematics.incisalWorldPoint.x,
      currentKinematics.incisalWorldPoint.y,
      currentKinematics.incisalWorldPoint.z
    );
    group.add(incisalSphere);

    // 3. Intercondylar Hinge Axis & Lever Arm to Incisal Point (for anatomical modes)
    if (settings.articulator.mode !== 'parallel') {
      const cLeft = new THREE.Vector3(
        currentKinematics.condyleLeftWorld.x,
        currentKinematics.condyleLeftWorld.y,
        currentKinematics.condyleLeftWorld.z
      );
      const cRight = new THREE.Vector3(
        currentKinematics.condyleRightWorld.x,
        currentKinematics.condyleRightWorld.y,
        currentKinematics.condyleRightWorld.z
      );
      const cMid = new THREE.Vector3().addVectors(cLeft, cRight).multiplyScalar(0.5);

      const axisGeom = new THREE.BufferGeometry().setFromPoints([cLeft, cRight]);
      const axisMat = new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 2.5,
        gapSize: 1.5,
      });
      const axisLine = new THREE.Line(axisGeom, axisMat);
      axisLine.computeLineDistances();
      group.add(axisLine);

      // Arm from Hinge Midpoint to Incisal Point
      const armGeom = new THREE.BufferGeometry().setFromPoints([
        cMid,
        incisalSphere.position.clone(),
      ]);
      const armMat = new THREE.LineDashedMaterial({
        color: 0x64748b,
        dashSize: 2,
        gapSize: 2,
      });
      const armLine = new THREE.Line(armGeom, armMat);
      armLine.computeLineDistances();
      group.add(armLine);
    }
  }, [settings.articulator, currentKinematics]);

  // Render 3D Caliper Measurements & Pending Point Marker inside the 3D scene
  useEffect(() => {
    const group = caliperGroupRef.current;
    if (!group) return;

    clearAndDisposeGroup(group);

    // Pending point A marker
    if (pendingCaliperPoint) {
      const mA = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      mA.position.set(pendingCaliperPoint.x, pendingCaliperPoint.y, pendingCaliperPoint.z);
      group.add(mA);
    }

    // Completed measurements (can be hidden or shown via showMeasurements toggle)
    if (settings.showMeasurements !== false) {
      for (const m of caliperMeasurements) {
        const pA = new THREE.Vector3(m.pointA.x, m.pointA.y, m.pointA.z);
        const pB = new THREE.Vector3(m.pointB.x, m.pointB.y, m.pointB.z);

        const sA = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        sA.position.copy(pA);

        const sB = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        sB.position.copy(pB);

        const lineGeom = new THREE.BufferGeometry().setFromPoints([pA, pB]);
        const line = new THREE.Line(
          lineGeom,
          new THREE.LineBasicMaterial({ color: 0xfbbf24 })
        );

        group.add(sA);
        group.add(sB);
        group.add(line);
      }
    }
  }, [caliperMeasurements, pendingCaliperPoint, settings.showMeasurements]);

  // Initialize Three.js Scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(theme === 'dark' ? 0x090d16 : 0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(1.29 - 75, -18.36 - 95, 1.24 + 65);
    cameraRef.current = camera;

    const trajGroup = new THREE.Group();
    scene.add(trajGroup);
    trajectoryGroupRef.current = trajGroup;

    const calGroup = new THREE.Group();
    scene.add(calGroup);
    caliperGroupRef.current = calGroup;

    const nativeUpperGroup = new THREE.Group();
    scene.add(nativeUpperGroup);
    nativeUpperGroupRef.current = nativeUpperGroup;

    const nativeLowerGroup = new THREE.Group();
    scene.add(nativeLowerGroup);
    nativeLowerGroupRef.current = nativeLowerGroup;

    const placedUpperGroup = new THREE.Group();
    scene.add(placedUpperGroup);
    placedUpperGroupRef.current = placedUpperGroup;

    const placedLowerGroup = new THREE.Group();
    scene.add(placedLowerGroup);
    placedLowerGroupRef.current = placedLowerGroup;

    const editorGizmoGroup = new THREE.Group();
    scene.add(editorGizmoGroup);
    editorGizmoGroupRef.current = editorGizmoGroup;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.localClippingEnabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      // Fallback for non-WebGL test environments (e.g. Vitest jsdom)
      setLoading(false);
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(centerTarget.current);
    controls.maxDistance = 400;
    controls.minDistance = 20;
    controlsRef.current = controls;

    const emitCameraChange = () => {
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      if (cam && ctrl && onCameraChangeRef.current) {
        onCameraChangeRef.current({
          position: [cam.position.x, cam.position.y, cam.position.z],
          target: [ctrl.target.x, ctrl.target.y, ctrl.target.z],
        });
      }
    };

    // Immediately cancel any preset camera lerp as soon as the user touches/drags/scrolls the 3D canvas
    // so the camera never springs back ("回彈") against user rotation!
    const handleControlStart = () => {
      userInteractingRef.current = true;
      targetCamPosRef.current = null;
      targetCamUpRef.current = null;
      lerpFramesRef.current = 0;
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== renderer?.domElement
      ) {
        document.activeElement.blur();
      }
    };
    const handleControlEnd = () => {
      userInteractingRef.current = false;
      emitCameraChange();
    };

    let cameraChangeThrottle: ReturnType<typeof setTimeout> | null = null;
    const handleControlChange = () => {
      if (userInteractingRef.current) {
        if (!cameraChangeThrottle) {
          cameraChangeThrottle = setTimeout(() => {
            cameraChangeThrottle = null;
            emitCameraChange();
          }, 150);
        }
      }
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);
    controls.addEventListener('change', handleControlChange);
    renderer.domElement.addEventListener('pointerdown', handleControlStart, { passive: true });
    renderer.domElement.addEventListener('touchstart', handleControlStart, { passive: true });
    renderer.domElement.addEventListener('wheel', handleControlStart, { passive: true });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(-50, -100, 120);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.95);
    fillLight.position.set(60, 80, 80);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(0, 120, -60);
    scene.add(rimLight);

    // Subtle clinical reference grid in background
    const gridColor1 = theme === 'dark' ? 0x1e293b : 0xcbd5e1;
    const gridColor2 = theme === 'dark' ? 0x0f172a : 0xe2e8f0;
    const gridHelper = new THREE.GridHelper(160, 16, gridColor1, gridColor2);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(1.29, -18.36, -30);
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Render Loop & FPS calculation
    let frameCount = 0;
    let fpsTimer = performance.now();

    const animate = (currentTime: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (
        !userInteractingRef.current &&
        targetCamPosRef.current &&
        targetCamUpRef.current
      ) {
        lerpFramesRef.current += 1;
        camera.position.lerp(targetCamPosRef.current, 0.14);
        camera.up.lerp(targetCamUpRef.current, 0.14).normalize();
        controls.target.lerp(targetLookAtRef.current, 0.14);

        if (
          camera.position.distanceTo(targetCamPosRef.current) < 0.35 ||
          lerpFramesRef.current > 45
        ) {
          camera.position.copy(targetCamPosRef.current);
          camera.up.copy(targetCamUpRef.current);
          controls.target.copy(targetLookAtRef.current);
          targetCamPosRef.current = null;
          targetCamUpRef.current = null;
          lerpFramesRef.current = 0;
          emitCameraChange();
        }
      }

      controls.update();
      renderer!.render(scene, camera);

      frameCount++;
      if (currentTime - fpsTimer >= 1000) {
        const nextFps = Math.round((frameCount * 1000) / (currentTime - fpsTimer));
        setFps((prev) => (prev === nextFps ? prev : nextFps));
        frameCount = 0;
        fpsTimer = currentTime;
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  // Sync autoRotate setting with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = settings.autoRotate;
      controlsRef.current.autoRotateSpeed = 1.2;
    }
  }, [settings.autoRotate]);

  // Dynamically load/swap STL files whenever upperStlUrl or lowerStlUrl changes
  useEffect(() => {
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    if (!scene || !controls) return;

    let cancelled = false;
    const loader = new STLLoader();

    const loadStlGeometry = (url: string, key: 'upper' | 'lower') =>
      new Promise<THREE.BufferGeometry>((resolve) => {
        if (!url || url.startsWith('procedural://')) {
          setLoadProgress((p) => ({ ...p, [key]: 100 }));
          resolve(createProceduralDentalArchGeometry(key === 'upper'));
          return;
        }
        loader.load(
          url,
          (geom) => {
            if (!geom.attributes.position || geom.attributes.position.count === 0) {
              resolve(createProceduralDentalArchGeometry(key === 'upper'));
            } else {
              resolve(geom);
            }
          },
          (xhr) => {
            if (!cancelled && xhr.total > 0) {
              setLoadProgress((p) => ({
                ...p,
                [key]: Math.round((xhr.loaded / xhr.total) * 100),
              }));
            }
          },
          () => {
            resolve(createProceduralDentalArchGeometry(key === 'upper'));
          }
        );
      });

    setLoading(true);
    setErrorMsg(null);
    setLoadProgress({ upper: 0, lower: 0 });
    setMapsReady(false);

    Promise.all([
      loadStlGeometry(upperStlUrl, 'upper'),
      loadStlGeometry(lowerStlUrl, 'lower'),
    ])
      .then(([upperGeom, lowerGeom]) => {
        if (cancelled) return;

        upperGeom.computeVertexNormals();
        lowerGeom.computeVertexNormals();
        upperGeom.computeBoundingBox();
        lowerGeom.computeBoundingBox();

        const upperCount = Math.round(upperGeom.attributes.position.count / 3);
        const lowerCount = Math.round(lowerGeom.attributes.position.count / 3);
        setTriangleStats({ upper: upperCount, lower: lowerCount });

        const uBox = upperGeom.boundingBox!;
        const lBox = lowerGeom.boundingBox!;
        const combinedBox = new THREE.Box3().copy(uBox).union(lBox);

        upperBoxRef.current.copy(uBox);
        lowerBoxRef.current.copy(lBox);
        combinedBoxRef.current.copy(combinedBox);

        const uSize = new THREE.Vector3();
        const lSize = new THREE.Vector3();
        uBox.getSize(uSize);
        lBox.getSize(lSize);

        if (onMeshStatsComputed) {
          onMeshStatsComputed({
            upperTriangles: upperCount,
            lowerTriangles: lowerCount,
            upperDimensions: {
              width: Number(uSize.x.toFixed(1)),
              depth: Number(uSize.y.toFixed(1)),
              height: Number(uSize.z.toFixed(1)),
            },
            lowerDimensions: {
              width: Number(lSize.x.toFixed(1)),
              depth: Number(lSize.y.toFixed(1)),
              height: Number(lSize.z.toFixed(1)),
            },
          });
        }

        // Build Occlusogram Elevation Maps & DataTextures
        const uPosArr = upperGeom.attributes.position.array;
        const uNormArr = upperGeom.attributes.normal?.array;
        const lPosArr = lowerGeom.attributes.position.array;
        const lNormArr = lowerGeom.attributes.normal?.array;

        const uMap = buildOcclusalElevationMap(
          uPosArr,
          uNormArr,
          true,
          DEFAULT_OCCLUSAL_BOUNDS,
          96
        );
        const lMap = buildOcclusalElevationMap(
          lPosArr,
          lNormArr,
          false,
          DEFAULT_OCCLUSAL_BOUNDS,
          96
        );
        upperElevationMapRef.current = uMap;
        lowerElevationMapRef.current = lMap;
        upperElevationTexRef.current?.dispose();
        lowerElevationTexRef.current?.dispose();
        upperElevationTexRef.current = createElevationDataTexture(uMap);
        lowerElevationTexRef.current = createElevationDataTexture(lMap);
        setMapsReady(true);

        // Compute Arch Diagnostic Metrics
        if (onArchMetricsComputed) {
          onArchMetricsComputed(computeOrthoArchMetrics(uPosArr, lPosArr));
        }

        // Update combined center for camera & grid
        const center = new THREE.Vector3();
        combinedBox.getCenter(center);
        centerTarget.current.copy(center);
        controls.target.copy(center);

        if (gridHelperRef.current) {
          gridHelperRef.current.position.set(center.x, center.y, combinedBox.min.z - 15);
        }

        // Remove previous meshes and dispose their geometries & materials
        if (upperMeshRef.current) {
          scene.remove(upperMeshRef.current);
          upperMeshRef.current.geometry.dispose();
          (upperMeshRef.current.material as THREE.Material | undefined)?.dispose?.();
        }
        if (lowerMeshRef.current) {
          scene.remove(lowerMeshRef.current);
          lowerMeshRef.current.geometry.dispose();
          (lowerMeshRef.current.material as THREE.Material | undefined)?.dispose?.();
        }

        const upperMesh = new THREE.Mesh(upperGeom, createDentalMaterial(true, upperGeom));
        upperMesh.visible = settings.showUpper;
        upperMesh.position.set(
          currentKinematics.upperPosition.x,
          currentKinematics.upperPosition.y,
          currentKinematics.upperPosition.z
        );

        const lowerMesh = new THREE.Mesh(lowerGeom, createDentalMaterial(false, lowerGeom));
        lowerMesh.visible = settings.showLower;
        lowerMesh.position.set(
          currentKinematics.lowerPosition.x,
          currentKinematics.lowerPosition.y,
          currentKinematics.lowerPosition.z
        );
        lowerMesh.rotation.set(
          currentKinematics.lowerRotation.x,
          currentKinematics.lowerRotation.y,
          currentKinematics.lowerRotation.z
        );

        scene.add(upperMesh);
        scene.add(lowerMesh);

        upperMeshRef.current = upperMesh;
        lowerMeshRef.current = lowerMesh;

        if (initialCamera && !initialCameraAppliedRef.current) {
          initialCameraAppliedRef.current = true;
          const cam = cameraRef.current;
          const ctrl = controlsRef.current;
          if (cam && ctrl) {
            cam.position.set(...initialCamera.position);
            ctrl.target.set(...initialCamera.target);
            ctrl.update();
          }
        } else {
          // Snap camera immediately on initial/case load so user dragging never fights an active lerp
          applyCameraPreset(activePreset, true);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load dental STL files:', err);
        setErrorMsg(
          tr(
            locale,
            '無法載入指定 STL 齒列模型。您可以透過拖曳或頂部選單載入其他案例資料。',
            'Failed to load STL dental model. You can drag and drop or use the Load button to import another case.'
          )
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [upperStlUrl, lowerStlUrl]);

  // Handle 3D Point-to-Point Digital Caliper Click OR 3D Tooth Editor Selection & Drag on Viewport
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    // 1. 3D Tooth Editor Selection & Interactive 3D Dragging
    if (settings.modelEdit?.enabled && !settings.caliperToolActive) {
      const modelEdit = settings.modelEdit;

      // 1A. Raycast directly against discrete Tooth Objects (Native 3D Teeth & Placed Library Teeth)
      const toothTargets: THREE.Object3D[] = [];
      if (placedUpperGroupRef.current && settings.showUpper) {
        toothTargets.push(...placedUpperGroupRef.current.children);
      }
      if (placedLowerGroupRef.current && settings.showLower) {
        toothTargets.push(...placedLowerGroupRef.current.children);
      }
      if (nativeUpperGroupRef.current && settings.showUpper) {
        toothTargets.push(...nativeUpperGroupRef.current.children);
      }
      if (nativeLowerGroupRef.current && settings.showLower) {
        toothTargets.push(...nativeLowerGroupRef.current.children);
      }

      const toothHits =
        toothTargets.length > 0 ? raycaster.intersectObjects(toothTargets, false) : [];

      if (toothHits.length > 0) {
        const hitObj = toothHits[0].object;
        const isUpper = Boolean(hitObj.userData?.isUpper);

        // Hit placed library tooth
        if (hitObj.userData?.placedToothId) {
          const placedId = hitObj.userData.placedToothId as string;
          const placedItem = modelEdit.placedTeeth.find((p) => p.id === placedId);
          if (placedItem) {
            const newTarget: SelectedToothTarget = { kind: 'placed', placedId };
            onSettingsChange((prev) => ({
              ...prev,
              modelEdit: {
                ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
                selectedTarget: newTarget,
              },
            }));

            if (
              modelEdit.toolMode === 'drag' ||
              (modelEdit.selectedTarget?.kind === 'placed' &&
                modelEdit.selectedTarget.placedId === placedId)
            ) {
              dragStartSnapshotRef.current = createModelEditSnapshot(modelEdit);
              hasDraggedRef.current = false;
              activeToothDragRef.current = {
                target: newTarget,
                isUpper,
                startWorldPt: toothHits[0].point.clone(),
                initialPosOrOffset: { ...placedItem.position },
              };
              if (controlsRef.current) controlsRef.current.enabled = false;
            }
            return;
          }
        }

        // Hit native discrete tooth object
        if (hitObj.userData?.isNativeTooth && hitObj.userData?.fdi) {
          const fdi = hitObj.userData.fdi as FdiToothNumber;
          const newTarget: SelectedToothTarget = { kind: 'native', fdi };
          onSettingsChange((prev) => ({
            ...prev,
            modelEdit: {
              ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
              selectedTarget: newTarget,
            },
          }));

          if (
            modelEdit.toolMode === 'drag' ||
            (modelEdit.selectedTarget?.kind === 'native' &&
              modelEdit.selectedTarget.fdi === fdi)
          ) {
            const curEdit = modelEdit.nativeEdits[fdi];
            dragStartSnapshotRef.current = createModelEditSnapshot(modelEdit);
            hasDraggedRef.current = false;
            activeToothDragRef.current = {
              target: newTarget,
              isUpper,
              startWorldPt: toothHits[0].point.clone(),
              initialPosOrOffset: curEdit
                ? { ...curEdit.offsetMm }
                : { x: 0, y: 0, z: 0 },
            };
            if (controlsRef.current) controlsRef.current.enabled = false;
          }
          return;
        }
      }

      // 1B. Raycast against Gingiva Base mesh (fallback to nearest tooth site if clicking near socket)
      const archTargets: THREE.Object3D[] = [];
      if (upperMeshRef.current && settings.showUpper) archTargets.push(upperMeshRef.current);
      if (lowerMeshRef.current && settings.showLower) archTargets.push(lowerMeshRef.current);
      const archHits =
        archTargets.length > 0 ? raycaster.intersectObjects(archTargets, false) : [];

      if (archHits.length > 0) {
        const hit = archHits[0];
        const isUpper = hit.object === upperMeshRef.current;
        const localVec = hit.point.clone();
        hit.object.worldToLocal(localVec);

        const picked = identifyToothAtPoint3D(
          { x: localVec.x, y: localVec.y, z: localVec.z },
          isUpper,
          segmentedTeeth,
          modelEdit.placedTeeth,
          modelEdit.nativeEdits
        );

        if (picked) {
          onSettingsChange((prev) => ({
            ...prev,
            modelEdit: {
              ...(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS),
              selectedTarget: picked,
            },
          }));

          if (
            picked.kind === 'native' &&
            picked.fdi &&
            (modelEdit.toolMode === 'drag' ||
              (modelEdit.selectedTarget?.kind === 'native' &&
                modelEdit.selectedTarget.fdi === picked.fdi))
          ) {
            const curEdit = modelEdit.nativeEdits[picked.fdi];
            dragStartSnapshotRef.current = createModelEditSnapshot(modelEdit);
            hasDraggedRef.current = false;
            activeToothDragRef.current = {
              target: picked,
              isUpper,
              startWorldPt: hit.point.clone(),
              initialPosOrOffset: curEdit
                ? { ...curEdit.offsetMm }
                : { x: 0, y: 0, z: 0 },
            };
            if (controlsRef.current) controlsRef.current.enabled = false;
          }
        }
        return;
      }
    }

    // 2. 3D Point-to-Point Digital Caliper Click
    if (!settings.caliperToolActive || !onAddCaliperMeasurement) return;

    const targets: THREE.Object3D[] = [];
    if (upperMeshRef.current && settings.showUpper) targets.push(upperMeshRef.current);
    if (lowerMeshRef.current && settings.showLower) targets.push(lowerMeshRef.current);
    if (targets.length === 0) return;

    const hits = raycaster.intersectObjects(targets, false);

    if (hits.length > 0) {
      const hitPt: Point3D = {
        x: hits[0].point.x,
        y: hits[0].point.y,
        z: hits[0].point.z,
      };
      if (!pendingCaliperPointRef.current) {
        pendingCaliperPointRef.current = hitPt;
        setPendingCaliperPoint(hitPt);
      } else {
        const ptA = pendingCaliperPointRef.current;
        pendingCaliperPointRef.current = null;
        setPendingCaliperPoint(null);
        onAddCaliperMeasurement(ptA, hitPt);
      }
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dragState = activeToothDragRef.current;
    if (!dragState) return;
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -dragState.startWorldPt.z);
    const intersectPt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, intersectPt)) return;

    let delta = new THREE.Vector3().subVectors(intersectPt, dragState.startWorldPt);
    if (!dragState.isUpper) {
      // If lower arch is articulated, transform world-space mouse delta by the lower jaw's rotation
      const lowerRotMat = new THREE.Matrix4()
        .makeRotationFromEuler(
          new THREE.Euler(
            currentKinematics.lowerRotation.x,
            currentKinematics.lowerRotation.y,
            currentKinematics.lowerRotation.z
          )
        )
        .invert();
      delta.applyMatrix4(lowerRotMat);
    }

    const dx = Number(delta.x.toFixed(2));
    const dy = Number(delta.y.toFixed(2));
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      hasDraggedRef.current = true;
    }

    if (dragState.target.kind === 'placed' && dragState.target.placedId) {
      const placedId = dragState.target.placedId;
      const nextX = Number((dragState.initialPosOrOffset.x + dx).toFixed(2));
      const nextY = Number((dragState.initialPosOrOffset.y + dy).toFixed(2));
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
        return {
          ...prev,
          modelEdit: {
            ...cur,
            placedTeeth: cur.placedTeeth.map((p) =>
              p.id === placedId
                ? { ...p, position: { ...p.position, x: nextX, y: nextY } }
                : p
            ),
          },
        };
      });
    } else if (dragState.target.kind === 'native' && dragState.target.fdi) {
      const fdi = dragState.target.fdi;
      const nextX = Math.max(
        -18,
        Math.min(18, Number((dragState.initialPosOrOffset.x + dx).toFixed(2)))
      );
      const nextY = Math.max(
        -18,
        Math.min(18, Number((dragState.initialPosOrOffset.y + dy).toFixed(2)))
      );
      onSettingsChange((prev) => {
        const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
        const prevOp = cur.nativeEdits[fdi] || {
          fdi,
          deleted: false,
          offsetMm: { x: 0, y: 0, z: 0 },
          rotationDeg: 0,
          scale: 1,
        };
        return {
          ...prev,
          modelEdit: {
            ...cur,
            nativeEdits: {
              ...cur.nativeEdits,
              [fdi]: {
                ...prevOp,
                offsetMm: {
                  ...prevOp.offsetMm,
                  x: nextX,
                  y: nextY,
                },
              },
            },
          },
        };
      });
    }
  };

  const handleViewportPointerUp = () => {
    if (activeToothDragRef.current) {
      if (hasDraggedRef.current && dragStartSnapshotRef.current) {
        const snap = dragStartSnapshotRef.current;
        onSettingsChange((prev) => {
          const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
          const prevPast = cur.history?.past || [];
          return {
            ...prev,
            modelEdit: {
              ...cur,
              history: {
                past: [...prevPast.slice(-31), snap],
                future: [],
              },
            },
          };
        });
      }
      activeToothDragRef.current = null;
      dragStartSnapshotRef.current = null;
      hasDraggedRef.current = false;
      if (controlsRef.current) controlsRef.current.enabled = true;
    }
  };

  // Handle Drag & Drop on Viewport (Supports both 3D Tooth Library drag-and-drop AND Case ZIP/STL files)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('application/x-dentalcad-tooth')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // 1. Check if a 3D Tooth Library item was dragged and dropped onto the 3D viewport
    const toothDataRaw = e.dataTransfer.getData('application/x-dentalcad-tooth');
    if (toothDataRaw) {
      try {
        const parsed = JSON.parse(toothDataRaw) as {
          morphology: ToothMorphologyType;
          isUpper: boolean;
        };
        const meta = getLibraryItemMeta(parsed.morphology);
        let dropPos: Point3D = { x: 0, y: -14, z: parsed.isUpper ? 1.5 : -1.5 };
        let dropIsUpper = parsed.isUpper;

        const container = containerRef.current;
        const camera = cameraRef.current;
        if (container && camera) {
          const rect = container.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, camera);
          const archTargets: THREE.Object3D[] = [];
          if (upperMeshRef.current && settings.showUpper) archTargets.push(upperMeshRef.current);
          if (lowerMeshRef.current && settings.showLower) archTargets.push(lowerMeshRef.current);
          const hits =
            archTargets.length > 0 ? raycaster.intersectObjects(archTargets, false) : [];
          if (hits.length > 0) {
            dropIsUpper = hits[0].object === upperMeshRef.current;
            const localPt = hits[0].point.clone();
            if (dropIsUpper) {
              localPt.z -= currentKinematics.upperPosition.z;
            } else {
              const lowerInv = new THREE.Matrix4().fromArray(
                currentKinematics.lowerInverseMatrixElements
              );
              localPt.applyMatrix4(lowerInv);
            }
            dropPos = {
              x: Number(localPt.x.toFixed(2)),
              y: Number(localPt.y.toFixed(2)),
              z: Number(localPt.z.toFixed(2)),
            };
          } else {
            const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const pt = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(fallbackPlane, pt)) {
              dropPos = {
                x: Number(pt.x.toFixed(2)),
                y: Number(pt.y.toFixed(2)),
                z: dropIsUpper ? 1.5 : -1.5,
              };
            }
          }
        }

        const newId = `drop-${meta.morphology}-${Date.now()}`;
        const newTooth: PlacedLibraryTooth = {
          id: newId,
          labelZh: `${dropIsUpper ? '上顎' : '下顎'} ${meta.titleZh}`,
          labelEn: `${dropIsUpper ? 'Upper' : 'Lower'} ${meta.titleEn}`,
          morphology: meta.morphology,
          isUpper: dropIsUpper,
          position: dropPos,
          rotationDeg: 0,
          scale: 1.0,
        };

        onSettingsChange((prev) => {
          const cur = pushModelEditSnapshot(prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS);
          return {
            ...prev,
            caliperToolActive: false,
            modelEdit: {
              ...cur,
              enabled: true,
              toolMode: 'drag',
              placedTeeth: [...cur.placedTeeth, newTooth],
              selectedTarget: { kind: 'placed', placedId: newId },
            },
          };
        });
        return;
      } catch {
        // Ignore malformed drag payload
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onCustomFilesDrop) {
      onCustomFilesDrop(e.dataTransfer.files);
    }
  };

  // Screenshot capture
  const handleCaptureScreenshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const link = document.createElement('a');
    link.download = `DentalCAD_3D_Capture_${Date.now()}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    applyCameraPreset('front');
    onPresetSelect('front');
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full min-h-[240px] lg:min-h-[480px] cad-grid-bg overflow-hidden select-none ${
        settings.caliperToolActive
          ? 'cursor-crosshair'
          : settings.modelEdit?.enabled && settings.modelEdit.toolMode === 'drag'
          ? 'cursor-move'
          : ''
      }`}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-100/90 dark:bg-[#090d16]/90 z-40 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
          <div className="w-12 h-12 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            {tr(locale, '載入 3D 齒列數位模型中...', 'Loading 3D Dental Arch Models...')}
          </p>
          <div className="w-64 bg-slate-300 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{ width: `${(loadProgress.upper + loadProgress.lower) / 2}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-2 tabular-nums">
            {tr(
              locale,
              `上顎 ${loadProgress.upper}% / 下顎 ${loadProgress.lower}%`,
              `Upper ${loadProgress.upper}% / Lower ${loadProgress.lower}%`
            )}
          </span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="absolute top-4 left-4 right-4 z-40 bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800/60 p-3 rounded text-red-800 dark:text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-600 dark:text-red-400 hover:underline px-2 py-0.5 text-xs font-mono"
          >
            {tr(locale, '關閉', 'Close')}
          </button>
        </div>
      )}

      {/* 3D Caliper Active / Measurements Floating Banner */}
      <ViewportCaliperBanner
        settings={settings}
        onSettingsChange={onSettingsChange}
        caliperMeasurements={caliperMeasurements}
        pendingCaliperPoint={pendingCaliperPoint}
        onClearAllCaliper={() => {
          pendingCaliperPointRef.current = null;
          setPendingCaliperPoint(null);
          onClearCaliperMeasurements?.();
        }}
        locale={locale}
      />

      {/* 3D Model Diff Floating Color Scale Legend & Telemetry Banner */}
      <ViewportDiffBanner
        settings={settings}
        onSettingsChange={onSettingsChange}
        diffStats={activeDiffStats}
        locale={locale}
      />

      {/* 3D Tooth & Arch Editor Floating HUD Banner */}
      <ViewportEditorBanner
        settings={settings}
        onSettingsChange={onSettingsChange}
        segmentedTeeth={segmentedTeeth}
        locale={locale}
      />

      {/* Drag Over Hint */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-sky-900/75 border-2 border-dashed border-sky-400 flex flex-col items-center justify-center backdrop-blur-sm">
          <Upload className="w-12 h-12 text-sky-300 mb-2 transition-transform duration-300 scale-110" />
          <p className="text-base font-medium text-sky-100">
            {tr(
              locale,
              '放開以加載新案例 .zip 壓縮檔、資料包或 STL 模型',
              'Drop to load .zip archive, case bundle, or STL models'
            )}
          </p>
          <p className="text-xs text-sky-300/80">
            {tr(
              locale,
              '支援直接拖入 .zip 壓縮包或整套口掃檔案 (.stl + .xml + .jpg + .pdf)',
              'Supports .zip archives or scanner files (.stl + .xml + .jpg + .pdf)'
            )}
          </p>
        </div>
      )}

      {/* Floating Top Controls: Camera Presets (Horizontally scrollable on mobile) */}
      <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 right-2.5 sm:right-auto z-30 flex items-center flex-nowrap sm:flex-wrap overflow-x-auto gap-1 sm:gap-1.5 bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200 dark:border-slate-800 p-1 rounded-lg backdrop-blur shadow-md">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-1.5 sm:px-2 py-1 flex items-center gap-1 flex-shrink-0">
          <Compass className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
          <span className="hidden xs:inline">{tr(locale, '視角', 'View')}</span>
        </span>
        {(
          [
            { id: 'front', label: tr(locale, '正視咬合', 'Front') },
            { id: 'upper', label: tr(locale, '上顎面', 'Upper') },
            { id: 'lower', label: tr(locale, '下顎面', 'Lower') },
            { id: 'right', label: tr(locale, '右側頰', 'Right') },
            { id: 'left', label: tr(locale, '左側頰', 'Left') },
            { id: 'isometric', label: tr(locale, '立體等角', 'Isometric') },
          ] as { id: CameraPreset; label: string }[]
        ).map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`camera-preset-${preset.id}`}
            onClick={() => {
              onPresetSelect(preset.id);
              applyCameraPreset(preset.id);
            }}
            className={`px-2 sm:px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap flex-shrink-0 ${
              activePreset === preset.id
                ? 'bg-sky-500 text-white font-medium shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Dedicated Vertical Articulation Seek Bar & Spring-Back Joystick on Left Edge */}
      <MandibularJoystickBar
        settings={settings}
        onSettingsChange={onSettingsChange}
        locale={locale}
      />
      <div className="absolute top-14 sm:top-14 right-2.5 sm:right-4 z-30 flex items-center space-x-1 sm:space-x-1.5 bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200 dark:border-slate-800 p-1 rounded-lg backdrop-blur shadow-md">
        {/* Toggle Trajectory Gizmo (3D 運動軌跡與顳顎關節軸心) */}
        <button
          type="button"
          data-testid="viewport-toggle-trajectory-btn"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              articulator: {
                ...prev.articulator,
                showTrajectoryGizmo: !prev.articulator.showTrajectoryGizmo,
              },
            }))
          }
          title={
            settings.articulator.showTrajectoryGizmo
              ? tr(locale, '隱藏 3D 運動軌跡標記與顳顎關節軸心', 'Hide articulation trajectory gizmo & TMJ axis')
              : tr(locale, '顯示 3D 運動軌跡標記與顳顎關節軸心', 'Show articulation trajectory gizmo & TMJ axis')
          }
          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
            settings.articulator.showTrajectoryGizmo
              ? 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {settings.articulator.showTrajectoryGizmo
              ? tr(locale, '運動軌跡', 'Trajectory')
              : tr(locale, '隱藏軌跡', 'Trajectory Off')}
          </span>
        </button>

        {/* 3D Caliper Tool Trigger */}
        <button
          type="button"
          data-testid="viewport-caliper-tool-btn"
          onClick={() =>
            onSettingsChange((prev) => {
              const nextActive = !prev.caliperToolActive;
              return {
                ...prev,
                caliperToolActive: nextActive,
                showMeasurements: nextActive ? true : prev.showMeasurements,
              };
            })
          }
          title={tr(locale, '切換 3D 數位游標尺點選測距', 'Toggle 3D Digital Caliper')}
          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
            settings.caliperToolActive
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tr(locale, '3D 測距', '3D Caliper')}</span>
        </button>

        {/* 3D Model Diff Quick Trigger */}
        <button
          type="button"
          data-testid="viewport-diff-toggle"
          onClick={() =>
            onSettingsChange((prev) => {
              const cur = prev.modelDiff || DEFAULT_MODEL_DIFF_SETTINGS;
              return {
                ...prev,
                modelDiff: {
                  ...cur,
                  enabled: !cur.enabled,
                },
              };
            })
          }
          title={tr(
            locale,
            '切換 3D 模型差異比對 (偏差色譜圖 + 雙模型疊影)',
            'Toggle 3D Model Diff (Deviation Heatmap + Ghost Superimposition)'
          )}
          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
            settings.modelDiff?.enabled
              ? 'bg-cyan-600 text-white font-semibold shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tr(locale, '3D 比對', '3D Diff')}</span>
        </button>

        {/* 3D Tooth & Arch Editor Quick Trigger */}
        <button
          type="button"
          data-testid="viewport-editor-toggle"
          onClick={() => {
            onSettingsChange((prev) => {
              const cur = prev.modelEdit || DEFAULT_MODEL_EDIT_SETTINGS;
              const nextEnabled = !cur.enabled;
              if (nextEnabled) onOpenEditorPanel?.();
              return {
                ...prev,
                caliperToolActive: nextEnabled ? false : prev.caliperToolActive,
                modelEdit: {
                  ...cur,
                  enabled: nextEnabled,
                  selectedTarget:
                    nextEnabled && !cur.selectedTarget
                      ? { kind: 'native', fdi: 25 }
                      : cur.selectedTarget,
                },
              };
            });
          }}
          title={tr(
            locale,
            '切換 3D 齒列互動編輯 (辨識牙位 / 刪除 / 複製貼上 / 牙齒庫 / 拖動牙齒)',
            'Toggle 3D Tooth Editor (Segment, Select, Delete, Copy/Paste, Library & Drag)'
          )}
          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
            settings.modelEdit?.enabled
              ? 'bg-violet-600 text-white font-semibold shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tr(locale, '3D 編輯', '3D Editor')}</span>
        </button>

        {/* Hide / Show 3D Caliper Measurements Toggle */}
        {caliperMeasurements.length > 0 && (
          <button
            type="button"
            data-testid="viewport-toggle-measurements-btn"
            onClick={() =>
              onSettingsChange((prev) => ({
                ...prev,
                showMeasurements: prev.showMeasurements === false ? true : false,
              }))
            }
            title={
              settings.showMeasurements === false
                ? tr(locale, '顯示 3D 測距線與標記點', 'Show 3D measurements')
                : tr(locale, '隱藏 3D 測距線與標記點', 'Hide 3D measurements')
            }
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
              settings.showMeasurements === false
                ? 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200'
                : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            {settings.showMeasurements === false ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">
              {settings.showMeasurements === false
                ? tr(locale, '顯示測距', 'Show Dist')
                : tr(locale, '隱藏測距', 'Hide Dist')}
            </span>
          </button>
        )}

        {(caliperMeasurements.length > 0 || pendingCaliperPoint) && (
          <button
            type="button"
            data-testid="viewport-clear-caliper-toolbar-btn"
            onClick={() => {
              pendingCaliperPointRef.current = null;
              setPendingCaliperPoint(null);
              onClearCaliperMeasurements?.();
            }}
            title={tr(locale, '清除所有 3D 測距標記', 'Clear all 3D caliper markers')}
            className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{tr(locale, '清除', 'Clear')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleResetCamera}
          title={tr(locale, '重設視角至正面咬合', 'Reset camera to frontal view')}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCaptureScreenshot}
          title={tr(locale, '截取當前 3D 畫面 (PNG)', 'Capture 3D screenshot (PNG)')}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={
            isFullscreen
              ? tr(locale, '結束全螢幕', 'Exit fullscreen')
              : tr(locale, '全螢幕檢視', 'Fullscreen view')
          }
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Bottom Left: Arch Toggles, Articulation Simulator & Texture Controls (Collapsible on Mobile) */}
      <ViewportBottomHud
        settings={settings}
        onSettingsChange={onSettingsChange}
        currentKinematics={currentKinematics}
        triangleStats={triangleStats}
        fps={fps}
        locale={locale}
      />

      {/* Floating Upload & Drag-and-Drop Trigger (Bottom-right on Desktop; mobile uses Header & Quick Bar so top viewport buttons never overlap) */}
      <label
        data-testid="viewport-upload-label"
        className="hidden sm:flex absolute bottom-4 right-4 z-30 items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-[#0f172a]/95 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-normal text-slate-700 dark:text-slate-300 backdrop-blur shadow-sm cursor-pointer transition-colors"
      >
        <input
          data-testid="viewport-file-input"
          type="file"
          multiple
          accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0 && onCustomFilesDrop) {
              onCustomFilesDrop(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <Upload className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
        <span>
          {tr(
            locale,
            '加載或拖曳口掃檔案 (.zip / .stl / .xml / .jpg)',
            'Load or drop scan files (.zip / .stl / .xml / .jpg)'
          )}
        </span>
      </label>
    </div>
  );
};
