import { Fragment } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';

type DreamMarkdownBlock =
  | { type: 'heading'; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'number-list'; items: string[] }
  | { type: 'code'; content: string };

function normalizeInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function parseDreamMarkdown(content: string): DreamMarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: DreamMarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listType: 'bullet-list' | 'number-list' | null = null;
  let codeLines: string[] = [];
  let inCodeFence = false;

  function flushParagraph(): void {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push({
      type: 'paragraph',
      content: normalizeInlineMarkdown(paragraphLines.join(' ')),
    });
    paragraphLines = [];
  }

  function flushList(): void {
    if (!listType || listItems.length === 0) {
      return;
    }
    blocks.push({
      type: listType,
      items: listItems.map((item) => normalizeInlineMarkdown(item)),
    });
    listItems = [];
    listType = null;
  }

  function flushCode(): void {
    if (codeLines.length === 0) {
      return;
    }
    blocks.push({
      type: 'code',
      content: codeLines.join('\n').trimEnd(),
    });
    codeLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        content: normalizeInlineMarkdown(headingMatch[1]),
      });
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'quote',
        content: normalizeInlineMarkdown(quoteMatch[1]),
      });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== 'bullet-list') {
        flushList();
      }
      listType = 'bullet-list';
      listItems.push(bulletMatch[1]);
      continue;
    }

    const numberMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (listType && listType !== 'number-list') {
        flushList();
      }
      listType = 'number-list';
      listItems.push(numberMatch[1]);
      continue;
    }

    if (listType) {
      flushList();
    }
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks;
}

export function SleepDreamMarkdown({ content }: { content: string }) {
  const blocks = parseDreamMarkdown(content);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text key={`heading-${index}`} style={styles.heading}>
              {block.content}
            </Text>
          );
        }

        if (block.type === 'quote') {
          return (
            <View key={`quote-${index}`} style={styles.quoteShell}>
              <Text style={styles.quoteText}>{block.content}</Text>
            </View>
          );
        }

        if (block.type === 'code') {
          return (
            <View key={`code-${index}`} style={styles.codeShell}>
              <Text style={styles.codeText}>{block.content}</Text>
            </View>
          );
        }

        if (block.type === 'bullet-list' || block.type === 'number-list') {
          return (
            <View key={`list-${index}`} style={styles.listShell}>
              {block.items.map((item, itemIndex) => (
                <View key={`${index}-${item}`} style={styles.listRow}>
                  <Text style={styles.listMarker}>
                    {block.type === 'number-list'
                      ? `${itemIndex + 1}.`
                      : '•'}
                  </Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Fragment key={`paragraph-${index}`}>
            <Text style={styles.paragraph}>{block.content}</Text>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  heading: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  paragraph: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 25,
  },
  quoteShell: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(167,139,250,0.4)',
    paddingLeft: 14,
  },
  quoteText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    fontStyle: 'italic',
  },
  listShell: {
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listMarker: {
    minWidth: 18,
    color: '#E9DDFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
  listText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  codeShell: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: {
    color: '#E9DDFF',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Courier',
  },
});
