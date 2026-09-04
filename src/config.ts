export interface PortkeyConfig {
  port: number;
  connectTimeoutMs: number;
}

const DEFAULT_PORT = 1541;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 5;

const MIN_PORT = 1;
const MAX_PORT = 65535;

export function resolveConfig(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): PortkeyConfig {
  const flags = parseFlags(argv);

  const port =
    validPort(flags.port) ?? validPort(envNumber(env.PORTKEY_PORT)) ?? DEFAULT_PORT;
  const connectTimeoutSeconds =
    validPositive(flags.connectTimeout) ??
    validPositive(envNumber(env.PORTKEY_CONNECT_TIMEOUT)) ??
    DEFAULT_CONNECT_TIMEOUT_SECONDS;

  return { port, connectTimeoutMs: connectTimeoutSeconds * 1000 };
}

interface Flags {
  port?: number;
  connectTimeout?: number;
}

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    const [name, inlineValue] = splitFlag(arg);
    if (name === "--port") {
      flags.port = Number(inlineValue ?? argv[++i]);
    } else if (name === "--connect-timeout") {
      flags.connectTimeout = Number(inlineValue ?? argv[++i]);
    }
  }
  return flags;
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf("=");
  if (arg.startsWith("--") && eq !== -1) {
    return [arg.slice(0, eq), arg.slice(eq + 1)];
  }
  return [arg, undefined];
}

function envNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function validPort(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isInteger(value)) {
    return undefined;
  }
  return value >= MIN_PORT && value <= MAX_PORT ? value : undefined;
}

function validPositive(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return value > 0 ? value : undefined;
}
