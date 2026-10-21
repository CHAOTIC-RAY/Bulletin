import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicUrl } from "../src/lib/safeFetchPublicUrl";

test("accepts ordinary public HTTPS feed URLs", () => {
  const url = validatePublicUrl("https://example.com/rss.xml");
  assert.equal(url.hostname, "example.com");
  assert.equal(url.protocol, "https:");
});

test("rejects non-HTTP protocols", () => {
  assert.throws(() => validatePublicUrl("file:///etc/passwd"), /HTTP\(S\)/);
});

test("rejects localhost and local suffixes", () => {
  assert.throws(() => validatePublicUrl("http://localhost/feed"), /Private, local/);
  assert.throws(() => validatePublicUrl("http://router.local/feed"), /Private, local/);
  assert.throws(() => validatePublicUrl("http://service.internal/feed"), /Private, local/);
});

test("rejects literal IP addresses and credentialed URLs", () => {
  assert.throws(() => validatePublicUrl("http://127.0.0.1/feed"), /Private, local/);
  assert.throws(() => validatePublicUrl("http://192.168.1.10/feed"), /Private, local/);
  assert.throws(() => validatePublicUrl("https://user:pass@example.com/feed"), /credentials/);
});
