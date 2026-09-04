#!/usr/bin/env node
import { resolveConfig } from "./config.ts";
import { createProxyServer } from "./proxy.ts";

const config = resolveConfig(process.argv.slice(2), process.env);
const server = createProxyServer(config);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`portkey listening on 0.0.0.0:${config.port}`);
});
