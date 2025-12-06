import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./pages/home";
import { About } from "./pages/about";
import { Standalone } from "./pages/standalone";
import { ConfigurableTestPage } from "./pages/configurable-test";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/about", element: <About /> },
  { path: "/standalone", element: <Standalone /> },
  { path: "/configurable-test", element: <ConfigurableTestPage /> },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
