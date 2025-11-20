const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    // Only inject if we are on a remote page (http/https)
    // This prevents the icon from showing up on the local file browser/index.html
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        injectHomeButton();
    }
});

function injectHomeButton() {
    const button = document.createElement('div');
    button.id = 'vidsrc-home-button';
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
    `;

    // Styles
    Object.assign(button.style, {
        position: 'fixed',
        top: '0px',
        right: '20px',
        width: '40px',
        height: '40px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        borderRadius: '0 0 50% 50%', // Semi-circle look since it's at the top
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: '2147483647', // Max z-index
        color: 'white',
        opacity: '0.5',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'auto',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    });

    // Add hover effect
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        button.style.transform = 'scale(1.1)';
        button.style.opacity = '1';
    });
    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        button.style.transform = 'scale(1)';
        button.style.opacity = '0.5';
    });
    button.style.transition = 'opacity 0.3s ease, transform 0.2s ease, background-color 0.2s ease';

    // Handle fullscreen changes
    function handleFullscreen() {
        if (document.fullscreenElement) {
            // Move button to fullscreen element so it stays visible
            try {
                document.fullscreenElement.appendChild(button);
            } catch (e) {
                console.error('Failed to move home button to fullscreen element:', e);
            }
        } else {
            // Move back to body
            document.body.appendChild(button);
        }
    }

    document.addEventListener('fullscreenchange', handleFullscreen);

    // Initial append
    handleFullscreen();

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        ipcRenderer.send('navigate-home');
    });
}
