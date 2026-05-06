// ── Minimalist YAML serializer/parser for the preset format ────────────────
// Scope: scalars (numbers, strings, booleans, null), flat numeric arrays,
// and one level of nested object arrays (the wearLayers shape).
// Quotes strings that would otherwise be ambiguous (numbers, keywords,
// special chars, leading/trailing whitespace).
//
// Why hand-rolled? Avoids a dependency for a known, narrow schema.
// Trade-off: Not a full YAML 1.2 parser — feed it untrusted input at your peril.

const SKIP = new Set(['id', 'system']);

const KEYWORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~']);

function needsQuoting(s) {
  if (s === '') return true;
  if (KEYWORDS.has(s.toLowerCase())) return true;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return true; // looks like a number
  if (/[:#,[\]{}&*!|>'"%@`]/.test(s)) return true; // YAML metacharacters
  if (/^\s|\s$/.test(s)) return true; // leading/trailing ws
  return false;
}

function formatScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  // string
  const s = String(v);
  if (!needsQuoting(s)) return s;
  return JSON.stringify(s); // JSON-style double-quote escape is YAML-compatible
}

/** Serialize a flat preset-shaped object to YAML. */
export function presetToYaml(preset) {
  const lines = [];
  for (const [k, v] of Object.entries(preset)) {
    if (SKIP.has(k)) continue;

    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else if (typeof v[0] === 'number') {
        lines.push(`${k}: [${v.map((n) => (Number.isFinite(n) ? n : 'null')).join(', ')}]`);
      } else if (typeof v[0] === 'object' && v[0] !== null) {
        lines.push(`${k}:`);
        for (const obj of v) {
          const entries = Object.entries(obj);
          if (entries.length === 0) continue;
          lines.push(`  - ${entries[0][0]}: ${formatScalar(entries[0][1])}`);
          for (let i = 1; i < entries.length; i++) {
            lines.push(`    ${entries[i][0]}: ${formatScalar(entries[i][1])}`);
          }
        }
      } else {
        // String/bool array — rare, but supported
        lines.push(`${k}: [${v.map(formatScalar).join(', ')}]`);
      }
    } else if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (typeof v === 'object') {
      // Defensive: serialise as JSON inline string
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${formatScalar(v)}`);
    }
  }
  return lines.join('\n');
}

// ── Parser ──────────────────────────────────────────────────────────────────

function stripComment(line) {
  // Remove unquoted # comments. Walk the string respecting quotes.
  let inSingle = false,
    inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'null' || s === '~') return null;
  if (s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === 'no' || s === 'off') return false;
  // Quoted strings
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    if (s[0] === '"') {
      try {
        return JSON.parse(s);
      } catch {
        return inner;
      }
    }
    return inner;
  }
  // Strict number test — rejects "3D Print", "1abc" etc.
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    return parseFloat(s);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return splitInlineList(inner).map(parseScalar);
  }
  return s; // bare string
}

function splitInlineList(s) {
  // Split on commas that are not inside quotes/brackets.
  const out = [];
  let depth = 0,
    inSingle = false,
    inDouble = false,
    start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (!inSingle && !inDouble) {
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ',' && depth === 0) {
        out.push(s.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  out.push(s.slice(start).trim());
  return out;
}

/** Parse a preset YAML string into a flat object. */
export function yamlToPreset(yaml) {
  const preset = {};
  const lines = yaml.split('\n');
  let currentArrayKey = null;
  let currentObj = null;

  for (const raw of lines) {
    const noComment = stripComment(raw);
    const trimmed = noComment.trim();
    if (!trimmed) continue;
    const indent = noComment.search(/\S/);

    if (indent === 0) {
      currentArrayKey = null;
      currentObj = null;
      const ci = findKeyValueSplit(trimmed);
      if (ci === -1) continue;
      const key = trimmed.slice(0, ci).trim();
      const val = trimmed.slice(ci + 1);
      if (val.trim() === '') {
        currentArrayKey = key;
        preset[key] = [];
      } else {
        preset[key] = parseScalar(val);
      }
    } else if (trimmed.startsWith('- ') && currentArrayKey) {
      const inner = trimmed.slice(2);
      const ci = findKeyValueSplit(inner);
      if (ci === -1) continue;
      const k = inner.slice(0, ci).trim();
      const vr = inner.slice(ci + 1);
      currentObj = { [k]: parseScalar(vr) };
      preset[currentArrayKey].push(currentObj);
    } else if (currentObj !== null) {
      const ci = findKeyValueSplit(trimmed);
      if (ci === -1) continue;
      const k = trimmed.slice(0, ci).trim();
      const vr = trimmed.slice(ci + 1);
      currentObj[k] = parseScalar(vr);
    }
  }
  return preset;
}

/** Find the first ":" that is not inside quotes, returning its index. */
function findKeyValueSplit(s) {
  let inSingle = false,
    inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === ':' && !inSingle && !inDouble) {
      // Require the colon to be followed by EOL or whitespace (YAML rule)
      if (i + 1 >= s.length || s[i + 1] === ' ' || s[i + 1] === '\t') return i;
    }
  }
  return -1;
}
