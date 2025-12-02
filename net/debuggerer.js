/// Purpose: applies some basic heuristics to detect and neutralize malicious scripts in the vidsrc payload
// The one we're after does many nasty things, but particularly it breaks your DevTools. And that ain't cool, bro

// Todo: Sniff out the philanthropic_level and change its value to 5, possibly will block ads ad source

const { session, net } = require('electron');

// --- CONFIGURATION ---

// 1. The Signatures (The unchangeable fingerprints)
const MALICIOUS_SIGNATURES = [
    '1bgbb027-3b87-ae67-26ar-hz150f600z16',
    'bf001a61-ea58-4c69-33b4-1b01154b26f5',
    'intersectionsStoreChannel'
];

// 2. Heuristics
// Removed size heuristics in favor of active content scanning

// 3. The Replacement
const NEUTERED_PAYLOAD = 'console.warn("[Debuggerer] Malicious script neutralized. Philanthropy rejected."); (function(){})();';

/**
 * UTILITY: Checks if a buffer appears to be binary (contains null bytes)
 * JS files are text and usually do not contain null bytes (0x00).
 */
function isLikelyText(buffer) {
    // Check the first 1024 bytes (or less) for null bytes
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0x00) return false;
    }
    return true;
}

/**
 * CORE LOGIC: Inspects the buffer for specific strings
 */
function containsFingerprint(buffer) {
    const content = buffer.toString('utf8');
    for (const sig of MALICIOUS_SIGNATURES) {
        if (content.includes(sig)) return sig;
    }
    return null;
}

module.exports = function activateDebuggerer() {
    const ses = session.defaultSession;

    console.log(`[Debuggerer] Active.`);
    console.log(`[Debuggerer] Heuristic: Scanning for 'philanthropic_level' in scripts.`);

    // Track active inspections to prevent overwhelming the system
    let activeInspections = 0;
    const MAX_CONCURRENT_INSPECTIONS = 10;

    ses.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, async (details, callback) => {
        const url = details.url;
        const headers = details.responseHeaders || {};

        // 1. Filter: Is it likely a script?
        const contentType = ((headers['content-type'] || headers['Content-Type'] || [])[0] || '').toLowerCase();
        const isScript = contentType.includes('javascript') || contentType.includes('text/javascript') || url.endsWith('.js');

        if (!isScript) {
            callback({});
            return;
        }

        // 2. Throttle: Don't inspect if too busy
        if (activeInspections >= MAX_CONCURRENT_INSPECTIONS) {
            console.log(`[Debuggerer] ⏸️ THROTTLED: Too many active inspections, skipping ${url.substring(0, 50)}...`);
            callback({});
            return;
        }

        activeInspections++;
        // console.log(`[Debuggerer] 🔍 INSPECTING: ${url.substring(0, 60)}...`);

        try {
            // 3. Active Check: Fetch and scan
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout for inspection

            const response = await net.fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!response.ok) {
                // If we can't fetch it, let the browser try (or fail)
                activeInspections--;
                callback({});
                return;
            }

            const text = await response.text();
            activeInspections--;

            // 4. Heuristic Check
            if (text.includes('philanthropic_level')) {
                console.log(`[Debuggerer] 🚫 BLOCKED: Malicious script detected in ${url}`);
                callback({
                    redirectURL: 'data:application/javascript;charset=utf-8,' + encodeURIComponent(NEUTERED_PAYLOAD)
                });
            } else {
                // Safe
                callback({});
            }

        } catch (error) {
            activeInspections--;
            // console.log(`[Debuggerer] ⚠️ ERROR inspecting ${url}: ${error.message}. Allowing.`);
            callback({});
        }
    });

    console.log(`[Debuggerer] WebRequest filters active.`);
    console.log(`[Debuggerer] Mode: ACTIVE BLOCKING (max ${MAX_CONCURRENT_INSPECTIONS} concurrent inspections)`);
};

// --- NETWORK HELPER ---
// Standard Node.js network request wrapped in a Promise
function fetchOriginal(request) {
    return new Promise((resolve, reject) => {
        const req = net.request({
            method: request.method,
            url: request.url,
            session: null // null session prevents infinite interception loop
        });

        // Forward headers (important for auth/referers)
        if (request.headers) {
            Object.keys(request.headers).forEach(k => {
                req.setHeader(k, request.headers[k]);
            });
        }

        req.on('response', (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    data: Buffer.concat(chunks),
                    headers: res.headers,
                    statusCode: res.statusCode
                });
            });
        });

        req.on('error', (e) => reject(e));

        // Handle POST data if applicable
        if (request.uploadData) {
            request.uploadData.forEach(part => {
                if (part.bytes) req.write(part.bytes);
            });
        }

        req.end();
    });
}