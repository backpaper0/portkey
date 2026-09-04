import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { classifyHost, type HostClassification } from "./identifier.ts";
import { renderConsolePage } from "./console.ts";

export interface ProxyServerOptions {
  port: number;
  connectTimeoutMs: number;
}

export function createProxyServer(options: ProxyServerOptions): http.Server {
  const agent = new ConnectTimeoutAgent(options.connectTimeoutMs);

  const server = http.createServer((req, res) => {
    handleRequest(req, res, options, agent);
  });
  server.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head, options);
  });
  return server;
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ProxyServerOptions,
  agent: http.Agent,
): void {
  const classification = classifyHost(req.headers.host ?? "");
  logAccess(req, classification);

  switch (classification.kind) {
    case "console":
      respondConsole(res, options.port);
      return;
    case "invalid":
      respondBadRequest(res);
      return;
    case "upstream":
      proxyRequest(req, res, classification, agent);
      return;
  }
}

function respondConsole(res: http.ServerResponse, gatewayPort: number): void {
  const body = renderConsolePage(gatewayPort);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function respondBadRequest(res: http.ServerResponse): void {
  res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
  res.end("不正なアップストリーム識別子です");
}

function respondBadGateway(res: http.ServerResponse, identifier: string): void {
  res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
  res.end(`Bad Gateway: ${identifier} is not reachable`);
}

function identifierOf(classification: {
  hostname: string;
  port: number;
}): string {
  return `${classification.hostname}~${classification.port}`;
}

class ConnectTimeoutAgent extends http.Agent {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super({ keepAlive: false });
    this.timeoutMs = timeoutMs;
  }

  override createConnection(options: net.NetConnectOpts): net.Socket {
    const socket = net.connect(options);
    const timer = setTimeout(() => {
      socket.destroy(new Error("connect timeout"));
    }, this.timeoutMs);
    socket.once("connect", () => clearTimeout(timer));
    socket.once("close", () => clearTimeout(timer));
    return socket;
  }
}

function proxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  classification: { hostname: string; port: number },
  agent: http.Agent,
): void {
  const identifier = identifierOf(classification);

  const proxyReq = http.request(
    {
      host: classification.hostname,
      port: classification.port,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: `${classification.hostname}:${classification.port}`,
      },
      agent,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      respondBadGateway(res, identifier);
    } else {
      res.destroy();
    }
  });

  req.pipe(proxyReq);
}

function handleUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  options: ProxyServerOptions,
): void {
  const classification = classifyHost(req.headers.host ?? "");
  logAccess(req, classification);

  if (classification.kind === "invalid") {
    writeBadRequestAndDestroy(socket);
    return;
  }
  if (classification.kind === "console") {
    socket.destroy();
    return;
  }

  const identifier = identifierOf(classification);
  const upstreamSocket = net.connect({
    host: classification.hostname,
    port: classification.port,
  });

  const timer = setTimeout(() => {
    upstreamSocket.destroy(new Error("connect timeout"));
  }, options.connectTimeoutMs);

  let connected = false;
  const teardown = (): void => {
    clearTimeout(timer);
    socket.destroy();
    upstreamSocket.destroy();
  };
  socket.once("close", teardown);
  socket.once("error", teardown);
  socket.once("end", teardown);

  upstreamSocket.once("connect", () => {
    connected = true;
    clearTimeout(timer);

    const headerLines: string[] = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i] as string;
      const value =
        key.toLowerCase() === "host"
          ? `${classification.hostname}:${classification.port}`
          : (req.rawHeaders[i + 1] as string);
      headerLines.push(`${key}: ${value}`);
    }

    upstreamSocket.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join("\r\n")}\r\n\r\n`,
    );
    if (head.length > 0) {
      upstreamSocket.write(head);
    }

    upstreamSocket.once("close", teardown);
    upstreamSocket.once("end", teardown);

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstreamSocket.once("error", () => {
    clearTimeout(timer);
    if (connected) {
      teardown();
    } else {
      writeBadGatewayAndDestroy(socket, identifier);
    }
  });
}

function writeBadRequestAndDestroy(socket: Duplex): void {
  const body = "不正なアップストリーム識別子です";
  socket.end(
    `HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
  );
}

function writeBadGatewayAndDestroy(socket: Duplex, identifier: string): void {
  const body = `Bad Gateway: ${identifier} is not reachable`;
  socket.end(
    `HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
  );
}

function logAccess(
  req: http.IncomingMessage,
  classification: HostClassification,
): void {
  const target =
    classification.kind === "upstream"
      ? identifierOf(classification)
      : classification.kind;
  console.log(`${req.method} ${req.headers.host ?? ""}${req.url} -> ${target}`);
}
