"use client";
import { getConfiguration, StoreProvider, useCreateStore } from "@/src/store";
import { usePathname, useSearchParams } from "next/navigation";

export default function RootLayout({ children }: { children: any }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams}`;

  const configuration = getConfiguration();
  const createStore = useCreateStore({
    url: decodeURIComponent(url),
    configuration,
  });

  return (
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__StoreInit = ${JSON.stringify(configuration)}`,
          }}
        ></script>
      </head>
      <StoreProvider createStore={createStore}>
        <body>{children}</body>
      </StoreProvider>
    </html>
  );
}
