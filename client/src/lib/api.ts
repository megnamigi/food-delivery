export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    const refreshed = await fetch("/api/auth/refresh", {
      credentials: "include",
    });
    if (refreshed.ok) return api<T>(path, options, false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.message || "Something went wrong. Please try again.",
      response.status,
    );
  return data as T;
}
export const dollars = (amount: number) => `$${amount.toFixed(2)}`;
