# Session du 18/10

## État courant
Icône bouton split **RÉSOLUE** en environnement propre (CMI off, Fix-SVG off) :
**mask alpha** + `background: var(--toolbarbutton-icon-fill)` (`b7c7b6a`,
validé opérateur — thème-adaptatif, zéro dépendance). Repo = autorité, poussé.
Profil Impre2 a le fichier sync (son cache n'a jamais connu les vieilles URIs).

## Journal
- [17/10] Crash post-migration : icônes titlebar invisibles → coupable = BSV `f1b866b` (fix data:→resource:// dépendant du bridge Fix-SVG, absent du profil neuf) ; et **CMI révélé coupable originel** (désactivé = tout revient, sauf BSV) — par expérimentation opérateur, fait acquis
- [17/10] Revert `f1b866b` (`96234ff`) — insuffisant : l'URI data: d'origine était empoisonnée au cache (leçon 10, alias v2 `c1e1544`) PUIS **gate contexte sur data: confirmé par instrumentation clean** (feed CSS vivant : stroke computed blanc 0.7 ; boîte 28×28 OK ; rendu vide quand même)
- [18/10] Fix final `b7c7b6a` : mask alpha coloré par la var de thème — immunisé au gate par construction
- [leçon] Les leçons 1-10 de Fix-SVG = observations faites en environnement empoisonné CMI — à réécrire avec caveat. Seule leçon qui survit à l'expérimentation propre : **le gate de contexte sur les images data: est réel post-158** (indépendant de CMI, prouvé par instrumentation)
