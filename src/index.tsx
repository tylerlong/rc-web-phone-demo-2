import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./components/app";
import store from "./store";
import init from "./store/init";

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);
root.render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);

init();
