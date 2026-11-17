import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const result = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["src/client.jsx"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["react", "@deepseek-ai/dsh-client-ui-primitives"],
  loader: { ".css": "text" },
  write: false,
});
await mkdir(new URL("lib/", root), { recursive: true });
await writeFile(new URL("lib/client.js", root),
  `window.__ModuleLoader__.load({id:"dsh-plugin-wordcloud",factory(require){
const module = {exports:{}};
${result.outputFiles[0].text}
return module.exports;
}});\n`);
