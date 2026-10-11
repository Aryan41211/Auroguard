import type { ApiClient } from "../api/client";

/** Shared props every dashboard view receives. */
export interface ViewProps {
  api: ApiClient;
  traineeId: string;
}
