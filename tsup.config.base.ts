import type { Options } from "tsup";

export const baseConfig: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
};
