/**
 * URL-Safe Serialization
 *
 * Inspired by URLON (https://github.com/cerebral/urlon)
 * Copyright (c) 2021 Cerebral - MIT License
 */

// Configuration
const TYPE_OBJECT = '.';
const TYPE_ARRAY = '@';
const TYPE_STRING = '=';
const TYPE_PRIMITIVE = ':';
const SEPARATOR = ',';
const TERMINATOR = '~';
const ESCAPE = '/';
const DATE_PREFIX = 'D';

// Build regex patterns
const esc = (c: string) => (/[.$^*+?()[\]{}|\\]/.test(c) ? `\\${c}` : c);
const KEY_STOP = new RegExp(
  `[${TYPE_STRING}${TYPE_PRIMITIVE}${TYPE_ARRAY}${esc(TYPE_OBJECT)}${esc(SEPARATOR)}]`,
);
const VALUE_STOP = new RegExp(`[${esc(SEPARATOR)}${TERMINATOR}]`);
const KEY_ESCAPE = new RegExp(
  `([${TYPE_STRING}${TYPE_PRIMITIVE}${TYPE_ARRAY}${esc(TYPE_OBJECT)}${ESCAPE}${esc(SEPARATOR)}])`,
  'g',
);
const VALUE_ESCAPE = new RegExp(
  `([${esc(SEPARATOR)}${TERMINATOR}${ESCAPE}])`,
  'g',
);

function escapeStr(str: string, pattern: RegExp): string {
  return encodeURI(str.replace(pattern, `${ESCAPE}$1`));
}

function cleanResult(str: string, standalone: boolean): string {
  while (str.endsWith(TERMINATOR)) str = str.slice(0, -1);

  const datePattern = new RegExp(`^${esc(TYPE_STRING)}${DATE_PREFIX}-?\\d+$`);
  if (standalone && datePattern.test(str)) {
    return str.slice(1);
  }

  if (!standalone && str.startsWith(TYPE_OBJECT)) {
    return str.slice(1);
  }

  return str;
}

// === SERIALIZE ===

export function stringify(value: unknown, standalone: boolean = false): string {
  return cleanResult(serialize(value, standalone), standalone);
}

function serialize(
  value: unknown,
  standalone: boolean,
  inArray: boolean = false,
): string {
  if (value === null) return `${TYPE_PRIMITIVE}null`;
  if (value === undefined) return `${TYPE_PRIMITIVE}undefined`;
  if (typeof value === 'function') return '';

  if (typeof value === 'number') {
    return `${TYPE_PRIMITIVE}${String(value).replace(/\./g, `${ESCAPE}.`)}`;
  }

  if (typeof value === 'boolean') {
    return `${TYPE_PRIMITIVE}${value}`;
  }

  if (value instanceof Date) {
    return `${TYPE_STRING}${DATE_PREFIX}${value.getTime()}`;
  }

  if (Array.isArray(value)) {
    const items = value.map(v => serialize(v, standalone, true));
    return `${TYPE_ARRAY}${items.join(SEPARATOR)}${TERMINATOR}`;
  }

  if (typeof value === 'object') {
    const entries: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      const val = serialize(v, false, false);
      if (val || v === undefined) {
        entries.push(`${escapeStr(k, KEY_ESCAPE)}${val}`);
      }
    }
    return `${TYPE_OBJECT}${entries.join(SEPARATOR)}${TERMINATOR}`;
  }

  // String: escape date-like pattern (D followed by digits)
  const strVal = String(value);
  let escaped = escapeStr(strVal, VALUE_ESCAPE);
  const datePattern = new RegExp(`^${DATE_PREFIX}-?\\d`);
  if (datePattern.test(strVal)) {
    escaped = ESCAPE + escaped;
  }

  return standalone || inArray ? escaped : `${TYPE_STRING}${escaped}`;
}

// === PARSE ===

export function parse<T = unknown>(
  input: string,
  standalone: boolean = false,
): T {
  const str = decodeURI(input);

  if (str.length === 0) {
    return (standalone ? '' : {}) as T;
  }

  const first = str[0];
  const hasMarker =
    first === TYPE_STRING ||
    first === TYPE_PRIMITIVE ||
    first === TYPE_ARRAY ||
    first === TYPE_OBJECT;

  let source: string;
  if (hasMarker) {
    source = str;
  } else if (standalone) {
    const datePattern = new RegExp(`^${DATE_PREFIX}-?\\d+$`);
    if (datePattern.test(str)) {
      const timestamp = parseInt(str.slice(DATE_PREFIX.length), 10);
      if (!isNaN(timestamp)) {
        return new Date(timestamp) as T;
      }
    }
    return str as T;
  } else {
    const markers = `${TYPE_STRING}${TYPE_PRIMITIVE}${TYPE_ARRAY}${TYPE_OBJECT}`;
    const objectPattern = new RegExp(
      `[^${ESCAPE}${markers}${SEPARATOR}${TERMINATOR}][${markers}]`,
    );
    source = objectPattern.test(str)
      ? `${TYPE_OBJECT}${str}`
      : `${TYPE_STRING}${str}`;
  }

  let pos = 0;

  function peek(): string {
    return source[pos] || '';
  }

  function advance(): void {
    pos++;
  }

  function readUntil(
    stopPattern: RegExp,
    checkEscape: boolean = false,
  ): { value: string; wasEscaped: boolean } {
    let result = '';
    let wasEscaped = false;

    while (pos < source.length) {
      const ch = peek();

      if (ch === ESCAPE) {
        if (
          checkEscape &&
          pos + 1 < source.length &&
          source[pos + 1] === DATE_PREFIX
        ) {
          wasEscaped = true;
        }
        advance();
        if (pos < source.length) {
          result += peek();
          advance();
        }
        continue;
      }

      if (stopPattern.test(ch)) break;
      result += ch;
      advance();
    }

    return { value: result, wasEscaped };
  }

  function parseString(): string | Date {
    const { value, wasEscaped } = readUntil(VALUE_STOP, true);

    const datePattern = new RegExp(`^${DATE_PREFIX}-?\\d+$`);
    if (!wasEscaped && datePattern.test(value)) {
      const timestamp = parseInt(value.slice(DATE_PREFIX.length), 10);
      if (!isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    return value;
  }

  function parsePrimitive(): number | boolean | null | undefined {
    const { value } = readUntil(VALUE_STOP, false);
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return parseFloat(value);
  }

  function parseArray(): unknown[] {
    const result: unknown[] = [];
    let lastWasSeparator = false;

    while (pos < source.length && peek() !== TERMINATOR) {
      if (peek() === SEPARATOR) {
        result.push('');
        advance();
        lastWasSeparator = true;
        continue;
      }

      lastWasSeparator = false;

      const ch = peek();
      if (
        ch === TYPE_PRIMITIVE ||
        ch === TYPE_ARRAY ||
        ch === TYPE_OBJECT ||
        ch === TYPE_STRING
      ) {
        result.push(parseValue());
      } else {
        result.push(parseString());
      }

      if (pos < source.length && peek() === SEPARATOR) {
        advance();
        lastWasSeparator = true;
      }
    }

    if (lastWasSeparator && (peek() === TERMINATOR || pos >= source.length)) {
      result.push('');
    }

    if (peek() === TERMINATOR) advance();
    return result;
  }

  function parseObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    while (pos < source.length && peek() !== TERMINATOR) {
      const { value: key } = readUntil(KEY_STOP, false);
      result[key] = parseValue();
      if (
        pos < source.length &&
        peek() !== TERMINATOR &&
        peek() === SEPARATOR
      ) {
        advance();
      }
    }
    if (peek() === TERMINATOR) advance();
    return result;
  }

  function parseValue(): unknown {
    const type = peek();
    advance();

    switch (type) {
      case TYPE_PRIMITIVE:
        return parsePrimitive();
      case TYPE_ARRAY:
        return parseArray();
      case TYPE_OBJECT:
        return parseObject();
      case TYPE_STRING:
        return parseString();
      default:
        throw new Error(`Unexpected type "${type}" at position ${pos}`);
    }
  }

  return parseValue() as T;
}

// Export as a format object for better type inference
export const readable = { stringify, parse };
