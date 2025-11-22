# zustand-querystring

A Zustand middleware that syncs the store with the querystring.

Try on [StackBlitz](https://stackblitz.com/github/nitedani/zustand-querystring/tree/main/examples/react) (You need to click "Open in New Tab")

Examples:

- [React](./examples/react/)
- [NextJS](./examples/next/)

Quickstart:

```ts
import create from 'zustand';
import { querystring } from 'zustand-querystring';

interface Store {
  count: number;
  ticks: number;
  someNestedState: {
    nestedCount: number;
    hello: string;
  };
}

export const useStore = create<Store>()(
  querystring(
    (set, get) => ({
      count: 0,
      ticks: 0,
      someNestedState: {
        nestedCount: 0,
        hello: 'Hello',
      },
    }),
    {
      // select controls what part of the state is synced with the query string
      // pathname is the current route (e.g. /about or /)
      select(pathname) {
        return {
          count: true,
          // ticks: false, <- false by default

          someNestedState: {
            nestedCount: true,
            hello: '/about' === pathname,
          },

          // OR select the whole nested state
          // someNestedState: true
        };
      },
    },
  ),
);
```

querystring options:

- <b>select</b> - the select option controls what part of the state is synced with the query string
- <b>key: string | false</b> - the key option controls how the state is stored in the querystring (default: 'state'). Set to `false` for standalone mode where each state key becomes a separate query parameter.
- <b>url</b> - the url option is used to provide the request url on the server side render
- <b>format</b> - custom format for stringify/parse (default: JSON-based format). Use `readable` from `zustand-querystring/format/readable` for human-readable URLs.
- <b>syncNull: boolean</b> - when true, null values that differ from initial state are synced to URL (default: false)
- <b>syncUndefined: boolean</b> - when true, undefined values that differ from initial state are synced to URL (default: false)

## Important Notes

### State Diffing

Only values that differ from the initial state are synced to the URL.

### Null and Undefined Handling

By default (`syncNull: false`, `syncUndefined: false`), `null` and `undefined` values are **not** synced to the URL. This means setting a value to `null` or `undefined` effectively "clears" it back to the initial state on page refresh.

If you want to preserve `null` or `undefined` values in the URL (so they persist across refreshes), set `syncNull: true` or `syncUndefined: true` in options.

### State Types

- **Plain objects** (created with `{}`) are recursively compared with initial state - only changed properties are synced
- **Arrays, Dates, RegExp, Maps, Sets, and class instances** are compared as atomic values - if any part changes, the entire value is synced
- **Functions** are never synced to the URL
