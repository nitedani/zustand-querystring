import { CommonHooks } from "rakkasjs";
import { StoreProvider } from "./store";

const hooks: CommonHooks = {
  wrapApp(app) {
    return <StoreProvider>{app}</StoreProvider>;
  },
};

export default hooks;
