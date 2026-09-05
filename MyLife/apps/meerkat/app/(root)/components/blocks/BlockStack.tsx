// Composition plan 2.2/2.4: the host that renders a resolved block stack.
// Per-node fail-safe: a node that is unknown, malformed, capability-ungated,
// unavailable, or renderer-pending mounts the honest BlockPlaceholder ALONE;
// the rest of the stack renders. The non-removable floors (channel list,
// settings, ranking picker) are rendered by the SCREENS outside this stack; a
// layout document cannot reach them.

import type { MkBlockNode } from '@mylife/meerkat-layout';
import { blockPlaceholderLine } from '../../data/block-registry-core';
import { resolveBlockStack } from '../../data/community-layout-core';
import type { BlockRuntime } from '../../data/block-registry-core';
import { BLOCK_RENDERERS, BLOCK_RENDERER_PENDING_LINE, type BlockHostContext } from './registry';
import { BlockPlaceholder } from './BlockPlaceholder';

/**
 * Capability substrates present in THIS build (composition 2.3). Computed, not
 * asserted: every gated capability's runtime lands with its composition phase
 * (video: Phase 2 players; live: Phase 7 SFU config; store/tiers: Phase 9
 * billing client; embeds: Phase 10 consent gate; and so on). Until then the
 * honest state for a declared capability is declared-but-unavailable.
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
}) {
  const resolved = resolveBlockStack(nodes, declaredCapabilities, blockRuntime());
  return (
    <>
      {resolved.map((node, index) => {
        const key = `${node.type}:${index}`;
        if (!node.renderable || node.config === null) {
          const line = blockPlaceholderLine(node.availability);
          return <BlockPlaceholder key={key} line={line ?? BLOCK_RENDERER_PENDING_LINE} />;
        }
        const Renderer = BLOCK_RENDERERS[node.type as keyof typeof BLOCK_RENDERERS];
        if (!Renderer) {
          return <BlockPlaceholder key={key} line={BLOCK_RENDERER_PENDING_LINE} />;
        }
        return <Renderer key={key} config={node.config} ctx={ctx} />;
      })}
    </>
  );
}
