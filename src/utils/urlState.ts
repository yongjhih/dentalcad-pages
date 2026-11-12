import { CameraPreset, LocaleMode, ShadingMode, ThemeMode } from '../types/dental';

export type ViewerTabType = 'dossier' | 'articulator' | 'gallery' | 'tools' | 'xml';

export interface CameraTransform {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ViewerUrlState {
  caseId?: string;
  cameraPreset?: CameraPreset;
  cameraTransform?: CameraTransform;
  shadingMode?: ShadingMode;
  photoTextureMapped?: boolean;
  showUpper?: boolean;
  showLower?: boolean;
  occlusionSeparation?: number;
  occlusogramEnabled?: boolean;
  activeTab?: ViewerTabType;
  theme?: ThemeMode;
  locale?: LocaleMode;
}

export const VIEWER_STATE_STORAGE_KEY = 'dentalcad_viewer_url_state';

const VALID_PRESETS = new Set<CameraPreset>([
  'front',
  'upper',
  'lower',
  'right',
  'left',
  'isometric',
]);

const VALID_SHADINGS = new Set<ShadingMode>([
  'enamel',
  'plaster',
  'normal',
  'translucent',
  'wireframe',
  'texture',
]);

const VALID_TABS = new Set<string>([
  'dossier',
  'articulator',
  'gallery',
  'tools',
  'xml',
]);

/**
 * Parses camera transform string in the format "px,py,pz,tx,ty,tz"
 */
export function parseCameraTransformString(val: string): CameraTransform | undefined {
  const parts = val.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length === 6 && parts.every((n) => Number.isFinite(n))) {
    return {
      position: [parts[0], parts[1], parts[2]],
      target: [parts[3], parts[4], parts[5]],
    };
  }
  return undefined;
}

/**
 * Serializes camera transform to a compact rounded string: "px,py,pz,tx,ty,tz"
 */
export function serializeCameraTransform(transform: CameraTransform): string {
  const round = (n: number) => {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? r.toString() : r.toFixed(1);
  };
  return `${round(transform.position[0])},${round(transform.position[1])},${round(
    transform.position[2]
  )},${round(transform.target[0])},${round(transform.target[1])},${round(
    transform.target[2]
  )}`;
}

/**
 * Parses URL search parameters into a structured ViewerUrlState
 */
export function parseViewerUrlParams(search: string): Partial<ViewerUrlState> {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw.trim()) {
    return {};
  }

  const params = new URLSearchParams(raw);
  const state: Partial<ViewerUrlState> = {};

  if (params.has('case')) {
    const val = params.get('case');
    if (val) state.caseId = val;
  }

  if (params.has('cam')) {
    const camStr = params.get('cam');
    if (camStr) {
      const transform = parseCameraTransformString(camStr);
      if (transform) state.cameraTransform = transform;
    }
  }

  if (params.has('view')) {
    const view = params.get('view') as CameraPreset;
    if (VALID_PRESETS.has(view)) {
      state.cameraPreset = view;
    }
  }

  if (params.has('shading')) {
    const shading = params.get('shading') as ShadingMode;
    if (VALID_SHADINGS.has(shading)) {
      state.shadingMode = shading;
    }
  }

  if (params.has('tex')) {
    const tex = params.get('tex');
    state.photoTextureMapped = tex === '1' || tex === 'true';
  }

  if (params.has('upper')) {
    const upper = params.get('upper');
    state.showUpper = upper !== '0' && upper !== 'false';
  }

  if (params.has('lower')) {
    const lower = params.get('lower');
    state.showLower = lower !== '0' && lower !== 'false';
  }

  if (params.has('sep')) {
    const sep = parseFloat(params.get('sep') || '');
    if (Number.isFinite(sep) && sep >= 0) {
      state.occlusionSeparation = Math.min(35, Math.max(0, sep));
    }
  }

  if (params.has('occ')) {
    const occ = params.get('occ');
    state.occlusogramEnabled = occ === '1' || occ === 'true';
  }

  if (params.has('tab')) {
    const tab = params.get('tab') as ViewerTabType;
    if (VALID_TABS.has(tab)) {
      state.activeTab = tab;
    }
  }

  if (params.has('theme')) {
    const theme = params.get('theme');
    if (theme === 'dark' || theme === 'light') {
      state.theme = theme;
    }
  }

  if (params.has('lang')) {
    const lang = params.get('lang');
    if (lang === 'zh-TW' || lang === 'en') {
      state.locale = lang;
    }
  }

  return state;
}

/**
 * Serializes ViewerUrlState to URL search string
 */
export function serializeViewerUrlParams(state: ViewerUrlState): string {
  const params = new URLSearchParams();

  if (state.caseId) params.set('case', state.caseId);
  if (state.cameraTransform) {
    params.set('cam', serializeCameraTransform(state.cameraTransform));
  } else if (state.cameraPreset) {
    params.set('view', state.cameraPreset);
  }

  if (state.shadingMode && state.shadingMode !== 'enamel') {
    params.set('shading', state.shadingMode);
  }

  if (typeof state.photoTextureMapped === 'boolean') {
    params.set('tex', state.photoTextureMapped ? '1' : '0');
  }

  if (typeof state.showUpper === 'boolean' && !state.showUpper) {
    params.set('upper', '0');
  }

  if (typeof state.showLower === 'boolean' && !state.showLower) {
    params.set('lower', '0');
  }

  if (typeof state.occlusionSeparation === 'number' && state.occlusionSeparation > 0) {
    params.set('sep', Math.round(state.occlusionSeparation * 10) / 10 + '');
  }

  if (state.occlusogramEnabled) {
    params.set('occ', '1');
  }

  if (state.activeTab && state.activeTab !== 'articulator') {
    params.set('tab', state.activeTab);
  }

  if (state.theme) params.set('theme', state.theme);
  if (state.locale) params.set('lang', state.locale);

  return params.toString();
}

/**
 * Loads the last saved viewer state from localStorage (used when URL has no params)
 */
export function loadPersistedViewerState(): Partial<ViewerUrlState> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(VIEWER_STATE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persists the latest viewer state to localStorage
 */
export function savePersistedViewerState(state: ViewerUrlState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VIEWER_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

/**
 * Updates the browser URL query string via history.replaceState
 */
export function updateBrowserUrl(state: ViewerUrlState): void {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const queryString = serializeViewerUrlParams(state);
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  } catch {
    // Ignore in non-browser environments
  }
}
