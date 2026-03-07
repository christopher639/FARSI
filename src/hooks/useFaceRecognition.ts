import { useState, useCallback } from "react";
import { apiPostForm, apiGet } from "@/lib/api";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────
export type FaceBbox = { x1: number; y1: number; x2: number; y2: number };

export type SuspectMatch = {
  suspect_id: string;
  name: string;
  confidence: number;
  match_pct: string;
  dob?: string;
  nationality?: string;
  id_number?: string;
  charges?: string;
  status?: string;
  risk_level?: string;
  last_seen?: string;
  case_number?: string;
  officer_id?: string;
  det_score?: number;
  age?: number | null;
  gender?: string | null;
};

export type FaceMatch = {
  face_id: number;
  bbox: FaceBbox;
  det_score: number;
  age: number | null;
  gender: string | null;
  suspects: SuspectMatch[];
};

export type FaceSearchResult = {
  faces_detected: number;
  matches: FaceMatch[];
  model_info: {
    index_size: number;
    embedding_dim: number;
    threshold: number;
    arcface_model: string;
  };
};

export type SuspectRecord = {
  suspect_id: string;
  name: string;
  charges?: string;
  status?: string;
  risk_level?: string;
  last_seen?: string;
  case_number?: string;
};

export type FaceModelStatus = {
  loaded: boolean;
  index_vectors: number;
  metadata_entries: number;
  models_dir: string;
  manifest: Record<string, unknown>;
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFaceRecognition() {
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<FaceSearchResult | null>(null);
  const [suspects, setSuspects] = useState<SuspectRecord[]>([]);
  const [modelStatus, setModelStatus] = useState<FaceModelStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchFaces = useCallback(
    async (
      imageFile: File,
      options?: { similarity_threshold?: number; top_k?: number; stream_id?: string }
    ) => {
      setSearching(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("image", imageFile);
        if (options?.similarity_threshold != null)
          formData.append("similarity_threshold", String(options.similarity_threshold));
        if (options?.top_k != null) formData.append("top_k", String(options.top_k));
        if (options?.stream_id) formData.append("stream_id", options.stream_id);

        const data = await apiPostForm<FaceSearchResult>("/inference/face-search", formData);
        setResult(data);
        return data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Face search failed";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const detectFaces = useCallback(async (imageFile: File) => {
    setDetecting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const data = await apiPostForm<{ faces_detected: number; faces: FaceMatch[] }>(
        "/inference/face-detect",
        formData
      );
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Face detection failed";
      setError(message);
      return null;
    } finally {
      setDetecting(false);
    }
  }, []);

  const fetchSuspects = useCallback(async () => {
    try {
      const data = await apiGet<{ suspects: SuspectRecord[] }>("/inference/face-search/suspects");
      setSuspects(data.suspects || []);
      return data.suspects;
    } catch {
      return [];
    }
  }, []);

  const fetchModelStatus = useCallback(async () => {
    try {
      const data = await apiGet<FaceModelStatus>("/inference/face-search/status");
      setModelStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  return {
    // State
    searching,
    detecting,
    result,
    suspects,
    modelStatus,
    error,
    // Actions
    searchFaces,
    detectFaces,
    fetchSuspects,
    fetchModelStatus,
    clearResult: () => setResult(null),
  };
}
