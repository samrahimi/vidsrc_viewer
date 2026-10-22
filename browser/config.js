window.AppConfig = {};

// All config comes from settings.json.
// AI chat and onboarding are turned off there for now so the site can be hosted as a static site.
window.loadConfig = async function () {
    try {
        const response = await fetch('settings.json');
        if (response.ok) {
            window.AppConfig = await response.json();
        } else {
            console.warn('Failed to load settings.json');
        }
    } catch (e) {
        console.warn('Error loading settings.json:', e);
    }
    console.log('Config loaded:', window.AppConfig);

    window.applyFeatureFlags();

    return window.AppConfig;
};

// Show or hide the AI chat UI. The chat iframe only loads chat.html when the feature is enabled.
window.applyFeatureFlags = function () {
    const chatEnabled = !!window.AppConfig.aiChatEnabled;
    ['#chat-fab', '#chat-toggle-btn', '#chat-iframe-container', '#chat-container'].forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = chatEnabled ? '' : 'none';
    });
    const chatIframe = document.querySelector('#chat-iframe[data-src]');
    if (chatEnabled && chatIframe && !chatIframe.getAttribute('src')) {
        chatIframe.src = chatIframe.dataset.src;
    }
};
