import js from "@eslint/js";
import tseslint from "typescript-eslint";

// packages/shared e apps/server (o eslint acha este subindo da pasta do arquivo); apps/web tem o seu.
// As deps ficam na raiz porque o typescript-eslint precisa do TS 5: o apps/server roda no TS 7.
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  files: ["**/*.ts"],
  rules: {
    // Sem `as`: type guard ou tipo de verdade. Aviso, como no apps/web.
    "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
  },
});
