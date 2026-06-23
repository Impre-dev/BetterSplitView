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
        const vs = gZenViewSplitter;
        if (!vs || vs.currentView < 0) {
            console.warn('[BetterSplitView] swapSplitPanes: no active split view');
            return;
        }

        const groupData = vs._data[vs.currentView];
        if (!groupData || groupData.tabs.length < 2) {
            console.warn('[BetterSplitView] swapSplitPanes: need 2+ tabs');
            return;
        }

        const nodes = groupData.tabs.map(tab => vs.getSplitNodeFromTab(tab));
        if (!nodes[0] || !nodes[1]) {
            console.warn('[BetterSplitView] swapSplitPanes: could not get split nodes');
            return;
        }

        // Swap dans l'arbre interne
        vs.swapNodes(nodes[0], nodes[1]);

        // Forcer le reflow visuel en switchant brièvement de tab
        // (swapNodes modifie l'arbre mais ne déclenche pas le rendu)
        const originalTab = gBrowser.selectedTab;
        const otherTab = groupData.tabs.find(t => t !== originalTab) || groupData.tabs[1];
        gBrowser.selectedTab = otherTab;
        setTimeout(() => {
            gBrowser.selectedTab = originalTab;
            console.log('[BetterSplitView] Swap effectué');
        }, 50);
    }

    // ── Swap button creation ────────────────────────────────────────────────

    function createSwapButton(header) {
        if (!header || header.querySelector('.zen-split-swap-button')) return;

        console.log('[BetterSplitView] Injecting swap button into header:', header.className);

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

        console.log('[BetterSplitView] Swap button injected ✓');
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

        const tabpanels = document.getElementById('tabbrowser-tabpanels');
        if (!tabpanels) {
            console.warn('[BetterSplitView] #tabbrowser-tabpanels not found, retrying...');
            setTimeout(init, 1000);
            return;
        }

        // Observer unique : surveille ET l'attribut zen-split-view ET les changements
        // de childList/subtree (nouveaux headers ajoutés quand le split s'active)
        const observer = new MutationObserver(() => {
            injectSwapButtons();
        });
        observer.observe(tabpanels, {
            attributes: true,
            attributeFilter: ['zen-split-view'],
            childList: true,
            subtree: true,
        });

        // Injection initiale au cas où un split est déjà actif
        injectSwapButtons();

        console.log('[BetterSplitView] Floating Box initialized, observing #tabbrowser-tabpanels');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
