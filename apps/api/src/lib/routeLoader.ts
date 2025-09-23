import type { Express, Router } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Dynamically loads route modules from a directory.
 * Each module should export a default Express Router.
 * The route is mounted at "/<filename>"; a file named "root" mounts at "/".
 */
export async function loadRoutes(app: Express, routesDir: string): Promise<void> {
  if (!fs.existsSync(routesDir)) return;

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
    const mod: any = await import(pathToFileUrl(fullPath));
    const router: Router | undefined = mod.default;
    if (!router) continue;

    const mountPath = base === 'root' ? '/' : `/${base}`;
    app.use(mountPath, router);
  }
}

function pathToFileUrl(p: string): string {
  const resolved = path.resolve(p);
  const url = new URL('file://');
  // Ensure Windows paths are converted properly (e.g., C:\ -> /C:/)
  url.pathname = resolved.replace(/\\/g, '/');
  return url.toString();
}





