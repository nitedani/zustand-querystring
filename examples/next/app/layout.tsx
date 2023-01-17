import { StoreProvider } from "@/src/store";

export default function RootLayout({ children }: { children: any }) {
  return (
    <html>
      <StoreProvider>
        <body>{children}</body>
      </StoreProvider>
    </html>
  );
}
