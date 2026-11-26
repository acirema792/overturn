// Spanish-language denial letters (45 CFR 147.136(e): plans must send notices in
// Spanish on request in counties where 10%+ are literate only in Spanish).
// Four SYNTHETIC letters, written together with the Spanish rules: they are
// tests, not a held-out benchmark, and are not part of the published numbers.
// Expected answers were written before running the rules.
import { describe, expect, it } from 'vitest';
import { analyse, buildAppealRequest } from '../pipeline';
import { SimEngine } from '../ai/simEngine';
import { checkEgress } from './egressGate';

interface EsCase {
  id: string;
  text: string;
  identifiers: string[];
  facts: string[];
  deadline: string | null;
  category: string;
  planType: string;
}

const LETTERS: EsCase[] = [
  {
    id: 'ES1 Mercado de Seguros, resonancia no necesaria',
    text: `Plan de Salud Sol
P.O. Box 2210, Austin, TX 78701

1 de octubre de 2026

María José Gutiérrez Ramírez
455 W Commerce St, Apt 2
San Antonio, TX 78207

Número de miembro: SOL987654321
Número de reclamo: 2026-0915-4471

Estimada Sra. María José Gutiérrez Ramírez:

Revisamos la solicitud de una resonancia magnética de la columna lumbar (CPT 72148) que pidió la Dra. Elena Paredes. El servicio fue negado porque no es médicamente necesario según nuestros criterios clínicos.

Este plan es un plan individual del Mercado de Seguros. Tiene 180 días a partir de la fecha de este aviso para pedir una apelación interna. Tomaremos una decisión sobre su apelación dentro de 30 días.

Atentamente,
Departamento de Apelaciones`,
    identifiers: ['María José Gutiérrez Ramírez', 'Gutiérrez', 'SOL987654321', '2026-0915-4471', '1 de octubre de 2026', '455 W Commerce St, Apt 2', 'San Antonio, TX 78207', 'Elena Paredes'],
    facts: ['CPT 72148', 'resonancia magnética de la columna lumbar'],
    deadline: '2027-03-30',
    category: 'medical_necessity',
    planType: 'marketplace',
  },
  {
    id: 'ES2 Medicaid, autorización previa',
    text: `Salud Comunitaria Medicaid
15 de enero de 2027

Paciente: Luis Alberto Fernández
N.º de Medicaid: TX44120987
Número de referencia: AUT-2027-88120

Estimado Sr. Fernández:

Negamos el pago de la terapia física (CPT 97110) porque no se obtuvo autorización previa. Si no está de acuerdo, puede presentar una apelación dentro de los 60 días a partir de la fecha de este aviso. Después de la apelación, puede pedir una audiencia imparcial estatal dentro de 120 días.

Su hijo, Mateo, también puede ayudarle a llenar el formulario.`,
    identifiers: ['Luis Alberto Fernández', 'Fernández', 'TX44120987', 'AUT-2027-88120', '15 de enero de 2027', 'Mateo'],
    facts: ['CPT 97110', 'terapia física'],
    deadline: '2027-03-16',
    category: 'prior_authorization',
    planType: 'medicaid',
  },
  {
    id: 'ES3 Plan del empleador, fuera de la red',
    text: `Beneficios de Salud Andina - plan grupal del empleador
Fecha del aviso: 3 de noviembre de 2026

Afiliado: Rosa Elena Castillo
ID de afiliado: ANW5520193
Número de cuenta: 88-4410-2291

Estimada afiliada:

El anestesiólogo que la atendió está fuera de la red, por lo que la reclamación de $2,340.00 fue negada. Usted tiene 180 días para apelar esta decisión. Le enviaremos una respuesta dentro de 60 días.`,
    identifiers: ['Rosa Elena Castillo', 'ANW5520193', '88-4410-2291', '3 de noviembre de 2026'],
    facts: ['$2,340.00', 'anestesiólogo'],
    deadline: '2027-05-02',
    category: 'out_of_network',
    planType: 'employer',
  },
  {
    id: 'ES4 Sin plazo ni fecha: no adivinar',
    text: `Aviso de negación

Estimado Sr. Joaquín Herrera Soto:

El medicamento solicitado no está cubierto por su plan. Puede apelar esta decisión.`,
    identifiers: ['Joaquín Herrera Soto'],
    facts: ['medicamento'],
    deadline: null,
    category: 'not_covered',
    planType: 'unknown',
  },
];

describe('Spanish-language denial letters, rules only', () => {
  for (const c of LETTERS) {
    it(c.id, async () => {
      const a = await analyse(new SimEngine('unavailable'), c.text, false, 'es');
      const out = a.redaction.redacted;
      for (const id of c.identifiers) expect(out, `identifier left: ${id}`).not.toContain(id);
      for (const f of c.facts) expect(out, `fact lost: ${f}`).toContain(f);
      expect(a.deadline.deadline).toBe(c.deadline);
      expect(a.facts.category).toBe(c.category);
      expect(a.facts.planType).toBe(c.planType);
      const req = buildAppealRequest(a, 'es');
      expect(checkEgress(req.prompt, a.redaction.vault, req.checkText).findings).toEqual([]);
    });
  }
});

// Verifier pass 5 repros: each Spanish phrasing must behave like its English equivalent,
// and English letters must not change.
import { detect } from './detectors';
import { findNoticeDate, findWindowDays, guessPlanType } from './deadline';

describe('Spanish rules: verifier repros', () => {
  const persons = (t: string) => detect(t).filter((d) => d.kind === 'PERSON').map((d) => d.text);
  it('English "Sr." (Senior) is not a Spanish title', () => {
    expect(persons('Reviewed by: Sr. Medical Director')).toEqual([]);
    expect(persons('Sr. Vice President Clinical Operations')).toEqual([]);
    expect(persons('Admitted to John Smith Sr. Memorial Hospital').some((p) => /Memorial/.test(p))).toBe(false);
  });
  it('"el Sr. y la Sra. Pérez" hides Pérez', () => {
    expect(persons('Escribimos al Sr. Ruiz. El Sr. y la Sra. Pérez llamaron.')).toEqual(expect.arrayContaining(['Ruiz', 'Pérez']));
  });
  it('the plan’s own response time and someone else’s deadline are not the patient’s window', () => {
    expect(findWindowDays('Recibirá una respuesta a su apelación dentro de 30 días. Tiene 180 días para apelar esta decisión.')).toBe(180);
    expect(findWindowDays('El plan tiene 30 días para responder a su apelación. Usted tiene 180 días para apelar.')).toBe(180);
    expect(findWindowDays('Su proveedor tiene 90 días para enviar una reclamación corregida. Tiene 180 días para apelar esta decisión.')).toBe(180);
  });
  it('a window written in words and digits counts ("sesenta (60) días")', () => {
    expect(findWindowDays('Tiene sesenta (60) días a partir de la fecha de este aviso para pedir una reconsideración.')).toBe(60);
  });
  it('service and admission dates are not the notice date', () => {
    expect(findNoticeDate('Aviso\nFecha de los servicios: 3 de octubre de 2026\nFecha de admisión: 1 de octubre de 2026\nTexto')).toBeNull();
  });
  it('"plan individual" is a Marketplace signal', () => {
    expect(guessPlanType('Su plan individual de salud niega el servicio.')).toBe('marketplace');
  });
});
