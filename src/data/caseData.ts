import {
  CaseManifest,
  DentalCaseBundle,
  DentalCaseMetadata,
  CameraPreset,
  ScannerVendor,
} from '../types/dental';
import {
  StoredCaseRecord,
  StoredPhotoRecord,
  saveCaseRecordToIndexedDB,
  getCaseRecordFromIndexedDB,
  hydrateCaseBundleFromRecord,
} from '../utils/caseStorage';

const DEMO_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<DentalCADExport Version="1.0" Vendor="Universal-Scanner">
  <OrderInfo>
    <OrderID>DEMO-ARCH-01</OrderID>
    <OrderCode>DCAD-CALIB-01</OrderCode>
    <Patient>Demo, Calibration Arch</Patient>
    <UniquePatientIdentifier>00000000-0000-4000-8000-000000000001</UniquePatientIdentifier>
    <Doctor>Dr. Demo, Clinician</Doctor>
    <DoctorLicense>DEMO-808</DoctorLicense>
    <DoctorID>DCAD-DEMO</DoctorID>
    <PracticeShipToAddress>Universal DentalCAD Clinic 100 Digital Dentistry Blvd, Suite 3D</PracticeShipToAddress>
    <DueDate>2026-05-02</DueDate>
    <ExportTime>2026-05-02 09:00:00</ExportTime>
    <ToothShadeSystem>VITA Classical / 3D-Master</ToothShadeSystem>
    <ScannerVendor>Universal Intraoral Scanner</ScannerVendor>
    <ScannerModel>Procedural Calibration Arch (14-Tooth)</ScannerModel>
  </OrderInfo>
  <ActualUsedTransforms>
    <Transformation>-1 0 0 0, 0 -1 0 0, 0 0 1 0, 0 0 0 1</Transformation>
  </ActualUsedTransforms>
</DentalCADExport>`;

/**
 * Built-in zero-PHI synthetic calibration arch bundle.
 * No local patient files are loaded from disk; users upload their own scanner files via browser.
 */
export const DEFAULT_CASE_BUNDLE: DentalCaseBundle = {
  id: 'DEMO-ARCH-01',
  label: '#DEMO-ARCH-01 — Demo, Calibration Arch (DentalCAD)',
  source: 'builtin',
  metadata: {
    orderId: 'DEMO-ARCH-01',
    orderCode: 'DCAD-CALIB-01',
    scannerVendor: 'generic',
    scannerModel: 'Universal Synthetic Arch',
    patientName: 'Demo, Calibration Arch',
    patientId: '00000000-0000-4000-8000-000000000001',
    doctorName: 'Dr. Demo, Clinician',
    doctorLicense: 'DEMO-808',
    doctorId: 'DCAD-DEMO',
    clinicName: 'Universal DentalCAD Clinic',
    clinicAddress: '100 Digital Dentistry Blvd, Suite 3D (Browser Sandbox)',
    scanDate: '2026-05-02',
    exportTime: '2026-05-02 09:00:00',
    dueDate: '2026-05-02',
    procedure: 'DentalCAD 3D',
    procedureType: '3D Occlusal & Articulation Sandbox',
    toothShadeSystem: 'VITA Lumin',
    upperAdaRange: 'ADA #1 - #16 (Maxillary Full Arch)',
    lowerAdaRange: 'ADA #17 - #32 (Mandibular Full Arch)',
    caasVersion: '1.0.0',
    scannerVersion: 'Universal-Scanner',
  },
  assets: {
    upperStlUrl: 'procedural://upper',
    upperStlFileName: 'demo_maxilla_upper.stl',
    lowerStlUrl: 'procedural://lower',
    lowerStlFileName: 'demo_mandible_lower.stl',
  },
  defaultMeshStats: {
    upperTriangles: 14112,
    lowerTriangles: 14112,
    upperDimensions: { width: 61.2, depth: 50.8, height: 15.2 },
    lowerDimensions: { width: 56.8, depth: 48.6, height: 15.2 },
  },
  photos: [],
  rawXmlV50: DEMO_SAMPLE_XML,
};

/**
 * Returns the synthetic zero-PHI calibration manifest (no local disk files are loaded).
 */
export async function fetchCaseManifest(): Promise<CaseManifest> {
  return {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    defaultCaseId: DEFAULT_CASE_BUNDLE.id,
    cases: [DEFAULT_CASE_BUNDLE],
  };
}

/**
 * Automatically detect intraoral scanner vendor from filenames and XML metadata content.
 */
export function detectScannerVendor(
  files: Array<{ name: string }>,
  xmlText = ''
): { vendor: ScannerVendor; model: string } {
  const joinedNames = files.map((f) => f.name.toLowerCase()).join(' ');
  const xmlLower = xmlText.toLowerCase();

  if (
    joinedNames.includes('_shell_occlusion_') ||
    joinedNames.includes('penta_') ||
    xmlLower.includes('caasversion')
  ) {
    return { vendor: 'scanner_a', model: 'Element / Lumina Series' };
  }
  if (
    joinedNames.includes('upperjawscan') ||
    joinedNames.includes('lowerjawscan') ||
    joinedNames.includes('3shape') ||
    joinedNames.includes('trios') ||
    xmlLower.includes('3shape') ||
    xmlLower.includes('trios')
  ) {
    return { vendor: '3shape', model: '3Shape TRIOS' };
  }
  if (joinedNames.includes('medit') || xmlLower.includes('medit')) {
    return { vendor: 'medit', model: 'Medit i-Series (i600 / i700 / i900)' };
  }
  if (
    joinedNames.includes('aoralscan') ||
    joinedNames.includes('shining') ||
    xmlLower.includes('shining3d')
  ) {
    return { vendor: 'shining3d', model: 'Shining 3D Aoralscan' };
  }
  if (
    joinedNames.includes('carestream') ||
    joinedNames.includes('cs3') ||
    xmlLower.includes('carestream')
  ) {
    return { vendor: 'carestream', model: 'Carestream Dental CS Series' };
  }
  return { vendor: 'generic', model: 'Universal Intraoral Scanner (STL)' };
}

/**
 * Parse intraoral scanner XML metadata (supports multiple intraoral scanner XML schemas)
 */
export function parseScannerXmlString(
  xmlText: string,
  fallbackOrderId = 'custom',
  filesForDetection: Array<{ name: string }> = []
): DentalCaseMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const getText = (...tags: string[]) => {
    for (const tag of tags) {
      const val = doc.querySelector(tag)?.textContent?.trim();
      if (val) return val;
    }
    return '';
  };

  const detected = detectScannerVendor(filesForDetection, xmlText);

  const orderId = getText('OrderID', 'CaseID', 'RxID') || fallbackOrderId;
  const orderCode = getText('OrderCode', 'CaseCode') || detected.vendor.toUpperCase();
  const rawPatient =
    getText('Patient', 'PatientName', 'PatientFullName') || 'Custom Patient';
  const patientName = rawPatient.includes(',')
    ? rawPatient
        .split(',')
        .map((s) => s.trim())
        .reverse()
        .join(', ')
    : rawPatient;

  const patientId =
    getText('UniquePatientIdentifier', 'PatientID', 'PatientGUID') || `uid-${orderId}`;
  const doctorName =
    getText('Doctor', 'DoctorName', 'UserName', 'Clinician') || 'Attending Clinician';
  const doctorLicense = getText('DoctorLicense', 'LicenseNumber') || 'N/A';
  const doctorId = getText('DoctorID', 'ClinicianID') || 'N/A';
  const rawAddress =
    getText('PracticeShipToAddress', 'ClinicName', 'PracticeName') || '';
  const clinicName = rawAddress.includes('Clinic')
    ? rawAddress.slice(0, rawAddress.indexOf('Clinic') + 6).trim()
    : rawAddress || 'Dental Clinic';
  const clinicAddress =
    rawAddress.replace(clinicName, '').replace(/\s+N\/A\s+/g, ', ').trim() ||
    rawAddress;

  const dueDate =
    getText('DueDate', 'ScanDate', 'CreateDate') || new Date().toISOString().slice(0, 10);
  const exportTime = getText('ExportTime', 'ModifyDate') || new Date().toISOString();

  const upperRangeEl = doc.querySelector('UpperRange');
  const lowerRangeEl = doc.querySelector('LowerRange');
  const upperFrom = upperRangeEl?.getAttribute('FromAdaId') || '1';
  const upperTo = upperRangeEl?.getAttribute('ToAdaId') || '16';
  const lowerFrom = lowerRangeEl?.getAttribute('FromAdaId') || '17';
  const lowerTo = lowerRangeEl?.getAttribute('ToAdaId') || '32';

  const procEl = doc.querySelector('RxDefines > Procedure > Type');
  const procTypeEl = doc.querySelector('RxDefines > ProcedureType > Type');
  const procedure =
    procEl?.getAttribute('Name') ||
    getText('CaseTypeName', 'TreatmentType') ||
    detected.model;
  const procedureType =
    procTypeEl?.getAttribute('Name') || `${procedure} Digital Impression`;

  return {
    orderId,
    orderCode,
    scannerVendor: detected.vendor,
    scannerModel: detected.model,
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
    toothShadeSystem: getText('ToothShadeSystem', 'ShadeSystem') || 'VITA Lumin',
    upperAdaRange: `ADA #${upperFrom} - #${upperTo} (Maxillary Full Arch)`,
    lowerAdaRange: `ADA #${lowerFrom} - #${lowerTo} (Mandibular Full Arch)`,
    caasVersion: getText('CaaSVersion', 'SoftwareVersion') || '1.0.0',
    scannerVersion: getText('ScannerVersion') || detected.model,
  };
}

/**
 * Build a complete DentalCaseBundle from user-selected or dropped files AND persist to IndexedDB.
 * Supports multi-vendor intraoral scanner exports (STL + XML + JPG + PDF + HTML).
 */
export async function buildCaseBundleFromFiles(
  fileList: FileList | File[],
  currentBundle: DentalCaseBundle
): Promise<DentalCaseBundle> {
  const files = Array.from(fileList);

  const stlFiles = files.filter((f) => f.name.toLowerCase().endsWith('.stl'));
  const upperStl =
    stlFiles.find((f) => {
      const n = f.name.toLowerCase();
      return (
        n.includes('_u.stl') ||
        n.includes('upper') ||
        n.includes('maxilla') ||
        n.includes('antagonist_u')
      );
    }) || (stlFiles.length === 1 ? stlFiles[0] : undefined);

  const lowerStl =
    stlFiles.find((f) => {
      const n = f.name.toLowerCase();
      return (
        n.includes('_l.stl') ||
        n.includes('lower') ||
        n.includes('mandible') ||
        n.includes('antagonist_l')
      );
    }) || (stlFiles.length === 2 && stlFiles[0] === upperStl ? stlFiles[1] : undefined);

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

  const idMatch =
    upperStl?.name.match(/^(\d+)_/) ||
    lowerStl?.name.match(/^(\d+)_/) ||
    xmlV50File?.name.match(/#?(\d+)/);
  const inferredId = idMatch ? idMatch[1] : `dcad-${Date.now().toString().slice(-5)}`;

  const detected = detectScannerVendor(files, rawXmlV50 || rawXmlV30 || '');

  const metadata: DentalCaseMetadata =
    rawXmlV50 || rawXmlV30
      ? parseScannerXmlString((rawXmlV50 || rawXmlV30)!, inferredId, files)
      : {
          ...currentBundle.metadata,
          orderId: inferredId,
          orderCode: detected.vendor.toUpperCase(),
          scannerVendor: detected.vendor,
          scannerModel: detected.model,
          procedure: detected.model,
          procedureType: 'Browser Local STL Import',
          patientName:
            upperStl?.name.replace(/(_shell_occlusion_[ul]|_u|_l|\.stl)$/gi, '') ||
            currentBundle.metadata.patientName,
          scanDate: new Date().toISOString().slice(0, 10),
        };

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
      match: (n) =>
        !n.includes('penta_') &&
        !n.includes('front') &&
        !n.includes('upper') &&
        !n.includes('lower') &&
        !n.includes('right') &&
        !n.includes('left'),
      title: '複合臨床全覽圖 (Overview)',
      viewName: 'Composite Penta View',
      description: '口掃系統匯總之五方位臨床照片集合總覽圖。',
      cameraPreset: 'isometric',
    },
    {
      id: 'front',
      match: (n) => n.includes('front') || n.includes('anterior'),
      title: '正視咬合面 (Frontal View)',
      viewName: 'Frontal Occlusion',
      description: '前牙中線、前牙覆咬與覆蓋及前牙齒列排列檢視。',
      cameraPreset: 'front',
    },
    {
      id: 'upper',
      match: (n) => n.includes('upper') || n.includes('maxilla'),
      title: '上顎齒列咬合面 (Upper Arch)',
      viewName: 'Maxillary Occlusal',
      description: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度。',
      cameraPreset: 'upper',
    },
    {
      id: 'lower',
      match: (n) => n.includes('lower') || n.includes('mandible'),
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

  const pdfFile = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
  const htmlFile = files.find((f) => f.name.toLowerCase().endsWith('.html'));

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
