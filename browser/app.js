const API_KEY = "829a43a98259bc44cae297489c7e3bba";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

// Detect if running in Electron
const isElectron = navigator.userAgent.toLowerCase().includes('electron');

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

// State
let searchTimeout;
let genres = {};
let currentCategoryPage = 1;
let currentCategoryId = null;
let currentCategoryName = '';
let isCategoryLoading = false;

// Config
const CATEGORIES_TO_SHOW = [28, 35, 18, 878]; // Action, Comedy, Drama, Sci-Fi (IDs from TMDB)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    if (isElectron) {
        appBadge.classList.remove('hidden');
    }

    await fetchGenres();
    fetchTrending('movie', 'day');
    fetchTrending('tv', 'day');
    renderCategoryFeeds();
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
}

async function fetchTrending(type, timeWindow) {
    const grid = type === 'movie' ? moviesGrid : showsGrid;
    showLoading(grid);

    try {
        const response = await fetch(`${BASE_URL}/trending/${type}/${timeWindow}?api_key=${API_KEY}`);
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
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=1`);
            const data = await response.json();
            const previewItems = data.results.slice(0, 10); // Show top 10
            const grid = section.querySelector(`#category-grid-${genreId}`);
            renderGrid(previewItems, grid, 'movie');
        } catch (error) {
            console.error(`Error fetching category ${genreId}:`, error);
        }
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

        renderGrid(data.results, categoryGrid, 'movie');

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

function renderGrid(items, container, forcedType) {
    container.innerHTML = '';

    items.forEach(item => {
        if (!item.poster_path) return; // Skip items without posters

        const type = forcedType || item.media_type;
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const posterUrl = `${IMAGE_BASE_URL}${item.poster_path}`;

        const card = document.createElement('div');
        card.className = 'media-card';
        card.onclick = () => playContent(item.id, type);

        card.innerHTML = `
            <img src="${posterUrl}" alt="${title}" class="card-poster" loading="lazy">
            <div class="card-overlay">
                <h3 class="card-title">${title}</h3>
                <div class="card-meta">
                    <span>${year}</span>
                    <span class="rating">⭐ ${rating}</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

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

    if (isElectron) {
        // In Electron, we want to navigate the main window or trigger the protocol handler
        // Since this page IS the default view, clicking should probably navigate the current window
        // OR if we want to trigger the 'vidsrc://' handler which might open a new window/process depending on main.js
        // But usually window.location.href works for protocols if registered.
        window.location.href = url;
    } else {
        // In browser, we might want to just open it, but since vidsrc:// isn't a real web protocol,
        // we should probably just log it or show an alert, OR if the user has the app installed it might work.
        // For this "happy path" web preview, let's just try to open it.
        window.location.href = url;
    }
};

function getStreamUrl(tmdbId, type) {
    // type is 'movie' or 'tv'
    // vidsrc://vidsrc.xyz/embed/movie/{tmdbId}
    // vidsrc://vidsrc.xyz/embed/tv/{tmdbId}

    const path = `vidsrc.xyz/embed/${type}/${tmdbId}`;

    if (isElectron) {
        return `vidsrc://${path}`;
    } else {
        // For web preview, we can't really "play" it without the app, 
        // but let's return the https link so it works in browser too if they want
        return `https://${path}`;
    }
}
