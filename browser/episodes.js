// Season & episode browser for TV series.
// Shared by the details sheet (index.html) and the player page (stream.html). Requires config.js.

window.Episodes = (() => {
    const PROGRESS_KEY = 'vidsrc_tv_progress';
    const seasonCache = new Map(); // "tvId:season" -> Promise of TMDB season data

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function isAired(airDate) {
        return !!airDate && airDate <= new Date().toISOString().split('T')[0];
    }

    function formatDate(airDate) {
        if (!airDate) return '';
        return new Date(`${airDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // --- Watch progress: last episode started, plus every episode started, per show ---

    function readAll() {
        try {
            return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function getProgress(tvId) {
        return readAll()[tvId] || null;
    }

    function saveProgress(tvId, season, episode) {
        const all = readAll();
        const entry = all[tvId] || { watched: [] };
        const key = `${season}:${episode}`;
        entry.season = Number(season);
        entry.episode = Number(episode);
        entry.timestamp = Date.now();
        entry.watched = [...(entry.watched || []).filter(w => w !== key), key];
        all[tvId] = entry;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    }

    function isWatched(progress, season, episode) {
        return !!progress && (progress.watched || []).includes(`${season}:${episode}`);
    }

    // --- Player URL: the embed takes ?season=x&episode=y ---

    function playerUrl(tvId, season, episode) {
        const url = new URL(window.AppConfig.playerUrlTemplateTv.replace('{tmdbId}', tvId));
        if (season !== undefined && season !== null && episode) {
            url.searchParams.set('season', season);
            url.searchParams.set('episode', episode);
        }
        return url.toString();
    }

    // --- TMDB ---

    function fetchSeason(tvId, season) {
        const key = `${tvId}:${season}`;
        if (!seasonCache.has(key)) {
            const url = `${window.AppConfig.tmdbBaseUrl}/tv/${tvId}/season/${season}?api_key=${window.AppConfig.tmdbApiKey}`;
            seasonCache.set(key, fetch(url).then(r => {
                if (!r.ok) throw new Error(`TMDB ${r.status}`);
                return r.json();
            }).catch(e => {
                seasonCache.delete(key);
                throw e;
            }));
        }
        return seasonCache.get(key);
    }

    // Regular seasons in order, then Specials last
    function sortSeasons(seasons) {
        return (seasons || [])
            .filter(s => s.episode_count > 0)
            .sort((a, b) => (a.season_number === 0) - (b.season_number === 0) || a.season_number - b.season_number);
    }

    function firstEpisode(seasons) {
        const first = sortSeasons(seasons)[0];
        return { season: first ? first.season_number : 1, episode: 1 };
    }

    // Where "Play" should start: the last episode started, or the very first episode
    function resumePoint(tvId, seasons) {
        const progress = getProgress(tvId);
        return progress ? { season: progress.season, episode: progress.episode, resumed: true } : { ...firstEpisode(seasons), resumed: false };
    }

    // The episode after season/episode, or null if there isn't one that has aired yet
    async function nextEpisode(tvId, seasons, season, episode) {
        try {
            const data = await fetchSeason(tvId, season);
            const next = (data.episodes || []).find(e => e.episode_number === Number(episode) + 1);
            if (next) return isAired(next.air_date) ? { season: Number(season), episode: next.episode_number } : null;

            if (Number(season) === 0) return null; // Specials don't roll over into regular seasons
            const nextSeason = sortSeasons(seasons).find(s => s.season_number > Number(season));
            if (!nextSeason) return null;
            const nextData = await fetchSeason(tvId, nextSeason.season_number);
            const firstEp = (nextData.episodes || [])[0];
            return firstEp && isAired(firstEp.air_date) ? { season: nextSeason.season_number, episode: firstEp.episode_number } : null;
        } catch (e) {
            console.error('Could not work out the next episode', e);
            return null;
        }
    }

    // --- Episode browser UI ---

    // options: { tvId, seasons, season, current: {season, episode} | null, currentLabel, onSelect(season, episode) }
    function render(container, options) {
        const seasons = sortSeasons(options.seasons);
        if (!seasons.length) {
            container.innerHTML = '';
            return;
        }
        const startSeason = seasons.some(s => s.season_number === Number(options.season))
            ? Number(options.season)
            : seasons[0].season_number;

        container.innerHTML = `
            <div class="episodes">
                <div class="episodes-header">
                    <h3>Episodes</h3>
                    ${seasons.length > 1 ? `
                        <select class="season-select" aria-label="Season">
                            ${seasons.map(s => `<option value="${s.season_number}" ${s.season_number === startSeason ? 'selected' : ''}>
                                ${esc(s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`)}
                            </option>`).join('')}
                        </select>` : `<span class="season-single">${esc(seasons[0].season_number === 0 ? 'Specials' : `Season ${seasons[0].season_number}`)}</span>`}
                </div>
                <div class="episode-count"></div>
                <ol class="episode-list"></ol>
            </div>
        `;

        const list = container.querySelector('.episode-list');
        const count = container.querySelector('.episode-count');
        const select = container.querySelector('.season-select');
        if (select) select.addEventListener('change', () => loadSeason(Number(select.value)));

        async function loadSeason(season) {
            list.innerHTML = '<li class="episode episode-skeleton"></li>'.repeat(3);
            count.textContent = '';
            try {
                const data = await fetchSeason(options.tvId, season);
                if (select && Number(select.value) !== season) return; // user switched again meanwhile
                const progress = getProgress(options.tvId);
                list.innerHTML = '';
                const episodes = data.episodes || [];
                count.textContent = episodes.length ? `${episodes.length} episode${episodes.length === 1 ? '' : 's'}` : '';
                episodes.forEach(ep => list.appendChild(episodeItem(ep, season, progress)));
                if (!list.children.length) list.innerHTML = '<li class="episode-empty">No episodes listed yet.</li>';
            } catch (e) {
                console.error('Error loading season', e);
                list.innerHTML = '<li class="episode-empty">Couldn’t load episodes. Try again in a moment.</li>';
            }
        }

        function episodeItem(ep, season, progress) {
            const aired = isAired(ep.air_date);
            const isCurrent = options.current && Number(options.current.season) === season && Number(options.current.episode) === ep.episode_number;
            const watched = isWatched(progress, season, ep.episode_number);
            const still = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '';

            const li = document.createElement('li');
            li.className = 'episode' + (isCurrent ? ' current' : '') + (aired ? '' : ' unaired');
            if (aired) {
                li.tabIndex = 0;
                li.setAttribute('role', 'button');
            }
            li.innerHTML = `
                <div class="episode-thumb">
                    ${still ? `<img src="${still}" alt="" loading="lazy">` : '<div class="episode-thumb-empty"></div>'}
                    ${aired ? '<span class="episode-play" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg></span>' : ''}
                    ${isCurrent ? `<span class="episode-flag">${esc(options.currentLabel || 'Up next')}</span>`
                    : watched ? '<span class="episode-flag watched">✓ Watched</span>' : ''}
                </div>
                <div class="episode-info">
                    <div class="episode-title-row">
                        <h4><span class="episode-number">${ep.episode_number}.</span> ${esc(ep.name || `Episode ${ep.episode_number}`)}</h4>
                        ${ep.runtime ? `<span class="episode-runtime">${ep.runtime}m</span>` : ''}
                    </div>
                    ${ep.overview ? `<p class="episode-overview">${esc(ep.overview)}</p>` : ''}
                    <div class="episode-date">${aired ? formatDate(ep.air_date) : ep.air_date ? `Coming ${formatDate(ep.air_date)}` : 'Air date not announced'}</div>
                </div>
            `;
            if (aired) {
                const select = () => options.onSelect(season, ep.episode_number);
                li.addEventListener('click', select);
                li.addEventListener('keydown', e => {
                    if (e.key === 'Enter') select();
                });
            }
            return li;
        }

        loadSeason(startSeason);
    }

    return { getProgress, saveProgress, playerUrl, fetchSeason, sortSeasons, resumePoint, nextEpisode, render };
})();
