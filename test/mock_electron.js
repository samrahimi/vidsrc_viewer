const session = {
    defaultSession: {
        webRequest: {
            onHeadersReceived: (filter, callback) => {
                // Store the callback so we can invoke it in tests
                module.exports.activeCallback = callback;
            }
        }
    }
};

const net = {
    fetch: async (url, options) => {
        // Mock fetch behavior based on URL
        if (url.includes('malicious')) {
            return {
                ok: true,
                text: async () => "var x = 'philanthropic_level'; // evil code here"
            };
        } else {
            return {
                ok: true,
                text: async () => "var x = 'safe'; // good code here"
            };
        }
    }
};

module.exports = { session, net };
