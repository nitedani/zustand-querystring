export interface QueryStringParam {
  key: string;
  value: string | string[];
}

/** Record of key to array of values - always arrays for consistency */
export type QueryStringParams = Record<string, string[]>;

/** Format for namespaced mode (key is a string) */
export interface QueryStringFormatNamespaced {
  /** Serialize entire state into a single encoded string */
  stringify: (state: object) => string;
  /** Deserialize a single encoded string back to state */
  parse: (value: string, ctx?: ParseContext) => object;
}

/** Context passed to parse methods for type inference */
export interface ParseContext {
  /** Initial state for type inference */
  initialState: object;
}

/** Format for standalone mode (key is false) */
export interface QueryStringFormatStandalone {
  /** Serialize state into key-value pairs (always arrays for consistency) */
  stringifyStandalone: (state: object) => QueryStringParams;
  /** Deserialize key-value pairs back to state */
  parseStandalone: (params: QueryStringParams, ctx: ParseContext) => object;
}

/** Full format implementing both modes */
export type QueryStringFormat = QueryStringFormatNamespaced &
  QueryStringFormatStandalone;

/** Conditional format type based on key option */
export type QueryStringFormatFor<K extends string | false> = K extends false
  ? QueryStringFormatStandalone
  : QueryStringFormatNamespaced;
