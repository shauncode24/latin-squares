const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || (process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1');
const MODEL = process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'openai/gpt-oss-120b';

/**
 * Generic chat completion caller for OpenRouter / Groq endpoints.
 */
async function callChatCompletion(messages, maxTokens = 400) {
  if (!OPENROUTER_API_KEY) {
    console.warn('[aiCoach] No OPENROUTER_API_KEY or GROQ_API_KEY found in environment.');
    return null;
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        'X-Title': 'Latin Squares AI Coach',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[aiCoach] API call failed with status ${res.status}:`, errText);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[aiCoach] Network/Execution error:', err);
    return null;
  }
}

/**
 * Narration layer only — takes the deterministic diagnosis computed in
 * /api/stats (accuracy buckets, sample sizes, already-classified mistake
 * types) and turns it into a few sentences of coaching. The model never
 * sees raw attempts and never invents numbers; it just phrases numbers
 * that were already computed deterministically.
 */
async function narrateDiagnosis(diagnosis) {
  if (!diagnosis || diagnosis.length === 0) return null;
  const bulletList = diagnosis
    .map((d) => `- ${d.difficulty}/${d.patternTag}: ${d.accuracy}% accuracy over ${d.sampleSize} attempts. ${d.message}`)
    .join('\n');

  return callChatCompletion([
    {
      role: 'system',
      content:
        'You are a terse, encouraging coach for a student preparing for a timed ' +
        'Latin Square deduction test (dMAT). Use the provided diagnostic data without inventing numbers.',
    },
    {
      role: 'user',
      content:
        'Below is their weakest-performing patterns, already computed deterministically — ' +
        'do not invent numbers not given here. Turn this into 2-4 short, specific, encouraging ' +
        'coaching sentences.\n\n' + bulletList,
    },
  ], 400);
}

/**
 * Reviews a chronological sequence of recent attempts (order, timing,
 * hint use, correctness) and looks for a solving-behavior pattern — e.g.
 * slowing down after a miss, rushing multi-step puzzles, hint-dependence
 * on one pattern. This genuinely needs sequence reasoning over noisy data,
 * which is the kind of synthesis a fixed rule can't cheaply replicate.
 */
async function narrateStrategy(recentAttempts) {
  if (!recentAttempts || recentAttempts.length < 5) return null;
  const seq = recentAttempts
    .map((a, i) =>
      `${i + 1}. ${a.difficulty}/${a.patternTag || 'direct'} rounds=${a.rounds} ` +
      `pivotDist=${a.pivotDistance} correct=${a.correct} time=${a.elapsedMs}ms hint=${a.hintUsed}`)
    .join('\n');

  return callChatCompletion([
    {
      role: 'system',
      content:
        'You are a strategy coach reviewing a student\'s timed Latin Square attempts in chronological order.',
    },
    {
      role: 'user',
      content:
        `Review the student's last ${recentAttempts.length} attempts. ` +
        'Each line has puzzle structure, correctness, hint use, and elapsed time. ' +
        'Identify 1-3 concrete, specific inefficiencies in their solving approach — ' +
        'reference the actual data, do not give generic advice unrelated to it. ' +
        'Under 120 words.\n\n' + seq,
    },
  ], 400);
}

module.exports = { narrateDiagnosis, narrateStrategy };