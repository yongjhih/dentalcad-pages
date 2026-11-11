export type ShadingMode = 'texture' | 'enamel' | 'plaster' | 'normal' | 'wireframe' | 'translucent';

export type CameraPreset = 'front' | 'upper' | 'lower' | 'right' | 'left' | 'isometric';

export type ThemeMode = 'dark' | 'light';

export type LocaleMode = 'en' | 'zh-TW';

export type ScannerVendor =
  | 'scanner_a'
  | '3shape'
  | 'medit'
  | 'shining3d'
  | 'carestream'
  | 'generic';

export type ArticulationMode =
  | 'hinge'
  | 'protrusion'
  | 'lateral_left'
  | 'lateral_right'
  | 'chewing'
  | 'parallel';

export type ArticulationCurvePresetId =
  | 'posselt'
  | 'pure_hinge'
  | 'early_translation'
  | 'steep_guidance'
  | 'custom';

export interface BezierControlPoints {
  p1x: number; // [0, 1]
  p1y: number; // [0, 1]
  p2x: number; // [0, 1]
  p2y: number; // [0, 1]
}

export interface ArticulatorSettings {
  mode: ArticulationMode;
  progress: number; // 0.0 (Centric Occlusion) to 1.0 (Max Excursion / Cycle)
  isPlaying: boolean;
  playbackSpeed: number; // 0.5x to 2.0x
  maxOpeningAngleDeg: number; // 5° to 32°
  condylarGuidanceAngleDeg: number; // Sagittal condylar inclination (10° to 60°)
  incisalGuidanceAngleDeg: number; // Anterior guidance angle (10° to 65°)
  bennettAngleDeg: number; // Lateral Bennett angle (0° to 35°)
  hingeAxisY: number; // Posterior TMJ hinge axis Y (mm, default -85)
  hingeAxisZ: number; // Superior TMJ hinge axis Z (mm, default 28)
  showTrajectoryGizmo: boolean; // Render 3D trajectory curve & TMJ hinge axis in viewport
  curvePresetId: ArticulationCurvePresetId;
  bezier: BezierControlPoints;
  manualExcursion?: { x: number; y: number }; // Continuous 2D direct joystick excursion (x: -1 to 1 lateral, y: -1 to 1 protrusion/opening)
}

export interface ViewportSettings {
  showUpper: boolean;
  showLower: boolean;
  occlusionSeparation: number; // 0 to 35mm (synced with articulator progress)
  shadingMode: ShadingMode;
  photoTextureMapped: boolean; // Project 5-view clinical photos onto 3D model
  occlusogramEnabled: boolean; // Occlusogram bite contact heatmap
  occlusogramMaxRangeMm: number; // Max clearance range in mm (default 1.6mm)
  caliperToolActive: boolean; // 3D point-to-point digital caliper mode
  showMeasurements?: boolean; // Show or hide 3D caliper measurement lines & points
  archDistinction: boolean; // distinct upper / lower tint
  wireframeOverlay: boolean;
  clippingEnabled: boolean;
  clippingAxis: 'x' | 'y' | 'z';
  clippingOffset: number;
  autoRotate: boolean;
  lightingIntensity: number;
  articulator: ArticulatorSettings;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface CaliperMeasurement {
  id: string;
  label: string;
  pointA: Point3D;
  pointB: Point3D;
  distanceMm: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
}

export interface OrthoArchMetrics {
  upperIntercanineWidthMm: number; // U3 - U3
  lowerIntercanineWidthMm: number; // L3 - L3
  upperIntermolarWidthMm: number; // U6 - U6
  lowerIntermolarWidthMm: number; // L6 - L6
  upperArchDepthMm: number;
  lowerArchDepthMm: number;
  overjetMm: number; // Horizontal anterior overlap
  overbiteMm: number; // Vertical anterior overlap
  midlineDeviationMm: number; // Upper vs lower anterior midline X offset
  archFormRatio: number; // Width / Depth ratio
}

export interface OcclusogramStats {
  minClearanceMm: number;
  meanContactClearanceMm: number;
  contactAreaMm2: number;
  heavyCollisionAreaMm2: number;
  leftContactPercent: number;
  rightContactPercent: number;
  anteriorContactPercent: number;
  posteriorContactPercent: number;
  totalContactPoints: number;
}

export interface MeshDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface MeshGeometryStats {
  upperTriangles: number;
  lowerTriangles: number;
  upperDimensions: MeshDimensions;
  lowerDimensions: MeshDimensions;
}

export interface DentalCaseAssets {
  upperStlUrl: string;
  upperStlFileName: string;
  lowerStlUrl: string;
  lowerStlFileName: string;
  rxPdfUrl?: string;
  rxPdfFileName?: string;
  rxHtmlUrl?: string;
  rxHtmlFileName?: string;
  xmlV50Url?: string;
  xmlV50FileName?: string;
  xmlV30Url?: string;
  xmlV30FileName?: string;
  logoUrl?: string;
}

export interface DentalCaseMetadata {
  orderId: string;
  orderCode: string;
  scannerVendor?: ScannerVendor;
  scannerModel?: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorLicense: string;
  doctorId: string;
  clinicName: string;
  clinicAddress: string;
  scanDate: string;
  exportTime: string;
  dueDate: string;
  procedure: string;
  procedureType: string;
  toothShadeSystem: string;
  upperAdaRange: string;
  lowerAdaRange: string;
  caasVersion: string;
  scannerVersion: string;
  transforms?: string[];
}

export interface ClinicalPhoto {
  id: string;
  title: string;
  viewName: string;
  description: string;
  fileName: string;
  src: string;
  cameraPreset: CameraPreset;
}

export interface DentalCaseBundle {
  id: string;
  label: string;
  source: 'builtin' | 'custom';
  metadata: DentalCaseMetadata;
  assets: DentalCaseAssets;
  photos: ClinicalPhoto[];
  defaultMeshStats?: MeshGeometryStats;
  rawXmlV50?: string;
  rawXmlV30?: string;
}

export interface CaseManifest {
  version: string;
  generatedAt: string;
  defaultCaseId: string;
  cases: DentalCaseBundle[];
}
