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

  delete<T>(url: string) {
    return request<T>(url, { method: "DELETE" });
  },

  upload<T>(url: string, formData: FormData) {
    return fetch(url, { method: "POST", body: formData, cache: "no-store" }).then(
      async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "שגיאת העלאה");
        return json.data as T;
      }
    );
  },
};
