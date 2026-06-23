// ==UserScript==
// @name           BetterSplitView — Split Bookmarks Engine
// @version        1.0.0
// @description    TabsProgressListener interception + Canvas favicons + triggerSplit + API
// @author         Impre
// @include        main
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    //  BetterSplitView — Split Bookmarks Engine (Feature 2)
    //
    //  Responsabilités :
    //    1. TabsProgressListener → détecter navigation vers splits/*.html
    //    2. handleSplitNavigation → lire HTML, parser JSON, fermer tab, trigger split
    //    3. triggerSplit(leftUrl, rightUrl, layout) → addTrustedTab × 2 + splitTabs
    //    4. Canvas composite favicons (32×16 PNG)
    //    5. createSplitPair / deleteSplitPair / listSplitPairs
    //    6. Exposer window.__betterSplitView
    //
    //  Dépendances : window.gZenViewSplitter, gBrowser, PlacesUtils, IOUtils
    //  Expose : window.__betterSplitView (consommé par creator-panel.uc.js)
    // ═══════════════════════════════════════════════════════════════════════

    const MOD_ID = 'BetterSplitView';
    const SPLITS_DIR = PathUtils.join(PathUtils.profileDir, 'chrome', 'sine-mods', MOD_ID, 'splits');

    // ── 3A: TabsProgressListener ────────────────────────────────────────────

    // Progress listener — catches navigation to splits/*.html triggers
    const splitDetector = {
        onLocationChange(browser, webProgress, request, location, flags) {
            // TODO Phase 3A: detect splits/*.html → browser.stop() → handleSplitNavigation()
        },
        QueryInterface: ChromeUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
    };

    function handleSplitNavigation(url, browser) {
        // TODO Phase 3A: read HTML file, parse #zensplit JSON, close tab, triggerSplit()
    }

    function triggerSplit(leftUrl, rightUrl, layout) {
        // TODO Phase 3A: addTrustedTab × 2 → splitTabs([tab1, tab2], layout)
    }

    // ── 3B: File generation + Canvas favicons ──────────────────────────────

    async function createCompositeFavicon(leftUrl, rightUrl, outputPath) {
        // TODO Phase 3B: Canvas 32×16, draw 2 favicons side-by-side → PNG
    }

    function generateSplitHTML(name, leftUrl, rightUrl, layout, iconFile) {
        // TODO Phase 3B: HTML template with <script type="application/json" id="zensplit">
    }

    async function createSplitPair(name, leftUrl, rightUrl, opts = {}) {
        // TODO Phase 3B: generate HTML + favicon + Places bookmark
    }

    async function deleteSplitPair(filename) {
        // TODO Phase 3B: delete HTML + PNG + Places bookmark
    }

    async function listSplitPairs() {
        // TODO Phase 3B: scan splits/ directory, parse each HTML
    }

    // ── 3C: Public API ─────────────────────────────────────────────────────

    window.__betterSplitView = {
        createSplitPair,
        triggerSplit,
        deleteSplitPair,
        listSplitPairs,
    };

    // ── Init ───────────────────────────────────────────────────────────────

    function init() {
        if (window.__betterSplitViewEngineInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewEngineInit = true;

        gBrowser.addTabsProgressListener(splitDetector);

        console.log('[BetterSplitView] Split Bookmarks Engine initialized');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
