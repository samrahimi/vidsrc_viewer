const API_KEY = "829a43a98259bc44cae297489c7e3bba";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

// Detect if running in Electron or Android (Native)
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const isAndroid = navigator.userAgent.toLowerCase().includes('android');
//const isNative = isElectron || isAndroid;
const isNative = true;


// DOM Elements
const moviesGrid = document.getElementById('trending-movies-grid');
const showsGrid = document.getElementById('popular-tv-grid');
const heroSection = document.getElementById('hero-section');
const searchInput = document.getElementById('search-input');
const searchResultsSection = document.getElementById('search-results-section');
const searchGrid = document.getElementById('search-grid');
const closeSearchBtn = document.getElementById('close-search'); // This is the one in the section header, can keep or remove
const searchClearBtn = document.getElementById('search-clear'); // The new X in the input
const appBadge = document.getElementById('app-badge');
const mainContentSections = document.querySelectorAll('.media-section:not(#search-results-section):not(#category-view-section), #hero-section, #category-feeds-container'); // Select hero and trending sections

// Category Elements
const categoryFeedsContainer = document.getElementById('category-feeds-container');
const categoryViewSection = document.getElementById('category-view-section');
const categoryTitle = document.getElementById('category-title');
const categoryGrid = document.getElementById('category-grid');
const closeCategoryBtn = document.getElementById('close-category');
const loadMoreCategoryBtn = document.getElementById('load-more-category');
const recommendationsSection = document.createElement('section'); // Created dynamically
recommendationsSection.id = 'recommendations-section';
recommendationsSection.className = 'media-section hidden';

// State
let searchTimeout;
let genres = {};
let currentCategoryPage = 1;
let currentCategoryId = null;
let currentCategoryName = '';
let isCategoryLoading = false;
let favorites = JSON.parse(localStorage.getItem('vidsrc_favorites')) || [];
let history = JSON.parse(localStorage.getItem('vidsrc_history')) || [];



// Config
/* common categories:
Action          28
Adventure       12
Animation       16
Comedy          35
Crime           80
Documentary     99
Drama           18
Family          10751
Fantasy         14
History         36
Horror          27
Music           10402
Mystery         9648
Romance         10749
Science Fiction 878
TV Movie        10770
Thriller        53
War             10752
Western         37
*/

const CATEGORIES_TO_SHOW = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37]; // Action, Comedy, Drama, Sci-Fi (IDs from TMDB)

// Initialize
// document.addEventListener('DOMContentLoaded', () => {
//     initApp();
// });

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
        if (isAndroid) appBadge.innerHTML = '<span class="badge-dot"></span> Android App';
    }

    await fetchGenres();

    // Check Onboarding
    const onboardingCompleted = localStorage.getItem('onboarding_completed');
    if (!onboardingCompleted) {
        document.getElementById('onboarding-container').classList.remove('hidden');
    } else {
        // Normal flow
        fetchTrending('movie', 'day');
        fetchTrending('tv', 'week');
        renderFavorites();
        renderHistory();
        renderRecommendationsFeed();
        renderCategoryFeeds();
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            fetchTrending(tab.dataset.type, tab.dataset.time);
        });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length > 0) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
        }

        if (query.length > 2) {
            searchTimeout = setTimeout(() => handleSearch(query), 500);
        } else if (query.length === 0) {
            closeSearch();
        }
    });

    closeSearchBtn.addEventListener('click', closeSearch);
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        closeSearch();
        searchInput.focus();
    });

    // Category View
    closeCategoryBtn.addEventListener('click', closeCategoryView);
    loadMoreCategoryBtn.addEventListener('click', loadMoreCategory);



    // History

    /* We need to rethink how we handle history in the UI... for now we will hide it, and quietly log history to build context for the AI


    document.getElementById('history-btn').addEventListener('click', () => {
        const histSection = document.getElementById('history-section');
        histSection.classList.remove('hidden');
        histSection.scrollIntoView({ behavior: 'smooth' });
        histSection.scrollIntoView({ behavior: 'smooth' });
    }) */

    // Onboarding Listener
    window.addEventListener('message', (event) => {
        if (event.data.type === 'closeOnboarding') {
            document.getElementById('onboarding-container').classList.add('hidden');
            // Initialize main content if not already done (or just refresh feeds)
            fetchTrending('movie', 'day');
            fetchTrending('tv', 'week');
            renderFavorites();
            renderHistory();
            renderRecommendationsFeed();
            renderCategoryFeeds();
        }
    });
}

async function fetchTrending(type, timeWindow) {
    const grid = type === 'movie' ? moviesGrid : showsGrid;
    showLoading(grid);

    try {
        const response = await fetch(`${BASE_URL}/trending/${type}/${timeWindow}?with_original_language=en&api_key=${API_KEY}`);
        const data = await response.json();

        if (type === 'movie' && timeWindow === 'day') {
            updateHero(data.results[0]);
        }

        renderGrid(data.results, grid, type);
    } catch (error) {
        console.error('Error fetching trending:', error);
        grid.innerHTML = '<p class="error">Failed to load content.</p>';
    }
}

async function handleSearch(query) {
    // Hide main content
    mainContentSections.forEach(el => el.classList.add('hidden'));

    showLoading(searchGrid);
    searchResultsSection.classList.remove('hidden');
    // Scroll to top since we are hiding everything else
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
        const data = await response.json();

        const filteredResults = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        renderGrid(filteredResults, searchGrid, null); // Type is in the item
    } catch (error) {
        console.error('Error searching:', error);
        searchGrid.innerHTML = '<p class="error">Search failed.</p>';
    }
}

function closeSearch() {
    searchResultsSection.classList.add('hidden');
    searchGrid.innerHTML = '';

    // Show main content again
    mainContentSections.forEach(el => el.classList.remove('hidden'));
}

// --- Category Logic ---

async function fetchGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`);
        const data = await response.json();
        data.genres.forEach(g => genres[g.id] = g.name);
    } catch (error) {
        console.error('Error fetching genres:', error);
    }
}

async function renderCategoryFeeds() {
    for (const genreId of CATEGORIES_TO_SHOW) {
        // Create section structure
        const section = document.createElement('section');
        section.className = 'media-section';
        section.innerHTML = `
            <div class="section-header">
                <h2>${genres[genreId] || 'Category'} Movies</h2>
                <a href="#" class="view-more" data-id="${genreId}">View More</a>
            </div>
            <div class="media-grid" id="category-grid-${genreId}"></div>
        `;
        categoryFeedsContainer.appendChild(section);

        // Add event listener to View More
        section.querySelector('.view-more').addEventListener('click', (e) => {
            e.preventDefault();
            openCategoryView(genreId, genres[genreId]);
        });

        // Fetch and render preview (first 5 items)
        try {
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&with_original_language=en&page=1`);
            const data = await response.json();
            const previewItems = data.results.slice(0, 14); // Show top 14
            const grid = section.querySelector(`#category-grid-${genreId}`);
            renderGrid(previewItems, grid, 'movie');
        } catch (error) {
            console.error(`Error fetching category ${genreId}:`, error);
        }
    }
}

// --- Recommendations Feed ---
function renderRecommendationsFeed() {
    const recs = JSON.parse(localStorage.getItem('vidsrc_recommendations'));
    if (!recs || recs.length === 0) return;

    // Insert after hero, before for-you or trending
    // We'll insert it before foryou-container
    const forYouContainer = document.getElementById('foryou-container');
    if (!document.getElementById('recommendations-section')) {
        forYouContainer.parentNode.insertBefore(recommendationsSection, forYouContainer);
    }

    recommendationsSection.classList.remove('hidden');
    recommendationsSection.innerHTML = `
        <div class="section-header">
            <h2>Recommended for You</h2>
            <a href="#" id="view-all-recs" class="view-more">View More</a>
        </div>
        <div class="media-grid" id="recommendations-grid"></div>
    `;

    const grid = recommendationsSection.querySelector('#recommendations-grid');
    renderGrid(recs.slice(0, 21), grid, null);

    document.getElementById('view-all-recs').addEventListener('click', (e) => {
        e.preventDefault();
        openStaticCategoryView('Recommended for You', recs);
    });
}

let staticCategoryItems = [];
let staticCategoryPage = 1;

function openStaticCategoryView(title, items) {
    // Hide main content
    mainContentSections.forEach(el => el.classList.add('hidden'));
    if (recommendationsSection) recommendationsSection.classList.add('hidden');

    // Reset state
    staticCategoryItems = items;
    staticCategoryPage = 1;
    categoryGrid.innerHTML = '';
    categoryTitle.textContent = title;
    loadMoreCategoryBtn.classList.remove('hidden');
    loadMoreCategoryBtn.textContent = 'Load More';
    loadMoreCategoryBtn.disabled = false;

    // Show section
    categoryViewSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Add scroll listener for infinite scroll
    window.removeEventListener('scroll', handleInfiniteScroll); // Remove API scroll
    window.addEventListener('scroll', handleStaticInfiniteScroll);

    // Load first page
    loadStaticCategoryPage();
}

function loadStaticCategoryPage() {
    const ITEMS_PER_PAGE = 20;
    const start = (staticCategoryPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = staticCategoryItems.slice(start, end);

    renderGrid(pageItems, categoryGrid, null, staticCategoryPage > 1);

    if (end >= staticCategoryItems.length) {
        loadMoreCategoryBtn.classList.add('hidden');
    } else {
        staticCategoryPage++;
        loadMoreCategoryBtn.textContent = 'Load More';
    }
}

function handleStaticInfiniteScroll() {
    if (loadMoreCategoryBtn.classList.contains('hidden')) return;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadStaticCategoryPage();
    }
}

async function openCategoryView(genreId, genreName) {
    // Hide main content
    mainContentSections.forEach(el => el.classList.add('hidden'));

    // Reset state
    currentCategoryId = genreId;
    currentCategoryName = genreName;
    currentCategoryPage = 1;
    categoryGrid.innerHTML = '';
    categoryTitle.textContent = `${genreName} Movies`;
    loadMoreCategoryBtn.classList.remove('hidden');
    loadMoreCategoryBtn.textContent = 'Load More';
    loadMoreCategoryBtn.disabled = false;

    // Show section
    categoryViewSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Add scroll listener for infinite scroll
    window.addEventListener('scroll', handleInfiniteScroll);

    // Load first page
    await loadCategoryPage();
}

async function loadCategoryPage() {
    if (isCategoryLoading) return;
    isCategoryLoading = true;
    loadMoreCategoryBtn.textContent = 'Loading...';

    try {
        const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${currentCategoryId}&sort_by=popularity.desc&page=${currentCategoryPage}`);
        const data = await response.json();

        const shouldAppend = currentCategoryPage > 1;
        renderGrid(data.results, categoryGrid, 'movie', shouldAppend);

        if (currentCategoryPage >= data.total_pages) {
            loadMoreCategoryBtn.classList.add('hidden');
        } else {
            currentCategoryPage++;
            loadMoreCategoryBtn.textContent = 'Load More';
        }
    } catch (error) {
        console.error('Error loading category page:', error);
        loadMoreCategoryBtn.textContent = 'Error loading more';
    } finally {
        isCategoryLoading = false;
    }
}

async function loadMoreCategory() {
    await loadCategoryPage();
}

function closeCategoryView() {
    categoryViewSection.classList.add('hidden');
    categoryGrid.innerHTML = '';
    mainContentSections.forEach(el => el.classList.remove('hidden'));
    if (recommendationsSection && !localStorage.getItem('onboarding_completed') === false) {
        // Only show if onboarding is complete and we have recs
        const recs = localStorage.getItem('vidsrc_recommendations');
        if (recs) recommendationsSection.classList.remove('hidden');
    }
    window.removeEventListener('scroll', handleInfiniteScroll);
    window.removeEventListener('scroll', handleStaticInfiniteScroll);
}

function handleInfiniteScroll() {
    if (isCategoryLoading || loadMoreCategoryBtn.classList.contains('hidden')) return;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 500) { // Load when near bottom
        loadCategoryPage();
    }
}

function updateHero(item) {
    if (!item) return;

    const backdropUrl = item.backdrop_path ? `${IMAGE_ORIGINAL_URL}${item.backdrop_path}` : '';
    const title = item.title || item.name;
    const desc = item.overview;
    const year = (item.release_date || item.first_air_date || '').split('-')[0];
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const type = item.media_type || 'movie'; // Default to movie for hero if unknown, but trending usually has it

    heroSection.style.backgroundImage = `url('${backdropUrl}')`;
    heroSection.classList.remove('hidden');

    heroSection.innerHTML = `
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <h1 class="hero-title">${title}</h1>
            <div class="hero-meta">
                <span>${year}</span>
                <span>⭐ ${rating}</span>
                <span style="text-transform: capitalize;">${type}</span>
            </div>
            <p class="hero-desc">${desc}</p>
            <a href="#" onclick="playContent('${item.id}', '${type}'); return false;" class="btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Watch Now
            </a>
        </div>
    `;
}

function renderGrid(items, container, forcedType, shouldAppend = false) {
    if (!shouldAppend) {
        container.innerHTML = '';
    }

    items.forEach(item => {
        if (!item.poster_path) return; // Skip items without posters

        const type = forcedType || item.media_type || 'movie';
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const posterUrl = `${IMAGE_BASE_URL}${item.poster_path}`;

        // Get top 2 genres
        const itemGenres = (item.genre_ids || []).slice(0, 2).map(id => genres[id]).filter(Boolean).join(', ');

        const card = document.createElement('div');
        card.className = 'media-card';
        card.onclick = () => playContent(item.id, type);

        card.innerHTML = `
            <img src="${posterUrl}" alt="${title}" class="card-poster" loading="lazy">
            <div class="card-actions">
                <button class="btn-icon-small fav-btn ${isFavorite(item.id) ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${item.id}', '${type}', '${encodeURIComponent(title)}', '${item.poster_path}', '${year}', '${rating}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${isFavorite(item.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
                <button class="btn-icon-small info-btn" onclick="event.stopPropagation(); openInfoModal('${item.id}', '${type}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </button>
            </div>
            <div class="card-overlay">
                <h3 class="card-title">${title}</h3>
                <div class="card-meta">
                    <span>${year}</span>
                    <span class="rating">⭐ ${rating}</span>
                </div>
                <div class="card-details">
                    <span class="card-genres">${itemGenres}</span>
                    <span class="card-runtime" id="runtime-${item.id}">...</span>
                </div>
            </div>
        `;

        container.appendChild(card);

        // Fetch runtime asynchronously
        fetchRuntime(item.id, type);
    });
}

async function fetchRuntime(id, type) {
    try {
        // Check if we already have it in cache/memory (optional optimization, skipping for now)
        const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}`);
        const data = await response.json();

        let runtime = '';
        if (type === 'movie') {
            runtime = data.runtime ? `${data.runtime}m` : '';
        } else {
            // For TV, it's an array of runtimes, take average or first
            if (data.episode_run_time && data.episode_run_time.length > 0) {
                runtime = `${data.episode_run_time[0]}m`;
            }
        }

        if (runtime) {
            const el = document.getElementById(`runtime-${id}`);
            if (el) el.textContent = runtime;
        }
    } catch (e) {
        // console.error('Error fetching runtime', e);
    }
}

window.openInfoModal = async function (id, type) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');

    modalBody.innerHTML = '<div class="loading-spinner">Loading...</div>';
    modalOverlay.classList.remove('hidden');

    try {
        const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,videos`);
        const data = await response.json();

        const title = data.title || data.name;
        const year = (data.release_date || data.first_air_date || '').split('-')[0];
        const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
        const posterUrl = data.poster_path ? `${IMAGE_BASE_URL}${data.poster_path}` : '';
        const backdropUrl = data.backdrop_path ? `${IMAGE_ORIGINAL_URL}${data.backdrop_path}` : '';
        const overview = data.overview;
        const genresList = data.genres.map(g => g.name).join(', ');
        const cast = data.credits.cast.slice(0, 5).map(c => c.name).join(', ');

        let runtime = '';
        if (type === 'movie') {
            runtime = data.runtime ? `${data.runtime} min` : '';
        } else {
            if (data.episode_run_time && data.episode_run_time.length > 0) {
                runtime = `${data.episode_run_time[0]} min per ep`;
            } else {
                runtime = `${data.number_of_seasons} Seasons`;
            }
        }

        modalBody.innerHTML = `
            <div class="modal-layout">
                <div class="modal-poster-container">
                    <img src="${posterUrl}" alt="${title}" class="modal-poster">
                </div>
                <div class="modal-info">
                    <h2 class="modal-title">${title}</h2>
                    <div class="modal-meta">
                        <span class="modal-year">${year}</span>
                        <span class="modal-rating">⭐ ${rating}</span>
                        <span class="modal-runtime">${runtime}</span>
                    </div>
                    <div class="modal-genres">${genresList}</div>
                    
                    <div class="modal-section">
                        <h3>Overview</h3>
                        <p class="modal-desc">${overview}</p>
                    </div>
                    
                    <div class="modal-section">
                        <h3>Starring</h3>
                        <p class="modal-cast">${cast}</p>
                    </div>
                    
                    <div class="modal-actions">
                        <button onclick="playContent('${id}', '${type}'); closeModal();" class="btn-primary">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Watch Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add backdrop as background to modal content? Or just keep it clean.
        // Let's keep it clean for now.

    } catch (e) {
        console.error('Error loading details', e);
        modalBody.innerHTML = '<p class="error">Failed to load details.</p>';
    }
};

window.closeModal = function () {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
};

// Add event listener for closing modal
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
});

function showLoading(container) {
    container.innerHTML = `
        <div class="loading-skeleton"></div>
        <div class="loading-skeleton"></div>
        <div class="loading-skeleton"></div>
        <div class="loading-skeleton"></div>
        <div class="loading-skeleton"></div>
    `;
}

// Expose to global scope for inline onclicks
window.playContent = function (tmdbId, type) {
    const url = getStreamUrl(tmdbId, type);
    console.log(`Opening: ${url}`);

    // Add to history
    addToHistory(tmdbId, type);

    // Always use watch.html to ensure metrics and overlays work
    window.location.href = `watch.html?tmdbId=${tmdbId}&type=${type}`;
};

// --- Favorites Logic ---

function isFavorite(id) {
    return favorites.some(f => f.id == id);
}

window.toggleFavorite = function (id, type, title, poster_path, year, rating) {
    const index = favorites.findIndex(f => f.id == id);
    if (index === -1) {
        favorites.push({ id, type, title: decodeURIComponent(title), poster_path, year, rating, timestamp: Date.now() });
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('vidsrc_favorites', JSON.stringify(favorites));
    renderFavorites();

    // Re-render current grids to update heart icons (inefficient but works for now)
    // A better way would be to toggle the class on the button directly
    const btns = document.querySelectorAll(`.fav-btn[onclick*="${id}"]`);
    btns.forEach(btn => {
        btn.classList.toggle('active');
        const svg = btn.querySelector('svg');
        if (btn.classList.contains('active')) {
            svg.setAttribute('fill', 'currentColor');
        } else {
            svg.setAttribute('fill', 'none');
        }
    });
};

function renderFavorites() {
    const favSection = document.getElementById('favorites-section');
    const favGrid = document.getElementById('favorites-grid');

    if (favorites.length === 0) {
        favSection.classList.add('hidden');
        return;
    }

    favSection.classList.remove('hidden');
    renderGrid(favorites, favGrid, null);
    updateForYouVisibility();
}

// --- History Logic ---

async function addToHistory(id, type) {
    // We need details to save to history. 
    // Since playContent only has ID and type, we might need to fetch details or find it in the DOM/memory.
    // For simplicity, let's try to find it in the grids first, or fetch it.

    let item = findItemInGrids(id);

    if (!item) {
        // Fetch details if not found
        try {
            const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}`);
            item = await response.json();
        } catch (e) {
            console.error("Could not fetch item for history", e);
            return;
        }
    }

    if (!item) return;

    const title = item.title || item.name;
    const poster_path = item.poster_path;
    const year = (item.release_date || item.first_air_date || '').split('-')[0];
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

    // Remove if exists (to move to top)
    const index = history.findIndex(h => h.id == id);
    if (index !== -1) {
        history.splice(index, 1);
    }

    history.unshift({ id, type, title, poster_path, year, rating, timestamp: Date.now() });

    // Limit history to 50 items
    if (history.length > 50) {
        history.pop();
    }

    localStorage.setItem('vidsrc_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const histSection = document.getElementById('history-section');
    const histGrid = document.getElementById('history-grid');

    if (history.length === 0) {
        histSection.classList.add('hidden');
        return;
    }

    histSection.classList.remove('hidden');
    renderGrid(history.slice(0, 20), histGrid, null);
    updateForYouVisibility();
}

function updateForYouVisibility() {
    const forYouContainer = document.getElementById('foryou-container');
    const favSection = document.getElementById('favorites-section');
    const histSection = document.getElementById('history-section');

    const hasFavs = !favSection.classList.contains('hidden');
    const hasHist = !histSection.classList.contains('hidden');

    if (hasFavs || hasHist) {
        forYouContainer.classList.remove('hidden');
    } else {
        forYouContainer.classList.add('hidden');
    }
}

function findItemInGrids(id) {
    // Helper to find item data from existing grids to avoid fetch
    // This is a bit hacky as we don't store the full data objects in a global map, 
    // but we can rely on fetch if needed. 
    // Actually, let's just fetch it or rely on what we have.
    // Since we don't have a global store of items, fetching is safer.
    return null;
}


function getStreamUrl(tmdbId, type) {
    // type is 'movie' or 'tv'
    // Template: vidsrc.xyz/embed/movie/{tmdbId}

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
    history = [];
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

