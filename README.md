# memebot-panel

Panel de simulación (paper) de memebot + ASL.

- **Live:** https://memebot-black.vercel.app/
- Código UI en `dashboard/` (HTML/CSS/JS estático).
- **No** commitear `dashboard/config.js` (copiá desde `config.example.js`, o reutilizá el `config.js` público que ya sirve el deploy). No uses la service role.
- **Deploy:** el sitio estático es la carpeta `dashboard/`. En Vercel (proyecto `memebot`, team `carvi1v`) el Root Directory tiene que ser `dashboard`. El deploy anterior se subió con la CLI desde esa carpeta, plana; si el root queda en la raíz del repo, Vercel no publica `index.html`.
- Tests: `node --test tests/ops.test.mjs`
- Brief para Claude: [`BRIEF-PANEL-CLAUDE.md`](./BRIEF-PANEL-CLAUDE.md)

Canónico también en Cursor Origin `mateo-cespedes/memebot` (privado). Este repo público es espejo del panel para editar afuera de Cursor.
