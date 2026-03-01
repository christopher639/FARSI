export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export type HeatmapPoint = {
  lat: number;
  lon: number;
  weight: number;
  severity: string;
  area_name?: string | null;
  crime_desc?: string | null;
  date?: string | null;
  hour?: number | null;
};

export type HeatmapQuery = {
  startDate?: string;
  endDate?: string;
  startHour?: number;
  endHour?: number;
  severities?: string[];
  crime?: string;
  limit?: number;
  seed?: number;
};

function buildQuery(params?: HeatmapQuery) {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.startDate) search.set("start_date", params.startDate);
  if (params.endDate) search.set("end_date", params.endDate);
  if (params.startHour !== undefined) search.set("start_hour", String(params.startHour));
  if (params.endHour !== undefined) search.set("end_hour", String(params.endHour));
  if (params.severities && params.severities.length) {
    search.set("severities", params.severities.join(","));
  }
  if (params.crime) search.set("crime", params.crime);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.seed !== undefined) search.set("seed", String(params.seed));
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function getHealth() {
  return request<{ status: string }>("/health");
}

export function trainMl() {
  return request<{ message: string; model_path: string; report: string }>("/ml/train", {
    method: "POST"
  });
}

export function predictMl(record: Record<string, unknown>) {
  return request<{ prediction: number }>("/ml/predict", {
    method: "POST",
    body: JSON.stringify({ record })
  });
}

export function getHeatmap(params?: HeatmapQuery) {
  return request<{ rows: Array<Record<string, unknown>> }>(`/ml/heatmap${buildQuery(params)}`);
}

export function getHeatmapPoints(params?: HeatmapQuery) {
  return request<{ points: HeatmapPoint[] }>(`/ml/heatmap/points${buildQuery(params)}`);
}

export function trainNlp() {
  return request<{ message: string; model_path: string; report: string }>("/nlp/train", {
    method: "POST"
  });
}

export function classifyText(text: string) {
  return request<{ prediction: number }>("/nlp/classify", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export function extractEntities(text: string) {
  return request<{ emails: string[]; phones: string[]; ids: string[]; plates: string[] }>(
    "/nlp/entities",
    {
      method: "POST",
      body: JSON.stringify({ text })
    }
  );
}

export function detectMotion(video_path: string, min_area: number) {
  return request<{ events: Array<{ frame_index: number; motion_score: number; bbox: number[] }> }>(
    "/cv/motion",
    {
      method: "POST",
      body: JSON.stringify({ video_path, min_area })
    }
  );
}

export function getSimulatedAlerts() {
  return request<{ message: string; data: Array<Record<string, unknown>> }>("/simulate/alerts");
}

export type UcfTrainRequest = {
  dataset_path?: string | null;
  dataset_id?: string;
  label_mode?: "binary" | "multiclass";
  epochs?: number;
  batch_size?: number;
  lr?: number;
  num_frames?: number;
  size?: number;
  max_videos?: number | null;
  seed?: number;
  val_split?: number;
  freeze_backbone?: boolean;
};

export type UcfTrainResponse = {
  message: string;
  model_path: string;
  labels_path: string;
  label_mode: string;
  samples_used: number;
  train_accuracy: number;
  val_accuracy: number;
  report: string;
};

export type UcfPredictResponse = {
  prediction: string;
  confidence: number;
  probs: Record<string, number>;
  model_path: string;
  label_mode: string;
};

export function trainUcf(payload: UcfTrainRequest) {
  return request<UcfTrainResponse>("/cv/ucf/train", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function predictUcf(payload: {
  video_path: string;
  label_mode?: "binary" | "multiclass";
  num_frames?: number;
  size?: number;
}) {
  return request<UcfPredictResponse>("/cv/ucf/predict", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function predictUcfUpload(file: File, params?: {
  label_mode?: "binary" | "multiclass";
  num_frames?: number;
  size?: number;
}) {
  const form = new FormData();
  form.append("file", file);
  if (params?.label_mode) form.append("label_mode", params.label_mode);
  if (params?.num_frames !== undefined) form.append("num_frames", String(params.num_frames));
  if (params?.size !== undefined) form.append("size", String(params.size));

  const res = await fetch(`${API_URL}/cv/ucf/predict/upload`, {
    method: "POST",
    body: form
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as UcfPredictResponse;
}
