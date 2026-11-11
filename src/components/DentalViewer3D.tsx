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
  ArticulationMode,
  OcclusogramStats,
  OrthoArchMetrics,
  Point3D,
  CaliperMeasurement,
  LocaleMode,
} from '../types/dental';
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
import {
  Maximize2,
  Minimize2,
  Camera,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  Compass,
  Upload,
  AlertCircle,
  Play,
  Pause,
  Flame,
  Ruler,
  Activity,
  Trash2,
  ChevronDown,
  ChevronUp,
  CircleDot,
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

  // Animation & Lerp
  const animFrameIdRef = useRef<number | null>(null);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetCamUpRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(1.29, -18.36, 1.24));
  const lerpFramesRef = useRef<number>(0);
  const userInteractingRef = useRef<boolean>(false);

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
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic dental occlusion center computed from loaded STL bounding boxes
  const centerTarget = useRef(new THREE.Vector3(1.29, -18.36, 1.24));

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

  // Spring-back Mandibular Joystick handler: user drags thumbstick to articulate; releasing snaps back to neutral CO (progress: 0)
  const handleJoystickPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setJoystickActive(true);

    const updateFromPointer = (clientX: number, clientY: number) => {
      const container = joystickContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width / 2 - 14;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const distance = Math.hypot(rawDx, rawDy);
      const angle = Math.atan2(rawDy, rawDx);
      const clampedDist = Math.min(distance, maxRadius);

      const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
      const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

      setJoystickPos({
        x: normX * maxRadius,
        y: normY * maxRadius,
      });

      // Smooth continuous 2D mandibular excursion: directly drives jaw movements without mode switching
      const mag = Math.min(1, clampedDist / maxRadius);
      const roundedMag = Number(mag.toFixed(3));

      onSettingsChange((prev) => ({
        ...prev,
        occlusionSeparation: Math.round(roundedMag * 35),
        articulator: {
          ...prev.articulator,
          manualExcursion: { x: normX, y: normY },
          progress: roundedMag,
          isPlaying: false,
        },
      }));
    };

    updateFromPointer(e.clientX, e.clientY);
  }, [onSettingsChange]);

  const handleJoystickPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickActive) return;
    const container = joystickContainerRef.current;
    if (!container) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 14;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const distance = Math.hypot(rawDx, rawDy);
    const angle = Math.atan2(rawDy, rawDx);
    const clampedDist = Math.min(distance, maxRadius);

    const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
    const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

    setJoystickPos({
      x: normX * maxRadius,
      y: normY * maxRadius,
    });

    const mag = Math.min(1, clampedDist / maxRadius);
    const roundedMag = Number(mag.toFixed(3));

    onSettingsChange((prev) => ({
      ...prev,
      occlusionSeparation: Math.round(roundedMag * 35),
      articulator: {
        ...prev.articulator,
        manualExcursion: { x: normX, y: normY },
        progress: roundedMag,
        isPlaying: false,
      },
    }));
  }, [joystickActive, onSettingsChange]);

  const handleJoystickPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });

    // Spring back to neutral centric occlusion (0 progress & clear manual excursion)
    onSettingsChange((prev) => ({
      ...prev,
      occlusionSeparation: 0,
      articulator: {
        ...prev.articulator,
        manualExcursion: undefined,
        progress: 0,
        isPlaying: false,
      },
    }));
  }, [onSettingsChange]);

  // Build Material based on settings, Occlusogram state & loaded 5-view textures
  const createDentalMaterial = useCallback(
    (isUpper: boolean) => {
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

      if (isUpper) {
        upperOccUpdaterRef.current = null;
      } else {
        lowerOccUpdaterRef.current = null;
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
        const color = isUpper
          ? archDistinction
            ? 0xfef3c7
            : 0xf1f5f9
          : archDistinction
          ? 0xdbeafe
          : 0xf1f5f9;
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.75,
          metalness: 0.02,
          side: THREE.DoubleSide,
          wireframe: wireframeOverlay,
        });
        mat.clippingPlanes = clippingPlanes;
        return mat;
      }

      // Default: Clinical Enamel
      const color = isUpper
        ? archDistinction
          ? 0xfffaf0
          : 0xf8fafc
        : archDistinction
        ? 0xf0fdf4
        : 0xf8fafc;
      const mat = new THREE.MeshPhysicalMaterial({
        color,
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

  // Update clipping plane equation & materials
  useEffect(() => {
    if (!settings.clippingEnabled) {
      clippingPlaneRef.current = null;
    } else {
      const offset = settings.clippingOffset;
      if (settings.clippingAxis === 'z') {
        clippingPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, 0, -1), offset);
      } else if (settings.clippingAxis === 'y') {
        clippingPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, -1, 0), offset);
      } else {
        clippingPlaneRef.current = new THREE.Plane(new THREE.Vector3(-1, 0, 0), offset);
      }
    }

    if (upperMeshRef.current) {
      upperMeshRef.current.material = createDentalMaterial(true);
    }
    if (lowerMeshRef.current) {
      lowerMeshRef.current.material = createDentalMaterial(false);
    }
  }, [
    settings.clippingEnabled,
    settings.clippingAxis,
    settings.clippingOffset,
    createDentalMaterial,
  ]);

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

    // Compute & report real-time Occlusogram contact statistics
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
      onOcclusogramStatsComputed(stats);
    }
  }, [
    settings.showUpper,
    settings.showLower,
    settings.occlusogramMaxRangeMm,
    currentKinematics,
    mapsReady,
    onOcclusogramStatsComputed,
  ]);

  // Render 3D Articulation Trajectory Curve & TMJ Hinge Axis Gizmo inside the 3D scene
  useEffect(() => {
    const group = trajectoryGroupRef.current;
    if (!group) return;

    // Clear previous gizmo objects
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

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

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

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
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);
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
        }
      }

      controls.update();
      renderer!.render(scene, camera);

      frameCount++;
      if (currentTime - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - fpsTimer)));
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

        // Remove previous meshes if any
        if (upperMeshRef.current) {
          scene.remove(upperMeshRef.current);
          upperMeshRef.current.geometry.dispose();
        }
        if (lowerMeshRef.current) {
          scene.remove(lowerMeshRef.current);
          lowerMeshRef.current.geometry.dispose();
        }

        const upperMesh = new THREE.Mesh(upperGeom, createDentalMaterial(true));
        upperMesh.visible = settings.showUpper;
        upperMesh.position.set(
          currentKinematics.upperPosition.x,
          currentKinematics.upperPosition.y,
          currentKinematics.upperPosition.z
        );

        const lowerMesh = new THREE.Mesh(lowerGeom, createDentalMaterial(false));
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

        // Snap camera immediately on initial/case load so user dragging never fights an active lerp
        applyCameraPreset(activePreset, true);
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

  // Handle 3D Point-to-Point Digital Caliper Click on Viewport
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settings.caliperToolActive || !onAddCaliperMeasurement) return;
    if ((e.target as HTMLElement).closest('button, input')) return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const targets: THREE.Object3D[] = [];
    if (upperMeshRef.current && settings.showUpper) targets.push(upperMeshRef.current);
    if (lowerMeshRef.current && settings.showLower) targets.push(lowerMeshRef.current);
    if (targets.length === 0) return;

    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
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

  // Handle Drag & Drop on Viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full h-full min-h-[240px] lg:min-h-[480px] cad-grid-bg overflow-hidden select-none ${
        settings.caliperToolActive ? 'cursor-crosshair' : ''
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
      {(settings.caliperToolActive || caliperMeasurements.length > 0 || pendingCaliperPoint) && (
        <div className="absolute top-24 sm:top-16 left-2.5 sm:left-4 z-30 bg-white/95 dark:bg-[#0f172a]/95 border border-amber-500/50 text-slate-900 dark:text-slate-100 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-md backdrop-blur max-w-[calc(100%-1.25rem)]">
          <Ruler className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="font-medium truncate">
            {settings.caliperToolActive
              ? pendingCaliperPoint
                ? tr(
                    locale,
                    '請點選第二點 (Point B) 完成測距',
                    'Click second point (Point B) to measure'
                  )
                : tr(
                    locale,
                    '3D 測距中：請於齒列模型上點選兩點',
                    '3D Caliper active: click two points on the arch'
                  )
              : tr(
                  locale,
                  `已標記 ${caliperMeasurements.length} 組 3D 測距`,
                  `${caliperMeasurements.length} 3D measurement(s)`
                )}
          </span>
          {caliperMeasurements.length > 0 && (
            <span className="font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums border-l border-slate-200 dark:border-slate-700 pl-2 flex-shrink-0">
              {caliperMeasurements[0].distanceMm.toFixed(2)} mm
            </span>
          )}
          {caliperMeasurements.length > 0 && (
            <button
              type="button"
              data-testid="viewport-toggle-measurements-banner-btn"
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  showMeasurements: prev.showMeasurements === false ? true : false,
                }))
              }
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors flex-shrink-0"
              title={
                settings.showMeasurements === false
                  ? tr(locale, '顯示 3D 測距線與標記點', 'Show 3D measurements')
                  : tr(locale, '隱藏 3D 測距線與標記點', 'Hide 3D measurements')
              }
            >
              {settings.showMeasurements === false ? (
                <>
                  <Eye className="w-3 h-3 text-amber-500" />
                  <span>{tr(locale, '顯示測距', 'Show')}</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-slate-400" />
                  <span>{tr(locale, '隱藏測距', 'Hide')}</span>
                </>
              )}
            </button>
          )}
          {(caliperMeasurements.length > 0 || pendingCaliperPoint) && (
            <button
              type="button"
              data-testid="viewport-clear-caliper-btn"
              onClick={() => {
                pendingCaliperPointRef.current = null;
                setPendingCaliperPoint(null);
                onClearCaliperMeasurements?.();
              }}
              className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors flex-shrink-0"
              title={tr(
                locale,
                '直接清除 3D 視窗中的所有測距線與標記點',
                'Clear all 3D caliper lines and markers'
              )}
            >
              <Trash2 className="w-3 h-3" />
              <span>{tr(locale, '清除測距', 'Clear')}</span>
            </button>
          )}
        </div>
      )}

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
      <div className="absolute top-20 sm:top-24 left-2.5 sm:left-4 z-30 flex flex-col items-center gap-3 bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800 p-2 sm:p-2.5 rounded-xl backdrop-blur shadow-xl">
        {/* Play / Pause Toggle Button */}
        <button
          type="button"
          data-testid="vertical-play-toggle-btn"
          onClick={() =>
            onSettingsChange((prev) => ({
              ...prev,
              articulator: {
                ...prev.articulator,
                isPlaying: !prev.articulator.isPlaying,
              },
            }))
          }
          className={`p-1.5 rounded-lg transition-all shadow-sm ${
            settings.articulator.isPlaying
              ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse'
              : 'bg-sky-600 text-white hover:bg-sky-500'
          }`}
          title={
            settings.articulator.isPlaying
              ? tr(locale, '暫停下顎運動 (垂直 SeekBar)', 'Pause articulation')
              : tr(locale, '自動播放下顎運動 (垂直 SeekBar)', 'Auto-play articulation')
          }
        >
          {settings.articulator.isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Vertical Seek Bar */}
        <div className="flex flex-col items-center gap-1.5 h-36 sm:h-44">
          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase">
            100%
          </span>
          <div className="relative flex-1 flex items-center justify-center w-6">
            <input
              type="range"
              data-testid="vertical-articulation-seekbar"
              min="0"
              max="1"
              step="0.01"
              value={settings.articulator.progress}
              onChange={(e) => {
                const p = parseFloat(e.target.value);
                onSettingsChange((prev) => ({
                  ...prev,
                  occlusionSeparation: Math.round(p * 35),
                  articulator: {
                    ...prev.articulator,
                    progress: p,
                    isPlaying: false,
                  },
                }));
              }}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
              className="w-1.5 h-28 sm:h-36 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              title={tr(locale, '垂直咬合行程拉桿', 'Vertical Articulation Slider')}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase">
            CO
          </span>
        </div>

        {/* Readout Pill */}
        <div className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-medium text-sky-600 dark:text-sky-400 text-center tabular-nums">
          {Math.round(settings.articulator.progress * 100)}%
        </div>

        <div className="w-full h-px bg-slate-200 dark:bg-slate-800" />

        {/* Spring-Back Mandibular Joystick (蘑菇頭控制器 - 鬆開自動彈回中立位) */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <CircleDot className="w-3 h-3 text-sky-500" />
            <span>{tr(locale, '搖桿', 'Stick')}</span>
          </div>

          <div
            ref={joystickContainerRef}
            data-testid="mandibular-joystick-pad"
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className={`relative w-14 h-14 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/90 flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none shadow-inner transition-colors ${
              joystickActive ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40' : ''
            }`}
            title={tr(
              locale,
              '咬合運動蘑菇頭搖桿（拖曳模擬前突與側方運動，鬆開自動回到中立位 CO）',
              'Mandibular joystick: drag to articulate in any excursion direction; release to spring back to neutral CO.'
            )}
          >
            {/* Crosshairs & Direction Indicators */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-full h-px bg-slate-400 dark:bg-slate-600" />
              <div className="h-full w-px bg-slate-400 dark:bg-slate-600 absolute" />
            </div>

            {/* Thumbstick Puck (蘑菇頭本體) */}
            <div
              data-testid="mandibular-joystick-thumb"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                transition: joystickActive ? 'none' : 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
              className={`w-6 h-6 rounded-full shadow-md flex items-center justify-center pointer-events-none transition-colors ${
                joystickActive
                  ? 'bg-sky-500 text-white shadow-sky-500/40'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current opacity-70" />
            </div>
          </div>
          <span className="text-[8px] text-slate-400 text-center leading-tight">
            {joystickActive
              ? tr(locale, '運動中', 'Active')
              : tr(locale, '鬆開回中', 'Spring CO')}
          </span>
        </div>
      </div>
      <div className="absolute top-12 sm:top-4 right-2.5 sm:right-4 z-30 flex items-center space-x-1 sm:space-x-1.5 bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200 dark:border-slate-800 p-1 rounded-lg backdrop-blur shadow-md">
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
      <div className="absolute bottom-2.5 sm:bottom-4 left-2.5 sm:left-4 right-2.5 sm:right-auto z-30 flex flex-col gap-1.5 sm:gap-2 max-w-full sm:max-w-md">
        <div className="bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 rounded-lg backdrop-blur shadow-lg text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
              <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
              <span className="truncate">
                {tr(locale, '咬合運動模擬與牙弓檢視', 'Articulation & Arch Control')}
              </span>
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    showUpper: !prev.showUpper,
                  }))
                }
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  settings.showUpper
                    ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-amber-500/40'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border border-transparent'
                }`}
              >
                {settings.showUpper ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {tr(locale, '上顎 (U)', 'Upper (U)')}
              </button>
              <button
                type="button"
                onClick={() =>
                  onSettingsChange((prev) => ({
                    ...prev,
                    showLower: !prev.showLower,
                  }))
                }
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  settings.showLower
                    ? 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-200 border border-sky-500/40'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border border-transparent'
                }`}
              >
                {settings.showLower ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {tr(locale, '下顎 (L)', 'Lower (L)')}
              </button>
              <button
                type="button"
                data-testid="viewport-hud-toggle"
                onClick={() => setHudCollapsed((v) => !v)}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                title={
                  hudCollapsed
                    ? tr(locale, '展開 3D 浮動控制面板', 'Expand 3D HUD Controls')
                    : tr(locale, '收合 3D 浮動控制面板（釋放手機視野）', 'Collapse 3D HUD Controls')
                }
              >
                {hudCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {!hudCollapsed && (
            <>
              {/* Quick Articulation Mode Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    { id: 'hinge', label: tr(locale, '生理樞軸', 'Hinge') },
                    { id: 'protrusion', label: tr(locale, '前突', 'Protrusion') },
                    { id: 'lateral_left', label: tr(locale, '左側方', 'Lat L') },
                    { id: 'lateral_right', label: tr(locale, '右側方', 'Lat R') },
                    { id: 'chewing', label: tr(locale, '咀嚼循環', 'Chewing') },
                    { id: 'parallel', label: tr(locale, '平行', 'Parallel') },
                  ] as { id: ArticulationMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onSettingsChange((prev) => ({
                        ...prev,
                        articulator: {
                          ...prev.articulator,
                          mode: m.id,
                        },
                      }))
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                      settings.articulator.mode === m.id
                        ? 'bg-sky-500 text-white border-sky-600'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Articulation Progress Slider & Play Button */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onSettingsChange((prev) => ({
                          ...prev,
                          articulator: {
                            ...prev.articulator,
                            isPlaying: !prev.articulator.isPlaying,
                          },
                        }))
                      }
                      className="p-1 rounded bg-sky-500 text-white hover:bg-sky-600 transition-colors"
                      title={
                        settings.articulator.isPlaying
                          ? tr(locale, '暫停咬合運動', 'Pause articulation')
                          : tr(locale, '自動播放咬合運動', 'Auto-play articulation')
                      }
                    >
                      {settings.articulator.isPlaying ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </button>
                    <span>{tr(locale, '下顎運動行程', 'Excursion Progress')}</span>
                  </div>
                  <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                    {settings.articulator.progress === 0
                      ? tr(locale, '中心咬合 CO (0%)', 'Centric CO (0%)')
                      : `${Math.round(settings.articulator.progress * 100)}% · ${currentKinematics.incisalOpeningMm.toFixed(1)}mm / ${currentKinematics.rotationAngleDeg.toFixed(1)}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.articulator.progress}
                  onChange={(e) => {
                    const p = parseFloat(e.target.value);
                    onSettingsChange((prev) => ({
                      ...prev,
                      occlusionSeparation: Math.round(p * 35),
                      articulator: {
                        ...prev.articulator,
                        progress: p,
                        isPlaying: false,
                      },
                    }));
                  }}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Occlusogram Quick Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  type="button"
                  data-testid="hud-occlusogram-btn"
                  onClick={() =>
                    onSettingsChange((prev) => ({
                      ...prev,
                      occlusogramEnabled: !prev.occlusogramEnabled,
                    }))
                  }
                  className={`w-full px-2.5 py-1 rounded text-[11px] font-medium transition-colors border flex items-center justify-center gap-1.5 ${
                    settings.occlusogramEnabled
                      ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{tr(locale, '咬合熱力圖', 'Occlusogram')}</span>
                </button>
              </div>

              {/* Quick shading pills */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800/80 gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {tr(locale, '材質', 'Shader')}
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'texture', label: tr(locale, '貼圖', 'Texture') },
                    { id: 'enamel', label: tr(locale, '琺瑯質', 'Enamel') },
                    { id: 'plaster', label: tr(locale, '石膏', 'Plaster') },
                    { id: 'normal', label: tr(locale, '法線', 'Normals') },
                    { id: 'wireframe', label: tr(locale, '線框', 'Wire') },
                    { id: 'translucent', label: tr(locale, '半透', 'X-Ray') },
                  ].map((m) => {
                    const isSelected =
                      m.id === 'texture'
                        ? settings.shadingMode === 'texture' || settings.photoTextureMapped
                        : settings.shadingMode === m.id && !settings.photoTextureMapped;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onSettingsChange((prev) => ({
                            ...prev,
                            shadingMode: m.id as ViewportSettings['shadingMode'],
                            photoTextureMapped: m.id === 'texture',
                          }))
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                          isSelected
                            ? 'bg-sky-500/15 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-medium'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Real-time CAD Mesh & System Stats Badge */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white/90 dark:bg-[#090d16]/80 border border-slate-200 dark:border-slate-800/80 rounded-md text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums shadow-sm">
          <span>
            {tr(locale, '上顎', 'Maxilla')}:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {triangleStats.upper.toLocaleString()}
            </strong>{' '}
            Δ
          </span>
          <span>
            {tr(locale, '下顎', 'Mandible')}:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {triangleStats.lower.toLocaleString()}
            </strong>{' '}
            Δ
          </span>
          <span>
            {tr(locale, '總計', 'Total')}:{' '}
            <strong className="text-sky-600 dark:text-sky-300 font-semibold">
              {(triangleStats.upper + triangleStats.lower).toLocaleString()}
            </strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fps} FPS</span>
        </div>
      </div>

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
