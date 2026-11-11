import {
  CameraPreset,
  ClinicalPhoto,
  DentalCaseBundle,
  DentalCaseMetadata,
  MeshGeometryStats,
} from '../types/dental';

const DB_NAME = 'OrthoCAD_CaseDB';
const DB_VERSION = 1;
const STORE_CASES = 'cases';
const LAST_ACTIVE_CASE_KEY = 'orthocad_last_active_case_id';

export interface StoredPhotoRecord {
  id: string;
  title: string;
  viewName: string;
  description: string;
  fileName: string;
  blob: Blob;
  cameraPreset: CameraPreset;
}

export interface StoredCaseRecord {
  id: string;
  label: string;
  updatedAt: number;
  metadata: DentalCaseMetadata;
  upperStlBlob?: Blob;
  upperStlFileName: string;
  fallbackUpperStlUrl?: string;
  lowerStlBlob?: Blob;
  lowerStlFileName: string;
  fallbackLowerStlUrl?: string;
  rxPdfBlob?: Blob;
  rxPdfFileName?: string;
  fallbackRxPdfUrl?: string;
  rxHtmlBlob?: Blob;
  rxHtmlFileName?: string;
  fallbackRxHtmlUrl?: string;
  xmlV50Blob?: Blob;
  xmlV50FileName?: string;
  xmlV30Blob?: Blob;
  xmlV30FileName?: string;
  rawXmlV50?: string;
  rawXmlV30?: string;
  storedPhotos?: StoredPhotoRecord[];
  fallbackPhotos?: ClinicalPhoto[];
  defaultMeshStats?: MeshGeometryStats;
  logoUrl?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        db.createObjectStore(STORE_CASES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a StoredCaseRecord in IndexedDB
 */
export async function saveCaseRecordToIndexedDB(record: StoredCaseRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readwrite');
    const store = tx.objectStore(STORE_CASES);
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get a single StoredCaseRecord by ID from IndexedDB
 */
export async function getCaseRecordFromIndexedDB(id: string): Promise<StoredCaseRecord | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readonly');
    const store = tx.objectStore(STORE_CASES);
    const req = store.get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result as StoredCaseRecord | undefined);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Update mesh stats on an existing IndexedDB case record once Three.js finishes computing them
 */
export async function updateStoredCaseMeshStats(
  id: string,
  meshStats: MeshGeometryStats
): Promise<void> {
  try {
    const existing = await getCaseRecordFromIndexedDB(id);
    if (!existing) return;
    existing.defaultMeshStats = meshStats;
    await saveCaseRecordToIndexedDB(existing);
  } catch (err) {
    console.warn('Failed to update mesh stats in IndexedDB:', err);
  }
}

/**
 * Delete a case from IndexedDB by ID
 */
export async function deleteCaseFromIndexedDB(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readwrite');
    const store = tx.objectStore(STORE_CASES);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Convert a StoredCaseRecord from IndexedDB into a live DentalCaseBundle with fresh Blob Object URLs
 */
export function hydrateCaseBundleFromRecord(record: StoredCaseRecord): DentalCaseBundle {
  const upperStlUrl = record.upperStlBlob
    ? URL.createObjectURL(record.upperStlBlob)
    : record.fallbackUpperStlUrl || '';
  const lowerStlUrl = record.lowerStlBlob
    ? URL.createObjectURL(record.lowerStlBlob)
    : record.fallbackLowerStlUrl || '';

  const rxPdfUrl = record.rxPdfBlob
    ? URL.createObjectURL(record.rxPdfBlob)
    : record.fallbackRxPdfUrl;
  const rxHtmlUrl = record.rxHtmlBlob
    ? URL.createObjectURL(record.rxHtmlBlob)
    : record.fallbackRxHtmlUrl;

  const xmlV50Url = record.xmlV50Blob
    ? URL.createObjectURL(record.xmlV50Blob)
    : record.rawXmlV50
    ? URL.createObjectURL(new Blob([record.rawXmlV50], { type: 'application/xml' }))
    : undefined;

  const xmlV30Url = record.xmlV30Blob
    ? URL.createObjectURL(record.xmlV30Blob)
    : record.rawXmlV30
    ? URL.createObjectURL(new Blob([record.rawXmlV30], { type: 'application/xml' }))
    : undefined;

  const photos: ClinicalPhoto[] =
    record.storedPhotos && record.storedPhotos.length > 0
      ? record.storedPhotos.map((p) => ({
          id: p.id,
          title: p.title,
          viewName: p.viewName,
          description: p.description,
          fileName: p.fileName,
          src: URL.createObjectURL(p.blob),
          cameraPreset: p.cameraPreset,
        }))
      : record.fallbackPhotos || [];

  return {
    id: record.id,
    label: record.label,
    source: 'custom',
    metadata: record.metadata,
    assets: {
      upperStlUrl,
      upperStlFileName: record.upperStlFileName,
      lowerStlUrl,
      lowerStlFileName: record.lowerStlFileName,
      rxPdfUrl,
      rxPdfFileName: record.rxPdfFileName,
      rxHtmlUrl,
      rxHtmlFileName: record.rxHtmlFileName,
      xmlV50Url,
      xmlV50FileName: record.xmlV50FileName,
      xmlV30Url,
      xmlV30FileName: record.xmlV30FileName,
      logoUrl: record.logoUrl || './images/itero_element_logo.png',
    },
    photos,
    defaultMeshStats: record.defaultMeshStats,
    rawXmlV50: record.rawXmlV50,
    rawXmlV30: record.rawXmlV30,
  };
}

/**
 * Load all persisted custom cases from IndexedDB, sorted by most recently updated
 */
export async function loadAllCasesFromIndexedDB(): Promise<DentalCaseBundle[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CASES, 'readonly');
      const store = tx.objectStore(STORE_CASES);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const records = (req.result as StoredCaseRecord[]) || [];
        records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(records.map(hydrateCaseBundleFromRecord));
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB unavailable or failed to read:', err);
    return [];
  }
}

export function saveLastActiveCaseId(caseId: string): void {
  try {
    localStorage.setItem(LAST_ACTIVE_CASE_KEY, caseId);
  } catch {
    // ignore storage errors
  }
}

export function getLastActiveCaseId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_CASE_KEY);
  } catch {
    return null;
  }
}
