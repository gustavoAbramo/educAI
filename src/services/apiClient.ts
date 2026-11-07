import type { ApiErrorResponse } from "@/types/api";

const configuredBaseUrl = import.meta.env.VITE_EDUCAI_API_BASE_URL?.trim();
const baseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, "") : "/api/v1";

export class ApiClientError extends Error {
    status: number;
    code: string;
    details?: unknown;
    path?: string;

    constructor(
        message: string,
        options: { status: number; code: string; details?: unknown; path?: string },
    ) {
        super(message);
        this.name = "ApiClientError";
        this.status = options.status;
        this.code = options.code;
        this.details = options.details;
        this.path = options.path;
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
        const headers = new Headers(init.headers);
        const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

        if (!isFormData && !headers.has("content-type")) {
            headers.set("content-type", "application/json");
        }

        const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers,
        });

        const raw = await response.text();
        const payload = raw ? JSON.parse(raw) : undefined;

        if (!response.ok) {
            const errorPayload = payload as ApiErrorResponse | undefined;
            if (errorPayload?.error) {
                throw new ApiClientError(errorPayload.error.message, {
                    status: response.status,
                    code: errorPayload.error.code,
                    details: errorPayload.error.details,
                    path: errorPayload.error.path,
                });
            }

            throw new ApiClientError("API local indisponível. Inicie com npm run dev:api.", {
                status: response.status,
                code: "API_UNAVAILABLE",
                path,
            });
        }

        return payload as T;
    } catch (error) {
        if (error instanceof ApiClientError) {
            throw error;
        }

        throw new ApiClientError("API local indisponível. Inicie com npm run dev:api.", {
            status: 0,
            code: "API_UNAVAILABLE",
            path,
            details: error instanceof Error ? error.message : String(error),
        });
    }
}

export const apiClient = {
    get<T>(path: string) {
        return request<T>(path, { method: "GET" });
    },
    postJson<T>(path: string, body: unknown) {
        return request<T>(path, { method: "POST", body: JSON.stringify(body) });
    },
    postForm<T>(path: string, body: FormData) {
        return request<T>(path, { method: "POST", body });
    },
    patchJson<T>(path: string, body: unknown) {
        return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
    },
    delete<T>(path: string) {
        return request<T>(path, { method: "DELETE" });
    },
    deleteJson<T>(path: string, body: unknown) {
        return request<T>(path, { method: "DELETE", body: JSON.stringify(body) });
    },
};

export { baseUrl };
