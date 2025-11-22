import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { querystring } from "zustand-querystring";
import { readable } from "zustand-querystring/format/readable";

interface Store {
  count: number;
  incrementCount: () => void;
  decrementCount: () => void;

  ticks: number;
  incrementTicks: () => void;

  someNestedState: {
    nestedCount: number;
    incrementNestedCount: () => void;

    hello: string;
    setHello: (hello: string) => void;
  };
}

export const useStore = create<Store>()(
  querystring(
    immer((set, get) => ({
      count: 0,
      incrementCount: () =>
        set((state) => {
          state.count += 1;
        }),
      decrementCount: () =>
        set((state) => {
          state.count -= 1;
        }),

      ticks: 0,
      incrementTicks: () =>
        set((state) => {
          state.ticks += 1;
        }),

      someNestedState: {
        nestedCount: 0,
        incrementNestedCount: () =>
          set((state) => {
            state.someNestedState.nestedCount += 1;
          }),

        hello: "Hello",
        setHello: (hello: string) =>
          set((state) => {
            state.someNestedState.hello = hello;
          }),
      },
    })),
    {
      format: readable,
      key: false,
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
