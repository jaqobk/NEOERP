# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## NEO ERP — production checklist

### Cloudflare
- Set secrets: `SUPER_ADMIN_NAME`, `SUPER_ADMIN_PIN` (strong PIN).
- Bind D1 database in `wrangler.toml`.
- Deploy Pages + Functions together; run migrations via first API hit (`ensureAuthTables`).

### Backups
- Use **Settings → Backup & Restore** (tenant cloud backup + local JSON).
- Schedule weekly exports; store off-platform.

### Multi-location
- Plan limits: Starter 1 / Business 3 / Premium up to 20 locations.
- Roles: set **Allowed locations** list; empty = all locations.
- Transfer stock: **Inventory → Transfer between locations**.

### Support
- Platform console: suspend/activate shops, record payments, Open as shop (2h).
- Offline POS sales queue auto-retries when the browser is online again.

### Compliance notes
- eTIMS / KRA fields are local settings only until a certified device/API is connected.
- Loyalty points are shop-configured; not a payments network.

