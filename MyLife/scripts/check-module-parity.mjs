#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = resolve(process.cwd());

let failures = 0;
let warnings = 0;

function fail(message) {
  console.error(`FAIL ${message}`);
  failures += 1;
}

function warn(message) {
  console.warn(`WARN ${message}`);
  warnings += 1;
}

function ok(message) {
  console.log(`OK   ${message}`);
}

function fileExists(path) {
  return existsSync(resolve(root, path));
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function walkTsxRoutes(dirPath) {
  const rootPath = resolve(root, dirPath);
  if (!existsSync(rootPath)) {
    return [];
  }

  const out = [];

  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);

      if (entry.isDirectory()) {
        if (['node_modules', '__tests__', '.next', '.expo', '.turbo', 'dist'].includes(entry.name)) {
          continue;
        }
        walk(full);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.tsx')) continue;
      if (['_layout.tsx', 'layout.tsx', '+not-found.tsx'].includes(entry.name)) continue;

      const rel = relative(rootPath, full).replace(/\\/g, '/');
      out.push(rel);
    }
  }

  walk(rootPath);
  return out;
}

function firstExisting(paths) {
  for (const p of paths) {
    if (fileExists(p)) {
      return p;
    }
  }
  return null;
}

const moduleSpecs = [
  {
    id: 'books',
    standalone: 'MyBooks',
    status: 'archived',
    archiveRoot: 'archive/MyBooks',
    standaloneWebRoots: ['MyBooks/apps/web/app'],
    standaloneMobileRoots: ['MyBooks/apps/mobile/app'],
  },
  {
    id: 'budget',
    standalone: 'MyBudget',
    status: 'archived',
    archiveRoot: 'archive/MyBudget',
    standaloneWebRoots: ['MyBudget/apps/web/app'],
    standaloneMobileRoots: ['MyBudget/apps/mobile/app'],
  },
  {
    id: 'fast',
    standalone: 'MyFast',
    status: 'design_only',
  },
  {
    id: 'recipes',
    moduleDir: 'bestchef',
    standalone: 'BestChef',
    status: 'standalone_app',
    inRepoStandaloneRoot: 'apps/bestchef',
    standaloneMobileRoots: ['apps/bestchef/app'],
    archiveRoot: 'archive/MyRecipes',
  },
  {
    id: 'rsvp',
    standalone: 'MyRSVP',
    status: 'implemented',
    standaloneWebRoots: ['MyRSVP/apps/web/app'],
    standaloneMobileRoots: ['MyRSVP/apps/mobile/app'],
  },
  {
    id: 'surf',
    standalone: 'MySurf',
    status: 'implemented',
    standaloneWebRoots: ['MySurf/apps/web/app'],
    standaloneMobileRoots: ['MySurf/apps/mobile/app'],
  },
  {
    id: 'workouts',
    standalone: 'MyWorkouts',
    status: 'archived',
    archiveRoot: 'archive/MyWorkouts',
    standaloneWebRoots: ['MyWorkouts/apps/web/app'],
    standaloneMobileRoots: ['MyWorkouts/apps/mobile/app'],
  },
  {
    id: 'car',
    standalone: 'MyCar',
    status: 'design_only',
  },
  {
    id: 'words',
    standalone: 'MyWords',
    status: 'implemented',
    standaloneWebRoots: ['MyWords/apps/web/app'],
    standaloneMobileRoots: ['MyWords/apps/mobile/app'],
  },
  {
    id: 'homes',
    standalone: 'MyHomes',
    status: 'implemented',
    standaloneWebRoots: ['MyHomes/apps/web/src/app', 'MyHomes/apps/web/app'],
    standaloneMobileRoots: ['MyHomes/apps/mobile/app'],
  },
  {
    id: 'habits',
    standalone: 'MyHabits',
    status: 'implemented',
    standaloneWebRoots: ['MyHabits/apps/web/app'],
    standaloneMobileRoots: ['MyHabits/apps/mobile/app'],
  },
  {
    id: 'closet',
    standalone: 'MyCloset',
    status: 'design_only',
  },
  {
    id: 'cycle',
    standalone: 'MyCycle',
    status: 'design_only',
  },
  {
    id: 'flash',
    standalone: 'MyFlash',
    status: 'design_only',
  },
  {
    id: 'mail',
    standalone: 'MyMail',
    status: 'design_only',
  },
  {
    id: 'meds',
    standalone: 'MyMeds',
    status: 'design_only',
  },
  {
    id: 'mood',
    standalone: 'MyMood',
    status: 'design_only',
  },
  {
    id: 'notes',
    standalone: 'MyNotes',
    status: 'design_only',
  },
  {
    id: 'journal',
    standalone: 'MyJournal',
    status: 'design_only',
  },
  {
    id: 'garden',
    standalone: 'MyGarden',
    status: 'design_only',
  },
  {
    id: 'pets',
    standalone: 'MyPets',
    status: 'design_only',
  },
  {
    id: 'trails',
    standalone: 'MyTrails',
    status: 'design_only',
  },
  {
    id: 'voice',
    standalone: 'MyVoice',
    status: 'design_only',
  },
  {
    id: 'stars',
    standalone: 'MyStars',
    status: 'design_only',
  },
];

const gitmodulesPath = resolve(root, '.gitmodules');
const hasGitmodules = existsSync(gitmodulesPath);
const gitmodules = hasGitmodules ? readFileSync(gitmodulesPath, 'utf8') : '';
const webPackage = readJson('apps/web/package.json');
const mobilePackage = readJson('apps/mobile/package.json');

console.log('Checking module parity inventory...\n');
if (!hasGitmodules) {
  warn('module parity: .gitmodules not found, standalone repo tracking assertions will be skipped');
}

for (const spec of moduleSpecs) {
  const moduleName = `@mylife/${spec.moduleDir || spec.id}`;
  const moduleRoot = `modules/${spec.moduleDir || spec.id}`;
  const hubWebRoot = `apps/web/app/${spec.id}`;
  const hubMobileRoot = `apps/mobile/app/(${spec.id})`;
  const standaloneRoot = spec.standalone;

  if (!fileExists(`${moduleRoot}/package.json`)) {
    fail(`${moduleName}: missing ${moduleRoot}/package.json`);
    continue;
  }
  ok(`${moduleName}: module package present`);

  if (!fileExists(`${moduleRoot}/src/definition.ts`)) {
    fail(`${moduleName}: missing ${moduleRoot}/src/definition.ts`);
  } else {
    ok(`${moduleName}: definition present`);
  }

  if (!fileExists(hubWebRoot)) {
    fail(`${moduleName}: missing hub web root ${hubWebRoot}`);
  } else {
    ok(`${moduleName}: hub web root present`);
  }

  if (!fileExists(hubMobileRoot)) {
    fail(`${moduleName}: missing hub mobile root ${hubMobileRoot}`);
  } else {
    ok(`${moduleName}: hub mobile root present`);
  }

  if (!webPackage.dependencies?.[moduleName]) {
    fail(`${moduleName}: missing web dependency in apps/web/package.json`);
  } else {
    ok(`${moduleName}: web dependency wired`);
  }

  if (!mobilePackage.dependencies?.[moduleName]) {
    fail(`${moduleName}: missing mobile dependency in apps/mobile/package.json`);
  } else {
    ok(`${moduleName}: mobile dependency wired`);
  }

  if (spec.status === 'standalone_app') {
    const appRoot = spec.inRepoStandaloneRoot;
    if (!appRoot || !fileExists(`${appRoot}/package.json`)) {
      fail(`${moduleName}: in-repo standalone app missing (${appRoot ?? 'path not set'})`);
      continue;
    }
    ok(`${moduleName}: in-repo standalone app present (${appRoot})`);

    const appPackage = readJson(`${appRoot}/package.json`);
    if (!appPackage.dependencies?.[moduleName]) {
      fail(`${moduleName}: in-repo standalone app missing ${moduleName} dependency`);
    } else {
      ok(`${moduleName}: in-repo standalone app dependency wired`);
    }

    const inRepoMobileRoot = firstExisting(spec.standaloneMobileRoots ?? []);
    const inRepoRoutes = inRepoMobileRoot ? walkTsxRoutes(inRepoMobileRoot) : [];
    if (inRepoRoutes.length === 0) {
      fail(
        `${moduleName}: in-repo standalone has no route files under ${inRepoMobileRoot ?? '(unresolved)'}`,
      );
    } else {
      ok(`${moduleName}: in-repo standalone route files ${inRepoRoutes.length}`);
    }

    if (spec.archiveRoot && fileExists(spec.archiveRoot)) {
      ok(`${moduleName}: archive placeholder present (${spec.archiveRoot})`);
    }

    warn(
      `${moduleName}: in-repo standalone app (${appRoot}) is canonical; hub surfaces are intentionally partial. Type contracts are enforced by app typechecks.`,
    );
    continue;
  }

  if (spec.status === 'archived') {
    if (spec.archiveRoot && fileExists(spec.archiveRoot)) {
      ok(`${moduleName}: archive placeholder present (${spec.archiveRoot})`);
    } else {
      warn(`${moduleName}: expected archive placeholder missing (${spec.archiveRoot ?? 'archive path not set'})`);
    }
    continue;
  }

  if (!fileExists(standaloneRoot)) {
    warn(`${moduleName}: standalone ${standaloneRoot} not present in repo, skipping standalone parity checks`);
    continue;
  }

  if (hasGitmodules) {
    if (!gitmodules.includes(`path = ${standaloneRoot}`)) {
      fail(`${moduleName}: standalone ${standaloneRoot} not found in .gitmodules`);
    } else {
      ok(`${moduleName}: standalone repo tracked in .gitmodules`);
    }
  } else {
    warn(`${moduleName}: .gitmodules missing, skipped standalone tracking assertion`);
  }

  if (!fileExists(`${standaloneRoot}/.git`)) {
    if (hasGitmodules) {
      fail(`${moduleName}: standalone repo missing local .git metadata`);
    } else {
      warn(`${moduleName}: standalone repo missing local .git metadata`);
    }
  } else {
    ok(`${moduleName}: standalone repo initialized`);
  }

  if (spec.status === 'design_only') {
    if (!fileExists(`${standaloneRoot}/DESIGN.md`)) {
      fail(`${moduleName}: design-only module missing ${standaloneRoot}/DESIGN.md`);
    } else {
      ok(`${moduleName}: design spec present`);
    }

    warn(
      `${moduleName}: standalone implementation is design-only. Strict UI parity checks are deferred until standalone app code exists.`,
    );
    continue;
  }

  const standaloneWebRoot = firstExisting(spec.standaloneWebRoots ?? []);
  const standaloneMobileRoot = firstExisting(spec.standaloneMobileRoots ?? []);

  if (!standaloneWebRoot) {
    fail(`${moduleName}: no standalone web root found (checked: ${(spec.standaloneWebRoots ?? []).join(', ')})`);
    continue;
  }

  if (!standaloneMobileRoot) {
    fail(`${moduleName}: no standalone mobile root found (checked: ${(spec.standaloneMobileRoots ?? []).join(', ')})`);
    continue;
  }

  ok(`${moduleName}: standalone roots resolved (${standaloneWebRoot}, ${standaloneMobileRoot})`);

  const standaloneWebRoutes = walkTsxRoutes(standaloneWebRoot);
  const standaloneMobileRoutes = walkTsxRoutes(standaloneMobileRoot);
  const hubWebRoutes = walkTsxRoutes(hubWebRoot);
  const hubMobileRoutes = walkTsxRoutes(hubMobileRoot);

  if (standaloneWebRoutes.length === 0) {
    fail(`${moduleName}: standalone web has no route files under ${standaloneWebRoot}`);
  } else {
    ok(`${moduleName}: standalone web route files ${standaloneWebRoutes.length}`);
  }

  if (standaloneMobileRoutes.length === 0) {
    fail(`${moduleName}: standalone mobile has no route files under ${standaloneMobileRoot}`);
  } else {
    ok(`${moduleName}: standalone mobile route files ${standaloneMobileRoutes.length}`);
  }

  if (hubWebRoutes.length === 0) {
    fail(`${moduleName}: hub web has no route files under ${hubWebRoot}`);
  } else {
    ok(`${moduleName}: hub web route files ${hubWebRoutes.length}`);
  }

  if (hubMobileRoutes.length === 0) {
    fail(`${moduleName}: hub mobile has no route files under ${hubMobileRoot}`);
  } else {
    ok(`${moduleName}: hub mobile route files ${hubMobileRoutes.length}`);
  }

  const standaloneWebIndex = `${standaloneWebRoot}/page.tsx`;
  const hubWebIndex = `${hubWebRoot}/page.tsx`;

  if (!fileExists(standaloneWebIndex)) {
    warn(`${moduleName}: standalone web root page missing (${standaloneWebIndex})`);
  }

  if (!fileExists(hubWebIndex)) {
    fail(`${moduleName}: hub web root page missing (${hubWebIndex})`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-module-parity: ${failures} failure(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`\ncheck-module-parity: passed with ${warnings} warning(s)`);
