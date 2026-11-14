export type ApiObject = Record<string, unknown>;

export function isApiObject(value: unknown): value is ApiObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readApiObject(response: Response): Promise<ApiObject> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The server returned an unreadable response (${response.status}).`);
  }

  if (!isApiObject(payload)) {
    throw new Error("The server returned an invalid response.");
  }

  return payload;
}

export function getApiError(payload: ApiObject, fallback: string): string {
  return typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
}

export function getApiArray<T>(payload: ApiObject, key: string): T[] {
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}
