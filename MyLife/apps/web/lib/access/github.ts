interface GitHubConfig {
  apiBaseUrl: string;
  token: string;
  org: string;
  teamSlug: string;
}

export interface GitHubInviteInput {
  githubUsername?: string;
  email?: string;
}

export interface GitHubInviteResult {
  ok: boolean;
  status: 'granted' | 'invited' | 'already_present' | 'disabled' | 'failed';
  mode?: 'username' | 'email';
  detail?: string;
}

export interface GitHubRevokeInput {
  githubUsername?: string;
}

function getConfig(): GitHubConfig | null {
  const token = process.env.MYLIFE_GITHUB_TOKEN;
  const org = process.env.MYLIFE_GITHUB_ORG;
  const teamSlug = process.env.MYLIFE_GITHUB_SELF_HOST_TEAM_SLUG;

  if (!token || !org || !teamSlug) {
    return null;
  }

  return {
    apiBaseUrl: process.env.MYLIFE_GITHUB_API_URL ?? 'https://api.github.com',
    token,
    org,
    teamSlug,
  };
}

async function requestGitHub(
  config: GitHubConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'mylife-access-automation',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
}

function isAlreadyPresentMessage(text: string): boolean {
  const value = text.toLowerCase();
  return (
    value.includes('already has a pending invite')
    || value.includes('already a part of the org')
    || value.includes('already a member')
  );
}

async function getTeamId(config: GitHubConfig): Promise<number> {
  const response = await requestGitHub(
    config,
    `/orgs/${encodeURIComponent(config.org)}/teams/${encodeURIComponent(config.teamSlug)}`,
    { method: 'GET' },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load team metadata: HTTP ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { id?: unknown };
  if (typeof payload.id !== 'number') {
    throw new Error('GitHub team metadata response missing numeric id.');
  }

  return payload.id;
}

export async function grantGitHubSelfHostAccess(
  input: GitHubInviteInput,
): Promise<GitHubInviteResult> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      status: 'disabled',
      detail: 'GitHub automation env vars are not configured.',
    };
  }

  const githubUsername = input.githubUsername?.trim();
  const email = input.email?.trim().toLowerCase();

  if (githubUsername) {
    const response = await requestGitHub(
      config,
      `/orgs/${encodeURIComponent(config.org)}/teams/${encodeURIComponent(config.teamSlug)}/memberships/${encodeURIComponent(githubUsername)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role: 'member' }),
      },
    );

    if (response.ok) {
      return {
        ok: true,
        status: 'granted',
        mode: 'username',
      };
    }

    const detail = await response.text();
    if (response.status === 422 && isAlreadyPresentMessage(detail)) {
      return {
        ok: true,
        status: 'already_present',
        mode: 'username',
        detail,
      };
    }

    return {
      ok: false,
      status: 'failed',
      mode: 'username',
      detail: `GitHub membership grant failed (HTTP ${response.status}): ${detail}`,
    };
  }

  if (email) {
    const teamId = await getTeamId(config);
    const response = await requestGitHub(
      config,
      `/orgs/${encodeURIComponent(config.org)}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          team_ids: [teamId],
        }),
      },
    );

    if (response.ok) {
      return {
        ok: true,
        status: 'invited',
        mode: 'email',
      };
    }

    const detail = await response.text();
    if (response.status === 422 && isAlreadyPresentMessage(detail)) {
      return {
        ok: true,
        status: 'already_present',
        mode: 'email',
        detail,
      };
    }

    return {
      ok: false,
      status: 'failed',
      mode: 'email',
      detail: `GitHub invitation failed (HTTP ${response.status}): ${detail}`,
    };
  }

  return {
    ok: false,
    status: 'failed',
    detail: 'No githubUsername or email provided for access provisioning.',
  };
}

export async function revokeGitHubSelfHostAccess(
  input: GitHubRevokeInput,
): Promise<GitHubInviteResult> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      status: 'disabled',
      detail: 'GitHub automation env vars are not configured.',
    };
  }

  const githubUsername = input.githubUsername?.trim();
  if (!githubUsername) {
    return {
      ok: false,
      status: 'failed',
      detail: 'githubUsername is required for revocation.',
    };
  }

  const response = await requestGitHub(
    config,
    `/orgs/${encodeURIComponent(config.org)}/teams/${encodeURIComponent(config.teamSlug)}/memberships/${encodeURIComponent(githubUsername)}`,
    {
      method: 'DELETE',
    },
  );

  if (response.ok || response.status === 404) {
    return {
      ok: true,
      status: 'granted',
      mode: 'username',
      detail: response.status === 404 ? 'User was not a team member.' : 'Team membership removed.',
    };
  }

  const detail = await response.text();
  return {
    ok: false,
    status: 'failed',
    mode: 'username',
    detail: `GitHub membership revoke failed (HTTP ${response.status}): ${detail}`,
  };
}
