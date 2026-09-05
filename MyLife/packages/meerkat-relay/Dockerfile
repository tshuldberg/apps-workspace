# Meerkat relay: stateless, zero-knowledge ciphertext forwarder.
#
# The relay needs only `ws` + `zod`. server.ts / hub.ts / protocol.ts import
# nothing from @mylife/sync, so this image ships ZERO workspace dependencies and
# installs cleanly with --omit=dev against a ws+zod-only manifest. The slim
# entrypoint (bin/meerkat-relay-server.mjs) imports server.ts directly, not the
# src/index.ts barrel (which would drag in the seeder/hosted node and their
# @mylife/sync runtime dependency). The seeder/hosted node is a SEPARATE image
# story (it does need @mylife/sync) and is intentionally not built here.
#
# Multi-stage so the runtime image carries only compiled output + ws + zod.
# Base pinned by manifest-list digest for supply-chain reproducibility; the
# comment records the human-readable tag (node:22-alpine).
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build
WORKDIR /app
RUN npm i -g pnpm@9
COPY package.json ./
COPY src ./src
COPY tsconfig.json ./
# Strip the workspace:* deps (the @mylife/* seeder / community-node packages,
# which the relay graph server.ts/hub.ts/protocol.ts does NOT import) BEFORE
# install. Under --ignore-workspace pnpm cannot resolve a workspace:* specifier,
# so leaving them in fails the build; the relay does not need them, and removing
# them lets the build stage install cleanly from the public registry (ws + zod +
# tsc + @types). ws + zod stay (they are real registry deps the runtime needs).
RUN node -e "const p=require('./package.json'); const strip=(o)=>Object.fromEntries(Object.entries(o||{}).filter(([,v])=>!String(v).startsWith('workspace:'))); p.dependencies=strip(p.dependencies); p.devDependencies=strip(p.devDependencies); require('fs').writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');"
# Install all (non-workspace) deps so the build stage has typescript + @types. The
# runtime stage installs ONLY ws + zod from the slim manifest below.
RUN pnpm install --prod=false --ignore-workspace
# Compile only the relay graph (server + hub + protocol) to CommonJS. CommonJS
# resolves the extensionless internal imports under plain node; the dist marker
# below overrides the package "type": "module" for the compiled output.
RUN pnpm exec tsc src/server.ts src/hub.ts src/protocol.ts \
      --outDir dist \
      --module commonjs \
      --moduleResolution node \
      --target ES2022 \
      --esModuleInterop \
      --skipLibCheck \
      --declaration false \
      --sourceMap false \
      --types node \
  && printf '{"type":"commonjs"}\n' > dist/package.json
# A slim runtime manifest with ONLY the two real runtime deps (ws + zod). The
# relay carries no @mylife/* dependency, so --ignore-workspace is correct.
RUN node -e "const p=require('./package.json'); const out={name:p.name,version:p.version,private:true,type:'module',dependencies:{ws:p.dependencies.ws,zod:p.dependencies.zod}}; require('fs').writeFileSync('package.runtime.json', JSON.stringify(out,null,2)+'\n');"

# Same digest-pinned base (node:22-alpine) for the runtime stage.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
# Slim manifest -> only ws + zod, no workspace packages, no dev deps.
COPY --from=build /app/package.runtime.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY bin/meerkat-relay-server.mjs ./bin/meerkat-relay-server.mjs
# Point the slim entrypoint's import at the compiled CommonJS output (the import
# line only; comments above it are left untouched).
RUN sed -i "s#^import { startRelayServer, installOrphanWatchdog } from '../src/server.ts';#import { startRelayServer, installOrphanWatchdog } from '../dist/server.js';#" bin/meerkat-relay-server.mjs
EXPOSE 8787
# Container-level liveness: the same GET /healthz the relay selector and any
# external uptime monitor use. Reads only { ok, connections }; no metadata.
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# No persistent volumes: the relay stores nothing but short-TTL in-memory
# mailboxes and rendezvous records, swept on a timer.
USER node
CMD ["node", "bin/meerkat-relay-server.mjs"]
