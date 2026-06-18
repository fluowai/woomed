import fs from "fs";
import path from "path";

const DOCKER_SECRETS_DIR = "/run/secrets";

function readDockerSecret(name: string): string | null {
  try {
    const secretPath = path.join(DOCKER_SECRETS_DIR, name);
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, "utf-8").trim();
    }
  } catch {
    // silent
  }
  return null;
}

function readFileSecret(name: string): string | null {
  const envPath = process.env[`${name}_FILE`];
  if (envPath) {
    try {
      return fs.readFileSync(envPath, "utf-8").trim();
    } catch {
      console.warn(`[SECRETS] Could not read secret file: ${envPath}`);
    }
  }
  return null;
}

export function getSecret(name: string): string | null {
  const dockerSecret = readDockerSecret(name);
  if (dockerSecret) return dockerSecret;

  const fileSecret = readFileSecret(name);
  if (fileSecret) return fileSecret;

  return process.env[name] || null;
}

export function requireSecret(name: string): string {
  const value = getSecret(name);
  if (!value) {
    throw new Error(
      `ERRO CRÍTICO: Secret "${name}" não encontrado. ` +
      `Defina via:\n` +
      `  1. Variável de ambiente: ${name}\n` +
      `  2. Arquivo: ${DOCKER_SECRETS_DIR}/${name} (Docker secrets)\n` +
      `  3. Arquivo customizado via ${name}_FILE`
    );
  }
  return value;
}
