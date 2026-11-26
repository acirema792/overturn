// English and Spanish interface text. The appeal LETTER stays in English on
// purpose: it goes to a US insurer. Explanations, checklists and questions for
// the doctor follow the chosen language.
import { createContext, useContext } from 'react';

export type Lang = 'en' | 'es';

const EN = {
  // header / nav / footer
  tagline: 'Appeal a health insurance denial. Your identity stays on your device.',
  navAppeal: 'Appeal',
  navHow: 'How it works',
  navBenchmark: 'Benchmark',
  nanoAvailable: 'Gemini Nano ready on this device',
  nanoDownloadable: 'Gemini Nano can be downloaded',
  nanoDownloading: 'Gemini Nano is downloading',
  nanoUnavailable: 'Gemini Nano not available in this browser',
  cloudPill: 'Cloud: {model}',
  offlinePill: 'Offline',
  cloudBlocked: 'Cloud blocked in this browser',
  cloudBlockedTitle:
    "Google's App Check couldn't verify this browser (common on VPNs, privacy or automated browsers). On-device reading, the review screen and the template letter still work.",
  appCheckOff: 'App Check not configured',
  englishOnlyPage: '',
  // steps
  stepLetter: 'Your letter',
  stepCheck: 'Check what leaves',
  stepAppeal: 'Your appeal',
  working: 'Working…',
  // input
  inputTitle: 'Paste your denial letter',
  inputLedeNano:
    'Your letter is read on this device by Gemini Nano. Names, member IDs, addresses and other identifiers it finds are replaced before anything goes to the cloud, and you check exactly what will be sent.',
  inputLede:
    'Your letter is read on this device. Names, member IDs, addresses and other identifiers it finds are replaced before anything goes to the cloud, and you check exactly what will be sent.',
  trySample: 'Try a sample (synthetic, not a real person):',
  letterLabel: 'Denial letter text',
  letterPlaceholder: 'Paste the text of the letter from your insurer, or an Explanation of Benefits, here…',
  readOnDevice: 'Read it on this device',
  rulesOnlyNow: 'Hide my details now (rules only)',
  downloadNano: 'Download Gemini Nano (once), then read',
  waitNano: 'Wait for Gemini Nano, then read',
  downloadNanoTitle: 'Chrome downloads the on-device model once; it can take several minutes',
  hideOnDevice: 'Hide my details on this device',
  openPdf: 'Open a PDF',
  usePhoto: 'Use a photo (PNG/JPEG)',
  photoNeedsNano: 'Photo reading needs Gemini Nano in Chrome',
  tooShort: 'That looks too short to be a letter.',
  noNanoNote:
    'Gemini Nano isn’t available in this browser, so only Overturn’s built-in rules will find your details. You’ll review the result and can hide anything they missed before sending. For the full on-device experience, use Chrome on desktop (see "How it works").',
  // progress
  progPrepareNano: 'Preparing Gemini Nano on this device…',
  progDownloadNano: 'Downloading Gemini Nano to this device: {pct}%',
  progNanoReading: 'Gemini Nano is reading the letter on this device…',
  progRulesReading: 'Finding personal details with on-device rules…',
  progPhoto: 'Gemini Nano is reading the photo on this device…',
  progPdf: 'Reading the PDF on this device…',
  progNanoDraft: 'Gemini Nano is drafting your appeal on this device…',
  progCloudDraft: 'Gemini is drafting your appeal from the de-identified letter…',
  progBusy: 'Google’s free Gemini tier is busy. Trying again automatically (attempt {n} of {total})…',
  // errors
  errPdfScan: 'This PDF has no text layer (it is a scan). Use a photo of the letter with Gemini Nano, or paste the text.',
  errPdf: 'Couldn’t read that PDF on this device: {msg}. You can paste the letter instead.',
  errPhoto: 'Couldn’t read the photo on this device: {msg}. You can paste or type the letter instead.',
  errBlocked: '{msg} Hide them on the left, then try again.',
  templateInstead: '{msg} Here is a template letter instead; nothing was guessed.',
  // review
  whyNo: 'Why they said no',
  source: 'Source: {source}',
  readBy: 'Read by',
  readByNano: 'Gemini Nano, on this device',
  readByRules: 'Rules only, on this device',
  readByNanoDetail: '{n} details found by the on-device model, plus rule-based checks.',
  readByError: 'The on-device model didn’t run ({err}). Nothing was sent to the cloud instead.',
  readByNoNano: 'No on-device model in this browser. Check the outgoing text carefully.',
  readByChoseRules: 'You chose rules only. Check the outgoing text carefully.',
  checkTitle: 'Check what leaves your device',
  gateOk: 'Egress check passed: no known or detectable identifiers in {bytes} bytes.',
  gateBad: 'Egress check blocked: {n} identifier(s) still present ({list}). Hide them on the left.',
  legend: 'Highlighted by:',
  legendRules: 'rules',
  legendRepeat: 'repeat of a found value',
  legendYou: 'you',
  yourLetter: 'Your letter',
  staysHere: '(stays here)',
  originalAria: 'Your original letter. Select text to hide it.',
  hideSelection: 'Hide “{text}”',
  selectToHide: 'Select text above to hide it',
  typeHideLabel: 'Type a word or name from your letter to hide it',
  typeHidePlaceholder: '…or type text to hide',
  hide: 'Hide',
  cloudWillSee: 'What the cloud model will see',
  foundByNano: 'Found by Gemini Nano ({n}). Remove any that aren’t personal.',
  notPersonalAria: '“{text}” is not personal: stop hiding it',
  hiddenByYou: 'Hidden by you:',
  showAgainAria: 'Show “{text}” again',
  possibleNames: 'Possible names still visible. Hide any that are people:',
  hideSuspect: '+ hide “{text}”',
  fullPrompt: 'See the full prompt that would be sent ({bytes} bytes)',
  sendCloud: 'Send the hidden version to Gemini',
  stayOffline: 'Stay offline: draft on this device',
  needsNano: 'Needs Gemini Nano in Chrome',
  useTemplate: 'Use a template letter (no AI)',
  startOver: 'Start over',
  cancelStartOver: 'Cancel and start over',
  // result
  whatHappened: 'What happened',
  appealLetter: 'Your appeal letter',
  appealLetterNote: 'Names and numbers were put back on this device. Edit anything, then print, sign and send it before the deadline.',
  letterInEnglish: '',
  unknownPh: 'The model used {list}, which we never issued. Replace them by hand.',
  appealLetterAria: 'Appeal letter',
  copyLetter: 'Copy letter',
  downloadTxt: 'Download .txt',
  print: 'Print',
  newLetter: 'Start a new letter',
  strongestArguments: 'Strongest arguments',
  gatherEvidence: 'Gather this evidence',
  askDoctor: 'Ask your doctor',
  disclaimer: 'Overturn is not a lawyer or your insurer. It helps you write and send your own appeal.',
  // deadline
  deadlineTitle: 'Appeal deadline',
  daysLeft: '{n} days left',
  datePassed: 'This date has passed: call your plan today',
  addCalendar: 'Add to calendar (.ics)',
  calendarTitle: 'Insurance appeal deadline',
  notSure: 'Not sure: we won’t guess',
  deadlineSources: 'Notice date from {notice}; appeal window from {window}. The date arithmetic is plain code on this device.',
  legalDefault: 'the legal default',
  srcCode: 'letter text (code)',
  srcNano: 'Gemini Nano',
  srcDefault: 'legal default',
  srcNone: 'not found',
  // ledger
  ledgerTitle: 'Privacy ledger',
  ledgerNothing: 'No part of your letter has left this device.',
  ledgerSent: '{steps} step sent {bytes} bytes of de-identified text to the cloud. The original letter stayed here.',
  colStep: 'Step',
  colRan: 'Ran',
  colMode: 'Mode requested',
  colModel: 'Model',
  colBytes: 'Prompt bytes sent',
  colRequests: 'Gemini requests seen',
  colTime: 'Time',
  whereDevice: 'On this device',
  whereCloud: 'Cloud',
  whereCode: 'Plain code',
  whereBlocked: 'Blocked',
  ledgerFoot:
    '"Ran" comes from Firebase AI Logic’s inferenceSource on each response. "Gemini requests seen" counts requests to Gemini endpoints recorded by your browser (Resource Timing) while the step ran. Separately, the app talks to Firebase for App Check and Remote Config when it loads; those requests carry no letter content.',
};

export type Key = keyof typeof EN;

const ES: Record<Key, string> = {
  tagline: 'Apela una negación de tu seguro médico. Tu identidad se queda en tu dispositivo.',
  navAppeal: 'Apelar',
  navHow: 'Cómo funciona',
  navBenchmark: 'Prueba',
  nanoAvailable: 'Gemini Nano listo en este dispositivo',
  nanoDownloadable: 'Gemini Nano se puede descargar',
  nanoDownloading: 'Gemini Nano se está descargando',
  nanoUnavailable: 'Gemini Nano no está disponible en este navegador',
  cloudPill: 'Nube: {model}',
  offlinePill: 'Sin conexión',
  cloudBlocked: 'Nube bloqueada en este navegador',
  cloudBlockedTitle:
    'App Check de Google no pudo verificar este navegador (pasa con VPN, navegadores privados o automatizados). La lectura en el dispositivo, la revisión y la carta modelo siguen funcionando.',
  appCheckOff: 'App Check no configurado',
  englishOnlyPage: 'Esta página está en inglés.',
  stepLetter: 'Tu carta',
  stepCheck: 'Revisa lo que sale',
  stepAppeal: 'Tu apelación',
  working: 'Trabajando…',
  inputTitle: 'Pega tu carta de negación',
  inputLedeNano:
    'Gemini Nano lee tu carta en este dispositivo. Los nombres, números de miembro, direcciones y otros datos que encuentra se reemplazan antes de que algo vaya a la nube, y tú revisas exactamente lo que se enviará.',
  inputLede:
    'Tu carta se lee en este dispositivo. Los nombres, números de miembro, direcciones y otros datos que encuentra se reemplazan antes de que algo vaya a la nube, y tú revisas exactamente lo que se enviará.',
  trySample: 'Prueba un ejemplo (ficticio, no es una persona real):',
  letterLabel: 'Texto de la carta de negación',
  letterPlaceholder: 'Pega aquí el texto de la carta de tu aseguradora o de la Explicación de Beneficios (EOB)…',
  readOnDevice: 'Leerla en este dispositivo',
  rulesOnlyNow: 'Ocultar mis datos ahora (solo reglas)',
  downloadNano: 'Descargar Gemini Nano (una vez) y leer',
  waitNano: 'Esperar a Gemini Nano y leer',
  downloadNanoTitle: 'Chrome descarga el modelo una sola vez; puede tardar varios minutos',
  hideOnDevice: 'Ocultar mis datos en este dispositivo',
  openPdf: 'Abrir un PDF',
  usePhoto: 'Usar una foto (PNG/JPEG)',
  photoNeedsNano: 'Leer fotos requiere Gemini Nano en Chrome',
  tooShort: 'Parece demasiado corto para ser una carta.',
  noNanoNote:
    'Gemini Nano no está disponible en este navegador, así que solo las reglas de Overturn buscarán tus datos. Revisarás el resultado y podrás ocultar lo que se les haya escapado antes de enviar. Para la experiencia completa en el dispositivo, usa Chrome en una computadora (ver "Cómo funciona").',
  progPrepareNano: 'Preparando Gemini Nano en este dispositivo…',
  progDownloadNano: 'Descargando Gemini Nano a este dispositivo: {pct}%',
  progNanoReading: 'Gemini Nano está leyendo la carta en este dispositivo…',
  progRulesReading: 'Buscando datos personales con reglas en el dispositivo…',
  progPhoto: 'Gemini Nano está leyendo la foto en este dispositivo…',
  progPdf: 'Leyendo el PDF en este dispositivo…',
  progNanoDraft: 'Gemini Nano está redactando tu apelación en este dispositivo…',
  progCloudDraft: 'Gemini está redactando tu apelación a partir de la carta sin datos personales…',
  progBusy: 'El nivel gratuito de Gemini está saturado. Reintentando automáticamente (intento {n} de {total})…',
  errPdfScan: 'Este PDF no tiene texto (es una imagen escaneada). Usa una foto de la carta con Gemini Nano o pega el texto.',
  errPdf: 'No se pudo leer ese PDF en este dispositivo: {msg}. Puedes pegar la carta.',
  errPhoto: 'No se pudo leer la foto en este dispositivo: {msg}. Puedes pegar o escribir la carta.',
  errBlocked: '{msg} Ocúltalos a la izquierda y vuelve a intentarlo.',
  templateInstead: '{msg} Aquí tienes una carta modelo; no se inventó nada.',
  whyNo: 'Por qué dijeron que no',
  source: 'Fuente: {source}',
  readBy: 'Leída por',
  readByNano: 'Gemini Nano, en este dispositivo',
  readByRules: 'Solo reglas, en este dispositivo',
  readByNanoDetail: '{n} datos encontrados por el modelo en el dispositivo, además de las reglas.',
  readByError: 'El modelo en el dispositivo no se ejecutó ({err}). Por eso no se envió nada a la nube.',
  readByNoNano: 'No hay modelo en el dispositivo en este navegador. Revisa con cuidado el texto que sale.',
  readByChoseRules: 'Elegiste solo reglas. Revisa con cuidado el texto que sale.',
  checkTitle: 'Revisa lo que sale de tu dispositivo',
  gateOk: 'Control de salida aprobado: ningún dato identificable conocido o detectable en {bytes} bytes.',
  gateBad: 'Control de salida bloqueado: aún quedan {n} dato(s) identificable(s) ({list}). Ocúltalos a la izquierda.',
  legend: 'Resaltado por:',
  legendRules: 'reglas',
  legendRepeat: 'repetición de un dato encontrado',
  legendYou: 'ti',
  yourLetter: 'Tu carta',
  staysHere: '(se queda aquí)',
  originalAria: 'Tu carta original. Selecciona texto para ocultarlo.',
  hideSelection: 'Ocultar “{text}”',
  selectToHide: 'Selecciona texto arriba para ocultarlo',
  typeHideLabel: 'Escribe una palabra o nombre de tu carta para ocultarlo',
  typeHidePlaceholder: '…o escribe el texto a ocultar',
  hide: 'Ocultar',
  cloudWillSee: 'Lo que verá el modelo en la nube',
  foundByNano: 'Encontrados por Gemini Nano ({n}). Quita los que no sean personales.',
  notPersonalAria: '“{text}” no es personal: dejar de ocultarlo',
  hiddenByYou: 'Ocultado por ti:',
  showAgainAria: 'Mostrar “{text}” otra vez',
  possibleNames: 'Posibles nombres aún visibles. Oculta los que sean personas:',
  hideSuspect: '+ ocultar “{text}”',
  fullPrompt: 'Ver la instrucción completa que se enviaría ({bytes} bytes)',
  sendCloud: 'Enviar la versión oculta a Gemini',
  stayOffline: 'Sin conexión: redactar en este dispositivo',
  needsNano: 'Requiere Gemini Nano en Chrome',
  useTemplate: 'Usar una carta modelo (sin IA)',
  startOver: 'Empezar de nuevo',
  cancelStartOver: 'Cancelar y empezar de nuevo',
  whatHappened: 'Qué pasó',
  appealLetter: 'Tu carta de apelación',
  appealLetterNote: 'Los nombres y números se volvieron a poner en este dispositivo. Edita lo que quieras; luego imprímela, fírmala y envíala antes de la fecha límite.',
  letterInEnglish: 'La carta está en inglés porque va dirigida a una aseguradora de EE. UU.',
  unknownPh: 'El modelo usó {list}, que nunca generamos. Reemplázalos a mano.',
  appealLetterAria: 'Carta de apelación',
  copyLetter: 'Copiar carta',
  downloadTxt: 'Descargar .txt',
  print: 'Imprimir',
  newLetter: 'Empezar una carta nueva',
  strongestArguments: 'Argumentos más fuertes',
  gatherEvidence: 'Reúne estas pruebas',
  askDoctor: 'Pregúntale a tu médico',
  disclaimer: 'Overturn no es un abogado ni tu aseguradora. Te ayuda a escribir y enviar tu propia apelación.',
  deadlineTitle: 'Fecha límite para apelar',
  daysLeft: 'Quedan {n} días',
  datePassed: 'Esta fecha ya pasó: llama a tu plan hoy',
  addCalendar: 'Añadir al calendario (.ics)',
  calendarTitle: 'Fecha límite de apelación del seguro',
  notSure: 'No estamos seguros: no vamos a adivinar',
  deadlineSources: 'Fecha del aviso: {notice}; plazo para apelar: {window}. El cálculo de fechas es código en este dispositivo.',
  legalDefault: 'el mínimo legal',
  srcCode: 'texto de la carta (código)',
  srcNano: 'Gemini Nano',
  srcDefault: 'mínimo legal',
  srcNone: 'no encontrado',
  ledgerTitle: 'Registro de privacidad',
  ledgerNothing: 'Ninguna parte de tu carta ha salido de este dispositivo.',
  ledgerSent: '{steps} paso envió {bytes} bytes de texto sin datos personales a la nube. La carta original se quedó aquí.',
  colStep: 'Paso',
  colRan: 'Dónde',
  colMode: 'Modo pedido',
  colModel: 'Modelo',
  colBytes: 'Bytes enviados',
  colRequests: 'Solicitudes a Gemini',
  colTime: 'Tiempo',
  whereDevice: 'En este dispositivo',
  whereCloud: 'Nube',
  whereCode: 'Código',
  whereBlocked: 'Bloqueado',
  ledgerFoot:
    '"Dónde" viene de inferenceSource de Firebase AI Logic en cada respuesta. "Solicitudes a Gemini" cuenta las solicitudes a Gemini que registró tu navegador (Resource Timing) durante el paso. Aparte, la app habla con Firebase para App Check y Remote Config al cargar; esas solicitudes no llevan contenido de tu carta.',
};

const DICT: Record<Lang, Record<Key, string>> = { en: EN, es: ES };

/** Keys that are intentionally empty in English (Spanish-only notes). */
export const ES_ONLY: Key[] = ['englishOnlyPage', 'letterInEnglish'];
export const ALL_KEYS = Object.keys(EN) as Key[];

export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const s = DICT[lang][key] ?? EN[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('overturn-lang');
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* storage may be unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('overturn-lang', lang);
  } catch {
    /* storage may be unavailable */
  }
}

export const LangContext = createContext<Lang>('en');
export const useLang = () => useContext(LangContext);
export const useT = () => {
  const lang = useLang();
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
};

/** Ledger step names come from the engine in English. */
const STEP_ES: Record<string, string> = {
  'Find personal details': 'Encontrar datos personales',
  'Read the denial': 'Leer la negación',
  'Read the photo': 'Leer la foto',
  'Read the PDF': 'Leer el PDF',
  'Hide personal details + compute deadline': 'Ocultar datos personales + calcular la fecha límite',
  'Write the appeal': 'Redactar la apelación',
  'Template appeal letter': 'Carta modelo de apelación',
};
export const stepName = (lang: Lang, step: string) => (lang === 'es' ? (STEP_ES[step] ?? step) : step);
