import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { SafetyProvider } from "./context/SafetyContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SafetyProvider>
        <App />
      </SafetyProvider>
    </BrowserRouter>
  </React.StrictMode>
);
