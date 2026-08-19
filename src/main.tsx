import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { useDocument } from "./store/document";
import "./index.css";

function Root() {
  const hydrateFromCache = useDocument((state) => state.hydrateFromCache);
  const ready = useDocument((state) => state.ready);

  useEffect(() => {
    void hydrateFromCache();
  }, [hydrateFromCache]);

  if (!ready) {
    return <p style={{ padding: 24 }}>Opening local cache…</p>;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
