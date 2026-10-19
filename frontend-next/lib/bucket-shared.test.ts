import { describe, expect, it } from 'vitest';
import { validateBucketEntry } from './bucket-shared';

const entry = { djName: ' DJ Test ', fullName: ' Alex Taylor ', consent: true, attendance: true };
describe('bucket entry details', () => {
  it('accepts an omitted or blank optional phone and trims names', () => {
    for (const phone of [undefined, null, '', '   ']) {
      expect(validateBucketEntry({ ...entry, phone })).toEqual({ djName: 'DJ Test', fullName: 'Alex Taylor', phone: null, attendance: true });
    }
  });
  it('accepts formatted international phone numbers', () => {
    expect(validateBucketEntry({ ...entry, phone: ' +44 (0)7700 900123 ' }).phone).toBe('+44 (0)7700 900123');
  });
  it('requires a full name and both confirmations', () => {
    for (const overrides of [{fullName: ''}, {fullName: 'x'.repeat(121)}, {fullName: 'Alex\nTaylor'}, {attendance: false}, {attendance: undefined}, {consent: false}]) {
      expect(() => validateBucketEntry({...entry,...overrides})).toThrow();
    }
  });
  it('rejects malformed supplied phone numbers', () => {
    for (const phone of ['abc1234567', '123', '-------', 123456789, '+'.repeat(31)]) {
      expect(() => validateBucketEntry({...entry,phone})).toThrow();
    }
  });
});
