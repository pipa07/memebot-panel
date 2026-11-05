# Brief para Claude — panel memebot según diseño PDF

## Objetivo
Rehacer / pulir el panel para que **se vea como el PDF de diseño adjunto** (`panel-diseno.pdf` / captura `panel-diseno-1.png`). Es simulación paper. Deploy a Vercel `memebot-black` lo hace Mateo después; vos dejá código + PR.

**Referencia visual obligatoria:** el PDF/PNG del diseño. Si hay duda entre el código actual y el PDF, gana el PDF.

## Repo
- Carpeta `dashboard/`: `index.html`, `app.js`, `styles.css`, `config.example.js`, `vercel.json`
- **Nunca** commitear `config.js` real (secrets). Solo `config.example.js`.
- Mantener `pytest tests/` en verde si existe.

## Layout del diseño (sidebar izquierda + main)

### Sidebar — BOT · PAPER
Tabs/nav con PnL al lado:
1. **Principal** — PnL neto de la cartera paper
2. **Lotería** — PnL lotería
3. **Acciones ASL** — PnL ASL

### Sidebar — REAL · MANUAL (falta hoy; hay que agregarla)
Bloque debajo de ASL, tipografía distinta (manual/real):
- Título kicker: `REAL · MANUAL`
- **Cartera Cocos** con saldo tipo `+$ 291.922` (formato AR: puntos de miles)
- Si el `stats.json` trae `cocos` / `real` / saldo Cocos → mostrar número vivo
- Si **no** trae dato: igual mostrar la sección (como en el diseño) con estado vacío corto, p.ej. `sin saldo en este envío` — **no borrar la sección**

### Sidebar — status
- Badge `BOT · PAPER`
- `Bot andando` / estado
- `Último escaneo … ART`
- `Alertas por Telegram` (solo si hay info; si no, oculto o “no informado”)
- Botón `Salir`

### Main — tab Principal (como el PDF)
Header: `CARTERA · PAPER · vX.XX` + PnL grande USD  
Fila: Bruto sin costos | Costos Solana | Por entrada | Tope abiertas  
`▸ Reglas y versiones` colapsable  
Cards Hoy / Aciertos / Cierres / Abiertas  
Fila de estrategias (p20, tp12, s300…) con neto, hoy, cierres, aciertos, abiertas  
Gráfico **PnL por hora** (solo cartera; lab no entra)  
Posiciones abiertas `n / tope` + vacío amable  
Últimos cierres (tabla)  
**LABORATORIO** abajo: labs ordenados por resultado paper; Pausada = no abre trades nuevos

### Otras tabs
- **Lotería:** no romper renderer; alinear tipografía/sidebar
- **Acciones ASL:** Confluencia arriba (principal ★), labs debajo; semáforo visible; E1 lab sin Telegram

## Prioridades (en orden)
1. Sidebar con **REAL · MANUAL / Cartera Cocos** como el PDF (hoy falta).
2. Densidad y tipografía del Principal = PDF (números grandes, cards Hoy/Aciertos…).
3. Mobile ~390px: sidebar colapsa o tabs scrolleables; sin scroll horizontal de página.
4. Estados vacíos en español rioplatense.
5. No inventar Cocos/Telegram **números** si el JSON no los trae; sí inventar/mostrar el **bloque UI** vacío.

## Qué NO hacer
- No cambiar schema de `stats.json` salvo campos opcionales ya contemplados (`cocos`, `real`, `telegram`/`notify.telegram`).
- No meter `config.js` al repo ni service role keys.
- No tocar bots de trading / AWS / Telegram envío.
- No gastar Cursor cloud agents; laburá en este repo con Claude.

## Verificación
- Desktop igual al PDF (sidebar + Principal).
- 390px usable.
- Cocos visible aunque el snapshot no traiga saldo.
- `pytest tests/` verde.
- Screenshots desktop + mobile en el PR.

## Entrega
Rama `claude/panel-diseno-cocos`, commits chicos, PR con resumen + screenshots.
