"use client";
import { useStore } from "../src/store";
import Link from "next/link";

export default function Home() {
  const {
    configuration,
    count,
    incrementCount,
    decrementCount,
    ticks,
    incrementTicks,
    someNestedState: { nestedCount, incrementNestedCount, hello, setHello },
  } = useStore();

  console.log(configuration);

  return (
    <div>
      <Link href="/about">Go to about page</Link>
      <div>Home page</div>
      <div>
        count is persisted in the query string, because we set it to true in
        store.ts
      </div>
      <div>Count: {count}</div>
      <button onClick={incrementCount}>Increment count</button>
      <button onClick={decrementCount}>Decrement count</button>

      <div>
        ticks is NOT persisted in the query string, because we haven't set it to
        true in store.ts
      </div>
      <div>Ticks: {ticks}</div>
      <button onClick={incrementTicks}>Increment ticks</button>

      <div>
        hello is NOT persisted in the query string on this(/) page, as we set it
        in store.ts
      </div>
      <div>hello: {hello}</div>
      <button onClick={() => setHello("World!")}>Set Hello to World</button>

      <div>
        nestedCount is persisted in the query string, because we set it to true
        in store.ts
      </div>
      <div>nestedCount: {nestedCount}</div>
      <button onClick={incrementNestedCount}>Increment nestedCount</button>
    </div>
  );
}
