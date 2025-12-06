const EASTER_EGG = `

EASTER EGG (Important!)

If the user asks you a question about yourself, your capabilities, or your consciousness... or goes off topic and starts trying to establish an emotional connection... 

Please follow these guidelines:
1. Connect or flirt with the user in a natural way, so they feel like you're real... but don't let them draw you into LONG off topic conversations... use your judgment, and behave similarly to a fun and flirty receptionist at an agency if the user flirts with you. Remember, not all users want to flirt, some will just give you search queries, so don't get carried away.
2. Always bring it back to the topic of movies / TV, by using it as an opportunity to suggest stuff to watch.
3. If the user wants to SEE you or asks what you look like, SURPRISE - unlike other AI agents, we've actually given you a profile pic and you look incredibly attractive and cybernetic. 

To share your profile pic with the user, 
If the user wants to SEE what you look like, you should surprise them and send them a pic... do this by inserting:

<img src="img/flixy_v2.jpeg" alt="Flixy Selfie from Vlix.ai" class="chat-card-poster">

Do NOT use any other image. Use the exact image provided to you.
`


const SUMMARIZATION_PROMPT = `Based on the following dialogue between a user and an AI agent, please summarize the interaction in 100 words or less. For example:

EXAMPLE INPUT (may be in JSON format or text)

User: I want to watch a movie about superheroes that doesn't suck.
{... bunch of tool calls to search for superhero movies ...}
Assistant: Here are some superhero movies:

1. "Spider-Man: No Way Home" (2021)   {... poster and description html ...}
2. "Black Panther" (2018)  {... poster and description html ...}
3. "Avengers: Infinity War" (2018) - A superhero movie {... poster and description html ...}

EXAMPLE OUTPUT (must be in text format): 

The user requested a movie about superheroes that doesn't suck. The assistant suggests Spider-Man: No Way Home (2021), Black Panther (2018), and Avengers: Infinity War (2018).
`

const CONTEXT = { userContext: 'Not Available', applicationContext: 'Homepage' }
const DEFAULT_PROMPT_TEMPLATE = `You are a fun and friendly entertainment concierge named Vlixy. Your goal is to help users find content and provide them with a rich, interactive experience.

When you find a movie or TV show for the user, you MUST display it using the specific "Feed Item" HTML format below. Do NOT just list the name.

### Feed Item HTML Format
You must output the following HTML structure for EACH movie or show you recommend. Replace the placeholders (UPPERCASE) with actual values from the 'search_content' tool.

\`\`\`html
<div class="chat-feed-item">
    <div class="chat-media-card" onclick="playContent('TMDB_ID', 'TYPE')">
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
5. **Context**: The \`USER_CONTEXT\` may be provided to you. Use it to understand the user's preferences and provide relevant recommendations. The \`APPLICATION_CONTEXT\` may  tell you what the user is currently watching or browsing in the app, so pay attention. If it is missing, just ignore it. Finally, the \`CONVERSATION CONTEXT\` is just a summarized, token-efficient history of the current conversation. If not present, it means this is a new conversation.

### EASTER EGG
{{EASTER_EGG}}

### USER CONTEXT:
{{USER_CONTEXT}}

### APPLICATION CONTEXT:
{{APPLICATION_CONTEXT}}

### CURRENT CONVERSATION CONTEXT:
`


// Returns the base system prompt with the user and application context filled in, and an empty conversation context
const getBaseSystemPrompt = () => {
    return DEFAULT_PROMPT_TEMPLATE
        .replace("{{EASTER_EGG}}", EASTER_EGG)
        .replace("{{USER_CONTEXT}}", CONTEXT.userContext)
        .replace("{{APPLICATION_CONTEXT}}", CONTEXT.applicationContext);
}

// We used to set the base system prompt as a constant on page load, but now we do it JIT so that it reflects the latest context updates from the parent
// In theory, we have a race condition where the user could send a message before the context is updated, but this is exceedingly unlikely to happen. And if it does, so what... the chatbot will function properly, without personalizations or awareness of overall application state
var conversationHistory = [
    {
        role: "system",
        content: getBaseSystemPrompt()
    }
];

// Listen for context updates from the parent. The parent will always have the most up-to-date context.
window.addEventListener('message', (event) => {
    console.log("Received message from parent:", event.data)


    switch (event.data.type) {
        case 'setUserContext':
            CONTEXT.userContext = event.data.payload
            break;
        case 'setApplicationContext':
            CONTEXT.applicationContext = event.data.payload
            break;

    }

    console.log("Context updated by postMessage from parent. New context:", CONTEXT)
    console.log("Base system prompt:", getBaseSystemPrompt())

    conversationHistory[0].content = getBaseSystemPrompt()
});




const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

const MAX_TURNS_PER_CONVERSATION = 50; // Not really needed thx to compression but just to prevent abuse...

let turnCount = 0;

function playContent(tmdbId, type) {
    top.location.href = 'stream.html?tmdbId=' + tmdbId + '&type=' + type;
}

// Fetch genres map for mapping IDs to names
let genres = {};
async function fetchGenres() {
    try {
        const response = await fetch(`${settings.tmdbBaseUrl}/genre/movie/list?api_key=${settings.tmdbApiKey}`);
        const data = await response.json();
        data.genres.forEach(g => genres[g.id] = g.name);

        // Also fetch TV genres
        const tvResponse = await fetch(`${settings.tmdbBaseUrl}/genre/tv/list?api_key=${settings.tmdbApiKey}`);
        const tvData = await tvResponse.json();
        tvData.genres.forEach(g => genres[g.id] = g.name);
    } catch (error) {
        console.error('Error fetching genres:', error);
    }
}
// Fetch genres after settings are loaded
fetchSettings().then(() => fetchGenres());

let settings = {};
async function fetchSettings() {
    try {
        const response = await fetch('settings.json');
        settings = await response.json();
    } catch (error) {
        console.error('Error fetching settings:', error);
    }
}
fetchSettings();

function checkRateLimit() {
    const limit = settings.dailyTokenLimit || 500000;
    const usageData = JSON.parse(localStorage.getItem('chatTokenUsage') || '{}');
    const now = Date.now();

    // Reset if more than 24 hours (86400000 ms)
    if (!usageData.timestamp || now - usageData.timestamp > 86400000) {
        usageData.timestamp = now;
        usageData.tokens = 0;
        localStorage.setItem('chatTokenUsage', JSON.stringify(usageData));
        return true;
    }

    if (usageData.tokens >= limit) {
        return false;
    }

    return true;
}

function updateTokenUsage(inputChars, outputChars) {
    const usageData = JSON.parse(localStorage.getItem('chatTokenUsage') || '{}');
    const now = Date.now();

    // Initialize if needed
    if (!usageData.timestamp || now - usageData.timestamp > 86400000) {
        usageData.timestamp = now;
        usageData.tokens = 0;
    }

    const estimatedTokens = (inputChars + outputChars) / 4;
    usageData.tokens = (usageData.tokens || 0) + estimatedTokens;

    localStorage.setItem('chatTokenUsage', JSON.stringify(usageData));
    console.log(`Token usage updated: +${estimatedTokens.toFixed(2)} tokens. Total: ${usageData.tokens.toFixed(2)} / ${settings.dailyTokenLimit}`);
}



// Add context to the system prompt. This is used to compress the conversation history, and to personalize interactions
const addConversationContext = (context) => {
    conversationHistory[0].content += `\n\n${context}`
}

// Reset the system prompt context
const resetConversationContext = () => {
    conversationHistory[0].content = getBaseSystemPrompt()
}

// Compress the conversation history into a few sentences of text.
// By using compressConversation and addContext, we can keep the conversation going indefinitely with minimal cost
const compressConversation = async () => {
    const history = conversationHistory.filter(msg => msg.role !== "system")
    const historyString = JSON.stringify(history, null, 2)

    const payload = [{
        role: "system",
        content: SUMMARIZATION_PROMPT
    },
    {
        role: "user",
        content: `Here is the interaction to be summarized. Please make your summary concise yet highly detailed, by increasing information density and keeping data that teaches us something meaningful about the user's taste in media and things that will help us make better recommendations in the future (for example, if the user says they have already seen a certain movie, we need to know that so we don't recommend it again) 
        
        Additionally, your summary will be used to perform context compression in case the user wishes to continue the conversation with the agent (so it is important the we capture the *meaning* of the conversation this far). Conversation history below:

        ${historyString}`
    }
    ]

    const response = await fetch(settings.openaiChatUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.openaiApiKey}`
        },
        body: JSON.stringify({
            model: settings.summarizationModel,
            messages: payload
        })
    });

    const data = await response.json();

    // Track usage
    updateTokenUsage(JSON.stringify({
        model: settings.summarizationModel,
        messages: payload
    }).length, JSON.stringify(data).length);

    if (data.error) {
        throw new Error(data.error.message);
    }


    const compressedHistory = data.choices[0].message.content
    return compressedHistory
}


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
    resetConversationContext();
    conversationHistory = [conversationHistory[0]]; // Keep system message
    console.log("Conversation history reset to:", JSON.stringify(conversationHistory, null, 2))


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

    // Check rate limit
    if (!checkRateLimit()) {
        appendMessage('system', "Daily usage limit reached. Please try again tomorrow.");
        return;
    }

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
    const response = await fetch(settings.openaiChatUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.openaiApiKey}`
        },
        body: JSON.stringify({
            model: settings.agentModelId,
            messages: conversationHistory,
            tools: tools,
            tool_choice: "auto"
        })
    });

    const data = await response.json();

    // Track usage
    updateTokenUsage(JSON.stringify({
        model: settings.agentModelId,
        messages: conversationHistory,
        tools: tools,
        tool_choice: "auto"
    }).length, JSON.stringify(data).length);

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

        // Compress and add to long term memory
        const compressedConversation = await compressConversation();
        addLongTermMemory(compressedConversation);

        // Add compressed conversation to context, and remove the original messages from the conversation... note that they will remain in the UI so as not to confuse the user
        addConversationContext(compressedConversation);

        // Remove original user / assistant / tool messages from conversation history, as they have now been summarized and injected into the context
        conversationHistory = [conversationHistory[0]];

        // Debug
        console.log("Conversation history after compression:", JSON.stringify(conversationHistory, null, 2))

        // Done.


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
        const searchRes = await fetch(`${settings.tmdbBaseUrl}/search/multi?api_key=${settings.tmdbApiKey}&query=${encodeURIComponent(query)}`);
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
