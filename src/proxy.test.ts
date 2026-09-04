import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { createProxyServer } from "./proxy.ts";

interface Response {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(
  port: number,
  options: http.RequestOptions,
  body?: string,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, ...options },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

async function unusedPort(): Promise<number> {
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

function readOnce(socket: net.Socket): Promise<string> {
  return new Promise((resolve) => {
    socket.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
  });
}

test("サブドメインで指定したアップストリームへGETリクエストを転送する", async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`hello from upstream: ${req.method} ${req.url}`);
  });
  const upstreamPort = await listen(upstream);

  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const res = await request(portkeyPort, {
      method: "GET",
      path: "/hello",
      headers: { host: `localhost_${upstreamPort}.localhost` },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, "hello from upstream: GET /hello");
  } finally {
    portkey.close();
    upstream.close();
  }
});

test("Host が厳密に 'localhost' のときはコンソール画面を返す", async () => {
  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const res = await request(portkeyPort, {
      method: "GET",
      path: "/",
      headers: { host: "localhost" },
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] ?? "", /text\/html/);
    assert.match(res.body, /portkey/);
  } finally {
    portkey.close();
  }
});

test("不正なアップストリーム識別子には400を返す", async () => {
  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const res = await request(portkeyPort, {
      method: "GET",
      path: "/",
      headers: { host: "not-an-identifier.localhost" },
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.headers["content-type"] ?? "", /text\/plain/);
    assert.match(res.body, /不正なアップストリーム識別子です/);
  } finally {
    portkey.close();
  }
});

test("アップストリームに到達できない場合は502を返す", async () => {
  const deadPort = await unusedPort();
  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const res = await request(portkeyPort, {
      method: "GET",
      path: "/",
      headers: { host: `localhost_${deadPort}.localhost` },
    });
    assert.equal(res.statusCode, 502);
    assert.equal(
      res.body,
      `Bad Gateway: localhost_${deadPort} is not reachable`,
    );
  } finally {
    portkey.close();
  }
});

test("Upgrade リクエストをアップストリームへ透過的にプロキシする", { timeout: 3000 }, async () => {
  const upstream = http.createServer();
  upstream.on("upgrade", (_req, socket, _head) => {
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
    );
    socket.on("data", (chunk: Buffer) => socket.write(chunk));
    socket.on("end", () => socket.destroy());
  });
  const upstreamPort = await listen(upstream);

  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const client = net.connect(portkeyPort, "127.0.0.1");
    await new Promise<void>((resolve) => client.once("connect", () => resolve()));

    client.write(
      `GET / HTTP/1.1\r\nHost: localhost_${upstreamPort}.localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`,
    );
    const handshake = await readOnce(client);
    assert.match(handshake, /^HTTP\/1\.1 101 Switching Protocols/);

    client.write("ping");
    const echoed = await readOnce(client);
    assert.equal(echoed, "ping");

    client.destroy();
  } finally {
    portkey.close();
    upstream.close();
  }
});

test("Upgrade リクエストでもアップストリームに到達できない場合は502を返す", async () => {
  const deadPort = await unusedPort();
  const portkey = createProxyServer({ port: 0, connectTimeoutMs: 1000 });
  const portkeyPort = await listen(portkey);

  try {
    const client = net.connect(portkeyPort, "127.0.0.1");
    await new Promise<void>((resolve) => client.once("connect", () => resolve()));

    client.write(
      `GET / HTTP/1.1\r\nHost: localhost_${deadPort}.localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`,
    );
    const response = await readOnce(client);
    assert.match(response, /^HTTP\/1\.1 502 Bad Gateway/);
    assert.match(response, new RegExp(`localhost_${deadPort} is not reachable`));

    client.destroy();
  } finally {
    portkey.close();
  }
});
