
const fs = require('fs');
const path = require('path');

// Configuration
const TMDB_API_KEY = "829a43a98259bc44cae297489c7e3bba"; // From onboarding.html
const OPENAI_API_KEY = "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"; // From user rules
const OPENAI_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "x-ai/grok-4-fast";

const BASE_URL = "https://api.themoviedb.org/3";
const OUTPUT_FILE = path.join(__dirname, '../browser/onboarding_data.json');

async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Error: ${res.status} ${res.statusText}`);
    return res.json();
}

async function getGenres() {
    console.log("Fetching genres...");
    const [movieGenres, tvGenres] = await Promise.all([
        fetchTMDB('/genre/movie/list'),
        fetchTMDB('/genre/tv/list')
    ]);

    const allGenres = [...movieGenres.genres];
    tvGenres.genres.forEach(g => {
        if (!allGenres.find(ag => ag.id === g.id)) {
            allGenres.push(g);
        }
    });
    return allGenres;
}

async function callLLM(prompt) {
    console.log("Calling LLM...");
    const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: "system", content: "You are a helpful movie and TV expert assistant. Output JSON only." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`LLM Error: ${response.status} ${txt}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

async function searchTMDB(query, type) {
    // type: 'movie', 'tv', 'person'
    const res = await fetchTMDB(`/search/${type}`, { query: query });
    if (res.results && res.results.length > 0) {
        return res.results[0]; // Take the first result
    }
    return null;
}

async function main() {
    try {
        // 1. Get Genres
        const genres = await getGenres();

        // 2. Get Lists from LLM
        const prompt = `
        I am building an onboarding wizard for a streaming app to determine a user's tastes.
        Please generate lists of 40 items for each of the following categories:
        1. "movies": Popular movies from the last 5 years, along with some classics.
        2. "series": Popular TV series from the last 5 years, along with some classics.
        3. "actors": Popular actors from the last 5 years, along with some classics.

        Return a JSON object with keys "movies", "series", and "actors". Each should be an array of strings (names/titles).
        Example:
        {
            "movies": ["The Godfather", "Inception", ...],
            "series": ["Breaking Bad", "Friends", ...],
            "actors": ["Robert De Niro", "Leonardo DiCaprio", ...]
        }
        `;

        const llmData = await callLLM(prompt);
        console.log("LLM Data received.");

        // 3. Enrich Data
        const enrichedData = {
            genres: genres,
            movies: [],
            series: [],
            actors: []
        };

        console.log("Enriching Movies...");
        for (const title of llmData.movies) {
            const item = await searchTMDB(title, 'movie');
            if (item) {
                enrichedData.movies.push({
                    id: item.id,
                    title: item.title,
                    poster_path: item.poster_path,
                    backdrop_path: item.backdrop_path,
                    release_date: item.release_date,
                    vote_average: item.vote_average
                });
            }
        }

        console.log("Enriching Series...");
        for (const title of llmData.series) {
            const item = await searchTMDB(title, 'tv');
            if (item) {
                enrichedData.series.push({
                    id: item.id,
                    name: item.name,
                    poster_path: item.poster_path,
                    backdrop_path: item.backdrop_path,
                    first_air_date: item.first_air_date,
                    vote_average: item.vote_average
                });
            }
        }

        console.log("Enriching Actors...");
        for (const name of llmData.actors) {
            const item = await searchTMDB(name, 'person');
            if (item) {
                enrichedData.actors.push({
                    id: item.id,
                    name: item.name,
                    profile_path: item.profile_path
                });
            }
        }

        // 4. Save to file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedData, null, 2));
        console.log(`Success! Data written to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
