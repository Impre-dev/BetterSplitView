# BetterSplitView

> Sine-Mod pour Zen Browser — améliore le split view avec un bouton flottant (swap + close) et des bookmarks splittés.

## Installation

### Via Sine UI

Dans Zen → Sine → **Add** → taper `Impre-dev/BetterSplitView`

### Via console (Ctrl+Shift+J)

```js
const mod = ChromeUtils.importESModule('chrome://userscripts/content/core/manager.sys.mjs');
mod.default.installMod('Impre-dev/BetterSplitView', null, true)
  .then(() => console.log('INSTALL OK'))
  .catch(e => console.error('INSTALL FAILED:', e.message))
```

## Mise à jour

```bash
git add -A
git commit -m "Description du changement"
git push origin main
```

Puis dans la console Zen :

```js
const mod = ChromeUtils.importESModule('chrome://userscripts/content/core/manager.sys.mjs');
mod.default.installMod('Impre-dev/BetterSplitView', null, true)
  .then(() => console.log('UPDATE OK'))
```

## Structure

```
BetterSplitView/
├── theme.json              # 3 scripts + style.chrome
├── chrome.css              # CSS: floating box + panels UI
├── floating-box.uc.js      # Feature 1: swap button + box repositioning
├── split-bookmarks.uc.js   # Feature 2: interception + Canvas favicons + API
├── creator-panel.uc.js     # UI: toolbar button + create/manage panels
└── splits/                 # Fichiers HTML générés + favicons (Phase 3B)
```

## Features (roadmap)

- **Feature 1** — Bouton flottant : repositionne la box de split en bas à droite, ajoute un bouton swap
- **Feature 2** — Split bookmarks : bookmarks qui ouvrent 2 sites en split view au clic
