# Rojo: normas del proyecto

- **Versión:** en cada push que suba cambios, actualiza `version` en `package.json` (con `npm version X.Y.Z --no-git-tag-version`, para que se actualice también `package-lock.json`). La versión se muestra en la pantalla de inicio. Sube el último número para arreglos y el del medio para funcionalidades nuevas.
- Antes de subir: `npm run typecheck`, `npm test` y `npm run build`.
- El despliegue lo hace `.github/workflows/deploy.yml` publicando `dist/` en la rama `gh-pages` (GitHub Pages: *Deploy from a branch*, `gh-pages` / root).
- La UI está en español. No dejes servidores ni procesos corriendo al terminar.
