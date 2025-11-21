const keyStringifyRegexp = /([=:@$/.])/g;
const valueStringifyRegexp = /([.~/])/g;
const keyParseRegexp = /[=:@$.]/;
const valueParseRegexp = /[.~]/;

function encodeString(str: string, regexp: RegExp): string {
  return encodeURI(str.replace(regexp, '/$1'));
}

function trim(res: string): string {
  return typeof res === 'string'
    ? res.replace(/~+$/g, '').replace(/^\$/, '')
    : res;
}

export function stringify(input: unknown, recursive?: boolean): string {
  if (!recursive) {
    return trim(stringify(input, true));
  }

  // Function
  if (typeof input === 'function') {
    return '';
  }

  // Number, Boolean or Null
  if (
    typeof input === 'number' ||
    input === true ||
    input === false ||
    input === null
  ) {
    const value = String(input);
    // Escape dots in numbers to avoid conflicts with separator
    return ':' + value.replace(/\./g, '/.');
  }

  const res: string[] = [];

  // Array
  if (Array.isArray(input)) {
    for (const elem of input) {
      typeof elem === 'undefined'
        ? res.push(':null')
        : res.push(stringify(elem, true));
    }
    return '@' + res.join('..') + '~';
  }

  // Date
  if (input instanceof Date) {
    return '=!Date:' + encodeString(input.toISOString(), valueStringifyRegexp);
  }

  // Object
  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const stringifiedValue = stringify(value, true);
      if (stringifiedValue) {
        res.push(encodeString(key, keyStringifyRegexp) + stringifiedValue);
      }
    }
    return '$' + res.join('..') + '~';
  }

  // undefined
  if (typeof input === 'undefined') {
    return '';
  }

  // String
  return '=' + encodeString(input.toString(), valueStringifyRegexp);
}

export function parse<T = unknown>(str: string): T {
  if (!str.startsWith('$')) {
    str = '$' + str;
  }

  let pos = 0;
  str = decodeURI(str);

  function readToken(regexp: RegExp): string {
    let token = '';
    for (; pos !== str.length; ++pos) {
      if (str.charAt(pos) === '/') {
        pos += 1;
        if (pos === str.length) {
          token += '~';
          break;
        }
      } else if (str.charAt(pos).match(regexp)) {
        break;
      }
      token += str.charAt(pos);
    }
    return token;
  }

  function parseToken(): unknown {
    const type = str.charAt(pos++);

    // String
    if (type === '=') {
      const value = readToken(valueParseRegexp);
      // Date
      if (value.startsWith('!Date:')) {
        return new Date(value.slice('!Date:'.length));
      }
      return value;
    }

    // Number, Boolean or Null
    if (type === ':') {
      const value = readToken(valueParseRegexp);
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      const parsedValue = parseFloat(value);
      return isNaN(parsedValue) ? null : parsedValue;
    }

    // Array
    if (type === '@') {
      const res: unknown[] = [];
      loop: {
        // empty array
        if (pos >= str.length || str.charAt(pos) === '~') {
          break loop;
        }
        // parse array items
        while (true) {
          res.push(parseToken());
          if (pos >= str.length || str.charAt(pos) === '~') {
            break loop;
          }
          // Skip the '..' separator
          if (str.charAt(pos) === '.' && str.charAt(pos + 1) === '.') {
            pos += 2;
          } else {
            pos += 1;
          }
        }
      }
      pos += 1;
      return res;
    }

    // Object
    if (type === '$') {
      const res: Record<string, unknown> = {};
      loop: {
        if (pos >= str.length || str.charAt(pos) === '~') {
          break loop;
        }
        while (true) {
          const name = readToken(keyParseRegexp);
          res[name] = parseToken();
          if (pos >= str.length || str.charAt(pos) === '~') {
            break loop;
          }
          // Skip the '..' separator
          if (str.charAt(pos) === '.' && str.charAt(pos + 1) === '.') {
            pos += 2;
          } else {
            pos += 1;
          }
        }
      }
      pos += 1;
      return res;
    }

    // Error
    throw new Error('Unexpected char "' + type + '" at position ' + (pos - 1));
  }

  return parseToken() as T;
}
