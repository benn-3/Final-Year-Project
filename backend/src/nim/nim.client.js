require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.NIM_API_KEY,
  baseURL: process.env.NIM_BASE_URL,
});

/**
 * Strip markdown code fences that some models add despite being told not to.
 * e.g. ```json\n{...}\n``` → {...}
 */
function stripFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * Stream a completion from NVIDIA NIM, collecting only the content field.
 * reasoning_content (thinking traces) is intentionally discarded.
 */
async function streamNIM(messages, options = {}) {
  const {
    temperature = 0.35,
    max_tokens = 4096,
  } = options;

  const stream = await openai.chat.completions.create({
    model: process.env.NIM_MODEL_NAME,
    messages,
    temperature,
    top_p: 0.95,
    max_tokens,
    chat_template_kwargs: { enable_thinking: true },
    stream: true,
  });

  let content = '';
  for await (const chunk of stream) {
    // delta.reasoning_content = thinking trace → ignore
    // delta.content = actual response → collect
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) content += delta;
  }
  return content;
}

/**
 * Core NIM call helper. Streams response, validates JSON against Zod schema,
 * retries once on failure, throws on second failure so callers can mark jobs failed.
 *
 * @param {{ systemPrompt: string, userPrompt: string, schema: import('zod').ZodType, options?: object }} params
 * @returns {Promise<object>} Validated parsed response
 */
async function callNIM({ systemPrompt, userPrompt, schema, options = {} }) {
  const baseMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let raw;
  try {
    raw = await streamNIM(baseMessages, options);
    const cleaned = stripFences(raw);
    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  } catch (firstErr) {
    console.warn('[NIM] First attempt failed, retrying once:', firstErr.message);
    // Retry once with a corrective message
    try {
      const retryMessages = [
        ...baseMessages,
        { role: 'assistant', content: raw || '' },
        {
          role: 'user',
          content:
            'Your last response was not valid JSON matching the required schema. ' +
            'Return ONLY valid JSON — no prose, no markdown fences, no explanations. ' +
            'Do not wrap JSON in code blocks. Try again.',
        },
      ];
      raw = await streamNIM(retryMessages, options);
      const cleaned = stripFences(raw);
      const parsed = JSON.parse(cleaned);
      return schema.parse(parsed);
    } catch (retryErr) {
      throw new Error(
        `NIM validation failed after retry: ${retryErr.message}. Raw: ${String(raw).slice(0, 200)}`
      );
    }
  }
}

module.exports = { callNIM };
