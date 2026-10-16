import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Config mínima: só resolve o alias "@/" (já usado pelo app) para os testes
// de funções puras em src/lib. Não roda em jsdom nem depende do vite.config.ts
// da aplicação (que injeta plugins específicos do TanStack Start/Cloudflare).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
