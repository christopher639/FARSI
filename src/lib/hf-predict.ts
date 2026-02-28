/**
 * HuggingFace Space Crime Classification — client utility
 * ========================================================
 * Calls the Gradio 6.x queue-based REST API on the deployed
 * Space to get crime-type predictions from the fastai model.
 *
 * Gradio 6.x two-step protocol:
 *   1. POST /gradio_api/call/predict  → { event_id }
 *   2. GET  /gradio_api/call/predict/{event_id} → SSE stream with result
 *
 * Mirrors the same API used in the Kaggle notebook:
 *   client.predict(latitude, longitude, month_str, falls_within, location, context, api_name="/predict")
 *
 * Environment variables (set in .env):
 *   VITE_HF_SPACE_URL  – base URL of the HF Space  (required)
 *   VITE_HF_TOKEN      – Bearer token for private Spaces (optional)
 */

// ─── Config ──────────────────────────────────────────────────────────
const HF_SPACE_URL = (
  import.meta.env.VITE_HF_SPACE_URL || "https://otiya-crime-classification.hf.space"
).replace(/\/+$/, "");

const HF_TOKEN: string | undefined = import.meta.env.VITE_HF_TOKEN;

// Gradio 6.x uses /gradio_api prefix (returned by /config)
const API_PREFIX = "/gradio_api";

// ─── Types ──────────────────────────────────────────────────────────
export type HfPredictionInput = {
  latitude: number;
  longitude: number;
  month?: string;
  falls_within?: string;
  location?: string;
  context?: string;
};

export type HfPredictionResult = {
  predicted_crime_type: string;
  confidence: number;
  probabilities: Record<string, number>;
};

// ─── Helpers ────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (HF_TOKEN) h["Authorization"] = `Bearer ${HF_TOKEN}`;
  return h;
}

/**
 * Parse the SSE stream returned by Gradio's GET /call/predict/{event_id}.
 * The stream contains lines like:
 *   event: complete
 *   data: ["Shoplifting","20.96%",{…}]
 *
 * We look for the "complete" event and parse its data line.
 */
function parseGradioSSE(raw: string): unknown[] {
  const lines = raw.split("\n");
  let foundComplete = false;

  for (const line of lines) {
    if (line.startsWith("event: complete")) {
      foundComplete = true;
      continue;
    }
    if (foundComplete && line.startsWith("data: ")) {
      const jsonStr = line.slice(6); // strip "data: "
      return JSON.parse(jsonStr);
    }
  }

  // Check for error event
  for (const line of lines) {
    if (line.startsWith("event: error")) {
      const nextDataLine = lines[lines.indexOf(line) + 1];
      const errMsg = nextDataLine?.startsWith("data: ")
        ? nextDataLine.slice(6)
        : "Unknown Gradio error";
      throw new Error(`Gradio error: ${errMsg}`);
    }
  }

  throw new Error("No 'complete' event found in Gradio SSE response");
}

// ─── Core prediction call ───────────────────────────────────────────

/**
 * Call the HuggingFace Space Gradio queue-based API for a single
 * crime record.  Uses the two-step protocol:
 *   1. POST /gradio_api/call/predict → event_id
 *   2. GET  /gradio_api/call/predict/{event_id} → SSE result
 */
export async function predictCrimeType(
  input: HfPredictionInput,
): Promise<HfPredictionResult> {
  const payload = {
    data: [
      input.latitude,
      input.longitude,
      input.month ?? new Date().toISOString().slice(0, 7),
      input.falls_within ?? "Unknown",
      input.location ?? "Unknown",
      input.context ?? "",
    ],
  };

  // ── Step 1: Submit to queue ────────────────────────────────────
  const submitRes = await fetch(
    `${HF_SPACE_URL}${API_PREFIX}/call/predict`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
  );

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`HF Space submit error ${submitRes.status}: ${text}`);
  }

  const { event_id } = (await submitRes.json()) as { event_id: string };
  if (!event_id) {
    throw new Error("HF Space did not return an event_id");
  }

  // ── Step 2: Fetch result via SSE ──────────────────────────────
  const resultRes = await fetch(
    `${HF_SPACE_URL}${API_PREFIX}/call/predict/${event_id}`,
    {
      method: "GET",
      headers: authHeaders(),
    },
  );

  if (!resultRes.ok) {
    const text = await resultRes.text();
    throw new Error(`HF Space result error ${resultRes.status}: ${text}`);
  }

  const sseText = await resultRes.text();
  const data = parseGradioSSE(sseText);

  // Gradio returns [crime_type, confidence_str, probabilities_dict]
  if (!Array.isArray(data) || data.length < 3) {
    throw new Error("Unexpected HF prediction response format");
  }

  const predicted_crime_type = String(data[0]);

  // Confidence comes as string like "20.96%" or a number
  let confidence: number;
  if (typeof data[1] === "string") {
    confidence = parseFloat(data[1].replace("%", "")) / 100;
  } else {
    confidence = Number(data[1]);
  }

  // Probabilities: dict object or JSON string
  let probabilities: Record<string, number>;
  if (typeof data[2] === "string") {
    try {
      probabilities = JSON.parse(data[2].replace(/'/g, '"'));
    } catch {
      probabilities = {};
    }
  } else if (typeof data[2] === "object" && data[2] !== null) {
    probabilities = data[2] as Record<string, number>;
  } else {
    probabilities = {};
  }

  return { predicted_crime_type, confidence, probabilities };
}

// ─── Batch prediction with throttle ─────────────────────────────────

/**
 * Predict crime types for a batch of inputs with concurrency control.
 * Mirrors the Kaggle notebook's loop-based batch prediction.
 */
export async function predictBatch(
  inputs: HfPredictionInput[],
  concurrency = 3,
  onProgress?: (completed: number, total: number) => void,
): Promise<HfPredictionResult[]> {
  const results: HfPredictionResult[] = new Array(inputs.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < inputs.length) {
      const i = nextIdx++;
      try {
        results[i] = await predictCrimeType(inputs[i]);
      } catch {
        results[i] = {
          predicted_crime_type: "Error",
          confidence: 0,
          probabilities: {},
        };
      }
      onProgress?.(Object.values(results).filter(Boolean).length, inputs.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, inputs.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
