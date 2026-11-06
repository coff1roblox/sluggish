# Sluggish

An AI website builder that runs in your browser. Describe a website (or paste a screenshot of one you like), watch it get built live, then keep chatting to change anything. When you're happy, download it as a single HTML file.

It runs on **free** AI models. The default is Google Gemini's free tier.

## Start in 2 minutes

1. **Get a free Gemini API key:** go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in with Google and click **Create API key**. No credit card.
2. **Open the app** (see below). Settings opens by itself the first time.
3. Paste the key, click **Check key & load models**, then **Save**.
4. Type what you want, for example: *"a landing page for a padel club with court booking and pricing"*.

### Ways to open it

- **Local server (most reliable):** run `python3 -m http.server 8000` in this folder, then open http://localhost:8000
- **Double-click `index.html`:** usually works. If requests fail, use the local server instead.
- **Free hosting on GitHub Pages:** repo **Settings > Pages > Deploy from a branch > `main` / root**. You get a public link. Everyone who uses it pastes their own key.

## What it does

- Live preview that fills in while the AI is still writing
- Desktop, tablet and phone preview sizes
- Screenshot to website: attach, paste or drag in an image
- Edit by chatting, with full version history (undo and redo)
- Edit the code by hand and the preview updates as you type
- Download, copy or open the site in a new tab
- One-click quick edits: "make it more premium", "perfect on mobile", etc.
- Also builds small web apps and games
- Works on phones
- Your chats and versions are saved in your browser

## Free AI providers

| Provider | Cost | Notes |
| --- | --- | --- |
| Google Gemini | Free tier | Default and the strongest free option. Flash models are free, have a big output limit and understand images. Pro models may need billing. |
| OpenRouter | Free models | Lots of open models. Only `:free` models are listed. Small daily request limit. |
| Groq | Free tier | Very fast open models. Per-minute limits. |
| Local (Ollama, LM Studio) | Free and private | Runs on your own computer. For Ollama: `OLLAMA_ORIGINS="*" OLLAMA_CONTEXT_LENGTH=32768 ollama serve` |

Free tiers change all the time. If a model stops working, open Settings and click **Check key & load models**. If Google retires the saved Gemini model, Sluggish switches to the best available Flash model by itself.

**Privacy:** on Google's free tier, Google may use what you send to improve its products. Don't paste anything private.

## The prompt

The instructions that make the AI build good-looking, working websites are in [`prompt.js`](prompt.js). Edit that file to change the design rules, the default tech (Tailwind CSS), or the tone of the replies. Keep the "How to reply" section, because the app reads that format.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page layout |
| `styles.css` | The app's look |
| `app.js` | Everything else: chat, AI providers, streaming, preview, versions, settings |
| `prompt.js` | The website-building prompt |

No build step, no dependencies, no server code.

## Honest limits

- Your API key lives in your browser. That's fine for you and your friends. To sell this as a product, you'd need a small backend so users don't bring their own key, and then you pay for the AI usage.
- Free models are good but not as strong as the best paid ones on big, complex sites.
- Generated sites are single static HTML files: no real database, logins or payments without adding a service.
