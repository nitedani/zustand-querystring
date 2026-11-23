/** Reads an own property only, so a key from the URL never reaches an inherited member. */
export function getOwn<T>(obj: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
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

/** A plain object: one whose prototype is Object.prototype or null, unlike an array, a Date or a class instance. */
export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
