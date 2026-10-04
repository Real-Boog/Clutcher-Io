// ==UserScript==
// @name         SillyHack CDN Loader
// @namespace    clutcher-sillyhack
// @version      1.3.0
// @description  Loads the latest SillyHack from cdn.sillyhack.com.
// @match        https://clutcher.io/*
// @match        https://www.clutcher.io/*
// @run-at       document-start
// @connect      cdn.sillyhack.com
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    'use strict';

    const PAGE =
        typeof unsafeWindow !== 'undefined'
            ? unsafeWindow
            : window;

    const SOURCE_URL =
        'https://cdn.sillyhack.com/sillyhack.js';

    const INVENTORY_KEY =
        'clutcher_inv_v1';


    // ============================================================
    // EARLY LIVE INVENTORY HOOK
    //
    // This MUST happen synchronously at document-start, before
    // Clutcher parses clutcher_inv_v1.
    // ============================================================

    function installInventoryBridge() {
        if (PAGE.__sillyInventoryParseHook) {
            return;
        }

        const pageJSON =
            PAGE.JSON || JSON;

        const originalParse =
            pageJSON.parse.bind(pageJSON);

        PAGE.__sillyInventoryParseHook = true;

        pageJSON.parse = function (value, reviver) {
            const result =
                originalParse(value, reviver);

            try {
                const saved =
                    PAGE.localStorage
                        ?.getItem?.(INVENTORY_KEY);

                if (
                    !PAGE.__sillyInventoryRef &&
                    typeof value === 'string' &&
                    value === saved &&
                    result &&
                    typeof result === 'object' &&
                    Array.isArray(result.items) &&
                    result.equipped &&
                    typeof result.equipped === 'object'
                ) {
                    PAGE.__sillyInventoryRef =
                        result;

                    console.info(
                        '[SillyHack Loader] Live inventory captured.'
                    );
                }
            } catch (error) {
                console.warn(
                    '[SillyHack Loader] Inventory capture failed:',
                    error
                );
            }

            return result;
        };

        console.info(
            '[SillyHack Loader] Early inventory hook installed.'
        );
    }


    // ============================================================
    // CDN LOADER
    // ============================================================

    function loadSillyHack() {
        const requestUrl =
            SOURCE_URL +
            '?_=' +
            Date.now();

        console.info(
            '[SillyHack Loader] Fetching latest SillyHack...'
        );

        GM_xmlhttpRequest({
            method: 'GET',

            url: requestUrl,

            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },

            timeout: 15000,

            onload(response) {
                if (
                    response.status < 200 ||
                    response.status >= 300
                ) {
                    console.error(
                        '[SillyHack Loader] CDN returned HTTP',
                        response.status
                    );

                    return;
                }

                const source =
                    response.responseText;

                if (!source?.trim()) {
                    console.error(
                        '[SillyHack Loader] CDN returned an empty script.'
                    );

                    return;
                }

                try {
                    /*
                     * IMPORTANT:
                     *
                     * This MUST be direct eval().
                     *
                     * Do NOT change it to:
                     *
                     *     (0, eval)(...)
                     *
                     * Indirect eval leaves the Tampermonkey userscript
                     * scope, which causes GM_addStyle / GM_getValue /
                     * GM_setValue etc. to become undefined.
                     */
                    eval(
                        source +
                        '\n//# sourceURL=' +
                        SOURCE_URL
                    );

                    console.info(
                        '[SillyHack Loader] CDN script loaded successfully.'
                    );

                    console.info(
                        '[SillyHack Loader] Live inventory:',
                        PAGE.__sillyInventoryRef
                            ? 'captured'
                            : 'not captured'
                    );

                } catch (error) {
                    console.error(
                        '[SillyHack Loader] Could not execute CDN script:',
                        error
                    );
                }
            },

            onerror(error) {
                console.error(
                    '[SillyHack Loader] CDN request failed:',
                    error
                );
            },

            ontimeout() {
                console.error(
                    '[SillyHack Loader] CDN request timed out.'
                );
            }
        });
    }


    // ============================================================
    // START
    // ============================================================

    // Must be first.
    installInventoryBridge();

    // Then fetch the larger script.
    loadSillyHack();

})();
