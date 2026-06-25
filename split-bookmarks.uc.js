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

    // ── Utils ──────────────────────────────────────────────────────────────

    /** Convertit un file:/// URL en chemin OS lisible par IOUtils */
    function fileUrlToPath(fileUrl) {
        // file:///O:/Programmation/.../splits/ia-compare.html → O:\Programmation\...\splits\ia-compare.html
        let path = fileUrl.replace(/^file:[\/]+/, '');
        // Décoder les %20 et autres séquences
        try {
            path = decodeURIComponent(path);
        } catch (e) { /* ignore si déjà décodé */ }
        // Normaliser les séparateurs
        path = path.replace(/\//g, '\\');
        return path;
    }

    /** Convertit un chemin OS en file:/// URL */
    function pathToFileUrl(osPath) {
        let url = osPath.replace(/\\/g, '/');
        // Ajouter le triple slash si ça commence par une lettre de drive
        if (/^[A-Za-z]:/.test(url)) {
            url = 'file:///' + url;
        }
        return url;
    }

    /** Slugify un nom de bookmark en nom de fichier safe */
    function slugify(name) {
        return name.toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'split';
    }

    /** S'assurer que le dossier splits/ existe */
    async function ensureSplitsDir() {
        try {
            await IOUtils.exists(SPLITS_DIR);
        } catch (e) {
            // N'existe pas → créer
        }
        try {
            await IOUtils.makeDirectory(SPLITS_DIR, { recursive: true, createParents: true });
        } catch (e) {
            // Peut déjà exister → ignoré
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PHASE 3A — TabsProgressListener + handleSplitNavigation + triggerSplit
    // ═══════════════════════════════════════════════════════════════════════

    // Anti-reentrance : évite de traiter le même fichier HTML plusieurs fois
    const _processing = new WeakSet();

    const splitDetector = {
        onLocationChange(browser, webProgress, request, location, flags) {
            // Ignorer les flags qui ne sont pas des vraies navigations
            if (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) return;

            const url = location.spec;

            // ── Détection 1 : Hash URL (https://example.com#zensplit=slug) ──
            // Domaine valide → DNS réussit → on intercepte avant rendu
            const hashMatch = url.match(/#zensplit=(.+)$/);
            if (hashMatch) {
                const slug = hashMatch[1];
                if (_processing.has(browser)) return;
                _processing.add(browser);
                try { browser.stop(); } catch (e) {}
                handleSplitNavigation(slug, browser);
                return;
            }

            // ── Détection 2 : Legacy file:///splits/slug.html ──
            if (!url.includes('/splits/') || !url.endsWith('.html')) return;

            // Anti-reentrance
            if (_processing.has(browser)) return;
            _processing.add(browser);

            // Stopper le chargement immédiatement = zéro flash visible
            try { browser.stop(); } catch (e) {}

            // Extraire le slug depuis le path file:///.../splits/slug.html
            const legacyMatch = url.match(/\/splits\/(.+)\.html$/);
            if (legacyMatch) {
                handleSplitNavigation(legacyMatch[1], browser);
            }
        },
        QueryInterface: ChromeUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
    };

    async function handleSplitNavigation(slug, browser) {
        try {
            // 1. Récupérer le tab associé au browser
            const tab = gBrowser.getTabForBrowser(browser);
            if (!tab) {
                _processing.delete(browser);
                return;
            }

            // 2. Lire le fichier HTML (splits/{slug}.html)
            const htmlPath = PathUtils.join(SPLITS_DIR, `${slug}.html`);
            let htmlContent;
            try {
                htmlContent = await IOUtils.readUTF8(htmlPath);
            } catch (e) {
                console.warn('[BetterSplitView] Cannot read', htmlPath, e);
                _processing.delete(browser);
                return;
            }

            // 3. Extraire la config JSON depuis le script id="zensplit"
            const match = htmlContent.match(/id="zensplit">\s*([\s\S]*?)<\/script>/);
            if (!match) {
                console.warn('[BetterSplitView] No zensplit config found in', htmlPath);
                _processing.delete(browser);
                return;
            }

            let config;
            try {
                config = JSON.parse(match[1].trim());
            } catch (e) {
                console.warn('[BetterSplitView] Invalid JSON in zensplit config', e);
                _processing.delete(browser);
                return;
            }

            // 4. Détection dedup : le split/pont est-il déjà ouvert ?
            if (!config.right && config.url) {
                // Bridge : chercher un tab avec la même URL
                for (const t of gBrowser.tabs) {
                    if (t === tab) continue;
                    try {
                        if (t.linkedBrowser?.currentURI?.spec === config.url) {
                            console.log('[BetterSplitView] Bridge already open, switching');
                            gBrowser.selectedTab = t;
                            gBrowser.removeTab(tab);
                            return;
                        }
                    } catch (e) {}
                }
            } else if (config.left && config.right) {
                // Split : chercher un split view existant avec les mêmes URLs
                const vs = window.gZenViewSplitter;
                if (vs && vs._data) {
                    for (const view of vs._data) {
                        if (!view.tabs || view.tabs.length < 2) continue;
                        try {
                            const tabUrls = view.tabs.map(t => t.linkedBrowser?.currentURI?.spec).filter(Boolean);
                            if (tabUrls.includes(config.left) && tabUrls.includes(config.right)) {
                                console.log('[BetterSplitView] Split already open, switching');
                                gBrowser.selectedTab = view.tabs[0];
                                gBrowser.removeTab(tab);
                                return;
                            }
                        } catch (e) {}
                    }
                }
            }

            // 5. Bridge mode : URL seule, pas de split
            if (!config.right && config.url) {
                try {
                    browser.loadURI(Services.io.newURI(config.url), {
                        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
                    });
                    console.log(`[BetterSplitView] Bridge: ${config.url}`);
                } catch (e) {
                    console.warn('[BetterSplitView] Bridge navigation failed', e);
                }
                return;
            }

            // 5. Absorption : chercher des tabs solo existants avec les mêmes URLs
            let existingLeft = null, existingRight = null;
            for (const t of gBrowser.tabs) {
                if (t === tab) continue;
                try {
                    const tUrl = t.linkedBrowser?.currentURI?.spec;
                    if (!tUrl) continue;
                    if (tUrl === config.left && !existingLeft) existingLeft = t;
                    if (tUrl === config.right && !existingRight) existingRight = t;
                } catch (e) {}
            }

            const vs = window.gZenViewSplitter;
            const layout = config.layout || 'vsep';

            if (existingLeft && existingRight) {
                // Cas A : les 2 tabs existent déjà en solo → absorber les 2
                console.log('[BetterSplitView] Absorbing both existing tabs');
                if (vs) {
                    vs.splitTabs([existingLeft, existingRight], layout);
                    gBrowser.selectedTab = existingLeft;
                    console.log(`[BetterSplitView] Split (absorbed both): ${config.left} | ${config.right} (${layout})`);
                }
                gBrowser.removeTab(tab);
            } else if (existingLeft) {
                // Cas B : seulement left existe → absorber left + créer right
                console.log('[BetterSplitView] Absorbing left, creating right');
                const tab2 = gBrowser.addTrustedTab(config.right);
                await new Promise(r => setTimeout(r, 600));
                if (vs) {
                    vs.splitTabs([existingLeft, tab2], layout);
                    gBrowser.selectedTab = existingLeft;
                    console.log(`[BetterSplitView] Split (absorbed left): ${config.left} | ${config.right} (${layout})`);
                }
                gBrowser.removeTab(tab);
            } else if (existingRight) {
                // Cas C : seulement right existe → créer left sur tab courant + absorber right
                console.log('[BetterSplitView] Absorbing right, creating left');
                try {
                    browser.loadURI(Services.io.newURI(config.left), {
                        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
                    });
                } catch (e) {
                    console.warn('[BetterSplitView] Failed to navigate to left URL', e);
                }
                await new Promise(r => setTimeout(r, 400));
                if (vs) {
                    vs.splitTabs([tab, existingRight], layout);
                    console.log(`[BetterSplitView] Split (absorbed right): ${config.left} | ${config.right} (${layout})`);
                }
            } else {
                // Cas D : aucun tab existant → créer split normal
                try {
                    browser.loadURI(Services.io.newURI(config.left), {
                        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
                    });
                } catch (e) {
                    console.warn('[BetterSplitView] Failed to navigate to left URL', e);
                }

                const tab2 = gBrowser.addTrustedTab(config.right);
                await new Promise(r => setTimeout(r, 600));
                if (vs) {
                    vs.splitTabs([tab, tab2], layout);
                    console.log(`[BetterSplitView] Split: ${config.left} | ${config.right} (${layout})`);
                }
            }

        } catch (e) {
            console.error('[BetterSplitView] handleSplitNavigation error', e);
        } finally {
            _processing.delete(browser);
        }
    }

    async function triggerSplit(leftUrl, rightUrl, layout = 'vsep') {
        const vs = window.gZenViewSplitter;
        if (!vs) {
            console.error('[BetterSplitView] gZenViewSplitter not available');
            return;
        }

        // addTrustedTab crée des tabs "lazy" (linkedBrowser = null)
        // Il faut sélectionner le tab pour forcer la création du browser
        const tab1 = gBrowser.addTrustedTab(leftUrl);
        gBrowser.selectedTab = tab1;
        await new Promise(r => setTimeout(r, 400));

        const tab2 = gBrowser.addTrustedTab(rightUrl);
        await new Promise(r => setTimeout(r, 400));

        // Re-sélectionner tab1 (pour que splitTabs parte du bon tab)
        gBrowser.selectedTab = tab1;
        await new Promise(r => setTimeout(r, 200));

        // Déclencher le split
        vs.splitTabs([tab1, tab2], layout);

        console.log(`[BetterSplitView] Split: ${leftUrl} | ${rightUrl} (${layout})`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PHASE 3B — Canvas favicons + generateSplitHTML + CRUD
    // ═══════════════════════════════════════════════════════════════════════

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error(`Failed to load: ${src}`));
            img.src = src;
        });
    }

    /**
     * Fetch le favicon d'une URL via Google favicon service.
     * Retourne un objectURL (same-origin → pas de canvas taint).
     */
    async function fetchFaviconAsObjectUrl(pageUrl) {
        try {
            const url = new URL(pageUrl);
            const domain = url.hostname;
            const favUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            const response = await fetch(favUrl);
            if (!response.ok) return null;
            const blob = await response.blob();
            if (blob.size === 0) return null;
            return URL.createObjectURL(blob);
        } catch (e) {
            console.warn('[BetterSplitView] Favicon fetch failed for', pageUrl, e);
            return null;
        }
    }

    async function createCompositeFavicon(leftSrc, rightSrc, outputPath) {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');

        // Fond transparent
        ctx.clearRect(0, 0, 16, 16);

        // leftSrc / rightSrc peuvent être des file:///, objectURL, ou data: URL
        const [leftImg, rightImg] = await Promise.all([
            loadImage(leftSrc).catch(() => null),
            loadImage(rightSrc).catch(() => null),
        ]);

        // Découper chaque favicon verticalement en 2 :
        // - Moitié gauche du favicon A → partie gauche du canvas (0→8)
        // - Moitié droite du favicon B → partie droite du canvas (8→16)
        if (leftImg) {
            const lw = leftImg.naturalWidth;
            const lh = leftImg.naturalHeight;
            // Source : moitié gauche (0, 0, lw/2, lh) → Dest : (0, 0, 8, 16)
            ctx.drawImage(leftImg, 0, 0, lw / 2, lh, 0, 0, 8, 16);
        } else {
            ctx.fillStyle = '#666';
            ctx.fillRect(0, 0, 8, 16);
        }
        if (rightImg) {
            const rw = rightImg.naturalWidth;
            const rh = rightImg.naturalHeight;
            // Source : moitié droite (rw/2, 0, rw/2, rh) → Dest : (8, 0, 8, 16)
            ctx.drawImage(rightImg, rw / 2, 0, rw / 2, rh, 8, 0, 8, 16);
        } else {
            ctx.fillStyle = '#999';
            ctx.fillRect(8, 0, 8, 16);
        }

        // Séparateur visuel subtil au centre
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, 16);
        ctx.stroke();

        // Exporter en PNG
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const buf = new Uint8Array(await blob.arrayBuffer());
        await IOUtils.write(outputPath, buf);
    }

    function generateSplitHTML(name, leftUrl, rightUrl, layout, iconFile) {
        const isBridge = !rightUrl;
        const jsonConfig = isBridge
            ? JSON.stringify({ url: leftUrl }, null, 4)
            : JSON.stringify({ left: leftUrl, right: rightUrl, layout }, null, 4);
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="icon" type="image/png" href="${iconFile}">
    <title>${name}</title>
</head>
<body>
    <script type="application/json" id="zensplit">
    ${jsonConfig}
    </script>
    <meta http-equiv="refresh" content="0; url=${leftUrl}">
</body>
</html>`;
    }

    async function createSplitPair(name, leftUrl, rightUrl, opts = {}) {
        await ensureSplitsDir();

        const slug = slugify(name);
        const layout = opts.layout || 'vsep';
        const htmlPath = PathUtils.join(SPLITS_DIR, `${slug}.html`);
        const pngPath = PathUtils.join(SPLITS_DIR, `${slug}.png`);
        const isBridge = !rightUrl;

        // 1. Générer le favicon
        if (isBridge) {
            // Mode pont : copier le favicon de la destination tel quel (sans retouche)
            try {
                const url = new URL(leftUrl);
                let faviconBytes = null;

                if (url.protocol === 'file:') {
                    // Fichier local : lire le HTML cible et extraire <link rel="icon">
                    try {
                        const localPath = fileUrlToPath(leftUrl);
                        if (await IOUtils.exists(localPath)) {
                            const html = await IOUtils.readUTF8(localPath);
                            const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
                                || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
                            if (iconMatch) {
                                let iconHref = iconMatch[1];
                                if (iconHref.startsWith('./')) iconHref = iconHref.slice(2);
                                if (!iconHref.startsWith('http') && !iconHref.startsWith('data:')) {
                                    const dir = localPath.replace(/[/\\][^/\\]+$/, '');
                                    const iconPath = PathUtils.join(dir, iconHref.replace(/\//g, '\\'));
                                    if (await IOUtils.exists(iconPath)) {
                                        faviconBytes = new Uint8Array(await IOUtils.read(iconPath));
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[BetterSplitView] Local favicon extraction failed', e);
                    }
                } else if (url.hostname) {
                    // URL web : Google favicon service → blob → save direct
                    const favUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
                    const response = await fetch(favUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        if (blob.size > 0) {
                            faviconBytes = new Uint8Array(await blob.arrayBuffer());
                        }
                    }
                }

                if (faviconBytes) {
                    await IOUtils.write(pngPath, faviconBytes);
                    console.log('[BetterSplitView] Bridge favicon saved');
                } else {
                    console.warn('[BetterSplitView] No favicon found for bridge');
                }
            } catch (e) {
                console.warn('[BetterSplitView] Bridge favicon failed', e);
            }
        } else {
            // Mode split : favicon composite (moitié gauche + moitié droite)
            try {
                let leftSrc = opts.leftIcon;
                let rightSrc = opts.rightIcon;

                if (!leftSrc) {
                    leftSrc = await fetchFaviconAsObjectUrl(leftUrl);
                }
                if (!rightSrc) {
                    rightSrc = await fetchFaviconAsObjectUrl(rightUrl);
                }

                if (leftSrc && rightSrc) {
                    await createCompositeFavicon(leftSrc, rightSrc, pngPath);
                } else {
                    console.warn('[BetterSplitView] Could not fetch favicons, skipping composite');
                }

                // Nettoyer les objectURLs
                if (leftSrc && leftSrc.startsWith('blob:')) URL.revokeObjectURL(leftSrc);
                if (rightSrc && rightSrc.startsWith('blob:')) URL.revokeObjectURL(rightSrc);
            } catch (e) {
                console.warn('[BetterSplitView] Favicon generation failed', e);
            }
        }

        // 2. Générer le fichier HTML
        const iconFile = `${slug}.png`;
        const html = generateSplitHTML(name, leftUrl, rightUrl, layout, iconFile);
        await IOUtils.writeUTF8(htmlPath, html);

        // 3. Créer le bookmark (file:// — garde le favicon HTML <link rel="icon">)
        //    L'URL hash (https://example.com#zensplit=slug) est une voie D'ACCÈS
        //    supplémentaire pour les extensions web, pas l'URL du favori.
        if (opts.createBookmark !== false) {
            const fileUrl = pathToFileUrl(htmlPath);
            try {
                await PlacesUtils.bookmarks.insert({
                    parentGuid: PlacesUtils.bookmarks.toolbarGuid,
                    title: name,
                    url: fileUrl,
                });
            } catch (e) {
                console.warn('[BetterSplitView] Bookmark creation failed', e);
            }
        }

        console.log(`[BetterSplitView] Split pair created: ${name} → ${slug}`);
        return { slug, htmlPath, pngPath };
    }

    async function deleteSplitPair(filename) {
        const baseName = filename.replace(/\.html$/i, '');
        const htmlPath = PathUtils.join(SPLITS_DIR, `${baseName}.html`);
        const pngPath = PathUtils.join(SPLITS_DIR, `${baseName}.png`);

        // 1. Supprimer HTML + PNG
        try { await IOUtils.remove(htmlPath); } catch (e) {}
        try {
            if (await IOUtils.exists(pngPath)) {
                await IOUtils.remove(pngPath);
            }
        } catch (e) {}

        // 2. Supprimer le bookmark Places correspondant
        const fileUrl = pathToFileUrl(htmlPath);
        try {
            const bookmark = await PlacesUtils.bookmarks.fetch({ url: fileUrl });
            if (bookmark) {
                await PlacesUtils.bookmarks.remove(bookmark.guid);
            }
        } catch (e) {
            console.warn('[BetterSplitView] Bookmark removal failed', e);
        }

        console.log(`[BetterSplitView] Deleted: ${baseName}`);
    }

    /**
     * Met à jour un split/pont existant.
     * Si le nom change → nouveau slug → supprime l'ancien fichier + recréé.
     * Si le nom ne change pas → régénère le contenu du même fichier.
     */
    async function updateSplitPair(oldSlug, name, leftUrl, rightUrl, opts = {}) {
        const newSlug = slugify(name);

        // Si le slug change → supprimer l'ancien puis recréer
        if (newSlug !== oldSlug) {
            await deleteSplitPair(`${oldSlug}.html`);
            return createSplitPair(name, leftUrl, rightUrl, { ...opts, createBookmark: true });
        }

        // Même slug → régénérer le contenu
        await ensureSplitsDir();
        const htmlPath = PathUtils.join(SPLITS_DIR, `${oldSlug}.html`);
        const pngPath = PathUtils.join(SPLITS_DIR, `${oldSlug}.png`);
        const layout = opts.layout || 'vsep';
        const isBridge = !rightUrl;

        // 1. Régénérer le favicon
        if (isBridge) {
            try {
                const url = new URL(leftUrl);
                let faviconBytes = null;
                if (url.protocol === 'file:') {
                    const localPath = fileUrlToPath(leftUrl);
                    if (await IOUtils.exists(localPath)) {
                        const html = await IOUtils.readUTF8(localPath);
                        const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
                            || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
                        if (iconMatch) {
                            let iconHref = iconMatch[1];
                            if (iconHref.startsWith('./')) iconHref = iconHref.slice(2);
                            if (!iconHref.startsWith('http') && !iconHref.startsWith('data:')) {
                                const dir = localPath.replace(/[/\\][^/\\]+$/, '');
                                const iconPath = PathUtils.join(dir, iconHref.replace(/\//g, '\\'));
                                if (await IOUtils.exists(iconPath)) {
                                    faviconBytes = new Uint8Array(await IOUtils.read(iconPath));
                                }
                            }
                        }
                    }
                } else if (url.hostname) {
                    const favUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
                    const response = await fetch(favUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        if (blob.size > 0) faviconBytes = new Uint8Array(await blob.arrayBuffer());
                    }
                }
                if (faviconBytes) {
                    await IOUtils.write(pngPath, faviconBytes);
                } else {
                    try { if (await IOUtils.exists(pngPath)) await IOUtils.remove(pngPath); } catch (e) {}
                }
            } catch (e) {
                console.warn('[BetterSplitView] Update favicon failed', e);
            }
        } else {
            try {
                const leftSrc = await fetchFaviconAsObjectUrl(leftUrl);
                const rightSrc = await fetchFaviconAsObjectUrl(rightUrl);
                if (leftSrc && rightSrc) {
                    await createCompositeFavicon(leftSrc, rightSrc, pngPath);
                }
                if (leftSrc && leftSrc.startsWith('blob:')) URL.revokeObjectURL(leftSrc);
                if (rightSrc && rightSrc.startsWith('blob:')) URL.revokeObjectURL(rightSrc);
            } catch (e) {
                console.warn('[BetterSplitView] Update favicon failed', e);
            }
        }

        // 2. Régénérer le HTML
        const iconFile = `${oldSlug}.png`;
        const html = generateSplitHTML(name, leftUrl, rightUrl, layout, iconFile);
        await IOUtils.writeUTF8(htmlPath, html);

        // 3. Met à jour le titre du bookmark
        const fileUrl = pathToFileUrl(htmlPath);
        try {
            const bookmark = await PlacesUtils.bookmarks.fetch({ url: fileUrl });
            if (bookmark) {
                await PlacesUtils.bookmarks.update(bookmark.guid, { title: name });
            }
        } catch (e) {
            console.warn('[BetterSplitView] Bookmark title update failed', e);
        }

        console.log(`[BetterSplitView] Updated: ${oldSlug} (${name})`);
        return { slug: oldSlug, htmlPath, pngPath };
    }

    async function listSplitPairs() {
        await ensureSplitsDir();

        let children;
        try {
            children = await IOUtils.getChildren(SPLITS_DIR);
        } catch (e) {
            return [];
        }

        const htmlFiles = children.filter(f => f.endsWith('.html'));
        const pairs = [];

        for (const file of htmlFiles) {
            try {
                const content = await IOUtils.readUTF8(file);
                const match = content.match(/id="zensplit">\s*([\s\S]*?)<\/script>/);
                if (match) {
                    const config = JSON.parse(match[1].trim());
                    // Extraire le <title>
                    const titleMatch = content.match(/<title>(.*?)<\/title>/);
                    pairs.push({
                        filename: file.split(/[/\\]/).pop(),
                        slug: file.split(/[/\\]/).pop().replace(/\.html$/i, ''),
                        title: titleMatch ? titleMatch[1] : config.left,
                        ...config,
                    });
                }
            } catch (e) {
                // Ignorer les fichiers illisibles
            }
        }

        return pairs;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PHASE 3C — Public API
    // ═══════════════════════════════════════════════════════════════════════

    window.__betterSplitView = {
        /** Crée une paire de split bookmark complète (HTML + favicon + bookmark) */
        createSplitPair,

        /** Déclenche un split manuellement (2 URLs arbitraires) */
        triggerSplit,

        /** Met à jour un split/pont existant (nouveau contenu, même ou nouveau slug) */
        updateSplitPair,

        /** Supprime une paire (HTML + PNG + bookmark Places) */
        deleteSplitPair,

        /** Liste toutes les paires trouvées dans splits/ */
        listSplitPairs,

        /** Récupère les URLs du split actif (pre-remplissage creator panel) */
        getActiveSplitUrls() {
            const vs = window.gZenViewSplitter;
            if (!vs || vs.currentView < 0) return null;
            const tabs = vs._data[vs.currentView].tabs;
            if (!tabs || tabs.length < 2) return null;
            return {
                left: tabs[0].linkedBrowser.currentURI.spec,
                right: tabs[1].linkedBrowser.currentURI.spec,
            };
        },

        /** Constantes exposées */
        SPLITS_DIR,
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  Init
    // ═══════════════════════════════════════════════════════════════════════

    function init() {
        if (window.__betterSplitViewEngineInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__betterSplitViewEngineInit = true;

        gBrowser.addTabsProgressListener(splitDetector);

        // S'assurer que splits/ existe
        ensureSplitsDir();

        console.log('[BetterSplitView] Split Bookmarks Engine initialized');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });

})();
