"use client";

import { useEffect } from "react";
import { CSRF_COOKIE_NAME } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const pendingMutations = new Map<string, Promise<Response>>();

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

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = resolveFetchUrl(input);
  if (!url || !url.pathname.startsWith("/api/")) {
    return false;
  }

  const apiOrigin = new URL(getApiBaseUrl()).origin;
  return url.origin === window.location.origin || url.origin === apiOrigin;
}

function getBodySignature(body: BodyInit | null | undefined): string | null {
  if (body === undefined || body === null) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  return null;
}

function getMutationKey(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  method: string,
): string | null {
  const url = resolveFetchUrl(input);
  if (!url) {
    return null;
  }

  const bodySignature = getBodySignature(init?.body);
  if (bodySignature === null) {
    return null;
  }

  return [method, url.origin, url.pathname, url.search, bodySignature].join("|");
}

export function CsrfFetchPatch() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (
        init?.method ??
        (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (!MUTATING_METHODS.has(method) || !isApiRequest(input)) {
        return nativeFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
      if (csrfToken && !headers.has("X-CSRF-Token")) {
        headers.set("X-CSRF-Token", csrfToken);
      }

      const requestInit = {
        ...init,
        headers,
      };
      const mutationKey = getMutationKey(input, requestInit, method);
      if (!mutationKey) {
        return nativeFetch(input, requestInit);
      }

      const pending = pendingMutations.get(mutationKey);
      if (pending) {
        return pending.then((response) => response.clone());
      }

      const request = nativeFetch(input, requestInit);
      pendingMutations.set(mutationKey, request);
      request.then(
        () => {
          pendingMutations.delete(mutationKey);
        },
        () => {
          pendingMutations.delete(mutationKey);
        },
      );

      return request;
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return null;
}
