import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import assert from "node:assert/strict";
globalThis.window = {};
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", ssr: { noExternal: ["@anchor-lang/core"] } });
try {
  const { App } = await server.ssrLoadModule("/web/App.tsx");
  const html = renderToString(createElement(App));
  for (const text of ["Your next adventure, covered.", "1,000.00", "Pay merchant", "Emergency lock", "INTERACTIVE DEMO"]) assert.ok(html.includes(text), "Missing: " + text);
  console.log("PASS: dashboard renders with trip balance, navigation, actions, and demo disclosure.");
} finally { await server.close(); }
