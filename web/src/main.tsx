import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./ds/global.css";
import { App } from "./App";
import { guardFileDrops } from "./lib/fileDrops";
import { applyTheme } from "./lib/theme";
import { prefs } from "./lib/prefs";

applyTheme(prefs.theme());
guardFileDrops();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
