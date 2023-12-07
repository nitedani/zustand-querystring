
import {createStore} from "@/src/store";
import Link from "next/link";
import { headers } from "next/headers";

export default function RSC({ searchParams }: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const head = headers();
  const pathname = head.get('next-url');

  // @ts-ignore
  const store = createStore({ url: `?${new URLSearchParams(searchParams).toString()}` });

  const storeState = store.getState();

  // Output to server logs
  console.log(JSON.stringify(storeState));

  return (
    <div>
      <Link href="/">Go to home page</Link>
      <div>About page</div>
      <div>
        count is persisted in the query string, because we set it to true in
        store.ts
      </div>
      <div>Count: {storeState.count}</div>

      <div>
        ticks is NOT persisted in the query string, because we haven't set it to
        true in store.ts
      </div>
      <div>Ticks: {storeState.ticks}</div>

      {/*<div>*/}
      {/*  hello is persisted in the query string only on this(/about) page, as we*/}
      {/*  set it in store.ts*/}
      {/*</div>*/}
      {/*<div>hello: {storeState.hello}</div>*/}

      <div>
        nestedCount is persisted in the query string, because we set it to true
        in store.ts
      </div>
      <div>nestedCount: {storeState.someNestedState.nestedCount}</div>
    </div>
  );
}
