import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHost } from "./identifier.ts";

test("厳密に 'localhost' に一致するホストはコンソールとして分類される", () => {
  assert.deepEqual(classifyHost("localhost"), { kind: "console" });
});

test("末尾のゲートウェイポート表記は剥がされてから分類される(コンソール)", () => {
  assert.deepEqual(classifyHost("localhost:1541"), { kind: "console" });
});

test("有効な識別子はアップストリームとして分類される", () => {
  assert.deepEqual(classifyHost("web~3000.localhost"), {
    kind: "upstream",
    hostname: "web",
    port: 3000,
  });
});

test("末尾のゲートウェイポート表記は剥がされてから分類される(アップストリーム)", () => {
  assert.deepEqual(classifyHost("web~3000.localhost:1541"), {
    kind: "upstream",
    hostname: "web",
    port: 3000,
  });
});

test("ホスト名部分は小文字化される", () => {
  assert.deepEqual(classifyHost("WEB~3000.localhost"), {
    kind: "upstream",
    hostname: "web",
    port: 3000,
  });
});

test("先頭ゼロ付きのポートは不正", () => {
  assert.deepEqual(classifyHost("web~03000.localhost"), { kind: "invalid" });
});

test("範囲外のポート(0, 65536)は不正", () => {
  assert.deepEqual(classifyHost("web~0.localhost"), { kind: "invalid" });
  assert.deepEqual(classifyHost("web~65536.localhost"), { kind: "invalid" });
});

test("セパレータ '~' が2回以上出現する識別子は不正", () => {
  assert.deepEqual(classifyHost("web~30~00.localhost"), { kind: "invalid" });
});

test("セパレータ '~' が出現しない識別子は不正", () => {
  assert.deepEqual(classifyHost("web3000.localhost"), { kind: "invalid" });
});

test("ラベルの先頭がハイフンのホスト名は不正", () => {
  assert.deepEqual(classifyHost("-web~3000.localhost"), { kind: "invalid" });
});

test("ラベルの末尾がハイフンのホスト名は不正", () => {
  assert.deepEqual(classifyHost("web-~3000.localhost"), { kind: "invalid" });
});

test("'.localhost' で終わらないホストは不正", () => {
  assert.deepEqual(classifyHost("web~3000.example.com"), { kind: "invalid" });
});

test("'localhost' サフィックス部分は大文字小文字を区別しない(コンソール)", () => {
  assert.deepEqual(classifyHost("LOCALHOST"), { kind: "console" });
});

test("'.localhost' サフィックス部分は大文字小文字を区別しない(アップストリーム)", () => {
  assert.deepEqual(classifyHost("web~3000.LOCALHOST"), {
    kind: "upstream",
    hostname: "web",
    port: 3000,
  });
});

test("63文字を超えるホスト名ラベルは不正", () => {
  const label = "a".repeat(64);
  assert.deepEqual(classifyHost(`${label}~3000.localhost`), { kind: "invalid" });
});

test("63文字のホスト名ラベルは許可される", () => {
  const label = "a".repeat(63);
  assert.deepEqual(classifyHost(`${label}~3000.localhost`), {
    kind: "upstream",
    hostname: label,
    port: 3000,
  });
});

test("ドット区切りの複数ラベルを持つホスト名も許可される", () => {
  assert.deepEqual(classifyHost("my-app.internal~8080.localhost"), {
    kind: "upstream",
    hostname: "my-app.internal",
    port: 8080,
  });
});
