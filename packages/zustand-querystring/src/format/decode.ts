// One UTF-8 character: an ASCII byte, or a lead byte and its continuation bytes
const utf8Char =
  /%[0-7][0-9a-f]|%[cd][0-9a-f]%[89ab][0-9a-f]|%e[0-9a-f](?:%[89ab][0-9a-f]){2}|%f[0-7](?:%[89ab][0-9a-f]){3}/gi;

/**
 * Like decodeURIComponent, but keeps what it can't decode as written.
 */
export function decodeComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str.replace(utf8Char, char => {
      try {
        return decodeURIComponent(char);
      } catch {
        return char;
      }
    });
  }
}
