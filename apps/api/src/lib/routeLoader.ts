import type { Express, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
/**
 * Dynamically loads route modules from a directory.
 * Each module should export a default Express Router.
 * The route is mounted at "/<filename>"; a file named "root" mounts at "/".
 */
export async function loadRoutes(app: Express, routesDir: string): Promise<void> {
  if (!fs.existsSync(routesDir)) return;

  const requireFn = createRequire(__filename);

  const entries = fs
    .readdirSync(routesDir, { withFileTypes: true })
    .filter((e) => e.isFile());

  const exts = new Set([".js", ".mjs", ".cjs", ".ts"]);

  for (const entry of entries) {
    const ext = path.extname(entry.name);
    if (!exts.has(ext)) continue;
    const base = path.basename(entry.name, ext);
    if (base === 'index' || base.startsWith('_')) continue;

    const fullPath = path.join(routesDir, entry.name);
    const mod: any = requireFn(fullPath);
    const router: Router | undefined = mod.default;
    if (!router) continue;

    const mountPath = base === 'root' ? '/' : `/${base}`;
    app.use(mountPath, router);
  }
}

