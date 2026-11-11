/**
 * Browser-native ZIP archive extractor & ?url= parameter resolver for DentalCAD Pages.
 * Uses Central Directory parsing + Web Compression Streams API (DecompressionStream('deflate-raw'))
 * to unpack intraoral scanner .zip bundles (.stl, .xml, .jpg, .png, .pdf, .html) directly in memory
 * with zero external dependencies.
 */

const DENTAL_FILE_EXT_REGEX = /\.(stl|xml|jpe?g|png|webp|pdf|html)$/i;

function getMimeTypeForFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.stl')) return 'model/stl';
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

async function inflateRawBytes(compressed: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressed as unknown as BufferSource).catch(() => {});
    writer.close().catch(() => {});

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }

    const out = new Uint8Array(total || expectedSize);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
  throw new Error('DecompressionStream(deflate-raw) is not supported in this browser.');
}

/**
 * Extracts dental scan files (.stl, .xml, .jpg, .png, .pdf, .html) from a ZIP ArrayBuffer/Blob/File.
 */
export async function extractDentalFilesFromZip(
  zipSource: ArrayBuffer | Blob | File
): Promise<File[]> {
  const buffer =
    zipSource instanceof ArrayBuffer ? zipSource : await zipSource.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');

  // 1. Locate End of Central Directory (EOCD) record (signature 0x06054b50)
  const maxCommentLen = 65535;
  const searchStart = Math.max(0, buffer.byteLength - 22 - maxCommentLen);
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  const extractedFiles: File[] = [];

  if (eocdOffset !== -1) {
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let ptr = cdOffset;

    for (let idx = 0; idx < totalEntries && ptr + 46 <= buffer.byteLength; idx++) {
      const sig = view.getUint32(ptr, true);
      if (sig !== 0x02014b50) break;

      const compressionMethod = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const uncompressedSize = view.getUint32(ptr + 24, true);
      const fileNameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const rawEntryName = decoder
        .decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen))
        .replace(/\\/g, '/');
      ptr += 46 + fileNameLen + extraLen + commentLen;

      // Skip directories and macOS resource forks (__MACOSX or ._*)
      const baseName = rawEntryName.split('/').pop() || '';
      if (
        !baseName ||
        rawEntryName.endsWith('/') ||
        rawEntryName.includes('__MACOSX/') ||
        baseName.startsWith('._') ||
        !DENTAL_FILE_EXT_REGEX.test(baseName)
      ) {
        continue;
      }

      if (localHeaderOffset + 30 > buffer.byteLength) continue;
      const localSig = view.getUint32(localHeaderOffset, true);
      if (localSig !== 0x04034b50) continue;

      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

      let fileBytes: Uint8Array;
      if (compressionMethod === 0) {
        fileBytes = compressedSlice;
      } else if (compressionMethod === 8) {
        fileBytes = await inflateRawBytes(compressedSlice, uncompressedSize);
      } else {
        continue;
      }

      const copy = new Uint8Array(fileBytes.byteLength);
      copy.set(fileBytes);
      extractedFiles.push(
        new File([copy], baseName, { type: getMimeTypeForFilename(baseName) })
      );
    }

    return extractedFiles;
  }

  // Fallback: Sequential Local File Header scan (0x04034b50)
  let offset = 0;
  while (offset + 30 <= buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const rawEntryName = decoder
      .decode(bytes.subarray(offset + 30, offset + 30 + fileNameLen))
      .replace(/\\/g, '/');
    const dataStart = offset + 30 + fileNameLen + extraLen;
    offset = dataStart + compressedSize;

    const baseName = rawEntryName.split('/').pop() || '';
    if (
      !baseName ||
      rawEntryName.endsWith('/') ||
      rawEntryName.includes('__MACOSX/') ||
      baseName.startsWith('._') ||
      !DENTAL_FILE_EXT_REGEX.test(baseName)
    ) {
      continue;
    }

    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);
    let fileBytes: Uint8Array;
    if (compressionMethod === 0) {
      fileBytes = compressedSlice;
    } else if (compressionMethod === 8) {
      fileBytes = await inflateRawBytes(compressedSlice, uncompressedSize);
    } else {
      continue;
    }

    const copy = new Uint8Array(fileBytes.byteLength);
    copy.set(fileBytes);
    extractedFiles.push(
      new File([copy], baseName, { type: getMimeTypeForFilename(baseName) })
    );
  }

  return extractedFiles;
}

/**
 * Expands a FileList or File[] by transparently unpacking any .zip archives into their constituent dental files.
 */
export async function expandUploadedFilesWithZip(
  fileList: FileList | File[]
): Promise<File[]> {
  const inputFiles = Array.from(fileList);
  const result: File[] = [];

  for (const file of inputFiles) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const unzipped = await extractDentalFilesFromZip(file);
        result.push(...unzipped);
      } catch (err) {
        console.warn(`Failed to extract ZIP archive ${file.name}:`, err);
      }
    } else {
      result.push(file);
    }
  }

  return result;
}

export interface ParsedUrlDataParam {
  rawParam: string;
  cleanedUrlOrPath: string;
  fileName: string;
  inferredCaseId: string | null;
  isLocalFilePath: boolean;
  isRemoteHttpUrl: boolean;
}

/**
 * Parses a ?url=... query parameter (supports wrapped quotes like ?url="/Users/.../OrthoCAD_Export_297077963.zip").
 */
export function parseUrlDataParameter(rawParam: string): ParsedUrlDataParam {
  const cleanedUrlOrPath = rawParam.trim().replace(/^['"]+|['"]+$/g, '').trim();
  const normalizedSlashes = cleanedUrlOrPath.replace(/\\/g, '/');
  const fileName = normalizedSlashes.split('/').pop()?.split('?')[0] || cleanedUrlOrPath;

  // Extract numeric case ID if present (e.g. OrthoCAD_Export_297077963.zip -> 297077963)
  const idMatch =
    fileName.match(/(\d{5,})/) ||
    fileName.match(/^(\d+)_/) ||
    cleanedUrlOrPath.match(/(\d{5,})/);
  const inferredCaseId = idMatch ? idMatch[1] : null;

  const isRemoteHttpUrl = /^https?:\/\//i.test(cleanedUrlOrPath);
  const isLocalFilePath =
    !isRemoteHttpUrl &&
    (cleanedUrlOrPath.startsWith('/') ||
      cleanedUrlOrPath.startsWith('~/') ||
      /^file:\/\//i.test(cleanedUrlOrPath) ||
      /^[a-zA-Z]:[\\/]/.test(cleanedUrlOrPath));

  return {
    rawParam,
    cleanedUrlOrPath,
    fileName,
    inferredCaseId,
    isLocalFilePath,
    isRemoteHttpUrl,
  };
}

/**
 * Helper to create an uncompressed (STORE, method 0) ZIP ArrayBuffer in memory for testing or export.
 */
export function createUncompressedZipBuffer(
  entries: Array<{ name: string; content: Uint8Array | string }>
): ArrayBuffer {
  const encoder = new TextEncoder();
  const prepared = entries.map((e) => ({
    nameBytes: encoder.encode(e.name),
    dataBytes: typeof e.content === 'string' ? encoder.encode(e.content) : e.content,
  }));

  let localTotalSize = 0;
  let cdTotalSize = 0;
  for (const item of prepared) {
    localTotalSize += 30 + item.nameBytes.byteLength + item.dataBytes.byteLength;
    cdTotalSize += 46 + item.nameBytes.byteLength;
  }

  const totalSize = localTotalSize + cdTotalSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let localOffset = 0;
  const localOffsets: number[] = [];

  for (const item of prepared) {
    localOffsets.push(localOffset);
    view.setUint32(localOffset, 0x04034b50, true); // Local file header signature
    view.setUint16(localOffset + 4, 20, true); // Version needed
    view.setUint16(localOffset + 6, 0, true); // Flags
    view.setUint16(localOffset + 8, 0, true); // Compression method 0 (STORE)
    view.setUint32(localOffset + 18, item.dataBytes.byteLength, true); // Compressed size
    view.setUint32(localOffset + 22, item.dataBytes.byteLength, true); // Uncompressed size
    view.setUint16(localOffset + 26, item.nameBytes.byteLength, true); // File name length
    view.setUint16(localOffset + 28, 0, true); // Extra length

    bytes.set(item.nameBytes, localOffset + 30);
    bytes.set(item.dataBytes, localOffset + 30 + item.nameBytes.byteLength);
    localOffset += 30 + item.nameBytes.byteLength + item.dataBytes.byteLength;
  }

  let cdOffset = localOffset;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    view.setUint32(cdOffset, 0x02014b50, true); // Central directory signature
    view.setUint16(cdOffset + 4, 20, true);
    view.setUint16(cdOffset + 6, 20, true);
    view.setUint16(cdOffset + 10, 0, true); // Method 0 (STORE)
    view.setUint32(cdOffset + 20, item.dataBytes.byteLength, true);
    view.setUint32(cdOffset + 24, item.dataBytes.byteLength, true);
    view.setUint16(cdOffset + 28, item.nameBytes.byteLength, true);
    view.setUint32(cdOffset + 42, localOffsets[i], true);

    bytes.set(item.nameBytes, cdOffset + 46);
    cdOffset += 46 + item.nameBytes.byteLength;
  }

  // End of Central Directory (EOCD)
  view.setUint32(cdOffset, 0x06054b50, true);
  view.setUint16(cdOffset + 8, prepared.length, true);
  view.setUint16(cdOffset + 10, prepared.length, true);
  view.setUint32(cdOffset + 12, cdTotalSize, true);
  view.setUint32(cdOffset + 16, localOffset, true);

  return buffer;
}
