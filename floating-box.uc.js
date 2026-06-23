// ==UserScript==
// @name           BetterSplitView — Floating Box
// @version        1.0.0
// @description    Repositions the split header to bottom-right + injects a swap button
// @author         Impre
// @include        main
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    //  BetterSplitView — Floating Box (Feature 1)
    //
    //  Responsabilités :
    //    1. Repositionner .zen-view-splitter-header-container (CSS gère ça)
    //    2. Injecter un bouton Swap dans .zen-view-splitter-header
    //    3. Observer l'apparition/disparition des splits (MutationObserver)
    //
    //  Dépendances : window.gZenViewSplitter
    //  Indépendant des autres scripts du mod.
    // ═══════════════════════════════════════════════════════════════════════

    const MOD_ID = 'BetterSplitView';

    // ── Swap logic ─────────────────────────────────────────────────────────

    function swapSplitPanes() {
        const vs = window.gZenViewSplitter;
        if (!vs || vs.currentView < 0) return;
        const groupData = vs._data[vs.currentView];
        if (!groupData || groupData.tabs.length < 2) return;
        const nodes = groupData.tabs.map(tab => vs.getSplitNodeFromTab(tab));
        if (nodes.length >= 2 && nodes[0] && nodes[1]) {
            vs.swapNodes(nodes[0], nodes[1]);
        }
    }

    // ── Swap button creation ────────────────────────────────────────────────

    function createSwapButton(header) {
        // TODO Phase 2B: create toolbarbutton with swap SVG icon
        // Wire click → swapSplitPanes()
    }

    // ── Init + MutationObserver ─────────────────────────────────────────────

    function init() {
        if (window.__betterSplitViewFloatingBoxInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewFloatingBoxInit = true;

        // TODO Phase 2B: MutationObserver on #tabbrowser-tabpanels[zen-split-view]
        // Detect new .zen-view-splitter-header elements → inject swap button

        console.log('[BetterSplitView] Floating Box initialized');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
