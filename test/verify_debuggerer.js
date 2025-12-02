const fs = require('fs');
const path = require('path');

// 1. Prepare testable file
const originalPath = path.join(__dirname, '../net/debuggerer.js');
const testablePath = path.join(__dirname, 'debuggerer_testable.js');
let content = fs.readFileSync(originalPath, 'utf8');
content = content.replace("require('electron')", "require('./mock_electron')");
fs.writeFileSync(testablePath, content);

// 2. Load mocks and module
const mockElectron = require('./mock_electron');
const activateDebuggerer = require('./debuggerer_testable');

// 3. Run Test
async function runTest() {
    console.log('--- Starting Debuggerer Verification ---');

    // Capture console.log to keep output clean or verify logs
    // const originalLog = console.log;
    // console.log = () => {}; 

    activateDebuggerer(); // Registers the callback

    const callback = mockElectron.activeCallback;
    if (!callback) {
        console.error('FAILED: onHeadersReceived callback not registered.');
        return;
    }

    // Test 1: Malicious
    console.log('\nTest 1: Malicious URL (expecting block)');
    await new Promise(resolve => {
        callback({
            url: 'http://example.com/malicious.js',
            responseHeaders: { 'content-type': ['application/javascript'] }
        }, (response) => {
            if (response.redirectURL && response.redirectURL.includes('data:application/javascript')) {
                console.log('PASS: Malicious script blocked and redirected.');
            } else {
                console.error('FAIL: Malicious script NOT blocked.', response);
            }
            resolve();
        });
    });

    // Test 2: Safe
    console.log('\nTest 2: Safe URL (expecting allow)');
    await new Promise(resolve => {
        callback({
            url: 'http://example.com/safe.js',
            responseHeaders: { 'content-type': ['application/javascript'] }
        }, (response) => {
            if (!response.redirectURL) {
                console.log('PASS: Safe script allowed.');
            } else {
                console.error('FAIL: Safe script blocked.', response);
            }
            resolve();
        });
    });

    // Test 3: Not a script (expecting immediate allow)
    console.log('\nTest 3: Image URL (expecting immediate allow)');
    await new Promise(resolve => {
        callback({
            url: 'http://example.com/image.png',
            responseHeaders: { 'content-type': ['image/png'] }
        }, (response) => {
            if (!response.redirectURL) {
                console.log('PASS: Non-script allowed.');
            } else {
                console.error('FAIL: Non-script blocked.', response);
            }
            resolve();
        });
    });

    // Cleanup
    try {
        fs.unlinkSync(testablePath);
    } catch (e) { }
    console.log('\n--- Verification Complete ---');
}

runTest();
