import React from "react";
import { createRoot } from "react-dom/client";
import Workspace from "./workspace/Workspace.jsx";
import "./workspace/workspace.css";
import "./workspace/polish.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Workspace />
  </React.StrictMode>,
);
