# Roadmap BetterSplitView

> Créé le 12/10 (migration régime v2 — le repo vit dans l'install, origin/main
> = `62c1434`, aucune divergence à la migration). Le détail vit dans les
> commits, le registre porte les pointeurs.

## File priorisée

- ⭐ *(aucun chantier ouvert)*

## Leçons de plateforme

- `updateSplitView()` appelé sans tab → `newView = -1` → `deactivateCurrentSplitView()` **détruit le split courant**. Contournement prouvé : toujours re-layouter via `applyGridLayout(root)` (cf. `applySplitRatio`, commit `62c1434`).

## ✅ Livré & poussé

> Au 12/10 : origin/main = `62c1434` — la ligne ci-dessous est **locale, non poussée** (push batché à la convenance).

| Version | Contenu | Commit |
|---|---|---|
| v1.1.0 | Anti-fusion : tabs membres d'un split jamais absorbés/réutilisés (`isTabInSplit` via `getSplitNodeFromTab`) ; déclencheur=pane → split 100% frais (`triggerSplit`) ou tab frais (Cas C, bridges) ; absorption solo inchangée ; dedup même-favori (switch) inchangé | `b194aa2` |
