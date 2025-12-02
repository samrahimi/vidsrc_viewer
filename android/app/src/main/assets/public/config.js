window.AppConfig = {};

window.loadConfig = async function () {
    let localConfig = {};
    let remoteConfig = {};

    // 1. Load local settings
    try {
        const localResponse = await fetch('settings.json');
        if (localResponse.ok) {
            localConfig = await localResponse.json();
        } else {
            console.warn('Failed to load local settings.json');
        }
    } catch (e) {
        console.warn('Error loading local settings.json:', e);
    }

    // 2. Load remote settings
    try {
        const remoteResponse = await fetch('https://vlix.ai/config/settings.json');
        if (remoteResponse.ok) {
            remoteConfig = await remoteResponse.json();
        } else {
            console.warn('Failed to load remote settings, using local only.');
        }
    } catch (e) {
        console.warn('Error loading remote settings:', e);
    }

    // 3. Merge: Remote overrides Local
    window.AppConfig = { ...localConfig, ...remoteConfig };
    console.log('Config loaded:', window.AppConfig);

    return window.AppConfig;
};
