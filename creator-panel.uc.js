// ==UserScript==
// @name           BetterSplitView — Creator Panel UI
// @version        1.0.0
// @description    Toolbar button + create/manage split bookmark panels
// @author         Impre
// @include        main
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    //  BetterSplitView — Creator Panel UI (Feature 2 — UI layer)
    //
    //  Responsabilités :
    //    1. Toolbar button (split screen icon) dans #nav-bar
    //    2. Create Panel : name, site1, site2, layout radio → createSplitPair()
    //    3. Manage Panel (sub-modale) : list + delete pairs
    //    4. Pre-remplissage depuis le split actif (getActiveSplitUrls)
    //
    //  Consomme : window.__betterSplitView (exposé par split-bookmarks.uc.js)
    //  Dépendances : window.gZenViewSplitter (pour pre-remplissage)
    // ═══════════════════════════════════════════════════════════════════════

    const MOD_ID = 'BetterSplitView';

    // ── 4A: Toolbar button ──────────────────────────────────────────────────

    function injectToolbarButton() {
        // TODO Phase 4A: inject toolbarbutton into #nav-bar with split SVG icon
    }

    // ── 4B: Create Panel ────────────────────────────────────────────────────

    function createPanel() {
        // TODO Phase 4B: XUL <panel> with XHTML form (name, site1, site2, layout)
    }

    function getActiveSplitUrls() {
        // TODO Phase 4B: read gZenViewSplitter._data[currentView].tabs
    }

    // ── 4C: Manage Panel ────────────────────────────────────────────────────

    function populateManageList() {
        // TODO Phase 4C: scan splits/ via listSplitPairs(), render list + delete buttons
    }

    // ── Init ───────────────────────────────────────────────────────────────

    function init() {
        if (window.__betterSplitViewPanelInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewPanelInit = true;

        injectToolbarButton();

        console.log('[BetterSplitView] Creator Panel initialized');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
