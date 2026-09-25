import { expect, test } from "bun:test";
import { getProxiedImageUrl } from "./config";

test("proxies Cloudflare R2 public images through API", () => {
  const url = "https://pub-example.r2.dev/catalog-panels/220S/image.png";
  const proxied = getProxiedImageUrl(url);

  expect(proxied).toContain("/api/proxy/image?");
  expect(proxied).toContain(encodeURIComponent(url));
});

test("keeps local previews and non-R2 images unchanged", () => {
  expect(getProxiedImageUrl("blob:http://localhost/preview")).toBe("blob:http://localhost/preview");
  expect(getProxiedImageUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
});
