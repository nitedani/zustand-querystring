export function stringify(input: unknown) {
  return encodeURIComponent(JSON.stringify(input));
}

export function parse(str: string) {
  return JSON.parse(decodeURIComponent(str));
}
