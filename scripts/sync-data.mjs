import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_CASES_DIR = path.join(ROOT_DIR, 'public', 'cases');
const DATA_DIR = path.join(ROOT_DIR, 'data');

/**
 * Extract tag text from XML string
 */
function getXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Extract attribute value from XML tag
 */
function getXmlAttr(xml, tag, attr) {
  const tagMatch = xml.match(new RegExp(`<${tag}[^>]*>`, 'i'));
  if (!tagMatch) return '';
  const attrMatch = tagMatch[0].match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return attrMatch ? attrMatch[1].trim() : '';
}

/**
 * Compute triangle count and bounding box dimensions (mm) from binary STL file
 */
function inspectBinaryStl(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 84) {
      return { triangles: 0, dimensions: { width: 0, depth: 0, height: 0 } };
    }
    const fd = fs.openSync(filePath, 'r');
    const headerBuf = Buffer.alloc(84);
    fs.readSync(fd, headerBuf, 0, 84, 0);
    const count = headerBuf.readUInt32LE(80);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Sample vertices efficiently (every triangle or step for huge files)
    const step = Math.max(1, Math.floor(count / 25000));
    const triBuf = Buffer.alloc(50);

    for (let i = 0; i < count; i += step) {
      const bytesRead = fs.readSync(fd, triBuf, 0, 50, 84 + i * 50);
      if (bytesRead < 50) break;
      for (const offset of [12, 24, 36]) {
        const x = triBuf.readFloatLE(offset);
        const y = triBuf.readFloatLE(offset + 4);
        const z = triBuf.readFloatLE(offset + 8);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    fs.closeSync(fd);

    return {
      triangles: count,
      dimensions: {
        width: Number((maxX - minX).toFixed(1)),
        depth: Number((maxY - minY).toFixed(1)),
        height: Number((maxZ - minZ).toFixed(1)),
      },
    };
  } catch (err) {
    console.warn(`Warning: Failed to inspect STL ${filePath}:`, err.message);
    return { triangles: 0, dimensions: { width: 0, depth: 0, height: 0 } };
  }
}

/**
 * Scan a directory for iTero case files and return discovered case descriptors
 */
function scanDirectoryForCases(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath);

  // Find all unique Order IDs in this directory
  const orderIds = new Set();
  for (const name of entries) {
    const stlMatch = name.match(/^(\d+)_shell_occlusion_[ul]\.stl$/i);
    if (stlMatch) orderIds.add(stlMatch[1]);
    const xmlMatch = name.match(/^itero_export_#?(\d+)_v\d+\.xml$/i);
    if (xmlMatch) orderIds.add(xmlMatch[1]);
  }

  const results = [];
  for (const orderId of orderIds) {
    results.push({ orderId, dirPath, entries });
  }
  return results;
}

/**
 * Create a relative symlink safely
 */
function linkAsset(sourceAbsPath, targetAbsPath) {
  if (!fs.existsSync(sourceAbsPath)) return false;
  fs.mkdirSync(path.dirname(targetAbsPath), { recursive: true });
  try {
    if (fs.lstatSync(targetAbsPath)) {
      fs.unlinkSync(targetAbsPath);
    }
  } catch {
    // target does not exist
  }
  const relSource = path.relative(path.dirname(targetAbsPath), sourceAbsPath);
  fs.symlinkSync(relSource, targetAbsPath);
  return true;
}

/**
 * Build a DentalCaseBundle from a discovered case directory
 */
function buildCaseBundle({ orderId, dirPath, entries }) {
  const caseOutDir = path.join(PUBLIC_CASES_DIR, orderId);
  fs.mkdirSync(caseOutDir, { recursive: true });

  const findFile = (predicate) => entries.find(predicate);

  const upperStlName =
    findFile((f) => f.toLowerCase() === `${orderId}_shell_occlusion_u.stl`) ||
    findFile((f) => f.toLowerCase().endsWith('_u.stl') || f.toLowerCase().includes('upper'));
  const lowerStlName =
    findFile((f) => f.toLowerCase() === `${orderId}_shell_occlusion_l.stl`) ||
    findFile((f) => f.toLowerCase().endsWith('_l.stl') || f.toLowerCase().includes('lower'));

  const xmlV50Name = findFile((f) => f.includes(orderId) && f.toLowerCase().endsWith('_v50.xml'));
  const xmlV30Name = findFile((f) => f.includes(orderId) && f.toLowerCase().endsWith('_v30.xml'));
  const rxPdfName = findFile((f) => f.includes(orderId) && f.toLowerCase().endsWith('.pdf'));
  const rxHtmlName = findFile((f) => f.includes(orderId) && f.toLowerCase().endsWith('.html') && f !== 'index.html');
  const logoName =
    findFile((f) => f.toLowerCase() === 'itero_element_logo.png') ||
    (fs.existsSync(path.join(ROOT_DIR, 'itero_element_logo.png')) ? 'itero_element_logo.png' : null);

  // Link STLs
  if (upperStlName) {
    linkAsset(path.join(dirPath, upperStlName), path.join(caseOutDir, 'upper.stl'));
  }
  if (lowerStlName) {
    linkAsset(path.join(dirPath, lowerStlName), path.join(caseOutDir, 'lower.stl'));
  }

  // Link XML, PDF, HTML, Logo
  let rawXmlV50 = '';
  let rawXmlV30 = '';
  if (xmlV50Name) {
    const abs = path.join(dirPath, xmlV50Name);
    linkAsset(abs, path.join(caseOutDir, 'itero_export_v50.xml'));
    rawXmlV50 = fs.readFileSync(abs, 'utf-8');
  }
  if (xmlV30Name) {
    const abs = path.join(dirPath, xmlV30Name);
    linkAsset(abs, path.join(caseOutDir, 'itero_export_v30.xml'));
    rawXmlV30 = fs.readFileSync(abs, 'utf-8');
  }
  if (rxPdfName) {
    linkAsset(path.join(dirPath, rxPdfName), path.join(caseOutDir, 'rx.pdf'));
  }
  if (rxHtmlName) {
    linkAsset(path.join(dirPath, rxHtmlName), path.join(caseOutDir, 'rx.html'));
  }
  if (logoName) {
    const logoSource = fs.existsSync(path.join(dirPath, logoName))
      ? path.join(dirPath, logoName)
      : path.join(ROOT_DIR, logoName);
    linkAsset(logoSource, path.join(caseOutDir, 'logo.png'));
  }

  // Parse XML metadata
  const xmlSource = rawXmlV50 || rawXmlV30;
  const orderCode = getXmlTag(xmlSource, 'OrderCode') || 'N/A';
  const rawPatient = getXmlTag(xmlSource, 'Patient') || 'Unknown Patient';
  // Convert "Yung Chih, Chen" -> "Chen, Yung Chih" or keep clean
  const patientName = rawPatient.includes(',')
    ? rawPatient
        .split(',')
        .map((s) => s.trim())
        .reverse()
        .join(', ')
    : rawPatient;

  const patientId = getXmlTag(xmlSource, 'UniquePatientIdentifier') || `case-${orderId}`;
  const doctorName = getXmlTag(xmlSource, 'Doctor') || 'Unknown Clinician';
  const doctorLicense = getXmlTag(xmlSource, 'DoctorLicense') || 'N/A';
  const doctorId = getXmlTag(xmlSource, 'DoctorID') || 'N/A';
  const rawAddress = getXmlTag(xmlSource, 'PracticeShipToAddress') || '';
  const clinicName = rawAddress.includes('Clinic')
    ? rawAddress.slice(0, rawAddress.indexOf('Clinic') + 6).trim()
    : rawAddress.split('No.')[0]?.trim() || 'Dental Clinic';
  const clinicAddress = rawAddress.replace(clinicName, '').replace(/\s+N\/A\s+/g, ', ').trim() || rawAddress;

  const dueDate = getXmlTag(xmlSource, 'DueDate') || '';
  const exportTime = getXmlTag(xmlSource, 'ExportTime') || '';
  // Format MM/DD/YYYY -> YYYY-MM-DD if applicable
  const formatDate = (dStr) => {
    const m = dStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : dStr;
  };
  const scanDate = formatDate(dueDate);

  const upperFrom = getXmlAttr(xmlSource, 'UpperRange', 'FromAdaId') || '1';
  const upperTo = getXmlAttr(xmlSource, 'UpperRange', 'ToAdaId') || '16';
  const lowerFrom = getXmlAttr(xmlSource, 'LowerRange', 'FromAdaId') || '17';
  const lowerTo = getXmlAttr(xmlSource, 'LowerRange', 'ToAdaId') || '32';

  const caasVersion = getXmlTag(xmlSource, 'CaaSVersion') || '1.0.0';
  const iteroVersion = getXmlTag(xmlSource, 'iTeroVersion') || '2.19.0';
  const toothShadeSystem = getXmlTag(xmlSource, 'ToothShadeSystem') || 'VITA Lumin';

  // Extract Procedure Name from <RxDefines>
  const procBlock = getXmlTag(xmlSource, 'RxDefines');
  const procedure =
    getXmlAttr(procBlock, 'Type', 'Name') || getXmlTag(xmlSource, 'CaseTypeName') || 'Invisalign';
  const procTypeBlock = getXmlTag(procBlock, 'ProcedureType');
  const procedureType = getXmlAttr(procTypeBlock, 'Type', 'Name') || `${procedure} Aligners`;

  // Inspect STL geometry stats
  const upperStats = upperStlName
    ? inspectBinaryStl(path.join(dirPath, upperStlName))
    : { triangles: 0, dimensions: { width: 0, depth: 0, height: 0 } };
  const lowerStats = lowerStlName
    ? inspectBinaryStl(path.join(dirPath, lowerStlName))
    : { triangles: 0, dimensions: { width: 0, depth: 0, height: 0 } };

  // Link & register 5-view clinical photos
  const photoConfigs = [
    {
      id: 'overview',
      suffix: `.jpg`,
      exactMatch: (f) => f === `gallery_#${orderId}.jpg` || f === `gallery_${orderId}.jpg`,
      targetName: 'gallery_overview.jpg',
      title: '複合臨床全覽圖 (Overview)',
      viewName: 'Composite Penta View',
      description: 'iTero Element 系統自動匯總之五方位臨床照片集合總覽圖。',
      cameraPreset: 'isometric',
    },
    {
      id: 'front',
      exactMatch: (f) => f.includes(orderId) && f.includes('penta_front'),
      targetName: 'penta_front.jpg',
      title: '正視咬合面 (Frontal View)',
      viewName: 'Frontal Occlusion',
      description: '前牙中線、前牙覆咬 (Overbite) 與覆蓋 (Overjet) 及前牙齒列排列檢視。',
      cameraPreset: 'front',
    },
    {
      id: 'upper',
      exactMatch: (f) => f.includes(orderId) && f.includes('penta_upper'),
      targetName: 'penta_upper.jpg',
      title: '上顎齒列咬合面 (Upper Arch)',
      viewName: 'Maxillary Occlusal',
      description: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度與旋轉度。',
      cameraPreset: 'upper',
    },
    {
      id: 'lower',
      exactMatch: (f) => f.includes(orderId) && f.includes('penta_lower'),
      targetName: 'penta_lower.jpg',
      title: '下顎齒列咬合面 (Lower Arch)',
      viewName: 'Mandibular Occlusal',
      description: '下顎牙弓對稱性、舌側傾斜度及前牙擁擠 (Crowding) 分析。',
      cameraPreset: 'lower',
    },
    {
      id: 'patientright',
      exactMatch: (f) => f.includes(orderId) && f.includes('penta_patientright'),
      targetName: 'penta_patientright.jpg',
      title: '右側頰面咬合 (Right Buccal)',
      viewName: 'Right Buccal Occlusion',
      description: '右側犬齒與第一大臼齒 Angle Class 咬合關係與齒間接觸。',
      cameraPreset: 'right',
    },
    {
      id: 'patientleft',
      exactMatch: (f) => f.includes(orderId) && f.includes('penta_patientleft'),
      targetName: 'penta_patientleft.jpg',
      title: '左側頰面咬合 (Left Buccal)',
      viewName: 'Left Buccal Occlusion',
      description: '左側犬齒與第一大臼齒咬合關係、對咬接觸點及後牙側方引導。',
      cameraPreset: 'left',
    },
  ];

  const photos = [];
  for (const cfg of photoConfigs) {
    const foundFile = findFile(cfg.exactMatch);
    if (foundFile) {
      linkAsset(path.join(dirPath, foundFile), path.join(caseOutDir, cfg.targetName));
      photos.push({
        id: cfg.id,
        title: cfg.title,
        viewName: cfg.viewName,
        description: cfg.description,
        fileName: foundFile,
        src: `./cases/${orderId}/${cfg.targetName}`,
        cameraPreset: cfg.cameraPreset,
      });
    }
  }

  return {
    id: orderId,
    label: `#${orderId} — ${patientName} (${procedure})`,
    source: 'builtin',
    metadata: {
      orderId,
      orderCode,
      patientName,
      patientId,
      doctorName,
      doctorLicense,
      doctorId,
      clinicName,
      clinicAddress,
      scanDate,
      exportTime,
      dueDate: scanDate,
      procedure,
      procedureType,
      toothShadeSystem,
      upperAdaRange: `ADA #${upperFrom} - #${upperTo} (Maxillary Full Arch)`,
      lowerAdaRange: `ADA #${lowerFrom} - #${lowerTo} (Mandibular Full Arch)`,
      caasVersion,
      iteroVersion,
    },
    assets: {
      upperStlUrl: `./cases/${orderId}/upper.stl`,
      upperStlFileName: upperStlName || `${orderId}_shell_occlusion_u.stl`,
      lowerStlUrl: `./cases/${orderId}/lower.stl`,
      lowerStlFileName: lowerStlName || `${orderId}_shell_occlusion_l.stl`,
      rxPdfUrl: rxPdfName ? `./cases/${orderId}/rx.pdf` : undefined,
      rxPdfFileName: rxPdfName,
      rxHtmlUrl: rxHtmlName ? `./cases/${orderId}/rx.html` : undefined,
      rxHtmlFileName: rxHtmlName,
      xmlV50Url: xmlV50Name ? `./cases/${orderId}/itero_export_v50.xml` : undefined,
      xmlV50FileName: xmlV50Name,
      xmlV30Url: xmlV30Name ? `./cases/${orderId}/itero_export_v30.xml` : undefined,
      xmlV30FileName: xmlV30Name,
      logoUrl: logoName ? `./cases/${orderId}/logo.png` : './images/itero_element_logo.png',
    },
    defaultMeshStats: {
      upperTriangles: upperStats.triangles,
      lowerTriangles: lowerStats.triangles,
      upperDimensions: upperStats.dimensions,
      lowerDimensions: lowerStats.dimensions,
    },
    photos,
    rawXmlV50: rawXmlV50 || undefined,
    rawXmlV30: rawXmlV30 || undefined,
  };
}

function main() {
  fs.mkdirSync(PUBLIC_CASES_DIR, { recursive: true });

  const discovered = [];
  // 1. Scan root directory
  discovered.push(...scanDirectoryForCases(ROOT_DIR));

  // 2. Scan ./data/* subdirectories if ./data exists
  if (fs.existsSync(DATA_DIR)) {
    discovered.push(...scanDirectoryForCases(DATA_DIR));
    for (const sub of fs.readdirSync(DATA_DIR)) {
      const subPath = path.join(DATA_DIR, sub);
      if (fs.statSync(subPath).isDirectory()) {
        discovered.push(...scanDirectoryForCases(subPath));
      }
    }
  }

  // Deduplicate by orderId
  const uniqueMap = new Map();
  for (const item of discovered) {
    uniqueMap.set(item.orderId, item);
  }

  const cases = Array.from(uniqueMap.values()).map(buildCaseBundle);

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    defaultCaseId: cases[0]?.id || '',
    cases,
  };

  const manifestPath = path.join(PUBLIC_CASES_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(
    `[sync-data] Generated ${manifestPath} with ${cases.length} case(s): ${cases.map((c) => c.id).join(', ')}`
  );
}

main();
