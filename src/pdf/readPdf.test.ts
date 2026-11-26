import { describe, expect, it } from 'vitest';
import { itemsToText } from './readPdf';

describe('itemsToText rebuilds letter lines from pdf.js items', () => {
  it('breaks lines on end-of-line flags and baseline changes, joins words on a line', () => {
    const items = [
      { str: 'Northwind Health Plan', hasEOL: true, transform: [1, 0, 0, 1, 72, 700] },
      { str: 'Member ID:', transform: [1, 0, 0, 1, 72, 680] },
      { str: 'NWH448812901', transform: [1, 0, 0, 1, 140, 680] },
      { str: 'Dear Maria L. Gonzalez,', transform: [1, 0, 0, 1, 72, 650] },
    ];
    expect(itemsToText(items)).toBe('Northwind Health Plan\nMember ID: NWH448812901\nDear Maria L. Gonzalez,');
  });
  it('ignores empty and non-text items', () => {
    expect(itemsToText([{ str: '' }, { str: 'Hello' }, { str: ' world' }])).toBe('Hello world');
  });
});
