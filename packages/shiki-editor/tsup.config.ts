import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/styles.css"],
  external: ["react", "react-dom", "shiki", "@vimee/core", "@vimee/react"],
});
