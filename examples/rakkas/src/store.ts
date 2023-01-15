import { StoreApi, create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { querystring } from "zustand-querystring";
import createContext from "zustand/context";
import { RequestContext } from "rakkasjs";

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

const zustandContext = createContext<StoreApi<Store>>();
export const StoreProvider = zustandContext.Provider;
export const useStore = zustandContext.useStore;

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

export const getConfiguration = (ctx: RequestContext) => {
  return {
    someApiUrl: process.env.SOME_PUBLIC_API_URL || "",
    language: "en",
  };
};

let store: ReturnType<typeof createStore> | undefined = undefined;
export const useCreateStore = ({
  url,
  configuration,
}: {
  url?: string;
  configuration: Configuration;
}) => {
  if (typeof window === "undefined") {
    return () => createStore({ url, defaultState: { configuration } });
  }
  store ??= createStore({ url, defaultState: { configuration } });
  return () => store!;
};
