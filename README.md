# zustand-querystring

A zustand middleware that stores state in the querystring.

Quickstart:
```ts
import create from "zustand";
import { queryString } from "zustand-querystring";

interface Store {
  count: number;
  incrementCount: () => void;

  ticks: number;
  incrementTicks: () => void;

  someNestedState: {
    nestedCount: number;
    incrementNestedCount: () => void;

    hello: string;
    setHello: (hello: string) => void;
  };
}

export const useStore = create<Store>(
  queryString(
    (set, get) => ({
      count: 0,
      incrementCount: () => set((state) => ({ count: state.count + 1 })),

      ticks: 0,
      incrementTicks: () => set((state) => ({ ticks: state.ticks + 1 })),

      someNestedState: {
        nestedCount: 0,
        incrementNestedCount: () =>
          set((state) => ({
            someNestedState: {
              // OR use the immer middleware instead of spreading
              ...state.someNestedState,
              nestedCount: state.someNestedState.nestedCount + 1,
            },
          })),

        hello: "Hello",
        setHello: (hello: string) =>
          set((state) => ({
            someNestedState: {
              // OR use the immer middleware instead of spreading
              ...state.someNestedState,
              hello,
            },
          })),
      },
    }),
    {
      // select controls what part of the state is synced with the query string
      // pathname is the current route (e.g. /about or /)
      select(pathname) {
        return {
          count: true,
          // ticks: false, <- false by default, because we specified the parent key

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