"use client";

import { useEffect } from "react";
import { CSRF_COOKIE_NAME } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCookieValue(name: string): string | null {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

function resolveFetchUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) {
      return new URL(input.url);
    }

    return new URL(input.toString(), window.location.origin);
  } catch {
    return null;
  }
}

function shouldAttachCsrf(input: RequestInfo | URL): boolean {
  const url = resolveFetchUrl(input);
  if (!url || !url.pathname.startsWith("/api/")) {
    return false;
  }

  const apiOrigin = new URL(getApiBaseUrl()).origin;
  return url.origin === window.location.origin || url.origin === apiOrigin;
}

export function CsrfFetchPatch() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (!MUTATING_METHODS.has(method) || !shouldAttachCsrf(input)) {
        return nativeFetch(input, init);
      }

      const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
      if (!csrfToken) {
        return nativeFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has("X-CSRF-Token")) {
        headers.set("X-CSRF-Token", csrfToken);
      }

      return nativeFetch(input, {
        ...init,
        headers,
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return null;
}
