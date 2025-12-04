export default async (req, context) => {
    // Only allow POST requests
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const OPENROUTER_API_KEY = "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";
    const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

    try {
        // Forward the request to OpenRouter
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                // Pass through any other relevant headers if needed, but usually just Auth and Content-Type are enough for this proxy
                // We might want to pass the referer or origin for OpenRouter analytics if they support it, but keeping it simple for now.
                "HTTP-Referer": "https://vlix.ai", // Optional: for OpenRouter rankings
                "Referer": "https://vlix.ai", // Optional: for OpenRouter rankings
                "HTTP-Origin": "https://vlix.ai", // Optional: for OpenRouter rankings
                "Origin": "https://vlix.ai", // Optional: for OpenRouter rankings

                "X-Title": "Vlix.AI Streaming Media Concierge", // Optional: for OpenRouter rankings
            },
            body: await req.text(), // Forward the body exactly as received
        });

        // Get the response body
        const data = await response.text();

        // Return the response to the client
        return new Response(data, {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Allow CORS for the web client
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
        });
    } catch (error) {
        console.error("Error proxying request:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
};
