/** Whether obj has key as an own property, so a key from the URL never names an inherited member. */
export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Reads an own property only, so a key from the URL never reaches an inherited member. */
export function getOwn<T>(obj: Record<string, T>, key: string): T | undefined {
  return hasOwn(obj, key) ? obj[key] : undefined;
}

/** Assigns an own property; a __proto__ key is defined, since assigning it would set the prototype. */
export function setOwn(obj: object, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    (obj as Record<string, unknown>)[key] = value;
  }
}
