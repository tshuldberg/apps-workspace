// Composition plan 2.2/2.4 (WEB): the host that renders a resolved block
// stack. Per-node fail-safe: a node that is unknown, malformed,
// capability-ungated, unavailable, or renderer-pending renders the honest
// placeholder ALONE; the rest of the stack renders. The non-removable floors
// (channel sidebar, settings gear, ranking picker) render outside this stack.

import type { MkBlockNode } from '@mylife/meerkat-layout';
import { blockPlaceholderLine, type BlockRuntime } from '../../lib/block-registry-core';
import { resolveBlockStack } from '../../lib/community-layout-core';
import { BLOCK_RENDERERS, BLOCK_RENDERER_PENDING_LINE, type BlockHostContext } from './registry';

/**
 * Capability substrates present in THIS build (composition 2.3). Computed, not
 * asserted: every gated capability's runtime lands with its composition phase.
 * Until then the honest state for a declared capability is
 * declared-but-unavailable. The web app never gains local transports or the
 * loopback player; its runtime map stays a strict subset of mobile's.
 */
export function blockRuntime(): BlockRuntime {
  return {};
}

export function BlockStack({
  nodes,
  declaredCapabilities,
  ctx,
}: {
  nodes: readonly MkBlockNode[];
  declaredCapabilities: readonly string[];
  ctx: BlockHostContext;
}): React.ReactElement {
  const resolved = resolveBlockStack(nodes, declaredCapabilities, blockRuntime());
  return (
    <>
      {resolved.map((node, index) => {
        const key = `${node.type}:${index}`;
        if (!node.renderable || node.config === null) {
          const line = blockPlaceholderLine(node.availability);
          return <div key={key} className="mk-block-card mk-muted" role="note">{line ?? BLOCK_RENDERER_PENDING_LINE}</div>;
        }
        const Renderer = BLOCK_RENDERERS[node.type as keyof typeof BLOCK_RENDERERS];
        if (!Renderer) {
          return <div key={key} className="mk-block-card mk-muted" role="note">{BLOCK_RENDERER_PENDING_LINE}</div>;
        }
        return <Renderer key={key} config={node.config} ctx={ctx} />;
      })}
    </>
  );
}
