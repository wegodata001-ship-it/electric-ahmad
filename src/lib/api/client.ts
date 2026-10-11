async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "שגיאת שרת");
  }

  return json.data as T;
}

export const apiClient = {
  get<T>(url: string) {
    return request<T>(url);
  },

  post<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  upload<T>(url: string, formData: FormData, timeoutMs = 0) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer =
      controller && timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    return fetch(url, {
      method: "POST",
      body: formData,
      cache: "no-store",
      signal: controller?.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "שגיאת העלאה");
        return json.data as T;
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("העלאת הקובץ ארכה יותר מדי. נסו שוב.");
        }
        throw error;
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  },
};
