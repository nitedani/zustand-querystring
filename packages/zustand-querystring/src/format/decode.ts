/**
 * Like decodeURIComponent, but keeps what it can't decode as written.
 */
export function decodeComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str.replace(/(?:%[0-9a-f]{2})+/gi, run => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run;
      }
    });
  }
}
