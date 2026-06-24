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

    const SVG_ICON = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="%2342414D" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><line x1="8" y1="2.5" x2="8" y2="13.5"/></svg>`;

    let toolbarButton = null;
    let mainPanel = null;
    let managePanel = null;

    // ── Helpers ────────────────────────────────────────────────────────────

    function getAPI() {
        return window.__betterSplitView;
    }

    function createXUL(tag, attrs = {}) {
        const el = document.createXULElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        return el;
    }

    const XHTML_NS = 'http://www.w3.org/1999/xhtml';

    function createHTML(tag, attrs = {}) {
        // En contexte XUL, il faut explicitement le namespace XHTML pour les éléments HTML
        const el = document.createElementNS(XHTML_NS, tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'style') { el.style.cssText = v; continue; }
            if (k === 'text') { el.textContent = v; continue; }
            if (k.startsWith('on') && typeof v === 'function') {
                el.addEventListener(k.slice(2).toLowerCase(), v);
                continue;
            }
            el.setAttribute(k, v);
        }
        return el;
    }

    // ── CSS Injection ──────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('zensplit-creator-styles')) return;
        const style = document.createXULElement ? document.createElementNS('http://www.w3.org/1999/xhtml', 'style') : document.createElement('style');
        style.setAttribute('id', 'zensplit-creator-styles');
        style.textContent = `
            /* === Panel XUL containers — fusionner avec le fond #FBFBFB === */
            #zensplit-main-panel,
            #zensplit-manage-panel {
                background: #FBFBFB !important;
                -moz-appearance: none !important;
                border-radius: 10px !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important;
                border: 1px solid rgba(0,0,0,0.06) !important;
            }
            .zensplit-panel {
                width: 340px;
                padding: 16px;
                font-family: system-ui, -apple-system, sans-serif;
                color: #333;
                background: transparent;
            }
            .zensplit-panel h3 {
                margin: 0 0 12px 0;
                font-size: 15px;
                font-weight: 600;
                color: #222;
            }
            .zensplit-field {
                margin-bottom: 10px;
            }
            .zensplit-field label {
                display: block;
                font-size: 12px;
                margin-bottom: 4px;
                color: #666;
            }
            .zensplit-field input[type="text"],
            .zensplit-field input[type="url"] {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid rgba(0,0,0,0.08);
                background: linear-gradient(135deg, #f2fff0 0%, #f9fff8 50%, #dcfff9 100%);
                color: #333;
                font-size: 13px;
                outline: none;
                transition: border-color 0.15s;
            }
            .zensplit-field input:focus {
                border-color: rgba(91, 141, 239, 0.6);
                box-shadow: 0 0 0 2px rgba(91, 141, 239, 0.15);
            }
            .zensplit-layout-row {
                display: flex;
                gap: 16px;
                margin-top: 20px;
                margin-bottom: 20px;
            }
            .zensplit-layout-row label {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 13px;
                cursor: pointer;
                color: #555;
            }
            .zensplit-actions {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }
            .zensplit-btn {
                flex: 1;
                padding: 9px 14px;
                border-radius: 8px;
                border: none;
                font-size: 13px;
                cursor: pointer;
                font-weight: 500;
                transition: opacity 0.15s;
            }
            .zensplit-btn-primary {
                background: #4caf50;
                color: white;
            }
            .zensplit-btn-primary:hover { opacity: 0.88; }
            .zensplit-btn-secondary {
                background: rgba(0,0,0,0.06);
                color: #555;
            }
            .zensplit-btn-secondary:hover { background: rgba(0,0,0,0.10); }
            .zensplit-btn-danger {
                background: #e05252;
                color: white;
                width: 28px;
                height: 28px;
                padding: 0;
                font-size: 13px;
                flex: none;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .zensplit-btn-danger:hover { opacity: 0.88; }
            .zensplit-btn-copy {
                background: rgba(0,0,0,0.06);
                color: #555;
                width: 28px;
                height: 28px;
                padding: 0;
                font-size: 13px;
                flex: none;
                border-radius: 6px;
                margin-right: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .zensplit-btn-copy:hover { background: rgba(0,0,0,0.10); }
            .zensplit-btn-copy.copied {
                background: #4caf50;
                color: white;
            }
            .zensplit-manage-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .zensplit-manage-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(0,0,0,0.06);
            }
            .zensplit-manage-item:last-child { border-bottom: none; }
            .zensplit-manage-info {
                flex: 1;
                min-width: 0;
            }
            .zensplit-manage-title {
                font-size: 13px;
                font-weight: 500;
                color: #333;
            }
            .zensplit-manage-urls {
                font-size: 11px;
                color: #999;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .zensplit-prefill-hint {
                font-size: 11px;
                color: #888;
                margin-top: 2px;
                font-style: italic;
            }
            .zensplit-empty {
                text-align: center;
                padding: 20px;
                color: #999;
                font-size: 13px;
            }
            /* Icône du bouton CustomizableUI — hérite de la taille de la toolbar */
            #zensplit-creator-btn .toolbarbutton-icon {
                width: auto !important;
                height: auto !important;
            }
            #zensplit-creator-btn {
                list-style-image: url('${SVG_ICON}');
            }
        `;
        // En contexte XUL, document.head n'existe pas — utiliser documentElement
        (document.head || document.documentElement).appendChild(style);
    }

    // ── Toolbar Widget (CustomizableUI) ────────────────────────────────────

    function injectToolbarButton() {
        // 1. Nettoyer les orphelins DOM des versions précédentes (appendChild direct)
        document.querySelectorAll('#zensplit-creator-btn').forEach(el => {
            // Ne pas supprimer si c'est dans le palette/overflow de CustomizableUI
            const parent = el.parentElement;
            if (parent && parent.id !== 'widget-overflow-list') {
                el.remove();
            }
        });

        // 2. Nettoyer un éventuel widget de test
        try { CustomizableUI.destroyWidget('test-btn'); } catch (e) {}

        // 3. Enregistrer le widget avec type:'custom' + onBuild pour contrôler le DOM
        try {
            CustomizableUI.createWidget({
                id: 'zensplit-creator-btn',
                type: 'custom',
                // Pas de defaultArea → démarre dans la palette du menu Personnaliser
                onBuild: (doc) => {
                    const btn = doc.createXULElement('toolbarbutton');
                    btn.id = 'zensplit-creator-btn';
                    btn.className = 'toolbarbutton-1 chromeclass-toolbar-additional';
                    btn.setAttribute('label', 'Split Bookmark');
                    btn.setAttribute('tooltiptext', 'Créer / gérer un split bookmark');

                    // Icône via <image> avec src = data URI SVG
                    const icon = doc.createXULElement('image');
                    icon.className = 'toolbarbutton-icon';
                    icon.setAttribute('src', SVG_ICON);
                    btn.appendChild(icon);

                    btn.addEventListener('command', () => toggleMainPanel());
                    return btn;
                },
            });

            console.log('[BetterSplitView] Toolbar widget registered (type:custom, onBuild)');
        } catch (e) {
            // Widget déjà enregistré (re-init) — c'est OK
            console.log('[BetterSplitView] Toolbar widget already registered');
        }
    }

    /** Récupère le bouton DOM courant (CustomizableUI le gère par-document) */
    function getToolbarButton() {
        return document.getElementById('zensplit-creator-btn');
    }

    // ── Main Panel (Create) ────────────────────────────────────────────────

    function toggleMainPanel() {
        if (!mainPanel) {
            mainPanel = buildMainPanel();
            document.getElementById('mainPopupSet')?.appendChild(mainPanel) || document.body.appendChild(mainPanel);
        }
        // Pre-fill depuis le split actif
        preFillFromActiveSplit();
        // Ouvrir à côté du bouton
        if (mainPanel.state === 'open') {
            mainPanel.hidePopup();
        } else {
            const btn = getToolbarButton();
            if (btn) mainPanel.openPopup(btn, 'after_end', 0, 0, false, false);
        }
    }

    function buildMainPanel() {
        const panel = createXUL('panel', {
            id: 'zensplit-main-panel',
            type: 'arrow',
            consumeoutsideclicks: 'true',
        });

        const container = createHTML('div', { class: 'zensplit-panel' });

        // Titre
        container.appendChild(createHTML('h3', { text: 'BetterSplitView' }));

        // Name
        const nameField = createHTML('div', { class: 'zensplit-field' });
        nameField.appendChild(createHTML('label', { text: 'Nom', for: 'zensplit-name' }));
        nameField.appendChild(createHTML('input', { type: 'text', id: 'zensplit-name', placeholder: 'IA Compare' }));
        container.appendChild(nameField);

        // Site 1
        const site1Field = createHTML('div', { class: 'zensplit-field' });
        site1Field.appendChild(createHTML('label', { text: 'Site 1 (gauche)', for: 'zensplit-url1' }));
        site1Field.appendChild(createHTML('input', { type: 'url', id: 'zensplit-url1', placeholder: 'https://chatgpt.com' }));
        container.appendChild(site1Field);

        // Site 2
        const site2Field = createHTML('div', { class: 'zensplit-field' });
        site2Field.appendChild(createHTML('label', { text: 'Site 2 (vide → pont)', for: 'zensplit-url2' }));
        site2Field.appendChild(createHTML('input', { type: 'url', id: 'zensplit-url2', placeholder: 'https://claude.ai (optionnel)' }));
        container.appendChild(site2Field);

        // Layout radio
        // TESTS CONFIRMÉS : hsep = empilés (haut/bas), vsep = côte à côte (gauche/droite)
        const layoutRow = createHTML('div', { class: 'zensplit-layout-row' });
        const layoutLabel = createHTML('label');
        layoutLabel.appendChild(createHTML('input', { type: 'radio', name: 'zensplit-layout', value: 'vsep', checked: 'checked' }));
        layoutLabel.appendChild(document.createTextNode(' ↔ Horizontal'));
        layoutRow.appendChild(layoutLabel);

        const layoutLabel2 = createHTML('label');
        layoutLabel2.appendChild(createHTML('input', { type: 'radio', name: 'zensplit-layout', value: 'hsep' }));
        layoutLabel2.appendChild(document.createTextNode(' ↕ Vertical'));
        layoutRow.appendChild(layoutLabel2);
        container.appendChild(layoutRow);

        // Actions
        const actions = createHTML('div', { class: 'zensplit-actions' });

        const manageBtn = createHTML('button', {
            class: 'zensplit-btn zensplit-btn-secondary',
            text: '📋 Liste',
            onclick: () => {
                mainPanel.hidePopup();
                openManagePanel();
            },
        });
        actions.appendChild(manageBtn);

        const createBtn = createHTML('button', {
            class: 'zensplit-btn zensplit-btn-primary',
            text: '✨ Créer',
            onclick: handleCreate,
        });
        actions.appendChild(createBtn);
        container.appendChild(actions);

        panel.appendChild(container);
        return panel;
    }

    function preFillFromActiveSplit() {
        const api = getAPI();
        if (!api || !api.getActiveSplitUrls) return;

        const active = api.getActiveSplitUrls();
        const url1 = document.getElementById('zensplit-url1');
        const url2 = document.getElementById('zensplit-url2');

        if (active && active.left && active.right) {
            if (url1) url1.value = active.left;
            if (url2) url2.value = active.right;
        }
    }

    async function handleCreate() {
        const name = document.getElementById('zensplit-name')?.value?.trim();
        const url1 = document.getElementById('zensplit-url1')?.value?.trim();
        const url2 = document.getElementById('zensplit-url2')?.value?.trim();
        const layoutEl = document.querySelector('input[name="zensplit-layout"]:checked');
        const layout = layoutEl ? layoutEl.value : 'vsep';

        if (!name || !url1) {
            // Feedback visuel simple
            const btn = document.querySelector('.zensplit-btn-primary');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '⚠️ Nom + URL requis !';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            }
            return;
        }

        const api = getAPI();
        if (!api) {
            console.error('[BetterSplitView] API not available');
            return;
        }

        // Feedback loading
        const createBtn = document.querySelector('.zensplit-btn-primary');
        if (createBtn) createBtn.textContent = '⏳ Création...';

        try {
            await api.createSplitPair(name, url1, url2, { layout });
            if (createBtn) {
                createBtn.textContent = '✅ Créé !';
                setTimeout(() => {
                    createBtn.textContent = '✨ Créer';
                    mainPanel?.hidePopup();
                    // Reset fields
                    document.getElementById('zensplit-name').value = '';
                    document.getElementById('zensplit-url1').value = '';
                    document.getElementById('zensplit-url2').value = '';
                }, 1000);
            }
        } catch (e) {
            console.error('[BetterSplitView] Create failed', e);
            if (createBtn) createBtn.textContent = '❌ Erreur';
            setTimeout(() => { if (createBtn) createBtn.textContent = '✨ Créer'; }, 2000);
        }
    }

    // ── Manage Panel ───────────────────────────────────────────────────────

    function openManagePanel() {
        if (!managePanel) {
            managePanel = buildManagePanel();
            document.getElementById('mainPopupSet')?.appendChild(managePanel) || document.body.appendChild(managePanel);
        }
        populateManageList();
        const btn = getToolbarButton();
        if (btn) managePanel.openPopup(btn, 'after_end', 0, 0, false, false);
    }

    function buildManagePanel() {
        const panel = createXUL('panel', {
            id: 'zensplit-manage-panel',
            type: 'arrow',
            consumeoutsideclicks: 'true',
        });

        const container = createHTML('div', { class: 'zensplit-panel' });
        container.appendChild(createHTML('h3', { text: 'Liste des Splits' }));

        const listDiv = createHTML('div', { id: 'zensplit-manage-list', class: 'zensplit-manage-list' });
        container.appendChild(listDiv);

        panel.appendChild(container);
        return panel;
    }

    async function populateManageList() {
        const listDiv = document.getElementById('zensplit-manage-list');
        if (!listDiv) return;

        const api = getAPI();
        if (!api) return;

        listDiv.innerHTML = '';
        listDiv.appendChild(createHTML('div', { class: 'zensplit-empty', text: '⏳ Chargement...' }));

        let pairs;
        try {
            pairs = await api.listSplitPairs();
        } catch (e) {
            listDiv.innerHTML = '';
            listDiv.appendChild(createHTML('div', { class: 'zensplit-empty', text: '❌ Erreur de lecture' }));
            return;
        }

        listDiv.innerHTML = '';

        if (!pairs || pairs.length === 0) {
            listDiv.appendChild(createHTML('div', { class: 'zensplit-empty', text: 'Aucun split bookmark pour l\'instant' }));
            return;
        }

        for (const pair of pairs) {
            const item = createHTML('div', { class: 'zensplit-manage-item' });

            const info = createHTML('div', { class: 'zensplit-manage-info' });
            info.appendChild(createHTML('div', { class: 'zensplit-manage-title', text: pair.title || pair.slug }));

            const urls = pair.left && pair.right
                ? `${pair.left} | ${pair.right}`
                : pair.url
                    ? `🔗 ${pair.url}`
                    : (pair.filename || '');
            const urlsDiv = createHTML('div', { class: 'zensplit-manage-urls', text: urls });
            info.appendChild(urlsDiv);
            item.appendChild(info);

            // Bouton copier le hash URL (pour extension tuiles)
            const hashUrl = `https://example.com#zensplit=${pair.slug}`;
            const copyBtn = createHTML('button', {
                class: 'zensplit-btn-copy',
                text: '🔗',
                title: `Copier l'URL hash : ${hashUrl}`,
                onclick: async () => {
                    try {
                        await navigator.clipboard.writeText(hashUrl);
                        copyBtn.textContent = '✓';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.textContent = '🔗';
                            copyBtn.classList.remove('copied');
                        }, 1200);
                    } catch (e) {
                        copyBtn.textContent = '❌';
                        setTimeout(() => { copyBtn.textContent = '🔗'; }, 1500);
                    }
                },
            });
            item.appendChild(copyBtn);

            const delBtn = createHTML('button', {
                class: 'zensplit-btn-danger',
                text: '🗑️',
                title: 'Supprimer',
                onclick: async () => {
                    delBtn.textContent = '⏳';
                    try {
                        await api.deleteSplitPair(pair.filename);
                        populateManageList();
                    } catch (e) {
                        delBtn.textContent = '❌';
                        setTimeout(() => { delBtn.textContent = '🗑️'; }, 1500);
                    }
                },
            });
            item.appendChild(delBtn);

            listDiv.appendChild(item);
        }
    }

    // ── Init ───────────────────────────────────────────────────────────────

    function init() {
        if (window.__betterSplitViewPanelInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewPanelInit = true;

        try {
            injectStyles();
            injectToolbarButton();
            console.log('[BetterSplitView] Creator Panel initialized');
        } catch (e) {
            console.error('[BetterSplitView] Creator Panel init error', e);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
