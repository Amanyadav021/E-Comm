import { slugify, generateOrderNumber, toCsv, fromJson, dec } from '../src/common/utils';

describe('slugify', () => {
  it('normalizes names into URL-safe slugs', () => {
    expect(slugify('Novex Nova 5G Smartphone')).toBe('novex-nova-5g-smartphone');
    expect(slugify('  Weird---Name!!  (2024) ')).toBe('weird-name-2024');
    expect(slugify('हिंदी only $$')).toBe('only'); // non-latin characters are stripped
  });
});

describe('generateOrderNumber', () => {
  it('embeds the date and stays unique-ish', () => {
    const n = generateOrderNumber(new Date('2026-09-17T12:00:00Z'));
    expect(n).toMatch(/^SC-20260917-[A-Z0-9]{4,6}$/);
    const many = new Set(Array.from({ length: 200 }, () => generateOrderNumber()));
    expect(many.size).toBe(200);
  });
});

describe('toCsv', () => {
  it('escapes quotes, commas and newlines', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"\nnext']]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"he said ""hi""\nnext"');
    expect(csv.startsWith('﻿')).toBe(true); // Excel BOM
  });
});

describe('fromJson / dec', () => {
  it('is tolerant of bad input', () => {
    expect(fromJson('not-json', { fallback: true })).toEqual({ fallback: true });
    expect(fromJson(null, [])).toEqual([]);
    expect(fromJson('{"a":1}', {})).toEqual({ a: 1 });
    expect(dec('12.50')).toBe(12.5);
    expect(dec(null)).toBe(0);
  });
});
