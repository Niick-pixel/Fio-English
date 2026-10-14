// Validador de historias STAR (sin DOM). Detecta:
//  - «we» en Action (borra tu mérito)
//  - Result sin número o resultado concreto
//  - historia de menos de 80 palabras
//  - tus errores documentados (ids de content/errors.json)
// Se carga en la interfaz (window.StarCheck) y en Node para los tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StarCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SECTIONS = ['s', 't', 'a', 'r'];
  const MIN_WORDS = 80;

  const ING_BASE_VERBS = new Set(['bring', 'sing', 'ring', 'swing', 'sting', 'fling', 'cling', 'wring', 'string', 'spring']);
  const ING_NOUNS = new Set(['thing', 'nothing', 'something', 'anything', 'everything', 'morning', 'evening', 'building', 'meeting', 'training', 'ceiling', 'king', 'wedding', 'shipping', 'pricing', 'onboarding', 'marketing', 'accounting', 'invoicing', 'billing', 'warehousing', 'scheduling', 'staffing', 'clothing', 'housing', 'funding', 'financing', 'planning', 'engineering', 'manufacturing']);
  // Frases donde «to» es preposición y SÍ va -ing.
  const TO_ING_OK = /\b(?:look(?:ed|ing)?\s+forward|used|committed|dedicated|according|when\s+it\s+comes|in\s+addition|contribut(?:e|ed|ing)|devoted|open|related|key|approach|object(?:ed)?|accustomed|prior)\s+to\s*$/i;
  // Sustantivos que no llevan -s (siempre bien) y adjetivos (hay que mirar la palabra siguiente).
  const UNCOUNTABLE = new Set(['people', 'staff', 'information', 'equipment', 'feedback', 'work', 'data', 'children', 'advice', 'research', 'software', 'customs', 'times', 'ways']);
  const ADJECTIVES = new Set(['new', 'other', 'different', 'small', 'large', 'big', 'key', 'international', 'local', 'internal', 'external', 'us', 'american', 'asian', 'european', 'time', 'important', 'urgent', 'difficult', 'senior', 'major', 'daily', 'weekly', 'monthly']);

  // Cada regla devuelve marcas { start, end, errorId, hint }.
  const RULES = [
    {
      errorId: 'for-ago',
      re: /\bfor\s+(?:\w+\s+){1,3}ago\b/gi,
      hint: '«for» y «ago» nunca van juntos',
    },
    {
      errorId: 'interested',
      re: /\b(?:I'm|I am|am|was|were|are|is|be|been)\s+(?:very\s+|really\s+|so\s+|always\s+)?interest\b/gi,
      hint: 'interested (con -ed)',
    },
    {
      errorId: 'listen-to',
      re: /\blisten(?:ed|ing|s)?\s+(?!to\b)(?:all|the|my|his|her|their|our|your|them|him|customers?|clients?|people|callers?)\b/gi,
      hint: 'listen TO',
    },
    {
      errorId: 'listen-to',
      re: /\bnecessit(?:y|ies)\b/gi,
      hint: 'con clientes: «needs»',
    },
    {
      errorId: 'labor',
      re: /\blabou?r(?:ed|ing)?\b(?=\s+(?:to|on|with|at|hard|in)\b)/gi,
      hint: '«labor» = trabajo físico; usá worked',
    },
    {
      errorId: 'colleagues',
      re: /\bpartners?\b/gi,
      hint: '¿socios/pareja? Para compañeros: colleagues',
    },
    {
      errorId: 'in-system',
      re: /\bat\s+the\s+system\b|\bthe\s+system\s+(?:Oracle|Salesforce|Genesys|TICA|SAP|Excel)\b|\bat\s+(?:Salesforce|Genesys|TICA|SAP|Excel)\b/gi,
      hint: 'sistemas con «in»: in Oracle',
    },
    {
      errorId: 'understood',
      re: /(?:^|[.!?]\s+|["“]\s*)understood(?=[.!,"”])/gi,
      hint: 'suena militar: Sure / Got it',
    },
  ];

  function wordCount(text) {
    const m = String(text || '').trim().match(/[A-Za-zÀ-ÿ0-9'’-]+/g);
    return m ? m.length : 0;
  }

  // Oración que contiene la posición i (para mirar el contexto de una coincidencia).
  function sentenceAt(text, i) {
    const start = Math.max(text.lastIndexOf('.', i - 1), text.lastIndexOf('!', i - 1), text.lastIndexOf('?', i - 1), text.lastIndexOf('\n', i - 1)) + 1;
    const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, i)).filter((x) => x >= 0);
    return text.slice(start, ends.length ? Math.min(...ends) : text.length);
  }

  function findMarks(text) {
    const marks = [];
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        // «understood» puede venir con un separador delante: marcar solo la palabra.
        const off = rule.errorId === 'understood' ? m[0].toLowerCase().indexOf('understood') : 0;
        marks.push({ start: m.index + off, end: m.index + m[0].length, errorId: rule.errorId, hint: rule.hint });
      }
    }

    // different / several / many… + sustantivo sin -s (mira las dos palabras siguientes).
    const pl = /\b(different|several|many|various|multiple)\s+([A-Za-z]+)(?:\s+([A-Za-z]+))?/gi;
    let m;
    while ((m = pl.exec(text))) {
      const [, quant, w1, w2] = m;
      const isPlural = (w) => /s$/i.test(w);
      const a = w1.toLowerCase();
      if (UNCOUNTABLE.has(a) || isPlural(w1)) continue;
      let noun = w1;
      if (ADJECTIVES.has(a)) {
        if (!w2 || isPlural(w2) || UNCOUNTABLE.has(w2.toLowerCase())) continue;
        noun = w1 + ' ' + w2;
      }
      pl.lastIndex = m.index + quant.length + 1; // no saltear coincidencias solapadas
      marks.push({ start: m.index, end: m.index + quant.length + 1 + noun.length, errorId: 'plural', hint: 'plural después de different/several/many' });
    }

    // to + -ing (salvo cuando «to» es preposición: look forward to hearing…)
    const ti = /\bto\s+([A-Za-z]+ing)\b/gi;
    while ((m = ti.exec(text))) {
      const w = m[1].toLowerCase();
      if (ING_BASE_VERBS.has(w) || ING_NOUNS.has(w)) continue;
      if (TO_ING_OK.test(text.slice(Math.max(0, m.index - 40), m.index + 2))) continue;
      marks.push({ start: m.index, end: m.index + m[0].length, errorId: 'to-infinitive', hint: 'después de «to»: verbo base' });
    }

    // Presente en medio de una historia en pasado (aviso suave).
    const pr = /\b(?:I|we|she|he|they)\s+(take|start|call|handle|send|check|make|need|try|work|create|ask|tell|say|go|get|help|review|update|decide|explain|talk|realize|notice|see|know|think|want|have)\b/gi;
    while ((m = pr.exec(text))) {
      const sentence = sentenceAt(text, m.index);
      if (/\b(?:now|today|still|always|currently|usually|every\s+day|nowadays)\b/i.test(sentence)) continue;
      // «to + verbo», «I'd/will/can + verbo» no matchean porque el sujeto debe ir pegado al verbo.
      marks.push({ start: m.index, end: m.index + m[0].length, errorId: 'tense-slip', hint: '¿presente? La historia va en pasado', soft: true });
    }

    return dedupe(marks);
  }

  // Si dos marcas se pisan, queda la primera (más larga en caso de empate de inicio).
  function dedupe(marks) {
    marks.sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    for (const mk of marks) if (!out.length || mk.start >= out[out.length - 1].end) out.push(mk);
    return out;
  }

  const WE_RE = /\b(?:we|we've|we'd|we're|we'll|our team)\b/gi;
  const I_RE = /\b(?:I|I'm|I've|I'd|I'll)\b/g;
  const NUMBER_RE = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundred|thousand|twice|half|double|doubled|tripled|percent)\b/i;

  function analyze(story) {
    const parts = {};
    for (const k of SECTIONS) parts[k] = String((story && story[k]) || '');
    const words = SECTIONS.reduce((a, k) => a + wordCount(parts[k]), 0);
    const marks = {};
    for (const k of SECTIONS) marks[k] = findMarks(parts[k]);

    // «we» en Action: se marca aparte y se cuenta.
    const weMarks = [];
    WE_RE.lastIndex = 0;
    let m;
    while ((m = WE_RE.exec(parts.a))) weMarks.push({ start: m.index, end: m.index + m[0].length, kind: 'we', hint: 'en Action: «I», no «we»' });
    const iCount = (parts.a.match(I_RE) || []).length;
    marks.a = dedupe([...marks.a, ...weMarks]);

    const issues = [];
    if (weMarks.length) {
      issues.push({
        id: 'we-in-action', severity: 'high',
        title: `Action usa «we» ${weMarks.length === 1 ? '1 vez' : `${weMarks.length} veces`}${iCount ? ` (y «I» ${iCount})` : ' y ninguna vez «I»'}`,
        detail: 'El entrevistador evalúa lo que hiciste VOS. Usá «I» para cada acción tuya; «we» u «our team» solo para el contexto en Situation.',
      });
    } else if (parts.a.trim() && !iCount) {
      issues.push({ id: 'no-i-in-action', severity: 'medium', title: 'Action no tiene ningún «I»', detail: 'Contá las acciones en primera persona: I called…, I created…, I coordinated…' });
    }

    if (!parts.r.trim()) {
      issues.push({ id: 'no-result', severity: 'high', title: 'Falta el Result', detail: '¿Qué pasó gracias a lo que hiciste? Ese es el final que recuerdan.' });
    } else if (!NUMBER_RE.test(parts.r)) {
      issues.push({ id: 'no-number', severity: 'medium', title: 'Result sin número ni resultado concreto', detail: 'Agregá algo medible: un %, tiempo ahorrado, casos resueltos, días de atraso evitados. Ej.: «…which cut documentation errors by about 30%».' });
    }

    if (words < MIN_WORDS) {
      issues.push({ id: 'too-short', severity: 'medium', title: `Desarrollá más: ${words} palabras`, detail: `Apuntá a 150–250 palabras (1.5–2 minutos hablando). Mínimo ${MIN_WORDS}.` });
    } else if (words > 350) {
      issues.push({ id: 'too-long', severity: 'low', title: `Bastante larga: ${words} palabras`, detail: 'Más de 2.5 minutos hablando. Recortá Situation y dejá el peso en Action y Result.' });
    }

    for (const k of SECTIONS) if (!parts[k].trim()) {
      const names = { s: 'Situation', t: 'Task', a: 'Action', r: 'Result' };
      if (k !== 'r') issues.push({ id: 'empty-' + k, severity: 'low', title: `${names[k]} está vacía`, detail: '' });
    }

    const errorCounts = {};
    for (const k of SECTIONS) for (const mk of marks[k]) if (mk.errorId) errorCounts[mk.errorId] = (errorCounts[mk.errorId] || 0) + 1;

    return { words, marks, issues, errorCounts, weCount: weMarks.length, iCount };
  }

  return { analyze, wordCount, findMarks, SECTIONS, MIN_WORDS };
});
