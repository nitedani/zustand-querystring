import { CommonHooks, useRequestContext, useSSQ } from "rakkasjs";
import { getConfiguration, StoreProvider, useCreateStore } from "./store";

const MyStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: configuration } = useSSQ(getConfiguration);
  const createStore = useCreateStore({
    configuration,
    url: useRequestContext()?.request.url,
  });
  return <StoreProvider createStore={createStore}>{children}</StoreProvider>;
};

const hooks: CommonHooks = {
  wrapApp(app) {
    return <MyStoreProvider>{app}</MyStoreProvider>;
  },
};

export default hooks;
