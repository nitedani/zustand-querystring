# zustand-querystring

[![npm](https://img.shields.io/npm/v/zustand-querystring)](https://www.npmjs.com/package/zustand-querystring)
[![CI](https://github.com/nitedani/zustand-querystring/actions/workflows/ci.yml/badge.svg)](https://github.com/nitedani/zustand-querystring/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/nitedani/zustand-querystring/badges/coverage.json)](https://github.com/nitedani/zustand-querystring/actions/workflows/ci.yml)

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
    set => ({
      search: '',
      page: 1,
      setSearch: search => set({ search }),
      setPage: page => set({ page }),
    }),
    {
      select: () => ({ search: true, page: true }),
    },
  ),
);
// URL: ?search=hello&page=2
```

---

## Options

```ts
querystring(storeCreator, {
  select: undefined, // which fields to sync
  key: false, // false | 'state'
  prefix: '', // prefix for URL params
  format: marked, // serialization format
  map: undefined, // bidirectional store ↔ URL mapping
  syncNull: false, // sync null values
  syncUndefined: false, // sync undefined values
  url: undefined, // request URL for SSR
});
```

### `select`

Controls which state fields sync to URL. Receives pathname, returns object with `true` for fields to sync.

```ts
// All fields
select: () => ({ search: true, page: true, filters: true });

// Route-based
select: pathname => ({
  search: true,
  filters: pathname.startsWith('/products'),
  adminSettings: pathname.startsWith('/admin'),
});

// Nested fields
select: () => ({
  user: {
    name: true,
    settings: { theme: true },
  },
});
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
querystring(storeA, { prefix: 'a_', select: () => ({ search: true }) });
querystring(storeB, { prefix: 'b_', select: () => ({ filter: true }) });
// URL: ?a_search=hello&b_filter=active
```

### `syncNull` / `syncUndefined`

By default, `null` and `undefined` reset to initial state (removed from URL). Set to `true` to write them.

### `map`

Bidirectional mapping between store state and URL state. Use when the URL should represent a different shape than the store — e.g., a store keyed by dynamic IDs where the URL should only reflect the active entry.

`to` receives the selected state and pathname, returns the URL shape. `from` receives the parsed URL state and pathname, returns store state to merge. Types flow automatically: `from`'s parameter type is inferred from `to`'s return type.

```ts
interface Store {
  filtersByOperation: Record<string, { filters: string[] }>;
  aggregationByOperation: Record<string, string>;
  setFilters: (opId: string, filters: string[]) => void;
}

const useStore = create<Store>()(
  querystring(
    set => ({
      filtersByOperation: {},
      aggregationByOperation: {},
      setFilters: (opId, filters) =>
        set(s => ({
          filtersByOperation: { ...s.filtersByOperation, [opId]: { filters } },
        })),
    }),
    {
      key: 'state',
      select: pathname => ({
        filtersByOperation: pathname.startsWith('/view/'),
        aggregationByOperation: pathname.startsWith('/view/'),
      }),
      map: {
        to: (state, pathname) => {
          const id = pathname.split('/').pop()!;
          return {
            filters: state.filtersByOperation?.[id]?.filters,
            aggregation: state.aggregationByOperation?.[id],
          };
        },
        from: (urlState, pathname) => {
          // urlState is typed as { filters: string[] | undefined, aggregation: string | undefined }
          const id = pathname.split('/').pop()!;
          return {
            ...(urlState.filters
              ? { filtersByOperation: { [id]: { filters: urlState.filters } } }
              : {}),
            ...(urlState.aggregation
              ? { aggregationByOperation: { [id]: urlState.aggregation } }
              : {}),
          };
        },
      },
    },
  ),
);
// On /view/DAM_v1 → URL: ?state=filters@price_>10~,aggregation=daily
```

### `url`

For SSR, pass the request URL:

```ts
querystring(store, { url: request.url, select: () => ({ search: true }) });
```

---

## How State Syncs

1. **On store creation**: URL → State
2. **On state change**: State → URL (via `replaceState`)
3. **On navigation** (a link, `router.push`, Back/Forward), while something subscribes to the store, like a component that uses it: URL → State, then State → URL. Store keys missing from the URL keep their values, and other params, like `utm_source`, stay in the URL.

A navigation sets a field the state doesn't have yet, like an optional `search` the initializer leaves out, only when `select` lists it, or when the store keeps its params under a `key` or a `prefix`. Without them, a store following the navigation reads only the fields its state has, so `/customers?search=acme` leaves a store without `search` as it is. A store created on that URL, as in a new tab, reads `search` from it too.

When the store writes the current URL, only values **different from initial state** are written:

```ts
// Initial: { search: '', page: 1, sort: 'date' }
// Current: { search: 'hello', page: 1, sort: 'name' }
// URL: ?search=hello&sort=name
// (page omitted - matches initial)
```

Type handling:

- Objects: recursively diffed
- Arrays, Dates: compared as whole values
- Class instances, a subclass of `Array` or `Date` too: compared by their fields, then by the query the store writes for them, so a private field counts
- Functions: never synced

---

## Links

`useStore.href(pathname, state)` returns a URL for `pathname` with the initial state plus the fields in `state`. Current values you didn't pass, like a search the user typed, stay out of the link, so sharing it doesn't share them. A custom `map` can still make them part of the link: in a param value it packs ([below](#links-with-a-packing-map)), in a param name it derives from them, like `advancedPage` for `page` while `mode` is `'advanced'`, or in another param the reader needs to decode a value you passed. `href` reads the link as a store would and adds the params the reader needs from the current state.

Call `href` in a selector so the link updates with the store, then pass it to your router's `Link` or `router.push` ([How State Syncs](#how-state-syncs)). To carry the current view, spread it and override the fields that change:

```tsx
const useStore = create<{ status: string; page: number; search: string }>()(
  querystring(() => ({ status: 'all', page: 1, search: '' })),
);

// Current: { status: 'active', page: 3, search: 'acme' }
const next = useStore(s => useStore.href('/customers', { ...s, page: 2 }));
// next: /customers?status=active&page=:2&search=acme

<Link href={next}>Next page</Link>;
```

A link without the spread carries only what you pass:

```tsx
const paid = useStore(() => useStore.href('/customers', { status: 'paid' }));
// paid: /customers?status=paid
```

A click sets `status` to `'paid'` and keeps `page: 3` and `search: 'acme'`. A new tab opens `/customers?status=paid` with `status: 'paid'`, `page: 1` and an empty search. To clear a filter on a click, pass its initial value: `useStore.href('/customers', { status: 'all' })` gives `/customers?status=all`. A click sets `status` back to `'all'`, and the store rewrites the address bar to `/customers?page=:3&search=acme`, leaving out `status` at its initial value. A passed initial value is written only when the current value differs: while `status` is `'all'`, the same call gives `/customers`.

`href` uses [`select`](#select) for the target pathname. If `search` is enabled only on `/search`, a link to `/customers` leaves it out.

On the server, create the store for each request with its [`url`](#url). The values the request URL sets are current values, as in a store created on that URL in the browser:

```ts
// request.url: /customers?status=active
const useStore = create<{ status: string; page: number }>()(
  querystring(() => ({ status: 'all', page: 1 }), { url: request.url }),
);
useStore.href('/customers', { page: 2 }); // /customers?page=:2
useStore.href('/customers', { status: 'all' }); // /customers?status=all
```

### Links with a packing map

A `map` that packs `status` and `page` into one param `q` makes the link write the whole param when it changes, so it carries the current `page` you didn't pass. A param the link doesn't change, like `search`, stays out:

```ts
const useStore = create<{ status: string; page: number; search: string }>()(
  querystring(() => ({ status: 'all', page: 1, search: '' }), {
    map: {
      to: state => ({
        q: `${state.status}-${state.page}`,
        search: state.search,
      }),
      from: ({ q, ...rest }) => {
        if (typeof q !== 'string') return rest;
        const [status, page] = q.split('-');
        return { ...rest, status, page: Number(page) };
      },
    },
  }),
);

// Current: { status: 'active', page: 3, search: 'acme' }
useStore.href('/customers', { status: 'paid' });
// href: /customers?q=paid-3
```

A click sets `status` to `'paid'` and `page` to 3, and keeps `search: 'acme'`. A new tab opens with `status: 'paid'`, `page: 3` and an empty search.

A `map` whose `to` returns class instances (your own classes, a subclass of `Date` or `Array` too) makes `href` slower. The store can't compare those instances as data, so it can rewrite the query to compare a param that holds one, and it does the same for an instance whose fields match the initial one when it writes the address bar. In a benchmark, 50 links over 12 such params took about 14 ms, against under 1 ms for the same values kept in the store without a `map`. Return plain objects and strings from `to` to keep links fast.

To find the params a reader needs, `href` tries current params alone, first those whose value differs from the initial state, then, unless the reader rejects the link with only the values you passed, the others. It tries params alone only in a group of up to 8; when no param alone is enough, or the group is larger, it narrows the group down to fewer. A link whose reader needs several params, or rejects more than 8 changed params together, can carry params it doesn't need, or none. While it checks a link, `href` counts a class instance that `from` sets in a field `to` doesn't write as unchanged, so it misses a reader that resets that instance.

### Reading a link

Anyone can edit a link before they share it, and the store reads its values without checking their types: a new tab on `/customers?page=abc` sets `page` to the string `'abc'`. Check a field like `page` before your app uses it as a number. `href` writes `pathname` as given, so build it from your own routes, never from user input: `useStore.href('//example.com')` returns `//example.com`, a link to another site.

---

## Formats

Three built-in formats:

| Format   | Example Output               |
| -------- | ---------------------------- |
| `marked` | `count:5,tags@a,b~`          |
| `plain`  | `count=5&tags=a&tags=b`      |
| `json`   | `count=5&tags=%5B%22a%22%5D` |

```ts
import { marked } from 'zustand-querystring/format/marked';
import { plain } from 'zustand-querystring/format/plain';
import { json } from 'zustand-querystring/format/json';

querystring(store, { format: plain });
```

### Marked Format (default)

Type markers: `:` primitive, `=` string, `@` array, `.` object

Delimiters: `,` separator, `~` terminator, `_` escape

```ts
import { createFormat } from 'zustand-querystring/format/marked';

const format = createFormat({
  typeObject: '.',
  typeArray: '@',
  typeString: '=',
  typePrimitive: ':',
  separator: ',',
  terminator: '~',
  escapeChar: '_',
  datePrefix: 'D',
});
```

### Plain Format

Dot notation for nesting, repeated keys for arrays.

```ts
import { createFormat } from 'zustand-querystring/format/plain';

const format = createFormat({
  entrySeparator: ',', // between entries in namespaced mode
  nestingSeparator: '.', // for nested keys
  arraySeparator: 'repeat', // 'repeat' for ?tags=a&tags=b, or ',' for ?tags=a,b
  escapeChar: '_',
  nullString: 'null',
  undefinedString: 'undefined',
  infinityString: 'Infinity', // string representation of Infinity
  negativeInfinityString: '-Infinity',
  nanString: 'NaN',
});
```

> **Note on `arraySeparator: ','`**: With comma-separated arrays and dynamic keys (e.g., `initialState: { filters: {} }`), a single array value like `os=CentOS` is indistinguishable from a scalar string. Use `'repeat'` for dynamic keys, or normalize with `Array.isArray(val) ? val : [val]`.

### JSON Format

URL-encoded JSON. No configuration.

---

## Custom Format

Implement `QueryStringFormat`:

```ts
import type {
  QueryStringFormat,
  QueryStringParams,
  ParseContext,
} from 'zustand-querystring';

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
      try {
        result[key] = JSON.parse(decodeURIComponent(values[0]));
      } catch {
        // Skip values that cannot be decoded or parsed as JSON, such as utm_content=50%off.
      }
    }
    return result;
  },
};

querystring(store, { format: myFormat });
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
    set => ({
      query: '',
      page: 1,
      setQuery: query => set({ query, page: 1 }), // reset page on new query
      setPage: page => set({ page }),
    }),
    { select: () => ({ query: true, page: true }) },
  ),
);
```

### Multiple stores with prefixes

```ts
const useFilters = create(
  querystring(filtersStore, {
    prefix: 'f_',
    select: () => ({ category: true, price: true }),
  }),
);

const usePagination = create(
  querystring(paginationStore, {
    prefix: 'p_',
    select: () => ({ page: true, limit: true }),
  }),
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
  QueryStringMap,
  QueryStringFormat,
  QueryStringParams,
  ParseContext,
} from 'zustand-querystring';
```

---

[Playground](https://zustand-querystring.nitedani.workers.dev) · [GitHub](https://github.com/nitedani/zustand-querystring)
