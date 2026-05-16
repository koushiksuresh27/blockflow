// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string | undefined;
  createdAt: string;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  status?: number;
}
