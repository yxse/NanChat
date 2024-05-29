import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";

const Options = () => {
  window.close();

  return null;
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
