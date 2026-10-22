const APP_VERSION = '1.2.0'; // Updated by publish script

// Detect if running in Electron or Android (Native)
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const isAndroid = navigator.userAgent.toLowerCase().includes('android');
const isNative = isElectron || isAndroid;


// DOM Elements
const viewRoot = document.getElementById('view-root');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear');
const appBadge = document.getElementById('app-badge');
const listCountBadge = document.getElementById('list-count');

// State
let genres = { movie: {}, tv: {} };
let favorites = JSON.parse(localStorage.getItem('vidsrc_favorites')) || [];
// Named watchHistory (not history) so it doesn't shadow window.history, which the router uses
let watchHistory = JSON.parse(localStorage.getItem('vidsrc_history')) || [];
const detailsCache = new Map(); // "type:id" -> TMDB details, used for runtimes on hover

// --- Catalog ---
// Curated collections. Each one can be shown as a row and opened as a full grid at #/collection/<key>.
const COLLECTIONS = {
    'trending': { title: 'Trending This Week', path: '/trending/all/week' },
    'top10-movies': { title: 'Top 10 Movies Today', path: '/trending/movie/day', type: 'movie', top10: true },
    'top10-tv': { title: 'Top 10 Shows Today', path: '/trending/tv/day', type: 'tv', top10: true },
    'trending-movies': { title: 'Trending Movies', path: '/trending/movie/week', type: 'movie' },
    'trending-tv': { title: 'Trending Shows', path: '/trending/tv/week', type: 'tv' },
    'popular-movies': { title: 'Popular Movies', path: '/movie/popular', type: 'movie' },
    'popular-tv': { title: 'Popular TV Shows', path: '/tv/popular', type: 'tv' },
    'now-playing': { title: 'New in Theaters', path: '/movie/now_playing', type: 'movie' },
    'on-the-air': { title: 'New Episodes This Week', path: '/tv/on_the_air', type: 'tv' },
    'top-rated-movies': { title: 'Critically Acclaimed Movies', path: '/movie/top_rated', type: 'movie' },
    'top-rated-tv': { title: 'Critically Acclaimed TV', path: '/tv/top_rated', type: 'tv' }
};

// TMDB genre IDs differ between movies and TV, so each tab has its own list (in display order).
const MOVIE_GENRES = [28, 35, 53, 878, 27, 18, 16, 10749, 80, 12, 14, 10751, 9648, 99, 36, 10752, 10402, 37];
const TV_GENRES = [10759, 35, 80, 18, 10765, 9648, 16, 10764, 99, 10751, 10762, 10768, 37];

// Rows for each browse page. Strings are collection keys; [type, genreId] pairs are genre rows.
const PAGES = {
    home: {
        hero: { path: '/trending/all/week' },
        rows: ['top10-movies', 'trending', 'popular-movies', 'popular-tv', 'top10-tv', 'now-playing', 'on-the-air',
            ['movie', 28], ['tv', 35], 'top-rated-movies', ['movie', 27], ['tv', 80], ['movie', 878], ['tv', 10765],
            'top-rated-tv', ['movie', 35], ['movie', 16], ['tv', 99]]
    },
    movies: {
        hero: { path: '/trending/movie/day', type: 'movie' },
        genres: { type: 'movie', ids: MOVIE_GENRES },
        rows: ['top10-movies', 'popular-movies', 'now-playing', 'trending-movies', 'top-rated-movies',
            ...MOVIE_GENRES.map(id => ['movie', id])]
    },
    tv: {
        hero: { path: '/trending/tv/day', type: 'tv' },
        genres: { type: 'tv', ids: TV_GENRES },
        rows: ['top10-tv', 'popular-tv', 'on-the-air', 'trending-tv', 'top-rated-tv',
            ...TV_GENRES.map(id => ['tv', id])]
    }
};

// Sort options for genre grids
const GENRE_SORTS = {
    popular: { label: 'Popular', params: () => ({ sort_by: 'popularity.desc' }) },
    top: { label: 'Top Rated', params: type => ({ sort_by: 'vote_average.desc', 'vote_count.gte': type === 'movie' ? 500 : 200 }) },
    new: {
        label: 'Newest', params: type => {
            const today = new Date().toISOString().split('T')[0];
            return type === 'movie'
                ? { sort_by: 'primary_release_date.desc', 'primary_release_date.lte': today, 'vote_count.gte': 20 }
                : { sort_by: 'first_air_date.desc', 'first_air_date.lte': today, 'vote_count.gte': 20 };
        }
    }
};

// Important: Jquery must be loaded and available to call
$(document).ready(function () {
    initApp();

    const memories = getLongTermMemories(false, "string")

    const explanation = "The following is a list of key events and interactions for the current user, and represents in-app actions (media views, ratings given, bookmarks applied, as well as previous conversations with the AI chat agent). Please consider this context when making recommendations and you may refer to it in conversation as needed. As you get to know the user, this context will grow and evolve. Finally, if the user complains about being tracked, reassure that that all data is saved locally on their device, not some server."
    const userContext = `${explanation}\n\n${memories}`

    setTimeout(() => {
        injectContext({ type: "setUserContext", payload: userContext }, "#chat-iframe")
    }, 2500)

    setTimeout(() => {
        injectContext({ type: "setApplicationContext", payload: "Home Screen (Browse Content)" }, "#chat-iframe")
    }, 3000)

});
async function initApp() {
    await window.loadConfig();

    if (isNative) {
        appBadge.classList.remove('hidden');
        if (isAndroid) {
            appBadge.innerHTML = '<span class="badge-dot"></span> Android App';

            // Android Update Logic
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
                try {
                    window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
                    checkForAndroidUpdates();
                } catch (e) {
                    console.error("Updater init error:", e);
                }
            }
        }
    }

    await fetchGenres();
    setupEventListeners();
    updateListCount();

    // Check Onboarding
    const onboardingCompleted = localStorage.getItem('onboarding_completed');
    if (window.AppConfig.onboardingEnabled && !onboardingCompleted) {
        document.getElementById('onboarding-container').classList.remove('hidden');
        document.getElementById('chat-fab').classList.add('hidden'); // Hide chat during onboarding
    } else {
        // Normal flow
        renderRoute();
        checkWebBanner(); // Check for web app banner

        // Coming back from the player to a details sheet's history entry reopens that sheet
        const modalState = window.history.state && window.history.state.modal;
        if (modalState) {
            modalPushed = true;
            modalHash = location.hash;
            openDetails(modalState.type, modalState.id);
        }
    }
}

function checkWebBanner() {
    // Only show on web app
    if (!window.location.href.includes('vlix.ai/web')) return;

    // Check if already closed this session
    if (sessionStorage.getItem('banner_closed')) return;

    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    let osName = null;

    // Detect supported native platforms
    if (userAgent.includes('android')) {
        osName = 'Android';
    } else if (platform.includes('win') || userAgent.includes('windows')) {
        osName = 'Windows';
    } else if (platform.includes('mac') || userAgent.includes('macintosh')) {
        // Exclude iOS
        if (!/iphone|ipad|ipod/.test(userAgent)) {
            osName = 'macOS';
        }
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
        // Exclude Android (already checked)
        if (!userAgent.includes('android')) {
            osName = 'Linux';
        }
    }

    // If supported OS detected, show banner
    if (osName) {
        const banner = document.getElementById('native-app-banner');
        const osSpan = document.getElementById('banner-os-name');
        const closeBtn = document.getElementById('close-banner');

        if (banner && osSpan && closeBtn) {
            osSpan.textContent = osName;
            banner.classList.remove('hidden');

            closeBtn.addEventListener('click', () => {
                banner.classList.add('hidden');
                sessionStorage.setItem('banner_closed', 'true');
            });
        }
    }
}

async function checkForAndroidUpdates() {
    try {
        const response = await fetch('https://vlix.ai/updates/version.json');
        const remoteData = await response.json();

        if (compareVersions(remoteData.version, APP_VERSION) > 0) {
            console.log(`Update available: ${remoteData.version}`);
            // Download update
            const update = await window.Capacitor.Plugins.CapacitorUpdater.download({
                url: remoteData.url,
                version: remoteData.version
            });

            if (update) {
                console.log('Update downloaded, setting...');
                await window.Capacitor.Plugins.CapacitorUpdater.set(update);
                // Reload to apply
                window.location.reload();
            }
        }
    } catch (e) {
        console.error('Android update check failed:', e);
    }
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return 1;
        if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
}

function setupEventListeners() {
    // Routing: every view has its own URL so the back button and deep links work
    window.addEventListener('hashchange', () => {
        if (modalPushed) {
            // Navigating away from an open details sheet
            modalPushed = false;
            hideModal();
        }
        renderRoute();
    });
    window.addEventListener('popstate', (e) => {
        const modalState = e.state && e.state.modal;
        if (modalPushed && !modalState) {
            // Back button while the details sheet is open closes the sheet
            modalPushed = false;
            hideModal();
        } else if (modalState && !modalPushed) {
            // Forward button back onto a details sheet's entry reopens it
            modalPushed = true;
            modalHash = location.hash;
            openDetails(modalState.type, modalState.id);
        }
    });

    // Search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        searchClearBtn.classList.toggle('hidden', query.length === 0);

        if (query.length > 1) {
            searchTimeout = setTimeout(() => {
                const hash = `#/search?q=${encodeURIComponent(query)}`;
                // Typing refines the current search instead of adding a history entry per keystroke
                navigate(hash, { replace: parseRoute().name === 'search' });
            }, 350);
        } else if (query.length === 0 && parseRoute().name === 'search') {
            leaveSearch();
        }
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchClearBtn.classList.add('hidden');
            searchInput.blur();
            if (parseRoute().name === 'search') leaveSearch();
        }
    });
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        if (parseRoute().name === 'search') leaveSearch();
        searchInput.focus();
    });

    // Keyboard shortcuts: "/" focuses search, Escape closes the details sheet
    document.addEventListener('keydown', (e) => {
        const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (e.key === '/' && !typing) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (e.key === 'Escape' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
            closeModal();
        }
    });

    document.getElementById('surprise-btn').addEventListener('click', surpriseMe);

    // Onboarding Listener
    window.addEventListener('message', (event) => {
        if (event.data.type === 'closeOnboarding') {
            document.getElementById('onboarding-container').classList.add('hidden');
            document.getElementById('chat-fab').classList.remove('hidden'); // Show chat after onboarding
            renderRoute();
        }
    });
}

// Clearing the search returns to whatever page you searched from
function leaveSearch() {
    navigate(lastNonSearchHash, { replace: true });
}

// --- TMDB ---

async function tmdb(path, params = {}) {
    const url = new URL(`${window.AppConfig.tmdbBaseUrl}${path}`);
    url.searchParams.set('api_key', window.AppConfig.tmdbApiKey);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB ${response.status} for ${path}`);
    return response.json();
}

async function fetchGenres() {
    try {
        const [movieData, tvData] = await Promise.all([tmdb('/genre/movie/list'), tmdb('/genre/tv/list')]);
        movieData.genres.forEach(g => genres.movie[g.id] = g.name);
        tvData.genres.forEach(g => genres.tv[g.id] = g.name);
    } catch (error) {
        console.error('Error fetching genres:', error);
    }
}

function genreName(type, id) {
    return genres[type][id] || genres.movie[id] || genres.tv[id] || 'Genre';
}

function genreTitle(type, id) {
    return `${genreName(type, id)} ${type === 'movie' ? 'Movies' : 'Shows'}`;
}

// Discover query for a genre row or grid. English-language titles, with a vote floor to skip obscure entries.
function genreQuery(type, id, sort = 'popular') {
    return {
        path: `/discover/${type}`,
        params: { with_genres: id, with_original_language: 'en', 'vote_count.gte': 20, ...GENRE_SORTS[sort].params(type) }
    };
}

// --- Router ---

let modalPushed = false; // true while an open details sheet has its own history entry
let modalHash = '';
const pageCache = {}; // Browse pages (home/movies/tv) are kept alive so going back is instant
const scrollPositions = {};
let currentRouteKey = null;
let lastNonSearchHash = '#/';
let hasInAppHistory = false; // false when the user landed directly on this URL

function parseRoute() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(query);
    const name = parts[0] || 'home';
    return { name, parts, params, key: raw };
}

function navigate(hash, { replace = false } = {}) {
    if (replace) {
        window.history.replaceState(null, '', hash);
        renderRoute();
    } else if (location.hash === hash) {
        renderRoute();
    } else {
        location.hash = hash;
    }
}

function renderRoute() {
    const route = parseRoute();

    // Remember where we were on the page we're leaving
    if (currentRouteKey) {
        scrollPositions[currentRouteKey] = window.scrollY;
        hasInAppHistory = true;
    }
    currentRouteKey = route.key;
    if (route.name !== 'search') lastNonSearchHash = '#' + route.key;

    // Nav state
    const navName = ['home', 'movies', 'tv', 'list', 'history'].includes(route.name) ? route.name
        : route.name === 'genre' ? (route.parts[1] === 'tv' ? 'tv' : 'movies') : null;
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navName));

    if (route.name !== 'search' && document.activeElement !== searchInput) {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
    }

    // Hide everything, then show or build the target view
    Array.from(viewRoot.children).forEach(child => child.classList.add('hidden'));

    let view;
    if (PAGES[route.name] && route.parts.length <= 1) {
        view = pageCache[route.name];
        if (!view) {
            view = buildBrowsePage(route.name);
            pageCache[route.name] = view;
            viewRoot.appendChild(view);
        }
        view.classList.remove('hidden');
    } else {
        // Transient views are rebuilt every time
        viewRoot.querySelectorAll('.transient-view').forEach(v => v.remove());
        view = document.createElement('div');
        view.className = 'transient-view';
        viewRoot.appendChild(view);

        switch (route.name) {
            case 'collection': renderCollectionView(view, route.parts[1]); break;
            case 'genre': renderGenreView(view, route.parts[1], route.parts[2], route.params.get('sort') || 'popular'); break;
            case 'search': renderSearchView(view, route.params.get('q') || '', route.params.get('type') || 'all'); break;
            case 'list': renderListView(view, route.params.get('type') || 'all'); break;
            case 'history': renderHistoryView(view, route.params.get('type') || 'all'); break;
            case 'recommended': renderRecommendedView(view); break;
            default: navigate('#/', { replace: true }); return;
        }
    }

    const savedScroll = scrollPositions[route.key];
    window.scrollTo(0, savedScroll && PAGES[route.name] ? savedScroll : 0);
}

// --- Browse pages (Home / Movies / TV) ---

function buildBrowsePage(name) {
    const config = PAGES[name];
    const page = document.createElement('div');
    page.className = 'browse-page';
    page.dataset.page = name;

    page.appendChild(buildHero(config.hero));

    if (config.genres) {
        const chips = document.createElement('div');
        chips.className = 'genre-chips';
        chips.innerHTML = config.genres.ids
            .map(id => `<a class="chip" href="#/genre/${config.genres.type}/${id}">${esc(genreName(config.genres.type, id))}</a>`)
            .join('');
        page.appendChild(chips);
    }

    // AI recommendations (saved by the chat feature) get the first row when present
    if (name === 'home') {
        const recs = JSON.parse(localStorage.getItem('vidsrc_recommendations') || 'null');
        if (recs && recs.length) {
            page.appendChild(buildRow({ title: 'Recommended for You', viewAll: '#/recommended', items: recs }));
        }
    }

    config.rows.forEach(row => {
        if (Array.isArray(row)) {
            const [type, id] = row;
            page.appendChild(buildRow({ title: genreTitle(type, id), type, viewAll: `#/genre/${type}/${id}`, ...genreQuery(type, id) }));
        } else {
            const c = COLLECTIONS[row];
            page.appendChild(buildRow({ ...c, viewAll: c.top10 ? null : `#/collection/${row}` }));
        }
    });

    return page;
}

// --- Hero carousel ---

function buildHero({ path, type }) {
    const hero = document.createElement('section');
    hero.className = 'hero-carousel loading';
    hero.innerHTML = '<div class="hero-slides"></div><div class="hero-dots"></div>';

    (async () => {
        try {
            const data = await tmdb(path);
            const items = data.results
                .filter(i => i.backdrop_path && (type || i.media_type === 'movie' || i.media_type === 'tv'))
                .slice(0, 6);
            if (!items.length) return hero.remove();

            const slides = hero.querySelector('.hero-slides');
            const dots = hero.querySelector('.hero-dots');

            items.forEach((item, i) => {
                const itemType = type || item.media_type;
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
                const genreList = (item.genre_ids || []).slice(0, 3).map(id => genreName(itemType, id)).join(' · ');

                const slide = document.createElement('div');
                slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
                slide.innerHTML = `
                    <div class="hero-backdrop" style="background-image: url('${window.AppConfig.tmdbImageOriginalUrl}${item.backdrop_path}')"></div>
                    <div class="hero-shade"></div>
                    <div class="hero-content">
                        <div class="hero-kicker">${itemType === 'tv' ? 'Series' : 'Movie'} · #${i + 1} Trending</div>
                        <h1 class="hero-title">${esc(title)}</h1>
                        <div class="hero-meta">
                            ${year ? `<span>${year}</span>` : ''}
                            ${rating ? `<span class="rating">★ ${rating}</span>` : ''}
                            ${genreList ? `<span>${esc(genreList)}</span>` : ''}
                        </div>
                        <p class="hero-desc">${esc(item.overview)}</p>
                        <div class="hero-buttons">
                            <button class="btn-primary hero-play">${ICONS.play} Play</button>
                            <button class="btn-glass hero-info">${ICONS.info} More Info</button>
                            <button class="btn-glass btn-round hero-fav" data-fav-key="${itemType}:${item.id}" aria-label="Add to My List">${favIcon(item.id, itemType)}</button>
                        </div>
                    </div>
                `;
                slide.querySelector('.hero-play').addEventListener('click', () => playContent(item.id, itemType));
                slide.querySelector('.hero-info').addEventListener('click', () => openDetails(itemType, item.id));
                slide.querySelector('.hero-fav').addEventListener('click', () => toggleFavoriteItem(item, itemType));
                slides.appendChild(slide);

                const dot = document.createElement('button');
                dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
                dot.setAttribute('aria-label', `Show ${title}`);
                dot.addEventListener('click', () => showSlide(i, true));
                dots.appendChild(dot);

                // Swap the text title for the official title logo when TMDB has one
                tmdb(`/${itemType}/${item.id}/images`, { include_image_language: 'en,null' }).then(images => {
                    const logo = (images.logos || []).find(l => l.iso_639_1 === 'en') || (images.logos || [])[0];
                    if (!logo) return;
                    const img = new Image();
                    img.className = 'hero-logo';
                    img.alt = title;
                    img.onload = () => slide.querySelector('.hero-title').replaceChildren(img);
                    img.src = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
                }).catch(() => { });
            });

            hero.classList.remove('loading');

            let current = 0;
            let timer;
            const showSlide = (index, userInitiated = false) => {
                current = (index + items.length) % items.length;
                slides.querySelectorAll('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === current));
                dots.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === current));
                if (userInitiated) restart();
            };
            const restart = () => {
                clearInterval(timer);
                timer = setInterval(() => {
                    // Only rotate while visible and not being hovered
                    if (hero.offsetParent && !hero.matches(':hover') && document.visibilityState === 'visible') showSlide(current + 1);
                }, 8000);
            };
            restart();

            // Swipe between slides on touch screens
            let touchX = null;
            hero.addEventListener('touchstart', e => touchX = e.touches[0].clientX, { passive: true });
            hero.addEventListener('touchend', e => {
                if (touchX === null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 50) showSlide(current + (dx < 0 ? 1 : -1), true);
                touchX = null;
            });
        } catch (error) {
            console.error('Error building hero:', error);
            hero.remove();
        }
    })();

    return hero;
}

// --- Rows ---

// A horizontally scrolling row. Content loads when the row scrolls near the viewport.
function buildRow({ title, path, params = {}, type, viewAll, top10 = false, items = null }) {
    const row = document.createElement('section');
    row.className = 'media-row' + (top10 ? ' top10-row' : '');
    row.innerHTML = `
        <div class="row-header">
            <h2>${esc(title)}</h2>
            ${viewAll ? `<a class="view-all" href="${viewAll}">View all <span aria-hidden="true">›</span></a>` : ''}
        </div>
        <div class="row-scroller">
            <button class="row-arrow left" aria-label="Scroll left">‹</button>
            <div class="row-track">${skeletons(8)}</div>
            <button class="row-arrow right" aria-label="Scroll right">›</button>
        </div>
    `;

    const track = row.querySelector('.row-track');
    const left = row.querySelector('.row-arrow.left');
    const right = row.querySelector('.row-arrow.right');
    const updateArrows = () => {
        left.classList.toggle('disabled', track.scrollLeft < 10);
        right.classList.toggle('disabled', track.scrollLeft + track.clientWidth >= track.scrollWidth - 10);
    };
    left.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.85, behavior: 'smooth' }));
    right.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.85, behavior: 'smooth' }));
    track.addEventListener('scroll', updateArrows, { passive: true });

    const fill = (results) => {
        const mixed = !type;
        const list = top10 ? results.slice(0, 10) : results;
        track.innerHTML = '';
        list.forEach((item, i) => {
            const card = createCard(item, { type, mixed, rank: top10 ? i + 1 : null });
            if (card) track.appendChild(card);
        });
        if (!track.children.length) row.remove();
        updateArrows();
    };

    if (items) {
        fill(items);
    } else {
        lazyLoad(row, async () => {
            try {
                const data = await tmdb(path, params);
                fill(data.results || []);
            } catch (error) {
                console.error(`Error loading row "${title}":`, error);
                row.remove();
            }
        });
    }

    return row;
}

const lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        lazyObserver.unobserve(entry.target);
        const load = entry.target._lazyLoad;
        delete entry.target._lazyLoad;
        if (load) load();
    });
}, { rootMargin: '600px 0px' });

function lazyLoad(el, load) {
    el._lazyLoad = load;
    lazyObserver.observe(el);
}

function skeletons(n) {
    return '<div class="loading-skeleton"></div>'.repeat(n);
}

// --- Cards ---

const ICONS = {
    play: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    bookmark: (filled) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    film: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>'
};

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function favIcon(id, type) {
    return ICONS.bookmark(isFavorite(id, type));
}

function safeExtractItemData(item, forcedType) {
    try {
        const id = item.id;
        const type = forcedType || item.media_type || item.type || 'movie';
        const title = item.title || item.name || 'Unknown Title';

        let year = '';
        const rawDate = item.release_date || item.first_air_date || item.year;
        if (rawDate) {
            year = String(rawDate).split('-')[0];
        }

        let rating = '';
        // Handle vote_average (number) or rating (string/number)
        const rawRating = item.vote_average !== undefined ? item.vote_average : item.rating;
        if (rawRating !== undefined && rawRating !== null && rawRating !== 'N/A') {
            const num = Number(rawRating);
            if (!isNaN(num)) {
                rating = num > 0 ? num.toFixed(1) : '';
            } else {
                rating = String(rawRating); // Fallback to string if it's not a valid number but exists
            }
        }

        const posterUrl = item.poster_path ? `${window.AppConfig.tmdbImageBaseUrl}${item.poster_path}` : '';

        // Safe genre extraction
        let genresStr = '';
        if (item.genres) {
            if (Array.isArray(item.genres) && item.genres.length > 0) {
                if (typeof item.genres[0] === 'string') {
                    genresStr = item.genres.slice(0, 2).join(', ');
                } else if (typeof item.genres[0] === 'object' && item.genres[0].name) {
                    genresStr = item.genres.slice(0, 2).map(g => g.name).join(', ');
                }
            }
        } else if (item.genre_ids && Array.isArray(item.genre_ids)) {
            genresStr = item.genre_ids.slice(0, 2).map(id => genres[type][id]).filter(Boolean).join(', ');
        }

        return { id, type, title, year, rating, posterUrl, genresStr };
    } catch (e) {
        console.error("Error extracting item data", e, item);
        return null;
    }
}

// Poster card. Click opens details; hover reveals quick Play and My List buttons.
function createCard(item, { type, mixed = false, rank = null } = {}) {
    if (!item) return null;
    const data = safeExtractItemData(item, type);
    if (!data || !data.posterUrl) return null;
    if (data.type !== 'movie' && data.type !== 'tv') return null;

    const { id, title, year, rating, posterUrl, genresStr } = data;
    const itemType = data.type;
    const key = `${itemType}:${id}`;

    const card = document.createElement('div');
    card.className = 'media-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', title);
    card.innerHTML = `
        <img src="${posterUrl}" alt="" class="card-poster" loading="lazy">
        ${mixed && itemType === 'tv' ? '<span class="type-badge">Series</span>' : ''}
        <div class="card-overlay">
            <div class="card-buttons">
                <button class="card-btn card-play" aria-label="Play ${esc(title)}">${ICONS.play}</button>
                <button class="card-btn card-fav" data-fav-key="${key}" aria-label="Add to My List">${favIcon(id, itemType)}</button>
            </div>
            <h3 class="card-title">${esc(title)}</h3>
            <div class="card-meta">
                <span>${year}</span>
                ${rating ? `<span class="rating">★ ${rating}</span>` : ''}
                <span class="card-runtime"></span>
            </div>
            <div class="card-genres">${esc(genresStr)}</div>
        </div>
    `;

    card.addEventListener('click', () => openDetails(itemType, id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === card) openDetails(itemType, id);
    });
    card.querySelector('.card-play').addEventListener('click', (e) => {
        e.stopPropagation();
        playContent(id, itemType);
    });
    card.querySelector('.card-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavoriteItem(item, itemType);
    });
    // Runtime is fetched on first hover only, instead of one request per card up front
    card.addEventListener('mouseenter', () => fillRuntime(card, itemType, id), { once: true });

    if (rank) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ranked-card';
        wrapper.innerHTML = `<span class="rank-number" aria-hidden="true">${rank}</span>`;
        wrapper.appendChild(card);
        return wrapper;
    }
    return card;
}

async function getDetails(type, id) {
    const key = `${type}:${id}`;
    if (!detailsCache.has(key)) {
        detailsCache.set(key, tmdb(`/${type}/${id}`, {
            append_to_response: 'credits,videos,recommendations,images',
            include_image_language: 'en,null'
        }).catch(e => { detailsCache.delete(key); throw e; }));
    }
    return detailsCache.get(key);
}

function formatRuntime(type, data) {
    if (type === 'movie') {
        if (!data.runtime) return '';
        const h = Math.floor(data.runtime / 60);
        const m = data.runtime % 60;
        return h ? `${h}h ${m}m` : `${m}m`;
    }
    if (data.number_of_seasons) return `${data.number_of_seasons} Season${data.number_of_seasons > 1 ? 's' : ''}`;
    return '';
}

async function fillRuntime(card, type, id) {
    try {
        const data = await getDetails(type, id);
        card.querySelector('.card-runtime').textContent = formatRuntime(type, data);
    } catch (e) { }
}

// --- Grid views ---

function gridHeader(title, { back = true, extra = '' } = {}) {
    return `
        <div class="view-header">
            ${back ? `<button class="btn-icon view-back" aria-label="Back">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>` : ''}
            <h1>${esc(title)}</h1>
            ${extra}
        </div>
    `;
}

function wireBack(view) {
    const btn = view.querySelector('.view-back');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (hasInAppHistory) window.history.back();
        else navigate(lastNonSearchHash === '#' + currentRouteKey ? '#/' : lastNonSearchHash);
    });
}

// options: [value, label, href]
function filterPills(active, options) {
    return `<div class="filter-pills">${options.map(([value, label, href]) =>
        `<a class="pill ${value === active ? 'active' : ''}" href="${href}">${esc(label)}</a>`
    ).join('')}</div>`;
}

// Switching filters replaces the current history entry instead of stacking one per click
function wirePills(view) {
    view.querySelectorAll('.filter-pills a').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.getAttribute('href'), { replace: true });
    }));
}

function typePills(base, active, allLabel = 'All') {
    const sep = base.includes('?') ? '&' : '?';
    return filterPills(active, [['all', allLabel, base], ['movie', 'Movies', `${base}${sep}type=movie`], ['tv', 'TV Shows', `${base}${sep}type=tv`]]);
}

// Grid that loads more pages as you scroll
function infiniteGrid(container, loadPage, { type, mixed = false, emptyText = 'Nothing here yet.' } = {}) {
    const grid = document.createElement('div');
    grid.className = 'media-grid';
    const sentinel = document.createElement('div');
    sentinel.className = 'grid-sentinel';
    container.append(grid, sentinel);

    let page = 1;
    let totalPages = Infinity;
    let loading = false;
    const seen = new Set();

    const observer = new IntersectionObserver(async (entries) => {
        if (!container.isConnected) return observer.disconnect();
        if (!entries[0].isIntersecting || loading || page > totalPages) return;
        loading = true;
        grid.insertAdjacentHTML('beforeend', skeletons(6));
        try {
            const data = await loadPage(page);
            totalPages = Math.min(data.total_pages || 1, 500);
            grid.querySelectorAll('.loading-skeleton').forEach(s => s.remove());
            (data.results || []).forEach(item => {
                const key = `${type || item.media_type}:${item.id}`;
                if (seen.has(key)) return;
                seen.add(key);
                const card = createCard(item, { type, mixed });
                if (card) grid.appendChild(card);
            });
            if (page === 1 && !grid.children.length) {
                grid.outerHTML = `<p class="empty-state-text">${esc(emptyText)}</p>`;
                return observer.disconnect();
            }
            page++;
        } catch (error) {
            console.error('Error loading grid page:', error);
            grid.querySelectorAll('.loading-skeleton').forEach(s => s.remove());
            return;
        } finally {
            loading = false;
        }
        // Re-observe so we keep loading if the sentinel is still on screen
        observer.unobserve(sentinel);
        if (page <= totalPages) observer.observe(sentinel);
    }, { rootMargin: '800px 0px' });

    observer.observe(sentinel);
}

function renderCollectionView(view, key) {
    const c = COLLECTIONS[key];
    if (!c) return navigate('#/', { replace: true });
    view.innerHTML = gridHeader(c.title);
    wireBack(view);
    infiniteGrid(view, page => tmdb(c.path, { page }), { type: c.type, mixed: !c.type });
}

function renderGenreView(view, type, id, sort) {
    if (!['movie', 'tv'].includes(type) || !id) return navigate('#/', { replace: true });
    if (!GENRE_SORTS[sort]) sort = 'popular';
    const base = `#/genre/${type}/${id}`;
    const sorts = Object.entries(GENRE_SORTS).map(([value, s]) => [value, s.label, value === 'popular' ? base : `${base}?sort=${value}`]);
    view.innerHTML = gridHeader(genreTitle(type, id), { extra: filterPills(sort, sorts) });
    wireBack(view);
    wirePills(view);
    const query = genreQuery(type, id, sort);
    infiniteGrid(view, page => tmdb(query.path, { ...query.params, page }), { type });
}

function renderSearchView(view, query, typeFilter) {
    if (document.activeElement !== searchInput) {
        searchInput.value = query;
        searchClearBtn.classList.toggle('hidden', !query);
    }
    const base = `#/search?q=${encodeURIComponent(query)}`;
    view.innerHTML = gridHeader(`Results for “${query}”`, {
        back: false,
        extra: typePills(base, typeFilter)
    });
    wirePills(view);

    if (typeFilter === 'movie' || typeFilter === 'tv') {
        infiniteGrid(view, page => tmdb(`/search/${typeFilter}`, { query, page }), {
            type: typeFilter, emptyText: `No ${typeFilter === 'movie' ? 'movies' : 'shows'} found for “${query}”.`
        });
    } else {
        infiniteGrid(view, page => tmdb('/search/multi', { query, page }), {
            mixed: true, emptyText: `No results for “${query}”. Try a different title.`
        });
    }
}

function renderLocalGrid(view, items, typeFilter, emptyState) {
    const filtered = items.filter(i => typeFilter === 'all' || (i.media_type || i.type) === typeFilter);
    if (!filtered.length) {
        view.insertAdjacentHTML('beforeend', emptyState);
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'media-grid';
    filtered.forEach(item => {
        const card = createCard(item, { type: item.media_type || item.type, mixed: true });
        if (card) grid.appendChild(card);
    });
    view.appendChild(grid);
}

function emptyState(title, text) {
    return `
        <div class="empty-state">
            <div class="empty-icon">${ICONS.film}</div>
            <h2>${esc(title)}</h2>
            <p>${esc(text)}</p>
            <div class="empty-actions">
                <a class="btn-primary" href="#/movies">Browse Movies</a>
                <a class="btn-glass" href="#/tv">Browse TV Shows</a>
            </div>
        </div>
    `;
}

function renderListView(view, typeFilter) {
    const items = [...favorites].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    view.innerHTML = gridHeader('My List', {
        back: false,
        extra: typePills('#/list', typeFilter, `All (${items.length})`)
    });
    wirePills(view);
    renderLocalGrid(view, items, typeFilter,
        emptyState('Your list is empty', 'Tap the bookmark on any title to save it here for later.'));
}

function renderHistoryView(view, typeFilter) {
    view.innerHTML = gridHeader('Watch History', {
        back: false,
        extra: `${typePills('#/history', typeFilter)}
            ${watchHistory.length ? '<button class="btn-glass btn-small clear-history">Clear history</button>' : ''}`
    });
    wirePills(view);
    const clearBtn = view.querySelector('.clear-history');
    if (clearBtn) clearBtn.addEventListener('click', confirmClearHistory);
    renderLocalGrid(view, watchHistory, typeFilter,
        emptyState('Nothing watched yet', 'Everything you start watching shows up here, so you can jump back in anytime.'));
}

function renderRecommendedView(view) {
    const recs = JSON.parse(localStorage.getItem('vidsrc_recommendations') || '[]');
    view.innerHTML = gridHeader('Recommended for You');
    wireBack(view);
    renderLocalGrid(view, recs, 'all', emptyState('No recommendations yet', 'Watch a few things and check back.'));
}

// Re-render the current view after local data (list/history) changes
function refreshLocalViews() {
    const name = parseRoute().name;
    if (name === 'list' || name === 'history') renderRoute();
}

// --- Details sheet ---

window.openDetails = async function (type, id) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalContent = modalOverlay.querySelector('.modal-content');

    modalContent.classList.add('details-modal');
    modalBody.innerHTML = `<div class="details-loading">${skeletons(1)}</div>`;
    modalContent.scrollTop = 0;

    if (modalOverlay.classList.contains('hidden')) {
        modalOverlay.classList.remove('hidden');
        document.body.classList.add('modal-open');
        // Give the sheet its own history entry so the back button closes it
        if (!modalPushed) {
            window.history.pushState({ modal: { type, id } }, '');
            modalPushed = true;
            modalHash = location.hash;
        }
    }
    if (modalPushed) window.history.replaceState({ modal: { type, id } }, '');

    try {
        const data = await getDetails(type, id);
        const title = data.title || data.name;
        const year = (data.release_date || data.first_air_date || '').split('-')[0];
        const rating = data.vote_average ? data.vote_average.toFixed(1) : null;
        const runtime = formatRuntime(type, data);
        const backdrop = data.backdrop_path ? `${window.AppConfig.tmdbImageOriginalUrl}${data.backdrop_path}` : '';
        const logo = (data.images?.logos || []).find(l => l.iso_639_1 === 'en') || (data.images?.logos || [])[0];
        const cast = (data.credits?.cast || []).slice(0, 8).map(c => c.name).join(', ');
        const director = type === 'movie'
            ? (data.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name).join(', ')
            : (data.created_by || []).map(c => c.name).join(', ');
        const videos = data.videos?.results || [];
        const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
            || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
            || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');
        const recs = (data.recommendations?.results || []).filter(r => r.poster_path).slice(0, 12);
        // Series start from the last episode watched, or the first episode
        const resume = type === 'tv' ? Episodes.resumePoint(id, data.seasons) : null;
        const playLabel = resume && resume.resumed ? `Resume S${resume.season} E${resume.episode}` : 'Play';

        modalBody.innerHTML = `
            <div class="details">
                <div class="details-hero" ${backdrop ? `style="background-image: url('${backdrop}')"` : ''}>
                    <div class="details-hero-shade"></div>
                    <div class="details-hero-content">
                        ${logo
                ? `<img class="details-logo" src="https://image.tmdb.org/t/p/w500${logo.file_path}" alt="${esc(title)}">`
                : `<h2 class="details-title">${esc(title)}</h2>`}
                        <div class="details-buttons">
                            <button class="btn-primary details-play">${ICONS.play} ${playLabel}</button>
                            <button class="btn-glass details-fav" data-fav-key="${type}:${id}">${favIcon(id, type)} <span>${isFavorite(id, type) ? 'In My List' : 'My List'}</span></button>
                            ${trailer ? `<button class="btn-glass details-trailer">${ICONS.film} Trailer</button>` : ''}
                        </div>
                    </div>
                </div>
                <div class="details-body">
                    <div class="details-main">
                        <div class="details-meta">
                            ${rating ? `<span class="rating">★ ${rating}</span>` : ''}
                            ${year ? `<span>${year}</span>` : ''}
                            ${runtime ? `<span>${runtime}</span>` : ''}
                            <span class="meta-tag">${type === 'tv' ? 'Series' : 'Movie'}</span>
                        </div>
                        ${data.tagline ? `<p class="details-tagline">${esc(data.tagline)}</p>` : ''}
                        <p class="details-overview">${esc(data.overview)}</p>
                    </div>
                    <div class="details-side">
                        ${cast ? `<p><span class="label">Cast:</span> ${esc(cast)}</p>` : ''}
                        ${director ? `<p><span class="label">${type === 'movie' ? 'Director' : 'Created by'}:</span> ${esc(director)}</p>` : ''}
                        ${(data.genres || []).length ? `<p><span class="label">Genres:</span> ${data.genres.map(g =>
                    `<a class="details-genre" href="#/genre/${type}/${g.id}">${esc(g.name)}</a>`).join(', ')}</p>` : ''}
                    </div>
                </div>
                ${type === 'tv' ? '<div class="details-episodes"></div>' : ''}
                ${recs.length ? `
                    <div class="details-recs">
                        <h3>More Like This</h3>
                        <div class="media-grid recs-grid"></div>
                    </div>` : ''}
            </div>
        `;

        modalBody.querySelector('.details-play').addEventListener('click', () =>
            resume ? playContent(id, type, resume.season, resume.episode) : playContent(id, type));
        const episodesContainer = modalBody.querySelector('.details-episodes');
        if (episodesContainer) {
            Episodes.render(episodesContainer, {
                tvId: id,
                seasons: data.seasons,
                season: resume.season,
                current: resume.resumed ? resume : null,
                currentLabel: 'Continue',
                onSelect: (season, episode) => playContent(id, 'tv', season, episode)
            });
        }
        modalBody.querySelector('.details-fav').addEventListener('click', () => toggleFavoriteItem(data, type));
        const trailerBtn = modalBody.querySelector('.details-trailer');
        if (trailerBtn) {
            trailerBtn.addEventListener('click', () => {
                const hero = modalBody.querySelector('.details-hero');
                hero.classList.add('playing-trailer');
                hero.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0" title="${esc(title)} trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
            });
        }
        const recsGrid = modalBody.querySelector('.recs-grid');
        if (recsGrid) {
            recs.forEach(item => {
                const card = createCard(item, { type: item.media_type || type });
                if (card) recsGrid.appendChild(card);
            });
        }
    } catch (e) {
        console.error('Error loading details', e);
        modalBody.innerHTML = '<p class="error" style="padding: 2rem;">Failed to load details.</p>';
    }
};

// Kept for existing callers
window.openInfoModal = function (id, type) {
    openDetails(type, id);
};

function hideModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    modalOverlay.querySelector('.modal-content').classList.remove('details-modal');
    document.getElementById('modal-body').innerHTML = ''; // Also stops any playing trailer
    document.body.classList.remove('modal-open');
}

window.closeModal = function () {
    if (modalPushed) {
        // popstate handler hides the sheet
        window.history.back();
    } else {
        hideModal();
    }
};

// Add event listener for closing modal
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
});

// --- Surprise me ---

async function surpriseMe() {
    const route = parseRoute();
    const type = route.name === 'movies' ? 'movie'
        : route.name === 'tv' ? 'tv'
            : route.name === 'genre' ? route.parts[1]
                : (Math.random() < 0.5 ? 'movie' : 'tv');
    const btn = document.getElementById('surprise-btn');
    btn.classList.add('spinning');
    try {
        // A random pick from well-liked, well-known titles (respecting the current genre page if there is one)
        const params = { sort_by: 'vote_average.desc', 'vote_count.gte': type === 'movie' ? 1500 : 400, page: 1 + Math.floor(Math.random() * 10) };
        if (route.name === 'genre') params.with_genres = route.parts[2];
        let data = await tmdb(`/discover/${type}`, params);
        if (!data.results.length) data = await tmdb(`/discover/${type}`, { ...params, page: 1 });
        const pick = data.results[Math.floor(Math.random() * data.results.length)];
        if (pick) openDetails(type, pick.id);
    } catch (e) {
        console.error('Surprise me failed', e);
    } finally {
        setTimeout(() => btn.classList.remove('spinning'), 400);
    }
}

// Expose to global scope for inline onclicks
// For series, season/episode default to where the user left off (stream.html falls back to the first episode)
window.playContent = function (tmdbId, type, season, episode) {
    let query = `tmdbId=${tmdbId}&type=${type}`;
    if (type === 'tv') {
        const progress = Episodes.getProgress(tmdbId);
        if (season === undefined && progress) {
            season = progress.season;
            episode = progress.episode;
        }
        if (season !== undefined && episode) query += `&season=${season}&episode=${episode}`;
    }
    console.log(`Opening: ${getStreamUrl(tmdbId, type, season, episode)}`);

    // Watch history is recorded by stream.html once it has loaded the title's details
    window.location.href = `stream.html?${query}`;
};

// --- Favorites Logic ---

function isFavorite(id, type) {
    return favorites.some(f => f.id == id && (!type || !(f.media_type || f.type) || (f.media_type || f.type) === type));
}

function toggleFavoriteItem(item, type) {
    const id = item.id;
    const index = favorites.findIndex(f => f.id == id && (!(f.media_type || f.type) || (f.media_type || f.type) === type));
    if (index === -1) {
        const data = safeExtractItemData(item, type);
        favorites.push({
            id,
            type,
            media_type: type,
            title: data.title,
            poster_path: item.poster_path,
            year: data.year,
            rating: data.rating,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids || (item.genres || []).map(g => g.id).filter(Boolean),
            timestamp: Date.now()
        });
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('vidsrc_favorites', JSON.stringify(favorites));
    syncFavoriteButtons(`${type}:${id}`);
    updateListCount();
    showToast(index === -1 ? 'Added to My List' : 'Removed from My List');
    if (parseRoute().name === 'list') renderRoute();
}

// Kept for existing callers that pass flat fields
window.toggleFavorite = function (id, type, title, poster_path, year, rating) {
    toggleFavoriteItem({ id, title: decodeURIComponent(title), poster_path, release_date: year, vote_average: Number(rating) }, type);
};

function syncFavoriteButtons(key) {
    const [type, id] = key.split(':');
    const active = isFavorite(id, type);
    document.querySelectorAll(`[data-fav-key="${key}"]`).forEach(btn => {
        btn.classList.toggle('active', active);
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('fill', active ? 'currentColor' : 'none');
        const label = btn.querySelector('span');
        if (label) label.textContent = active ? 'In My List' : 'My List';
    });
}

function updateListCount() {
    listCountBadge.textContent = favorites.length > 99 ? '99+' : favorites.length;
    listCountBadge.classList.toggle('hidden', favorites.length === 0);
}

function renderFavorites() {
    updateListCount();
    refreshLocalViews();
}

function renderHistory() {
    refreshLocalViews();
}

let toastTimer;
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
}


function getStreamUrl(tmdbId, type, season, episode) {
    // type is 'movie' or 'tv'
    // Template: play.vlix.ai/embed/movie/{tmdbId}, series take ?season=x&episode=y
    if (type === 'tv') return Episodes.playerUrl(tmdbId, season, episode);

    let template = type === 'movie'
        ? window.AppConfig.playerUrlTemplateMovie
        : window.AppConfig.playerUrlTemplateTv;

    // Replace placeholders
    const path = template.replace('{tmdbId}', tmdbId);
    return path

}

// --- Electron IPC & Menu Handlers ---

if (window.electronAPI) {
    window.electronAPI.onMenuAction((action) => {
        console.log('Menu action received:', action);
        switch (action) {
            case 'clear-history':
                confirmClearHistory();
                break;
            case 'clear-favorites':
                confirmClearFavorites();
                break;
            case 'show-faq':
                showFAQ();
                break;
            case 'show-support':
                showSupport();
                break;
            case 'export-activity':
                exportActivity();
                break;
        }
    });
}

// Fullscreen Toggle
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle');
if (fullscreenToggleBtn) {
    fullscreenToggleBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    // Update icon on change
    document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        const svg = fullscreenToggleBtn.querySelector('svg');
        if (isFullscreen) {
            // Change to exit fullscreen icon
            svg.innerHTML = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>';
        } else {
            // Change to enter fullscreen icon
            svg.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>';
        }
    });
}

// --- Modals for Menu Actions ---

function showModal(title, content, actions = []) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');

    let actionsHtml = '';
    if (actions.length > 0) {
        actionsHtml = `<div class="modal-actions" style="margin-top: 20px; justify-content: flex-end; gap: 10px;">
            ${actions.map(a => `<button class="${a.class || 'btn-secondary'}" onclick="${a.onclick}">${a.label}</button>`).join('')}
        </div>`;
    }

    modalBody.innerHTML = `
        <div class="modal-layout" style="display: block;">
            <h2 class="modal-title" style="margin-bottom: 15px;">${title}</h2>
            <div class="modal-content-text" style="line-height: 1.6; color: #ccc;">
                ${content}
            </div>
            ${actionsHtml}
        </div>
    `;

    modalOverlay.classList.remove('hidden');
}

function confirmClearHistory() {
    showModal(
        'Clear Watch History',
        '<p>Are you sure you want to delete your entire watch history? This cannot be undone.</p>',
        [
            { label: 'Cancel', onclick: 'closeModal()', class: 'btn-secondary' },
            { label: 'Clear History', onclick: 'performClearHistory()', class: 'btn-primary' } // Red color would be nice but using primary for now
        ]
    );
}

window.performClearHistory = function () {
    localStorage.removeItem('vidsrc_history');
    watchHistory = [];
    renderHistory();
    closeModal();
    // Optional: Show success toast/alert
    // alert('History cleared');
};

function confirmClearFavorites() {
    showModal(
        'Clear Favorites',
        '<p>Are you sure you want to delete all your favorites? This cannot be undone.</p>',
        [
            { label: 'Cancel', onclick: 'closeModal()', class: 'btn-secondary' },
            { label: 'Clear Favorites', onclick: 'performClearFavorites()', class: 'btn-primary' }
        ]
    );
}

window.performClearFavorites = function () {
    localStorage.removeItem('vidsrc_favorites');
    favorites = [];
    renderFavorites();
    closeModal();
};

function showFAQ() {
    const faqContent = `
        <div class="faq-item" style="margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 5px;">Difficulty installing on macOS?</h3>
            <p>If you see a warning about the app not being signed by a verified developer, you can bypass this by running the following command in your terminal:</p>
            <code style="display: block; background: #222; padding: 10px; border-radius: 5px; margin-top: 5px; user-select: text;">xattr -cr /Applications/Chatflix.app</code>
        </div>
        <div class="faq-item" style="margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 5px;">Blocked by Windows SmartScreen?</h3>
            <p>If Windows SmartScreen blocks the app, click "More info" and then "Run anyway". This happens because we are an independent developer without a costly code signing certificate.</p>
        </div>
        <div class="faq-item" style="margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 5px;">Is this safe?</h3>
            <p>Chatflix is a specialized web browser that streams content while stripping out ads, popups, and malicious links found on streaming sites. It is significantly safer than browsing these sites directly.</p>
        </div>
        <div class="faq-item" style="margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 5px;">Is this legal?</h3>
            <p>Chatflix does not host any content. It is a streaming tool. No files are downloaded to your device (no P2P/torrents). All history and favorites are stored locally on your machine and can be cleared at any time.</p>
        </div>
    `;
    showModal('Frequently Asked Questions', faqContent, [{ label: 'Close', onclick: 'closeModal()', class: 'btn-secondary' }]);
}

function showSupport() {
    const supportContent = `
        <p style="margin-bottom: 15px;">We welcome donations to support development!</p>
        <div style="text-align: center; margin: 20px 0;">
            <!-- Placeholder for QR Code -->
            <div style="width: 150px; height: 150px; background: white; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: black;">
                QR Code
            </div>
            <p style="margin-top: 10px; font-family: monospace; background: #222; padding: 10px; border-radius: 5px; word-break: break-all; user-select: text;">
                0x0000000000000000000000000000000000000000
            </p>
            <p style="font-size: 0.9em; color: #888; margin-top: 5px;">Accepting ETH, ERC-20 tokens, and NFTs.</p>
        </div>
    `;
    showModal('Support Our Work', supportContent, [{ label: 'Close', onclick: 'closeModal()', class: 'btn-secondary' }]);
}

function exportActivity() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
    }

    // Try to parse JSON strings back to objects for cleaner output
    for (const key in data) {
        try {
            data[key] = JSON.parse(data[key]);
        } catch (e) {
            // Keep as string if not valid JSON
        }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidsrc-activity-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

