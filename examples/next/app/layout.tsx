import { StoreProvider } from "@/src/store";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
