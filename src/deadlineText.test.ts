import { describe, expect, it } from 'vitest';
import { deadlineExplanation } from './deadlineText';
import { analyse } from './pipeline';
import { SimEngine } from './ai/simEngine';

const NO_DATE = `Northwind Health Plan
Dear Member,
The lumbar MRI (CPT 72148) is not medically necessary under our clinical criteria.
You may appeal. Your appeal must be received within 180 days of the date of this notice.`;

describe('Spanish deadline sentence', () => {
  it('a stated window without a notice date still says the letter gives 180 days (not "no window")', async () => {
    const a = await analyse(new SimEngine('unavailable'), NO_DATE, false, 'es');
    expect(a.deadline.deadline).toBeNull();
    expect(a.deadline.windowDays).toBe(180);
    const es = deadlineExplanation(a, 'es');
    expect(es).toMatch(/Tu carta dice que tienes 180 días/);
    expect(es).not.toMatch(/No encontramos un plazo/);
    expect(es).toMatch(/Tampoco pudimos leer la fecha del aviso/);
    expect(deadlineExplanation(a, 'en')).toMatch(/180 days/);
  });
});
