/*
  App configuration.
  Change the name here and it changes everywhere in the app.
*/
window.S = window.S || {};

S.config = {
  name: 'Kite',
  chatName: 'Chat',
  codeName: 'Code',
  tagline: 'Free AI chat and coding, right in your browser.',
};

/*
  AI providers. Every one of these has a free option.
  kind "gemini" uses Google's API format, kind "openai" uses the OpenAI-compatible format.
*/
S.PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    recommended: true,
    blurb: 'The strongest free option. Free API key, no credit card. Flash models are free; Pro models may need billing on some accounts.',
    keySteps: 'Sign in at Google AI Studio, click "Create API key", copy it and paste it here.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    freeOnly: true,
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'Dozens of free open models (DeepSeek, Qwen, Llama and more). Only free models are shown. Small daily limit.',
    keySteps: 'Create a free account at OpenRouter, open Keys, create a key and paste it here.',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
    blurb: 'Open models that answer extremely fast. Free tier with per-minute limits.',
    keySteps: 'Create a free account at GroqCloud, open API Keys, create a key and paste it here.',
  },
  local: {
    id: 'local',
    name: 'Local model',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    blurb: 'Run models on your own computer with Ollama or LM Studio. Free and private.',
    keySteps: 'Start Ollama with OLLAMA_ORIGINS="*" OLLAMA_CONTEXT_LENGTH=32768 ollama serve, then click Connect.',
  },
};
