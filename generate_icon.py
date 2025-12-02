import base64
import mimetypes
import os
from google import genai
from google.genai import types

# Set the API key
os.environ["GEMINI_API_KEY"] = "AIzaSyDoi83gghx1NJtfsCphv5GWEMddBtjjztU"

def save_binary_file(file_name, data):
    f = open(file_name, "wb")
    f.write(data)
    f.close()
    print(f"File saved to to: {file_name}")

def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-3-pro-image-preview"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="A sparkling neuralmind agentic assistant chat icon. Futuristic, glowing, brain-like neural network structure, vibrant colors (neon blue, purple, pink), sparkles, solid black background. High quality, icon style. No text."),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_modalities=[
            "IMAGE",
        ],
        image_config=types.ImageConfig(
            image_size="1K",
        ),
    )

    print("Generating image...")
    # The example code iterates over a stream
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if (
            chunk.candidates is None
            or chunk.candidates[0].content is None
            or chunk.candidates[0].content.parts is None
        ):
            continue
        
        for part in chunk.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                file_name = "browser/chat_icon_sparkling"
                inline_data = part.inline_data
                data_buffer = inline_data.data
                
                # Determine extension
                ext = ".png"
                if inline_data.mime_type == "image/jpeg":
                    ext = ".jpg"
                elif inline_data.mime_type == "image/webp":
                    ext = ".webp"
                
                save_binary_file(f"{file_name}{ext}", data_buffer)
            else:
                pass # Text content if any

if __name__ == "__main__":
    generate()
