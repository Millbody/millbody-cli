import { register } from "node:module";

register("./exitPromptHooks.js", import.meta.url);

Object.defineProperty(process.stdin, "isTTY", {
  value: true,
  configurable: true,
});
