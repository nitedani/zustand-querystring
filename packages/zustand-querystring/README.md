# zustand-querystring

Zustand middleware for URL query string sync.

```bash
npm install zustand-querystring
```

## Usage

```ts
import { create } from 'zustand';
import { querystring } from 'zustand-querystring';

const useStore = create(
  querystring(
    (set) => ({
      search: '',
      page: 1,
      setSearch: (search) => set({ search }),
      setPage: (page) => set({ page }),
    }),
    {
      select: () => ({ search: true, page: true }),
    }
  )
);
// URL: ?search=hello&page=2
```

---

## Options

```ts
querystring(storeCreator, {
  select: undefined,    // which fields to sync
  key: false,           // false | 'state'
  prefix: '',           // prefix for URL params
  format: marked,       // serialization format
  syncNull: false,      // sync null values
  syncUndefined: false, // sync undefined values
  url: undefined,       // request URL for SSR
})
```

### `select`

Controls which state fields sync to URL. Receives pathname, returns object with `true` for fields to sync.

```ts
// All fields
select: () => ({ search: true, page: true, filters: true })

// Route-based
select: (pathname) => ({
  search: true,
  filters: pathname.startsWith('/products'),
  adminSettings: pathname.startsWith('/admin'),
})

// Nested fields
select: () => ({
  user: {
    name: true,
    settings: { theme: true },
  },
})
```

### `key`

- `false` (default): Each field becomes a separate URL param
  ```
  ?search=hello&page=2&filters.sort=name
  ```
- `'state'` (or any string): All state in one param
  ```
  ?state=search%3Dhello%2Cpage%3A2
  ```

### `prefix`

Adds prefix to all params. Use when multiple stores share URL.

```ts
querystring(storeA, { prefix: 'a_', select: () => ({ search: true }) })
querystring(storeB, { prefix: 'b_', select: () => ({ filter: true }) })
// URL: ?a_search=hello&b_filter=active
```

### `syncNull` / `syncUndefined`

By default, `null` and `undefined` reset to initial state (removed from URL). Set to `true` to write them.

### `url`

For SSR, pass the request URL:

```ts
querystring(store, { url: request.url, select: () => ({ search: true }) })
```

---

## How State Syncs

1. **On page load**: URL → State
2. **On state change**: State → URL (via `replaceState`)

Only values **different from initial state** are written to URL:

```ts
// Initial: { search: '', page: 1, sort: 'date' }
// Current: { search: 'hello', page: 1, sort: 'name' }
// URL: ?search=hello&sort=name
// (page omitted - matches initial)
```

Type handling:
- Objects: recursively diffed
- Arrays, Dates: compared as whole values
- Functions: never synced

---

## Formats

Three built-in formats:

| Format | Example Output |
|--------|----------------|
| `marked` | `count:5,tags@a,b~` |
| `plain` | `count=5&tags=a,b` |
| `json` | `count=5&tags=%5B%22a%22%5D` |

```ts
import { marked } from 'zustand-querystring/format/marked';
import { plain } from 'zustand-querystring/format/plain';
import { json } from 'zustand-querystring/format/json';

querystring(store, { format: plain })
```

### Marked Format (default)

Type markers: `:` primitive, `=` string, `@` array, `.` object

Delimiters: `,` separator, `~` terminator, `/` escape

```ts
import { createFormat } from 'zustand-querystring/format/marked';

const format = createFormat({
  typeObject: '.',
  typeArray: '@',
  typeString: '=',
  typePrimitive: ':',
  separator: ',',
  terminator: '~',
  escapeChar: '/',
  datePrefix: 'D',
});
```

### Plain Format

Dot notation for nesting, comma-separated arrays.

```ts
import { createFormat } from 'zustand-querystring/format/plain';

const format = createFormat({
  entrySeparator: ',',      // between entries in namespaced mode
  nestingSeparator: '.',    // for nested keys
  arraySeparator: ',',      // or 'repeat' for ?tags=a&tags=b&tags=c
  escapeChar: '/',
  nullString: 'null',
  undefinedString: 'undefined',
  emptyArrayMarker: '__empty__',
});
```

### JSON Format

URL-encoded JSON. No configuration.

---

## Custom Format

Implement `QueryStringFormat`:

```ts
import type { QueryStringFormat, QueryStringParams, ParseContext } from 'zustand-querystring';

const myFormat: QueryStringFormat = {
  // For key: 'state' (namespaced mode)
  stringify(state: object): string {
    return encodeURIComponent(JSON.stringify(state));
  },
  parse(value: string, ctx?: ParseContext): object {
    return JSON.parse(decodeURIComponent(value));
  },

  // For key: false (standalone mode)
  stringifyStandalone(state: object): QueryStringParams {
    const result: QueryStringParams = {};
    for (const [key, value] of Object.entries(state)) {
      result[key] = [encodeURIComponent(JSON.stringify(value))];
    }
    return result;
  },
  parseStandalone(params: QueryStringParams, ctx: ParseContext): object {
    const result: Record<string, unknown> = {};
    for (const [key, values] of Object.entries(params)) {
      result[key] = JSON.parse(decodeURIComponent(values[0]));
    }
    return result;
  },
};

querystring(store, { format: myFormat })
```

Types:
- `QueryStringParams` = `Record<string, string[]>` (values always arrays)
- `ctx.initialState` available for type coercion

---

## Examples

### Search with reset

```ts
const useStore = create(
  querystring(
    (set) => ({
      query: '',
      page: 1,
      setQuery: (query) => set({ query, page: 1 }), // reset page on new query
      setPage: (page) => set({ page }),
    }),
    { select: () => ({ query: true, page: true }) }
  )
);
```

### Multiple stores with prefixes

```ts
const useFilters = create(
  querystring(filtersStore, {
    prefix: 'f_',
    select: () => ({ category: true, price: true }),
  })
);

const usePagination = create(
  querystring(paginationStore, {
    prefix: 'p_',
    select: () => ({ page: true, limit: true }),
  })
);
// URL: ?f_category=shoes&f_price=100&p_page=2&p_limit=20
```

### Next.js SSR

```ts
// app/page.tsx
export default async function Page({ searchParams }) {
  // Store reads from URL on init
}
```

---

## Exports

```ts
// Middleware
import { querystring } from 'zustand-querystring';

// Formats
import { marked, createFormat } from 'zustand-querystring/format/marked';
import { plain, createFormat } from 'zustand-querystring/format/plain';
import { json } from 'zustand-querystring/format/json';

// Types
import type {
  QueryStringOptions,
  QueryStringFormat,
  QueryStringParams,
  ParseContext,
} from 'zustand-querystring';
```

---

[Playground](https://stackblitz.com/github/nitedani/zustand-querystring/tree/main/examples/react) · [GitHub](https://github.com/nitedani/zustand-querystring)
