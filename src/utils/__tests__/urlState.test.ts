import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseViewerUrlParams,
  serializeViewerUrlParams,
  parseCameraTransformString,
  serializeCameraTransform,
  loadPersistedViewerState,
  savePersistedViewerState,
  updateBrowserUrl,
  ViewerUrlState,
} from '../urlState';

describe('Viewer URL State Synchronization and Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Camera Transform Parsing & Serialization', () => {
    it('parses valid 6-tuple camera coordinates', () => {
      const res = parseCameraTransformString('-75.2,-95.1,65.0,0.0,-19.5,0.5');
      expect(res).toBeDefined();
      expect(res?.position).toEqual([-75.2, -95.1, 65.0]);
      expect(res?.target).toEqual([0.0, -19.5, 0.5]);
    });

    it('returns undefined for invalid or malformed strings', () => {
      expect(parseCameraTransformString('invalid')).toBeUndefined();
      expect(parseCameraTransformString('1,2,3,4,5')).toBeUndefined(); // only 5 numbers
      expect(parseCameraTransformString('1,2,3,4,5,NaN')).toBeUndefined();
    });

    it('serializes camera transform cleanly with 1-decimal rounding', () => {
      const serialized = serializeCameraTransform({
        position: [-75.241, -95.062, 65.0],
        target: [0.0, -19.5, 0.5],
      });
      expect(serialized).toBe('-75.2,-95.1,65,0,-19.5,0.5');
    });
  });

  describe('parseViewerUrlParams', () => {
    it('returns empty object for empty or missing search query', () => {
      expect(parseViewerUrlParams('')).toEqual({});
      expect(parseViewerUrlParams('?')).toEqual({});
      expect(parseViewerUrlParams('   ')).toEqual({});
    });

    it('parses case, camera preset, and viewport settings correctly', () => {
      const query =
        '?case=DEMO-ARCH-01&view=front&shading=plaster&tex=1&upper=1&lower=0&sep=2.5&occ=1&tab=gallery&theme=dark&lang=zh-TW';
      const state = parseViewerUrlParams(query);

      expect(state.caseId).toBe('DEMO-ARCH-01');
      expect(state.cameraPreset).toBe('front');
      expect(state.shadingMode).toBe('plaster');
      expect(state.photoTextureMapped).toBe(true);
      expect(state.showUpper).toBe(true);
      expect(state.showLower).toBe(false);
      expect(state.occlusionSeparation).toBe(2.5);
      expect(state.occlusogramEnabled).toBe(true);
      expect(state.activeTab).toBe('gallery');
      expect(state.theme).toBe('dark');
      expect(state.locale).toBe('zh-TW');
    });

    it('parses free-orbit cam transform in preference over preset', () => {
      const query = '?case=TEST-01&cam=-12.5,45.2,88.1,0,-10,2';
      const state = parseViewerUrlParams(query);

      expect(state.cameraTransform).toEqual({
        position: [-12.5, 45.2, 88.1],
        target: [0, -10, 2],
      });
    });

    it('ignores invalid enum values safely', () => {
      const query = '?view=unknown&shading=superpowers&tab=invalidTab';
      const state = parseViewerUrlParams(query);
      expect(state.cameraPreset).toBeUndefined();
      expect(state.shadingMode).toBeUndefined();
      expect(state.activeTab).toBeUndefined();
    });
  });

  describe('serializeViewerUrlParams', () => {
    it('serializes state into URL query string', () => {
      const state: ViewerUrlState = {
        caseId: 'DEMO-ARCH-01',
        cameraPreset: 'upper',
        shadingMode: 'plaster',
        photoTextureMapped: true,
        showUpper: true,
        showLower: false,
        occlusionSeparation: 3.2,
        occlusogramEnabled: true,
        activeTab: 'tools',
        theme: 'light',
        locale: 'en',
      };

      const search = serializeViewerUrlParams(state);
      expect(search).toContain('case=DEMO-ARCH-01');
      expect(search).toContain('view=upper');
      expect(search).toContain('shading=plaster');
      expect(search).toContain('tex=1');
      expect(search).toContain('lower=0');
      expect(search).toContain('sep=3.2');
      expect(search).toContain('occ=1');
      expect(search).toContain('tab=tools');
      expect(search).toContain('theme=light');
      expect(search).toContain('lang=en');
    });

    it('serializes cameraTransform as cam parameter', () => {
      const state: ViewerUrlState = {
        cameraTransform: {
          position: [10, -50, 30],
          target: [0, 0, 0],
        },
      };
      const search = serializeViewerUrlParams(state);
      expect(search).toBe('cam=10%2C-50%2C30%2C0%2C0%2C0');
    });
  });

  describe('localStorage persistence (for parameterless URLs)', () => {
    it('saves and loads viewer state from localStorage', () => {
      expect(loadPersistedViewerState()).toBeNull();

      const sample: ViewerUrlState = {
        caseId: 'SAVED-01',
        cameraPreset: 'isometric',
        shadingMode: 'enamel',
        photoTextureMapped: true,
      };

      savePersistedViewerState(sample);
      const loaded = loadPersistedViewerState();
      expect(loaded).toEqual(sample);
    });
  });

  describe('updateBrowserUrl', () => {
    it('updates window.history.replaceState without throwing', () => {
      expect(() => {
        updateBrowserUrl({
          caseId: 'CASE-123',
          cameraPreset: 'front',
        });
      }).not.toThrow();
    });
  });
});
