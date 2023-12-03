# zustand-querystring

A Zustand middleware that syncs the store with the querystring.

Try on [StackBlitz](https://stackblitz.com/github/nitedani/zustand-querystring/tree/main/examples/react) (You need to click "Open in New Tab")

Examples:

- [React](./examples/react/)
- [NextJS](./examples/next/)
- [Rakkas](./examples/rakkas/)

Quickstart:

```ts
import create from "zustand";
import { querystring } from "zustand-querystring";

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
        hello: "Hello",
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
            hello: "/about" === pathname,
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
- <b>key: string</b> - the key option controls how the state is stored in the querystring (default: $)
- <b>url</b> - the url option is used to provide the request url on the server side render
