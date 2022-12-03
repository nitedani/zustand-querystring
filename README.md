# zustand-querystring

A zustand middleware that stores state in the querystring.

Try on [StackBlitz](https://stackblitz.com/github/nitedani/zustand-querystring/tree/main/examples/react) (You need to click "Open in New Tab")

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
    }
  )
);
```