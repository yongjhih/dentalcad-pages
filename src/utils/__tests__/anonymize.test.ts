import { describe, it, expect } from 'vitest';
import {
  maskWords,
  maskIdentifier,
  getDisplayMetadata,
  anonymizeXmlString,
} from '../anonymize';
import { DEFAULT_CASE_BUNDLE } from '../../data/caseData';

describe('anonymize utility (HIPAA / Clinical Privacy)', () => {
  it('masks Chinese and English words while keeping initial characters and common prefixes', () => {
    expect(maskWords('黃品榕')).toBe('黃**');
    expect(maskWords('陳怡君醫師 (Dr. Yi-Chun Chen)')).toBe('陳**** (Dr. Y*-C*** C***)');
    expect(maskWords('Leader Way OMS Dental Clinic')).toBe(
      'L***** W** O** Dental Clinic'
    );
  });

  it('masks identifiers and license numbers keeping only prefix and suffix', () => {
    expect(maskIdentifier('N123456789')).toBe('N1******89');
    expect(maskIdentifier('1234')).toBe('****');
    expect(maskIdentifier('N/A')).toBe('N/A');
  });

  it('masks patient, doctor, and clinic metadata when anonymize=true and preserves when false', () => {
    const raw = DEFAULT_CASE_BUNDLE.metadata;
    const masked = getDisplayMetadata(raw, true);
    const unmasked = getDisplayMetadata(raw, false);

    expect(masked.patientName).not.toBe(raw.patientName);
    expect(masked.doctorName).not.toBe(raw.doctorName);
    expect(masked.clinicName).not.toBe(raw.clinicName);
    expect(masked.doctorLicense).toContain('*');

    expect(unmasked).toEqual(raw);
  });

  it('scrubs patient, doctor, and clinic tags inside raw XML strings when anonymize=true', () => {
    const sampleXml = `<Order><Patient>黃品榕</Patient><Doctor>陳怡君醫師</Doctor><DoctorLicense>北市衛牙字第9999號</DoctorLicense><PracticeShipToAddress>新竹市品味牙醫診所</PracticeShipToAddress></Order>`;
    const scrubbed = anonymizeXmlString(sampleXml, true);

    expect(scrubbed).not.toContain('黃品榕');
    expect(scrubbed).not.toContain('陳怡君醫師');
    expect(scrubbed).not.toContain('新竹市品味牙醫診所');
    expect(scrubbed).toContain('<Patient>黃**</Patient>');
    expect(anonymizeXmlString(sampleXml, false)).toBe(sampleXml);
  });
});
