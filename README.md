# Kite

Free AI chat and coding, right in your browser.

- **Kite Chat**: chat with the best free AI models. Markdown, code highlighting, live "thinking", image input, conversation history, edit and retry.
- **Kite Code**: describe a website, web app or game and watch it get built live. Keep chatting to change anything, step through versions, preview on desktop, tablet and phone, then download it as one HTML file.

Kite runs on **free** models. You connect a free provider once and pick models from the menu next to the send button.

## Start in 2 minutes

1. Open the app (see below). A welcome screen shows up.
2. Click **Open Google AI Studio**, sign in, click **Create API key**, copy it. No credit card.
3. Paste it into Kite and click **Connect and start**.

### Ways to open it

- **Local server (most reliable):** run `python3 -m http.server 8000` in this folder, then open http://localhost:8000
- **Free hosting on GitHub Pages:** repo **Settings > Pages > Deploy from a branch**, pick the branch and `/ (root)`. You get a public link. Everyone who uses it brings their own free key.

## Models

| Provider | Cost | What you get |
| --- | --- | --- |
| Google Gemini | Free key | Default and strongest. Pro, Flash and Flash-Lite tiers show up automatically. Pro may need billing on some accounts. |
| OpenRouter | Free key | Dozens of free open models (DeepSeek, Qwen, Llama and more). Only free ones are listed. |
| Groq | Free key | Very fast open models. |
| Local | Free, private | Ollama or LM Studio on your own computer. Start Ollama with `OLLAMA_ORIGINS="*" OLLAMA_CONTEXT_LENGTH=32768 ollama serve` |

Connect any of them in **Settings > Models**. Kite reads each provider's live model list, so new models show up without an update. If Google retires a model you're using, Kite switches to the closest current one by itself.

**Privacy:** keys, chats and projects live only in your browser. On Google's free tier, Google may use what you send to improve its products, so don't paste anything private.

## Rename it

Change `name` in [`js/config.js`](js/config.js). Every screen, prompt and title uses it.

## Prompts

[`js/prompts.js`](js/prompts.js) holds the instructions for Chat and for Code. The Code prompt is what makes the sites look designed instead of generic. Keep its "How to reply" section, because the app reads that format.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page skeleton |
| `css/app.css` | The whole design system, light and dark |
| `js/config.js` | App name and providers |
| `js/prompts.js` | System prompts |
| `js/ai.js` | Providers, model catalog, streaming, retries |
| `js/store.js` | Saving chats, projects and settings |
| `js/ui.js` | Icons, markdown, composer, model picker, dialogs |
| `js/chat.js` | Kite Chat |
| `js/code.js` | Kite Code |
| `js/app.js` | Sidebar, routing, settings, onboarding |
| `vendor/`, `fonts/` | Bundled libraries and fonts (see `vendor/LICENSES.md`) |

No build step, no server, no dependencies to install.

## Honest limits

- Everything runs in the browser with your own key. That's great for you and friends. To sell it as a product you'd need a backend that holds one key and handles accounts, and then you pay for everyone's AI usage.
- Browser storage is about 5 MB. Big Code projects with many versions fill it up; export or delete old stuff in **Settings > Data**.
- Free models are good but not as strong as the best paid ones on hard problems.
- Kite Code builds single-file sites. No real database, logins or payments without plugging in a service.
