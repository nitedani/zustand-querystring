import { useRequestContext, useSSQ } from "rakkasjs";
import { createContext, useContext, useMemo } from "react";
import { create } from "zustand";
import { querystring } from "zustand-querystring";
import { immer } from "zustand/middleware/immer";

export type Configuration = {
  someApiUrl: string;
  language: string;
};

interface Store {
  configuration: Configuration;
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

const zustandContext = createContext<ReturnType<typeof createStore> | null>(
  null
);

export interface CreateStoreOptions {
  defaultState: Partial<Store> & { configuration: Configuration };
  url?: string;
}

export const createStore = (options: CreateStoreOptions) =>
  create<Store>()(
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
        ...options.defaultState,
      })),
      {
        url: options.url,
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

export function useStore<R = Store>(
  selector: (state: Store) => R = (state) => state as any,
  equalityFn?: (left: R, right: R) => boolean
) {
  return useContext(zustandContext)!(selector, equalityFn);
}

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: configuration } = useSSQ((ctx) => ({
    someApiUrl: process.env.SOME_PUBLIC_API_URL || "",
    language: "en", // or detect from ctx.request.headers
  }));

  const ctx = useRequestContext();
  const store = useMemo(
    () =>
      createStore({
        url: ctx?.request.url,
        defaultState: { configuration },
      }),
    []
  );

  return (
    <zustandContext.Provider value={store}>{children}</zustandContext.Provider>
  );
};
