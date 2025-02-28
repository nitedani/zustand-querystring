import { createStore } from "@/src/store";
import Link from "next/link";

export default async function RSC({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const store = createStore({
    //@ts-ignore
    url: `?${new URLSearchParams(await searchParams).toString()}`,
  });

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

      <div>
        nestedCount is persisted in the query string, because we set it to true
        in store.ts
      </div>
      <div>nestedCount: {storeState.someNestedState.nestedCount}</div>
    </div>
  );
}
