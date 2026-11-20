import { writeFileSync, mkdirSync } from 'node:fs';
import { runEval, renderMarkdown } from '../src/eval/runEval';
import { CASES } from '../src/data/cases';
import { HELDOUT } from '../src/data/heldout';

mkdirSync('eval_results', { recursive: true });
const env = `node ${process.version}`;
const sets = [
  { file: 'rules-only-tuning', label: 'Rules only, tuning set (16 letters; rules were adjusted on these)', cases: CASES },
  { file: 'rules-only-heldout', label: 'Rules only, held-out set (8 letters; written after tuning, run without changes)', cases: HELDOUT },
];
let out = '';
for (const s of sets) {
  const r = await runEval(s.label, undefined, env, s.cases);
  writeFileSync(`eval_results/${s.file}.json`, JSON.stringify(r, null, 2));
  out += renderMarkdown(r) + '\n\n';
}
writeFileSync('eval_results/rules-only.md', out);
console.log(out);
