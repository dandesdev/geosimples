import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { InputGuide } from "./InputGuide";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InputGuide />
  </StrictMode>,
);
