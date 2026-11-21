/** Reads an own property only, so a key from the URL never reaches an inherited member. */
export function getOwn<T>(obj: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/** Defined, not assigned: assigning a __proto__ key would set the prototype. */
export function setOwn(obj: object, key: string, value: unknown): void {
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}
