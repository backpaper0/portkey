import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "./config.ts";

test("フラグも環境変数もなければ既定値を使う", () => {
  const config = resolveConfig([], {});
  assert.equal(config.port, 1541);
  assert.equal(config.connectTimeoutMs, 5000);
});

test("PORTKEY_PORT 環境変数で既定値を上書きできる", () => {
  const config = resolveConfig([], { PORTKEY_PORT: "3000" });
  assert.equal(config.port, 3000);
});

test("--port フラグは環境変数より優先される", () => {
  const config = resolveConfig(["--port", "4000"], { PORTKEY_PORT: "3000" });
  assert.equal(config.port, 4000);
});

test("--port=4000 の内包形式もサポートする", () => {
  const config = resolveConfig(["--port=4000"], {});
  assert.equal(config.port, 4000);
});

test("PORTKEY_CONNECT_TIMEOUT は秒単位で解釈されミリ秒に変換される", () => {
  const config = resolveConfig([], { PORTKEY_CONNECT_TIMEOUT: "10" });
  assert.equal(config.connectTimeoutMs, 10000);
});

test("--connect-timeout フラグは環境変数より優先される", () => {
  const config = resolveConfig(["--connect-timeout", "1"], {
    PORTKEY_CONNECT_TIMEOUT: "10",
  });
  assert.equal(config.connectTimeoutMs, 1000);
});

test("--connect-timeout=1 の内包形式もサポートする", () => {
  const config = resolveConfig(["--connect-timeout=1"], {});
  assert.equal(config.connectTimeoutMs, 1000);
});

test("数値でない --port は既定値にフォールバックする", () => {
  const config = resolveConfig(["--port=abc"], {});
  assert.equal(config.port, 1541);
});

test("範囲外の --port (0, 65536) は既定値にフォールバックする", () => {
  assert.equal(resolveConfig(["--port=0"], {}).port, 1541);
  assert.equal(resolveConfig(["--port=65536"], {}).port, 1541);
});

test("範囲外の PORTKEY_PORT は既定値にフォールバックする", () => {
  const config = resolveConfig([], { PORTKEY_PORT: "99999999" });
  assert.equal(config.port, 1541);
});

test("数値でない --connect-timeout は既定値にフォールバックする", () => {
  const config = resolveConfig(["--connect-timeout=xx"], {});
  assert.equal(config.connectTimeoutMs, 5000);
});

test("0以下の --connect-timeout は既定値にフォールバックする", () => {
  const config = resolveConfig(["--connect-timeout=0"], {});
  assert.equal(config.connectTimeoutMs, 5000);
});
