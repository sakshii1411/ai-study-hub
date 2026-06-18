/**
 * aiClient.ts
 * Primary: Groq (llama models - free tier, very fast)
 * Fallback 1: OpenRouter (many models)
 * Fallback 2: NVIDIA NIM API
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY ?? "";
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY ?? "";
const NVIDIA_API_KEY = import.meta.env.VITE_NVIDIA_API_KEY ?? "";

async function callGroq(userPrompt: string, systemPrompt?: string, temperature = 0.7, maxTokens = 3000): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("No Groq API key configured.");
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });
  const groqModels = ["llama-3.3-70b-versatile","llama-3.1-70b-versatile","llama-3.1-8b-instant","mixtral-8x7b-32768"];
  for (const model of groqModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      });
      if (!res.ok) { const body = await res.text(); if (res.status === 429) continue; throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 300)}`); }
      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from Groq.");
      return content;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("rate")) continue;
      throw err;
    }
  }
  throw new Error("All Groq models rate-limited. Please try again in a minute.");
}

async function callOpenRouter(userPrompt: string, systemPrompt?: string, temperature = 0.7, maxTokens = 3000): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("No OpenRouter API key configured.");
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });
  const models = ["meta-llama/llama-3.3-70b-instruct","meta-llama/llama-3.1-70b-instruct","google/gemma-2-9b-it:free","mistralai/mistral-7b-instruct:free"];
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}`, "HTTP-Referer": window.location.origin, "X-Title": "AI Study Planner" },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      });
      if (!res.ok) { const body = await res.text(); if (res.status === 429 || res.status === 402) continue; throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 300)}`); }
      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from OpenRouter.");
      return content;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("402") || msg.includes("rate")) continue;
      throw err;
    }
  }
  throw new Error("All OpenRouter models failed.");
}

async function callNvidia(userPrompt: string, systemPrompt?: string, temperature = 0.7, maxTokens = 3000): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA API key configured.");
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({ model: "meta/llama-3.3-70b-instruct", messages, temperature, max_tokens: maxTokens, stream: false }),
  });
  if (!res.ok) { const errText = await res.text(); throw new Error(`NVIDIA HTTP ${res.status}: ${errText.slice(0, 300)}`); }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from NVIDIA.");
  return content;
}

export async function callAI(userPrompt: string, systemPrompt?: string, temperature = 0.7, maxTokens = 3000): Promise<string> {
  const errors: string[] = [];
  if (GROQ_API_KEY) { try { return await callGroq(userPrompt, systemPrompt, temperature, maxTokens); } catch (err: unknown) { errors.push(`[groq] ${err instanceof Error ? err.message : String(err)}`); } }
  if (OPENROUTER_API_KEY) { try { return await callOpenRouter(userPrompt, systemPrompt, temperature, maxTokens); } catch (err: unknown) { errors.push(`[openrouter] ${err instanceof Error ? err.message : String(err)}`); } }
  if (NVIDIA_API_KEY) { try { return await callNvidia(userPrompt, systemPrompt, temperature, maxTokens); } catch (err: unknown) { errors.push(`[nvidia] ${err instanceof Error ? err.message : String(err)}`); } }
  throw new Error(`All AI providers failed. Details:\n${errors.join("\n")}\n\nPlease check your API keys in the .env file.`);
}

/** Streaming version — calls onChunk with each new token, returns full text */
export async function callAIStream(
  userPrompt: string,
  onChunk: (chunk: string) => void,
  systemPrompt?: string,
  temperature = 0.7,
  maxTokens = 3000
): Promise<string> {
  if (!GROQ_API_KEY) return callAI(userPrompt, systemPrompt, temperature, maxTokens);
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });
  const groqModels = ["llama-3.3-70b-versatile","llama-3.1-70b-versatile","llama-3.1-8b-instant"];
  for (const model of groqModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
      });
      if (!res.ok || !res.body) { if (res.status === 429) continue; throw new Error(`Groq HTTP ${res.status}`); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: ") && l !== "data: [DONE]");
        for (const line of lines) {
          try {
            const delta = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content;
            if (delta) { full += delta; onChunk(delta); }
          } catch { /* skip malformed chunks */ }
        }
      }
      return full;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("rate")) continue;
      throw err;
    }
  }
  // Fall back to non-streaming if all groq models rate-limited
  return callAI(userPrompt, systemPrompt, temperature, maxTokens);
}

export async function callAIJson<T = unknown>(userPrompt: string, systemPrompt?: string): Promise<T> {
  const raw = await callAI(userPrompt, systemPrompt ?? "You are a helpful AI. Respond with VALID JSON only. No markdown, no backticks, no explanation outside the JSON.", 0.3, 3000);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{"); const firstBracket = cleaned.indexOf("[");
  const lastBrace = cleaned.lastIndexOf("}"); const lastBracket = cleaned.lastIndexOf("]");
  let jsonStr = cleaned;
  if (firstBracket !== -1 && lastBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) { jsonStr = cleaned.slice(firstBracket, lastBracket + 1); }
  else if (firstBrace !== -1 && lastBrace !== -1) { jsonStr = cleaned.slice(firstBrace, lastBrace + 1); }
  return JSON.parse(jsonStr) as T;
}
