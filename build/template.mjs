/**
 * A very small HTML template renderer — the only "framework" this site has.
 *
 * Templates are ordinary .html files in src/templates/ and src/partials/ with
 * four kinds of tag:
 *
 *   {{ name }}              insert a value, HTML-escaped
 *   {{{ name }}}            insert a value as raw HTML (page bodies only)
 *   {{# if name }} … {{ else }} … {{/ if }}
 *   {{# each list }} … {{/ each }}
 *   {{> partial-name }}     pull in src/partials/<name>.html
 *
 * Inside `each`, `{{ this }}` is the item itself, `{{ @index }}` its position
 * (from 0) and `{{ @first }}` / `{{ @last }}` are true at the ends. Names are
 * dotted paths — `contact.email` — and `../` steps out to the enclosing scope.
 *
 * Anything more complicated than this is deliberately not supported: it is
 * worked out in build/model.mjs, in plain JavaScript, before rendering starts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Escape a value for use in HTML text or inside a double-quoted attribute.
 *
 * `'` is deliberately left alone. Every attribute here is double-quoted, so an
 * apostrophe needs no escaping — and escaping it would rewrite the quotes
 * inside `style="background:url('…')"`, which is legal but unreadable and
 * defeats any tool that reads URLs out of the markup.
 */
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Look up a dotted path in the scope chain. `../x` steps out one level. */
function resolve(path, scopes) {
  let depth = scopes.length - 1;
  let rest = path.trim();

  while (rest.startsWith('../')) {
    depth--;
    rest = rest.slice(3);
  }
  if (depth < 0) return undefined;

  if (rest === 'this' || rest === '.') return scopes[depth].value;

  // @index / @first / @last live on the scope itself, not on the data.
  if (rest.startsWith('@')) {
    for (let i = depth; i >= 0; i--) {
      if (rest.slice(1) in scopes[i].meta) return scopes[i].meta[rest.slice(1)];
    }
    return undefined;
  }

  const parts = rest.split('.');
  // Start at the innermost scope and walk outwards until the first part hits.
  for (let i = depth; i >= 0; i--) {
    let current = scopes[i].value;
    if (current === null || typeof current !== 'object' || !(parts[0] in current)) continue;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }
  return undefined;
}

/** Falsy the way a template author expects: empty strings and [] are false. */
function truthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** One tag. Built fresh per call — `run` recurses, and a shared regex's
 *  lastIndex would be clobbered by the inner call. */
const tagRe = () => /\{\{(\{)?\s*([#/>]?)\s*(?:(if|each|else)\b\s*)?([^{}]*?)\s*(\})?\}\}/g;

/**
 * Render one template string.
 * @param {string} source   the template text
 * @param {object} data     the top-level values it can see
 * @param {object} options  { partials: absolute path to src/partials }
 */
export function render(source, data, options = {}) {
  const scopes = [{ value: data, meta: {} }];
  return run(source, scopes, options);
}

function run(source, scopes, options) {
  let out = '';
  let pos = 0;
  const TAG = tagRe();

  let match;
  while ((match = TAG.exec(source)) !== null) {
    const [tag, tripleOpen, marker, keyword, expression, tripleClose] = match;
    out += source.slice(pos, match.index);

    // ---- block open: {{# if x }} / {{# each xs }} ----
    if (marker === '#') {
      const end = findClose(source, TAG.lastIndex, keyword);
      const body = source.slice(TAG.lastIndex, end.bodyEnd);
      const value = resolve(expression, scopes);

      if (keyword === 'if') {
        const [whenTrue, whenFalse] = splitElse(body);
        out += run(truthy(value) ? whenTrue : whenFalse, scopes, options);
      } else if (keyword === 'each') {
        const list = Array.isArray(value) ? value : [];
        list.forEach((item, index) => {
          scopes.push({
            value: item,
            meta: { index, first: index === 0, last: index === list.length - 1 },
          });
          out += run(body, scopes, options);
          scopes.pop();
        });
      } else {
        throw new Error(`Unknown block {{# ${keyword} }}`);
      }

      pos = end.after;
      TAG.lastIndex = pos;
      continue;
    }

    // ---- partial: {{> footer }} ----
    if (marker === '>') {
      const file = join(options.partials, `${expression}.html`);
      if (!existsSync(file)) throw new Error(`Partial not found: src/partials/${expression}.html`);
      out += run(readFileSync(file, 'utf8'), scopes, options);
      pos = TAG.lastIndex;
      continue;
    }

    if (marker === '/') throw new Error(`Unexpected closing tag ${tag}`);

    // ---- plain value ----
    // A stray {{ else }} outside an if-block renders as nothing.
    const value = keyword ? undefined : resolve(expression, scopes);
    if (value !== undefined && value !== null && value !== false) {
      out += tripleOpen && tripleClose ? String(value) : esc(value);
    }
    pos = TAG.lastIndex;
  }

  return out + source.slice(pos);
}

/** Walk forward from `from` to the {{/ keyword }} that closes this block. */
function findClose(source, from, keyword) {
  const scan = /\{\{\s*([#/])\s*(if|each)\b\s*[^{}]*?\}\}/g;
  scan.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = scan.exec(source)) !== null) {
    if (match[2] !== keyword) continue;
    depth += match[1] === '#' ? 1 : -1;
    if (depth === 0) return { bodyEnd: match.index, after: scan.lastIndex };
  }
  throw new Error(`Missing {{/ ${keyword} }}`);
}

/** Split an if-block body on its top-level {{ else }}. */
function splitElse(body) {
  const scan = /\{\{\s*([#/])?\s*(if|each|else)\b\s*[^{}]*?\}\}/g;
  let depth = 0;
  let match;
  while ((match = scan.exec(body)) !== null) {
    if (match[2] === 'else') {
      if (depth === 0) return [body.slice(0, match.index), body.slice(scan.lastIndex)];
      continue;
    }
    depth += match[1] === '#' ? 1 : -1;
  }
  return [body, ''];
}

/** Read and render a template file. */
export function renderFile(file, data, options) {
  return render(readFileSync(file, 'utf8'), data, options);
}
