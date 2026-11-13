/** Send a JSON body to a same-origin route handler. */
export function sendJson(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The response body as JSON, or an empty object when it isn't any. */
export function readJsonOrEmpty<T extends object = { error?: string }>(
  res: Response,
): Promise<Partial<T>> {
  return res.json().catch(() => ({}));
}
