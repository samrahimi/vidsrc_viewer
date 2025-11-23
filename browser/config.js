window.AppConfig = {
    playerUrlTemplateMovie: "vidsrc.xyz/embed/movie/{tmdbId}",
    playerUrlTemplateTv: "vidsrc.xyz/embed/tv/{tmdbId}"
};

window.loadConfig = async function () {
    try {
        const response = await fetch('settings.json');
        if (response.ok) {
            const config = await response.json();
            window.AppConfig = { ...window.AppConfig, ...config };
            console.log('Config loaded:', window.AppConfig);
        } else {
            console.warn('Failed to load settings.json, using defaults.');
        }
    } catch (e) {
        console.warn('Error loading settings.json:', e);
    }
    return window.AppConfig;
};
