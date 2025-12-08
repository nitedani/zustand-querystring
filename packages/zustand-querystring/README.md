# zustand-querystring

A Zustand middleware that syncs store state with the URL query string.

## Installation

```bash
npm install zustand-querystring
# or
pnpm add zustand-querystring
# or
yarn add zustand-querystring
```

## Quick Start

```ts
import { create } from 'zustand';
import { querystring } from 'zustand-querystring';

interface Store {
  search: string;
  page: number;
  filters: {
    category: string;
    minPrice: number;
  };
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
}

const useStore = create<Store>()(
  querystring(
    (set) => ({
      search: '',
      page: 1,
      filters: {
        category: 'all',
        minPrice: 0,
      },
      setSearch: (search) => set({ search }),
      setPage: (page) => set({ page }),
    }),
    {
      // Select which parts of state to sync
      select: () => ({
        search: true,
        page: true,
        filters: true,
      }),
    }
  )
);
```

## Options

### `select`

Controls which parts of state are synced to the URL. Can be a function that receives the current pathname.

```ts
select: (pathname) => ({
  search: true,
  page: true,
  // Only sync filters on the /products page
  filters: pathname === '/products',
})
```

### `key`

Controls how state is stored in the URL (default: `'state'`).

- **Namespaced mode** (`key: 'state'`): All state in one parameter
  - URL: `?state=search%3Dhello%2Cpage%3A2`
- **Standalone mode** (`key: false`): Each field is a separate parameter
  - URL: `?search=hello&page=2`

```ts
// Standalone mode - cleaner URLs
querystring(storeCreator, {
  key: false,
  select: () => ({ search: true, page: true }),
})
```

### `prefix`

Add a prefix to all query parameters (useful when multiple stores share the URL).

```ts
querystring(storeCreator, {
  key: false,
  prefix: 'app_',
  select: () => ({ search: true }),
})
// URL: ?app_search=hello
```

### `format`

Choose the serialization format. Two built-in formats are available:

#### Compact Format (default)

Optimized for URL length with type markers:

```ts
import { compact } from 'zustand-querystring';
// or
import { createFormat } from 'zustand-querystring/format/compact';

// Default: compact format
querystring(storeCreator, { format: compact })

// Custom options:
const format = createFormat({
  typeObject: '.',      // Marker for objects (default: '.')
  typeArray: '@',       // Marker for arrays (default: '@')
  typeString: '=',      // Marker for strings (default: '=')
  typePrimitive: ':',   // Marker for numbers/booleans/null (default: ':')
  separator: ',',       // Entry separator (default: ',')
  terminator: '~',      // Structure terminator (default: '~')
  escapeChar: '/',      // Escape character (default: '/')
  datePrefix: 'D',      // Date value prefix (default: 'D')
});
```

Example output: `search=hello,filters.category=books,page:2`

#### Plain Format

Human-readable with dot notation:

```ts
import { plain } from 'zustand-querystring';
// or
import { createFormat } from 'zustand-querystring/format/plain';

querystring(storeCreator, { format: plain })

// Custom options:
const format = createFormat({
  entrySeparator: ',',       // Between key=value pairs (default: ',')
  nestingSeparator: '.',     // For nested keys (default: '.')
  escapeChar: '/',           // Escape character (default: '/')
  nullString: 'null',        // Representation of null (default: 'null')
  undefinedString: 'undefined', // Representation of undefined (default: 'undefined')
  emptyArrayMarker: '__empty__', // Marker for empty arrays (default: '__empty__')
});
```

Example output: `search=hello,filters.category=books,page=2`

### `syncNull` / `syncUndefined`

By default, `null` and `undefined` values are not synced to the URL. Enable these to preserve them:

```ts
querystring(storeCreator, {
  syncNull: true,      // Sync null values (default: false)
  syncUndefined: true, // Sync undefined values (default: false)
})
```

### `url`

Provide the request URL for server-side rendering:

```ts
querystring(storeCreator, {
  url: request.url,
})
```

## How It Works

### State Diffing

Only values that **differ from the initial state** are synced to the URL. This keeps URLs minimal.

### Type Handling

- **Plain objects** (`{}`) - Recursively compared; only changed properties are synced
- **Arrays, Dates** - Compared as atomic values; any change syncs the entire value
- **Functions** - Never synced to the URL

### URL Encoding

All keys and values are properly URI-encoded for URL safety. The default format tokens (`. @ = : , ~ /`) are URL-safe and don't require encoding.

## Examples

### Basic Search Page

```ts
const useSearchStore = create(
  querystring(
    (set) => ({
      query: '',
      page: 1,
      sort: 'relevance',
      setQuery: (query) => set({ query, page: 1 }),
      setPage: (page) => set({ page }),
      setSort: (sort) => set({ sort }),
    }),
    {
      key: false, // Standalone mode for clean URLs
      select: () => ({
        query: true,
        page: true,
        sort: true,
      }),
    }
  )
);
// URL: ?query=shoes&page=2&sort=price
```

### Multiple Stores

```ts
const useFiltersStore = create(
  querystring(storeCreator, {
    key: false,
    prefix: 'f_',
    select: () => ({ category: true, priceRange: true }),
  })
);

const usePaginationStore = create(
  querystring(storeCreator, {
    key: false,
    prefix: 'p_',
    select: () => ({ page: true, limit: true }),
  })
);
// URL: ?f_category=shoes&f_priceRange=0-100&p_page=2&p_limit=20
```

### Conditional Syncing

```ts
querystring(storeCreator, {
  select: (pathname) => ({
    // Always sync search
    search: true,
    // Only sync filters on product pages
    filters: pathname?.startsWith('/products'),
    // Only sync admin settings on admin pages
    adminSettings: pathname?.startsWith('/admin'),
  }),
})
```

## Links

- [Live Playground](https://stackblitz.com/github/nitedani/zustand-querystring/tree/main/examples/react)
- [React Example](../../examples/react/)
- [Next.js Example](../../examples/next/)

## License

MIT
