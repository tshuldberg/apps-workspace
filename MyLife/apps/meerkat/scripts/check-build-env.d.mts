export interface BuildEnvCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  skipped: boolean;
}

export function checkBuildEnv(
  env: Record<string, string | undefined>,
): BuildEnvCheckResult;
