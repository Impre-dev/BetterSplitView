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

    // ── Swap logic ─────────────────────────────────────────────────────────

    function swapSplitPanes() {
        const vs = window.gZenViewSplitter;
        if (!vs || vs.currentView < 0) return;

        const groupData = vs._data[vs.currentView];
        if (!groupData || groupData.tabs.length < 2) return;

        const nodes = groupData.tabs.map(tab => vs.getSplitNodeFromTab(tab));
        if (nodes.length >= 2 && nodes[0] && nodes[1]) {
            vs.swapNodes(nodes[0], nodes[1]);
            console.log('[BetterSplitView] Swap effectué');
        }
    }

    // ── Swap button creation ────────────────────────────────────────────────

    function createSwapButton(header) {
        if (header.querySelector('.zen-split-swap-button')) return;

        const btn = document.createXULElement('toolbarbutton');
        btn.className = 'zen-split-swap-button';
        btn.setAttribute('tooltiptext', 'Swap left/right');

        // Icône rendue via list-style-image dans chrome.css
        const icon = document.createXULElement('image');
        icon.className = 'toolbarbutton-icon';
        btn.appendChild(icon);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            swapSplitPanes();
        });

        // Insérer avant le bouton unsplit natif (à gauche)
        const unsplitBtn = header.querySelector('.zen-tab-unsplit-button');
        if (unsplitBtn) {
            header.insertBefore(btn, unsplitBtn);
        } else {
            header.appendChild(btn);
        }
    }

    // ── Init + MutationObserver ─────────────────────────────────────────────

    function injectSwapButtons() {
        document.querySelectorAll('.zen-view-splitter-header').forEach(header => {
            createSwapButton(header);
        });
    }

    function init() {
        if (window.__betterSplitViewFloatingBoxInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewFloatingBoxInit = true;

        // Observer 1: détection activation/désactivation du split view
        const tabpanels = document.getElementById('tabbrowser-tabpanels');
        if (tabpanels) {
            const attrObserver = new MutationObserver(() => {
                injectSwapButtons();
            });
            attrObserver.observe(tabpanels, {
                attributes: true,
                attributeFilter: ['zen-split-view']
            });
        }

        // Observer 2: détection de nouveaux headers ajoutés au DOM
        const overlay = document.getElementById('zen-splitview-overlay-wrapper');
        if (overlay) {
            const childObserver = new MutationObserver(() => {
                injectSwapButtons();
            });
            childObserver.observe(overlay, { childList: true, subtree: true });
        }

        // Injection initiale au cas où un split est déjà actif
        injectSwapButtons();

        console.log('[BetterSplitView] Floating Box initialized');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
