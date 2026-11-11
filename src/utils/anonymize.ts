import { DentalCaseMetadata } from '../types/dental';

/**
 * Mask each word in a string by keeping only the first character (and common prefixes like "Dr.")
 */
export function maskWords(input: string): string {
  if (!input) return '';
  return input.replace(/[A-Za-z\u4e00-\u9fa50-9]+/g, (word) => {
    if (/^(Dr|Clinic|Dental|City|Taiwan)$/i.test(word)) {
      return word;
    }
    if (word.length <= 1) return '*';
    return word[0] + '*'.repeat(Math.min(word.length - 1, 5));
  });
}

/**
 * Mask an identifier or license number
 */
export function maskIdentifier(id: string): string {
  if (!id || id === 'N/A') return id;
  if (id.length <= 4) return '*'.repeat(id.length);
  return `${id.slice(0, 2)}${'*'.repeat(Math.min(id.length - 4, 8))}${id.slice(-2)}`;
}

/**
 * Return either raw or anonymized DentalCaseMetadata based on `enabled` flag
 */
export function getDisplayMetadata(
  metadata: DentalCaseMetadata,
  anonymize: boolean
): DentalCaseMetadata {
  if (!anonymize) return metadata;

  return {
    ...metadata,
    patientName: maskWords(metadata.patientName),
    patientId: maskIdentifier(metadata.patientId),
    doctorName: maskWords(metadata.doctorName),
    doctorLicense: maskIdentifier(metadata.doctorLicense),
    doctorId: maskIdentifier(metadata.doctorId),
    clinicName: maskWords(metadata.clinicName),
    clinicAddress: maskWords(metadata.clinicAddress),
  };
}

/**
 * Mask sensitive XML tags (<Patient>, <Doctor>, <PracticeShipToAddress>, etc.) when anonymize is active
 */
export function anonymizeXmlString(xml: string, anonymize: boolean): string {
  if (!anonymize || !xml) return xml;

  const sensitiveTags = [
    'Patient',
    'UniquePatientIdentifier',
    'Doctor',
    'DoctorLicense',
    'DoctorID',
    'DoctorCompanyID',
    'PracticeShipToAddress',
  ];

  let result = xml;
  for (const tag of sensitiveTags) {
    result = result.replace(
      new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi'),
      (_match, openTag, content, closeTag) => {
        const trimmed = content.trim();
        if (!trimmed) return `${openTag}${content}${closeTag}`;
        const masked =
          tag.includes('ID') || tag.includes('Identifier') || tag.includes('License')
            ? maskIdentifier(trimmed)
            : maskWords(trimmed);
        return `${openTag}${masked}${closeTag}`;
      }
    );
  }
  return result;
}
