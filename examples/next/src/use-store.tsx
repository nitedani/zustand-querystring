"use client";
import {createContext, ReactNode, useContext, useState} from "react";
import {useStore as useZustandStore} from "zustand";
import {usePathname, useSearchParams} from "next/navigation";
import {createStore, Store} from "@/src/store";

type StoreType = ReturnType<typeof createStore>;
const zustandContext = createContext<StoreType | null>(null);

export const useStore = <T = Store, >(selector?: (state: Store) => T) => {
  selector ??= (state) => state as T;
  const store = useContext(zustandContext);
  if (!store) throw new Error("Store is missing the provider");
  return useZustandStore(store, selector);
};

export const StoreProvider = ({children}: { children: ReactNode }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams}`;

  const [store] = useState(() =>
    createStore({
      url,
    })
  );

  return (
    <zustandContext.Provider value={store}>{children}</zustandContext.Provider>
  );
};
