// Long Term Memory: A plain english log that contains the user's journey through the app and their interactionos with the chatflix agent.
// We plan to make this user viewable and user editable in the future, so each entry should be concise, self-contained, and semantically meaningful. Long term memory entries should be in the english language.
const TRUNCATE_AFTER = 40 // Only retrieve 40 long term memory entries by default (first 40 or last 40 depending on reverse param)
const MAX_SINGLE_MEMORY_SIZE = 2048 //about 512 tokens... in case the summarizer goes haywire
const addLongTermMemory = (memory) => {
    const memories = localStorage.getItem("longTermMemory")
    var response = []

    if (memories) {
        response = JSON.parse(memories)
    }

    // Inject a timestamp into the memory before saving. Memory should remain a plaintext string.
    memory = `${new Date().toLocaleString()}: ${memory}`
    if (memory.length > MAX_SINGLE_MEMORY_SIZE) {
        console.log("Item exceeded MAX_SINGLE_MEMORY_SIZE cap. Content was truncated.")
        memory = memory.slice(0, MAX_SINGLE_MEMORY_SIZE)
    }
    response.push(memory)
    localStorage.setItem("longTermMemory", JSON.stringify(response))

    console.log("Added to long term memory:", memory)
    console.log("Long term memory count:", getLongTermMemoryCount())
}

// Returns an array of memories or a string of memories joined by double newlines
const getLongTermMemories = (reverse = false, responseFormat = "array") => {
    const memories = localStorage.getItem("longTermMemory")
    var response = []

    //get most recent memories up to TRUNCATE_AFTER cap, then set the order based on reverse param
    if (memories) {
        const allMemories = JSON.parse(memories).reverse()
        const truncatedMemories = allMemories.slice(0, TRUNCATE_AFTER)
        if (!reverse) {
            response = truncatedMemories.reverse()
        } else {
            response = truncatedMemories
        }

        if (allMemories.length > TRUNCATE_AFTER) {
            console.log("Long term memory count exceeded TRUNCATE_AFTER cap. Some memories were truncated.")
        }

        return responseFormat === "array" ? response : response.join("\n\n")

    } else {
        return responseFormat === "array" ? [] : ""
    }
}

// Clears the long term memory
const clearLongTermMemory = () => {
    localStorage.removeItem("longTermMemory")
}

// Returns the number of memories in the long term memory
const getLongTermMemoryCount = () => {
    const memories = localStorage.getItem("longTermMemory")
    return memories ? JSON.parse(memories).length : 0
}

// Overwrite the long term memory with a new array... The only reason to use this is if we let the user selectively edit the memory, and frankly its not worth it, this is a movie app not an AGI
const setLongTermMemory = (memories) => {
    localStorage.setItem("longTermMemory", JSON.stringify(memories))
}


// Set the current userContext or applicationContext for a chatflix chat widget
// One day, there will be a hilarious hack involving movie posters, but we really don't care because the stakes are very low

const injectContext = (message = { type: "userContext", payload: "hamster!" }, targetSelector = "#chat-iframe") => {
    if (!window.AppConfig || !window.AppConfig.aiChatEnabled) return
    $(targetSelector)[0].contentWindow.postMessage(message)
    console.log("Posted message to chat: ", message)
}
