import {
  CaseManifest,
  DentalCaseBundle,
  DentalCaseMetadata,
  CameraPreset,
} from '../types/dental';
import {
  StoredCaseRecord,
  StoredPhotoRecord,
  saveCaseRecordToIndexedDB,
  getCaseRecordFromIndexedDB,
  hydrateCaseBundleFromRecord,
} from '../utils/caseStorage';

/**
 * Built-in fallback case bundle (synced with public/cases/manifest.json)
 * Ensures zero-latency initial render while still allowing dynamic manifest.json overrides.
 */
export const DEFAULT_CASE_BUNDLE: DentalCaseBundle = {
  id: '297077963',
  label: '#297077963 — Chen, Yung Chih (Invisalign)',
  source: 'builtin',
  metadata: {
    orderId: '297077963',
    orderCode: '0ACP263H',
    patientName: 'Chen, Yung Chih',
    patientId: 'ffcd7058-2e43-4fc0-a28f-0c99fd32d19e',
    doctorName: 'Dr. Chen, De Shing',
    doctorLicense: '808',
    doctorId: '838507',
    clinicName: 'Leader Way OMS Dental Clinic',
    clinicAddress:
      'No. 280, Sec. 3, Chongqing N. Rd, Datong Dist., Taipei City 10372, Taiwan',
    scanDate: '2026-05-02',
    exportTime: '11/11/2026 10:46:00',
    dueDate: '2026-05-02',
    procedure: 'Invisalign',
    procedureType: 'Invisalign Aligners',
    toothShadeSystem: 'VITA Lumin',
    upperAdaRange: 'ADA #1 - #16 (Maxillary Full Arch)',
    lowerAdaRange: 'ADA #17 - #32 (Mandibular Full Arch)',
    caasVersion: '1.0.0.49',
    iteroVersion: '2.19.0.107',
  },
  assets: {
    upperStlUrl: './cases/297077963/upper.stl',
    upperStlFileName: '297077963_shell_occlusion_u.stl',
    lowerStlUrl: './cases/297077963/lower.stl',
    lowerStlFileName: '297077963_shell_occlusion_l.stl',
    rxPdfUrl: './cases/297077963/rx.pdf',
    rxPdfFileName: 'iTero_Rx_297077963.pdf',
    rxHtmlUrl: './cases/297077963/rx.html',
    rxHtmlFileName: 'Rx_297077963.html',
    xmlV50Url: './cases/297077963/itero_export_v50.xml',
    xmlV50FileName: 'itero_export_#297077963_v50.xml',
    xmlV30Url: './cases/297077963/itero_export_v30.xml',
    xmlV30FileName: 'itero_export_#297077963_v30.xml',
    logoUrl: './cases/297077963/logo.png',
  },
  defaultMeshStats: {
    upperTriangles: 319289,
    lowerTriangles: 299787,
    upperDimensions: { width: 66.4, depth: 51.1, height: 19.5 },
    lowerDimensions: { width: 65.0, depth: 54.5, height: 22.0 },
  },
  photos: [
    {
      id: 'overview',
      title: '複合臨床全覽圖 (Overview)',
      viewName: 'Composite Penta View',
      description: 'iTero Element 系統自動匯總之五方位臨床照片集合總覽圖。',
      fileName: 'gallery_#297077963.jpg',
      src: './cases/297077963/gallery_overview.jpg',
      cameraPreset: 'isometric',
    },
    {
      id: 'front',
      title: '正視咬合面 (Frontal View)',
      viewName: 'Frontal Occlusion',
      description: '前牙中線、前牙覆咬 (Overbite) 與覆蓋 (Overjet) 及前牙齒列排列檢視。',
      fileName: 'gallery_#297077963_penta_front_m.jpg',
      src: './cases/297077963/penta_front.jpg',
      cameraPreset: 'front',
    },
    {
      id: 'upper',
      title: '上顎齒列咬合面 (Upper Arch)',
      viewName: 'Maxillary Occlusal',
      description: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度與旋轉度。',
      fileName: 'gallery_#297077963_penta_upper_m.jpg',
      src: './cases/297077963/penta_upper.jpg',
      cameraPreset: 'upper',
    },
    {
      id: 'lower',
      title: '下顎齒列咬合面 (Lower Arch)',
      viewName: 'Mandibular Occlusal',
      description: '下顎牙弓對稱性、舌側傾斜度及前牙擁擠 (Crowding) 分析。',
      fileName: 'gallery_#297077963_penta_lower_m.jpg',
      src: './cases/297077963/penta_lower.jpg',
      cameraPreset: 'lower',
    },
    {
      id: 'patientright',
      title: '右側頰面咬合 (Right Buccal)',
      viewName: 'Right Buccal Occlusion',
      description: '右側犬齒與第一大臼齒 Angle Class 咬合關係與齒間接觸。',
      fileName: 'gallery_#297077963_penta_patientright_m.jpg',
      src: './cases/297077963/penta_patientright.jpg',
      cameraPreset: 'right',
    },
    {
      id: 'patientleft',
      title: '左側頰面咬合 (Left Buccal)',
      viewName: 'Left Buccal Occlusion',
      description: '左側犬齒與第一大臼齒咬合關係、對咬接觸點及後牙側方引導。',
      fileName: 'gallery_#297077963_penta_patientleft_m.jpg',
      src: './cases/297077963/penta_patientleft.jpg',
      cameraPreset: 'left',
    },
  ],
};

/**
 * Fetch the dynamic case manifest generated in public/cases/manifest.json
 */
export async function fetchCaseManifest(): Promise<CaseManifest> {
  try {
    const res = await fetch('./cases/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as CaseManifest;
    if (data && Array.isArray(data.cases) && data.cases.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Using fallback case manifest:', err);
  }
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    defaultCaseId: DEFAULT_CASE_BUNDLE.id,
    cases: [DEFAULT_CASE_BUNDLE],
  };
}

/**
 * Parse iTero XML string (v3.0 or v5.0) into DentalCaseMetadata
 */
export function parseIteroXmlString(
  xmlText: string,
  fallbackOrderId = 'custom'
): DentalCaseMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const getText = (tag: string) =>
    doc.querySelector(tag)?.textContent?.trim() || '';

  const orderId = getText('OrderID') || fallbackOrderId;
  const orderCode = getText('OrderCode') || 'CUSTOM';
  const rawPatient = getText('Patient') || 'Custom Patient';
  const patientName = rawPatient.includes(',')
    ? rawPatient
        .split(',')
        .map((s) => s.trim())
        .reverse()
        .join(', ')
    : rawPatient;

  const patientId = getText('UniquePatientIdentifier') || `uid-${orderId}`;
  const doctorName = getText('Doctor') || 'Attending Clinician';
  const doctorLicense = getText('DoctorLicense') || 'N/A';
  const doctorId = getText('DoctorID') || 'N/A';
  const rawAddress = getText('PracticeShipToAddress') || '';
  const clinicName = rawAddress.includes('Clinic')
    ? rawAddress.slice(0, rawAddress.indexOf('Clinic') + 6).trim()
    : rawAddress || 'Dental Clinic';
  const clinicAddress =
    rawAddress.replace(clinicName, '').replace(/\s+N\/A\s+/g, ', ').trim() ||
    rawAddress;

  const dueDate = getText('DueDate') || new Date().toISOString().slice(0, 10);
  const exportTime = getText('ExportTime') || new Date().toISOString();

  const upperRangeEl = doc.querySelector('UpperRange');
  const lowerRangeEl = doc.querySelector('LowerRange');
  const upperFrom = upperRangeEl?.getAttribute('FromAdaId') || '1';
  const upperTo = upperRangeEl?.getAttribute('ToAdaId') || '16';
  const lowerFrom = lowerRangeEl?.getAttribute('FromAdaId') || '17';
  const lowerTo = lowerRangeEl?.getAttribute('ToAdaId') || '32';

  const procEl = doc.querySelector('RxDefines > Procedure > Type');
  const procTypeEl = doc.querySelector('RxDefines > ProcedureType > Type');
  const procedure =
    procEl?.getAttribute('Name') || getText('CaseTypeName') || 'Invisalign';
  const procedureType =
    procTypeEl?.getAttribute('Name') || `${procedure} Aligners`;

  return {
    orderId,
    orderCode,
    patientName,
    patientId,
    doctorName,
    doctorLicense,
    doctorId,
    clinicName,
    clinicAddress,
    scanDate: dueDate,
    exportTime,
    dueDate,
    procedure,
    procedureType,
    toothShadeSystem: getText('ToothShadeSystem') || 'VITA Lumin',
    upperAdaRange: `ADA #${upperFrom} - #${upperTo} (Maxillary Full Arch)`,
    lowerAdaRange: `ADA #${lowerFrom} - #${lowerTo} (Mandibular Full Arch)`,
    caasVersion: getText('CaaSVersion') || '1.0.0',
    iteroVersion: getText('iTeroVersion') || '2.19.0',
  };
}

/**
 * Build a complete DentalCaseBundle from user-selected or dropped files AND persist to IndexedDB
 * Supports dropping an entire iTero export folder (STLs + XMLs + JPGs + PDF + HTML)
 * or individual STL files.
 */
export async function buildCaseBundleFromFiles(
  fileList: FileList | File[],
  currentBundle: DentalCaseBundle
): Promise<DentalCaseBundle> {
  const files = Array.from(fileList);

  // Check for upper and lower STL files
  const stlFiles = files.filter((f) => f.name.toLowerCase().endsWith('.stl'));
  const upperStl =
    stlFiles.find((f) => {
      const n = f.name.toLowerCase();
      return n.includes('_u.stl') || n.includes('upper') || n.includes('maxilla');
    }) || (stlFiles.length === 1 ? stlFiles[0] : undefined);

  const lowerStl = stlFiles.find((f) => {
    const n = f.name.toLowerCase();
    return n.includes('_l.stl') || n.includes('lower') || n.includes('mandible');
  });

  // Check for XML metadata files
  const xmlFiles = files.filter((f) => f.name.toLowerCase().endsWith('.xml'));
  const xmlV50File =
    xmlFiles.find((f) => f.name.toLowerCase().includes('v50')) || xmlFiles[0];
  const xmlV30File = xmlFiles.find((f) => f.name.toLowerCase().includes('v30'));

  let rawXmlV50: string | undefined;
  let rawXmlV30: string | undefined;

  if (xmlV50File) {
    rawXmlV50 = await xmlV50File.text();
  }
  if (xmlV30File) {
    rawXmlV30 = await xmlV30File.text();
  }

  // Extract Order ID from filename if present
  const idMatch =
    upperStl?.name.match(/^(\d+)_/) ||
    lowerStl?.name.match(/^(\d+)_/) ||
    xmlV50File?.name.match(/#?(\d+)/);
  const inferredId = idMatch ? idMatch[1] : `custom-${Date.now().toString().slice(-4)}`;

  const metadata: DentalCaseMetadata =
    rawXmlV50 || rawXmlV30
      ? parseIteroXmlString((rawXmlV50 || rawXmlV30)!, inferredId)
      : {
          ...currentBundle.metadata,
          orderId: inferredId,
          patientName: upperStl?.name.replace(/\.stl$/i, '') || currentBundle.metadata.patientName,
        };

  // Check for Clinical Photos (.jpg / .png)
  const imageFiles = files.filter(
    (f) => /\.(jpe?g|png|webp)$/i.test(f.name) && !f.name.toLowerCase().includes('logo')
  );
  const storedPhotos: StoredPhotoRecord[] = [];

  const photoDefs: {
    id: string;
    match: (n: string) => boolean;
    title: string;
    viewName: string;
    description: string;
    cameraPreset: CameraPreset;
  }[] = [
    {
      id: 'overview',
      match: (n) => !n.includes('penta_'),
      title: '複合臨床全覽圖 (Overview)',
      viewName: 'Composite Penta View',
      description: 'iTero Element 系統自動匯總之五方位臨床照片集合總覽圖。',
      cameraPreset: 'isometric',
    },
    {
      id: 'front',
      match: (n) => n.includes('front'),
      title: '正視咬合面 (Frontal View)',
      viewName: 'Frontal Occlusion',
      description: '前牙中線、前牙覆咬與覆蓋及前牙齒列排列檢視。',
      cameraPreset: 'front',
    },
    {
      id: 'upper',
      match: (n) => n.includes('upper'),
      title: '上顎齒列咬合面 (Upper Arch)',
      viewName: 'Maxillary Occlusal',
      description: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度。',
      cameraPreset: 'upper',
    },
    {
      id: 'lower',
      match: (n) => n.includes('lower'),
      title: '下顎齒列咬合面 (Lower Arch)',
      viewName: 'Mandibular Occlusal',
      description: '下顎牙弓對稱性、舌側傾斜度及前牙擁擠分析。',
      cameraPreset: 'lower',
    },
    {
      id: 'patientright',
      match: (n) => n.includes('right'),
      title: '右側頰面咬合 (Right Buccal)',
      viewName: 'Right Buccal Occlusion',
      description: '右側犬齒與第一大臼齒咬合關係與齒間接觸。',
      cameraPreset: 'right',
    },
    {
      id: 'patientleft',
      match: (n) => n.includes('left'),
      title: '左側頰面咬合 (Left Buccal)',
      viewName: 'Left Buccal Occlusion',
      description: '左側犬齒與第一大臼齒咬合關係及後牙側方引導。',
      cameraPreset: 'left',
    },
  ];

  for (const def of photoDefs) {
    const matchedImg = imageFiles.find((f) => def.match(f.name.toLowerCase()));
    if (matchedImg) {
      storedPhotos.push({
        id: def.id,
        title: def.title,
        viewName: def.viewName,
        description: def.description,
        fileName: matchedImg.name,
        blob: matchedImg,
        cameraPreset: def.cameraPreset,
      });
    }
  }

  // Check for PDF & HTML Rx
  const pdfFile = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
  const htmlFile = files.find((f) => f.name.toLowerCase().endsWith('.html'));

  // Check if there is an existing record in IndexedDB for this ID to merge blobs
  const existingRecord = await getCaseRecordFromIndexedDB(metadata.orderId).catch(() => undefined);

  const record: StoredCaseRecord = {
    id: metadata.orderId,
    label: `#${metadata.orderId} — ${metadata.patientName} (${metadata.procedure})`,
    updatedAt: Date.now(),
    metadata,
    upperStlBlob: upperStl || existingRecord?.upperStlBlob,
    upperStlFileName:
      upperStl?.name || existingRecord?.upperStlFileName || currentBundle.assets.upperStlFileName,
    fallbackUpperStlUrl: currentBundle.assets.upperStlUrl,
    lowerStlBlob: lowerStl || existingRecord?.lowerStlBlob,
    lowerStlFileName:
      lowerStl?.name || existingRecord?.lowerStlFileName || currentBundle.assets.lowerStlFileName,
    fallbackLowerStlUrl: currentBundle.assets.lowerStlUrl,
    rxPdfBlob: pdfFile || existingRecord?.rxPdfBlob,
    rxPdfFileName: pdfFile?.name || existingRecord?.rxPdfFileName || currentBundle.assets.rxPdfFileName,
    fallbackRxPdfUrl: currentBundle.assets.rxPdfUrl,
    rxHtmlBlob: htmlFile || existingRecord?.rxHtmlBlob,
    rxHtmlFileName:
      htmlFile?.name || existingRecord?.rxHtmlFileName || currentBundle.assets.rxHtmlFileName,
    fallbackRxHtmlUrl: currentBundle.assets.rxHtmlUrl,
    xmlV50Blob: xmlV50File || existingRecord?.xmlV50Blob,
    xmlV50FileName:
      xmlV50File?.name || existingRecord?.xmlV50FileName || currentBundle.assets.xmlV50FileName,
    xmlV30Blob: xmlV30File || existingRecord?.xmlV30Blob,
    xmlV30FileName:
      xmlV30File?.name || existingRecord?.xmlV30FileName || currentBundle.assets.xmlV30FileName,
    rawXmlV50: rawXmlV50 ?? existingRecord?.rawXmlV50 ?? currentBundle.rawXmlV50,
    rawXmlV30: rawXmlV30 ?? existingRecord?.rawXmlV30 ?? currentBundle.rawXmlV30,
    storedPhotos:
      storedPhotos.length > 0 ? storedPhotos : existingRecord?.storedPhotos,
    fallbackPhotos: currentBundle.photos,
    logoUrl: currentBundle.assets.logoUrl,
  };

  await saveCaseRecordToIndexedDB(record).catch((err) =>
    console.warn('Failed to save case to IndexedDB:', err)
  );

  return hydrateCaseBundleFromRecord(record);
}

/**
 * Update just the upper or lower STL of a case and persist to IndexedDB
 */
export async function updateCaseStlInIndexedDB(
  currentBundle: DentalCaseBundle,
  upperFile?: File,
  lowerFile?: File
): Promise<DentalCaseBundle> {
  const existingRecord = await getCaseRecordFromIndexedDB(currentBundle.id).catch(() => undefined);

  const record: StoredCaseRecord = {
    id: currentBundle.id,
    label: currentBundle.label,
    updatedAt: Date.now(),
    metadata: currentBundle.metadata,
    upperStlBlob: upperFile || existingRecord?.upperStlBlob,
    upperStlFileName: upperFile ? upperFile.name : currentBundle.assets.upperStlFileName,
    fallbackUpperStlUrl: currentBundle.assets.upperStlUrl,
    lowerStlBlob: lowerFile || existingRecord?.lowerStlBlob,
    lowerStlFileName: lowerFile ? lowerFile.name : currentBundle.assets.lowerStlFileName,
    fallbackLowerStlUrl: currentBundle.assets.lowerStlUrl,
    rxPdfBlob: existingRecord?.rxPdfBlob,
    rxPdfFileName: currentBundle.assets.rxPdfFileName,
    fallbackRxPdfUrl: currentBundle.assets.rxPdfUrl,
    rxHtmlBlob: existingRecord?.rxHtmlBlob,
    rxHtmlFileName: currentBundle.assets.rxHtmlFileName,
    fallbackRxHtmlUrl: currentBundle.assets.rxHtmlUrl,
    xmlV50Blob: existingRecord?.xmlV50Blob,
    xmlV50FileName: currentBundle.assets.xmlV50FileName,
    xmlV30Blob: existingRecord?.xmlV30Blob,
    xmlV30FileName: currentBundle.assets.xmlV30FileName,
    rawXmlV50: currentBundle.rawXmlV50,
    rawXmlV30: currentBundle.rawXmlV30,
    storedPhotos: existingRecord?.storedPhotos,
    fallbackPhotos: currentBundle.photos,
    defaultMeshStats: currentBundle.defaultMeshStats,
    logoUrl: currentBundle.assets.logoUrl,
  };

  await saveCaseRecordToIndexedDB(record).catch((err) =>
    console.warn('Failed to save STL update to IndexedDB:', err)
  );

  return hydrateCaseBundleFromRecord(record);
}
