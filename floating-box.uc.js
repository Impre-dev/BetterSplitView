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

        const n = groupData.tabs.map(tab => vs.getSplitNodeFromTab(tab));
        if (!n[0] || !n[1]) {
            console.warn('[BetterSplitView] swapSplitPanes: could not get split nodes');
            return;
        }

        const count = n.length;

        if (count === 2) {
            // ── Simple swap gauche ↔ droite ──
            vs.swapNodes(n[0], n[1]);
        } else if (count === 3) {
            // ── Rotation droite: [A,B,C] → [C,A,B] ──
            vs.swapNodes(n[1], n[2]); // B↔C → [A,C,B]
            vs.swapNodes(n[0], n[2]); // A↔C(pos1) → [C,A,B]
        } else if (count >= 4) {
            // ── Rotation horaire (grid 2×2 ou +) ──
            // HG↔BG, puis BG(content)↔BD, puis BD↔HD
            vs.swapNodes(n[0], n[1]);
            vs.swapNodes(n[1], n[Math.min(3, count - 1)]);
            vs.swapNodes(n[2], n[Math.min(3, count - 1)]);
        }

        // Forcer le reflow visuel en switchant brièvement de tab
        const originalTab = gBrowser.selectedTab;
        const otherTab = groupData.tabs.find(t => t !== originalTab) || groupData.tabs[1];
        gBrowser.selectedTab = otherTab;
        setTimeout(() => {
            gBrowser.selectedTab = originalTab;
            console.log(`[BetterSplitView] Swap effectué (${count} tabs)`);
        }, 50);
    }

    // ── Swap button creation ────────────────────────────────────────────────

    function createControlButton(header) {
        if (!header || header.querySelector('.zen-split-control-button')) return;

        console.log('[BetterSplitView] Injecting control button into header:', header.className);

        const btn = document.createXULElement('toolbarbutton');
        btn.className = 'zen-split-control-button';
        btn.setAttribute('tooltiptext', 'Clic gauche : quitter le split | Clic droit : swap');

        // Icône rendue via list-style-image dans chrome.css
        const icon = document.createXULElement('image');
        icon.className = 'toolbarbutton-icon';
        btn.appendChild(icon);

        // Clic gauche uniquement (button === 0) → quitter le split
        btn.addEventListener('click', (e) => {
            if (e.button !== 0) return; // Ignorer clic droit/milieu
            e.preventDefault();
            e.stopPropagation();
            const vs = gZenViewSplitter;
            if (vs && typeof vs.unsplitCurrentView === 'function') {
                vs.unsplitCurrentView();
                console.log('[BetterSplitView] Unsplit');
            }
        });

        // Clic droit → swap
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            swapSplitPanes();
        });

        header.appendChild(btn);

        console.log('[BetterSplitView] Control button injected ✓');
    }

    // ── Init + MutationObserver ─────────────────────────────────────────────

    function injectControlButtons() {
        document.querySelectorAll('.zen-view-splitter-header').forEach(header => {
            createControlButton(header);
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
            injectControlButtons();
        });
        observer.observe(tabpanels, {
            attributes: true,
            attributeFilter: ['zen-split-view'],
            childList: true,
            subtree: true,
        });

        // Injection initiale au cas où un split est déjà actif
        injectControlButtons();

        console.log('[BetterSplitView] Floating Box initialized, observing #tabbrowser-tabpanels');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
