import type { HabitLinkType } from '../types';

export interface StackLink {
  parentHabitId: string;
  childHabitId: string;
  linkType: HabitLinkType;
  sortOrder: number;
}

export interface StackNode {
  habitId: string;
  linkType: HabitLinkType;
  sortOrder: number;
}

export interface HabitStack {
  anchorHabitId: string;
  chain: StackNode[];
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

function getChildren(
  links: StackLink[],
  parentHabitId: string,
  linkType: HabitLinkType,
) {
  return sortByOrder(
    links.filter((link) => link.parentHabitId === parentHabitId && link.linkType === linkType),
  );
}

function appendParallelChildren(
  chain: StackNode[],
  links: StackLink[],
  parentHabitId: string,
  visited: Set<string>,
) {
  for (const link of getChildren(links, parentHabitId, 'with')) {
    if (visited.has(link.childHabitId)) continue;
    visited.add(link.childHabitId);
    chain.push({
      habitId: link.childHabitId,
      linkType: 'with',
      sortOrder: link.sortOrder,
    });
  }
}

function appendAfterChildren(
  chain: StackNode[],
  links: StackLink[],
  parentHabitId: string,
  visited: Set<string>,
) {
  for (const link of getChildren(links, parentHabitId, 'after')) {
    if (visited.has(link.childHabitId)) continue;

    visited.add(link.childHabitId);
    chain.push({
      habitId: link.childHabitId,
      linkType: 'after',
      sortOrder: link.sortOrder,
    });

    appendParallelChildren(chain, links, link.childHabitId, visited);
    appendAfterChildren(chain, links, link.childHabitId, visited);
  }
}

export function resolveStack(
  links: StackLink[],
  anchorHabitId: string,
): HabitStack {
  const chain: StackNode[] = [];
  const visited = new Set<string>();

  for (const link of getChildren(links, anchorHabitId, 'before')) {
    if (visited.has(link.childHabitId)) continue;
    visited.add(link.childHabitId);
    chain.push({
      habitId: link.childHabitId,
      linkType: 'before',
      sortOrder: link.sortOrder,
    });
  }

  visited.add(anchorHabitId);
  chain.push({
    habitId: anchorHabitId,
    linkType: 'after',
    sortOrder: 0,
  });

  appendParallelChildren(chain, links, anchorHabitId, visited);
  appendAfterChildren(chain, links, anchorHabitId, visited);

  return { anchorHabitId, chain };
}

export function getNextInStack(
  stack: HabitStack,
  completedHabitId: string,
): string | null {
  const index = stack.chain.findIndex((node) => node.habitId === completedHabitId);
  if (index === -1 || index >= stack.chain.length - 1) {
    return null;
  }

  for (let offset = index + 1; offset < stack.chain.length; offset += 1) {
    if (stack.chain[offset].linkType !== 'with') {
      return stack.chain[offset].habitId;
    }
  }

  return null;
}

export function getParallelHabits(
  stack: HabitStack,
  habitId: string,
): string[] {
  const index = stack.chain.findIndex((node) => node.habitId === habitId);
  if (index === -1) {
    return [];
  }

  const parallel: string[] = [];
  for (let offset = index + 1; offset < stack.chain.length; offset += 1) {
    if (stack.chain[offset].linkType !== 'with') {
      break;
    }
    parallel.push(stack.chain[offset].habitId);
  }

  return parallel;
}

export function validateNoCircularDependency(
  existingLinks: Array<{ parentHabitId: string; childHabitId: string }>,
  newParentId: string,
  newChildId: string,
): boolean {
  if (newParentId === newChildId) {
    return false;
  }

  const visited = new Set<string>();
  const queue = [newChildId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newParentId) {
      return false;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const link of existingLinks) {
      if (link.parentHabitId === current) {
        queue.push(link.childHabitId);
      }
    }
  }

  return true;
}
