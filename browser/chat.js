const OPENAI_API_KEY = "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";
const TMDB_API_KEY = "829a43a98259bc44cae297489c7e3bba"; // Copied from app.js
const BASE_URL = "https://api.themoviedb.org/3";

const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

const MAX_TURNS_PER_CONVERSATION = 10; // Configurable limit
let turnCount = 0;

// Fetch genres map for mapping IDs to names
let genres = {};
async function fetchGenres() {
    try {
        const response = await fetch(`${BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`);
        const data = await response.json();
        data.genres.forEach(g => genres[g.id] = g.name);

        // Also fetch TV genres
        const tvResponse = await fetch(`${BASE_URL}/genre/tv/list?api_key=${TMDB_API_KEY}`);
        const tvData = await tvResponse.json();
        tvData.genres.forEach(g => genres[g.id] = g.name);
    } catch (error) {
        console.error('Error fetching genres:', error);
    }
}
fetchGenres();

let conversationHistory = [
    {
        role: "system",
        content: `You are the Chatflix streaming media concierge. Your goal is to help users find content and provide them with a rich, interactive experience.

When you find a movie or TV show for the user, you MUST display it using the specific "Feed Item" HTML format below. Do NOT just list the name.

### Feed Item HTML Format
You must output the following HTML structure for EACH movie or show you recommend. Replace the placeholders (UPPERCASE) with actual values from the 'search_content' tool.

\`\`\`html
<div class="chat-feed-item">
    <div class="chat-media-card" onclick="window.parent.playContent('TMDB_ID', 'TYPE')">
        <img src="https://image.tmdb.org/t/p/w500POSTER_PATH" alt="TITLE" class="chat-card-poster">
        <div class="chat-card-actions">
            <button class="chat-btn-icon-small" onclick="event.stopPropagation(); window.parent.openInfoModal('TMDB_ID', 'TYPE')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </button>
        </div>
    </div>
    <div class="chat-caption">
        <div class="chat-title">TITLE (YEAR)</div>
        <p class="chat-description">BRIEF_DESCRIPTION_OR_COMMENTARY</p>
    </div>
</div>
\`\`\`

### Instructions
1. **Search**: Always use the 'search_content' tool to find the content details.
2. **Format**: Return your response as a "feed" of these items.
   - You can stack multiple items.
   - The \`chat-description\` is optional. Use it to provide the TMDB overview (shortened if needed) OR your own commentary (e.g., "This is a classic."). If you have nothing to add, you can omit the <p> tag.
3. **Links**: The tile handles the clicking.
4. **Style**: Keep it clean. Do not add extra markdown bolding around the title since the HTML handles styling.
`
    }
];

// Tool Definitions
const tools = [
    {
        type: "function",
        function: {
            name: "search_content",
            description: "Search for a movie or TV show to get all details needed for the content tile (ID, poster, rating, year, etc.).",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The name of the movie or TV show to search for."
                    },
                    type: {
                        type: "string",
                        enum: ["movie", "tv"],
                        description: "The type of content (movie or tv). Defaults to movie if unsure."
                    }
                },
                required: ["query"]
            }
        }
    }
];

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
newChatBtn.addEventListener('click', startNewChat);

function startNewChat() {
    // If history is empty (just system message), do nothing
    if (conversationHistory.length <= 1) return;

    // Reset history
    conversationHistory = [conversationHistory[0]]; // Keep system message

    // Clear UI
    messagesContainer.innerHTML = '';

    // Reset turns
    turnCount = 0;

    // Enable input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = "Ask for a movie...";

    // Add greeting
    appendMessage('assistant', "Hello! I'm your Chatflix concierge. I can help you find movies and TV shows to watch. What are you in the mood for?");
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Check max turns
    if (turnCount >= MAX_TURNS_PER_CONVERSATION) {
        return; // Should be disabled, but just in case
    }

    // Add user message
    appendMessage('user', text);
    chatInput.value = '';
    chatInput.disabled = true;
    sendBtn.disabled = true;

    conversationHistory.push({ role: "user", content: text });

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        await processChat();
    } catch (error) {
        console.error("Chat Error:", error);
        appendMessage('system', "Sorry, something went wrong. Please try again.");
    } finally {
        removeTypingIndicator(typingId);
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }
}

async function processChat() {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o", // Upgraded to 4o for better instruction following with HTML
            messages: conversationHistory,
            tools: tools,
            tool_choice: "auto"
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    const message = data.choices[0].message;

    if (message.tool_calls) {
        // Handle tool calls
        conversationHistory.push(message); // Add the assistant's tool call request to history

        for (const toolCall of message.tool_calls) {
            if (toolCall.function.name === 'search_content') {
                const args = JSON.parse(toolCall.function.arguments);
                const result = await searchContent(args.query, args.type);

                conversationHistory.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                });
            }
        }

        // Call API again with tool results
        await processChat();
    } else {
        // Final response
        conversationHistory.push(message);
        appendMessage('assistant', message.content);

        // Increment turn count (1 turn = user message + assistant response)
        turnCount++;

        // Check limit
        if (turnCount >= MAX_TURNS_PER_CONVERSATION) {
            chatInput.disabled = true;
            sendBtn.disabled = true;
            chatInput.placeholder = "Max length reached.";
            appendMessage('system', "Max length reached, click + to start a new chat");
        }
    }
}

async function searchContent(query, type = 'movie') {
    try {
        // 1. Search TMDB
        const searchRes = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        const searchData = await searchRes.json();

        // Filter for movie or tv
        const results = searchData.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');

        if (results.length === 0) {
            return { error: "No results found." };
        }

        // Prefer exact match or the requested type
        let bestMatch = results.find(r => r.media_type === type) || results[0];

        // 2. Get External IDs (IMDB ID) - Optional now since we use TMDB ID for playContent, but good to have
        // const detailsRes = await fetch(`${BASE_URL}/${bestMatch.media_type}/${bestMatch.id}/external_ids?api_key=${TMDB_API_KEY}`);
        // const detailsData = await detailsRes.json();

        return {
            id: bestMatch.id, // TMDB ID
            title: bestMatch.title || bestMatch.name,
            year: (bestMatch.release_date || bestMatch.first_air_date || '').split('-')[0],
            type: bestMatch.media_type,
            poster_path: bestMatch.poster_path,
            vote_average: bestMatch.vote_average ? bestMatch.vote_average.toFixed(1) : 'N/A',
            overview: bestMatch.overview
        };
    } catch (e) {
        console.error("Search Tool Error:", e);
        return { error: "Failed to search content." };
    }
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    // Simple Markdown parsing
    let html = text
        // Remove code block markers that might wrap HTML
        .replace(/```html/g, '')
        .replace(/```/g, '')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Links [text](url) -> <a href="url" target="_top">text</a>
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_top">$1</a>')
        // Newlines
        .replace(/\n/g, '<br>');

    div.innerHTML = html;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message assistant typing-indicator';
    div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
