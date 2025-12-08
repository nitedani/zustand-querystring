import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Playground } from "./pages/Playground";
import { Formats } from "./pages/Formats";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "system-ui, -apple-system, sans-serif",
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "playground", element: <Playground /> },
      { path: "formats", element: <Formats /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>
);
