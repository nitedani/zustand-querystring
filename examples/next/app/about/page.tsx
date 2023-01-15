"use client";
import { useStore } from "../../src/store";
import Link from "next/link";

export default function About() {
  const {
    count,
    incrementCount,
    decrementCount,
    ticks,
    incrementTicks,
    someNestedState: { nestedCount, incrementNestedCount, hello, setHello },
  } = useStore();

  return (
    <div>
      <Link href="/">Go to home page</Link>
      <div>About page</div>
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
        hello is persisted in the query string only on this(/about) page, as we
        set it in store.ts
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
