import React, { ReactNode } from 'react';

type MessageBlock =
  | { type: 'paragraph' | 'quote'; value: string }
  | { type: 'heading'; level: 1 | 2 | 3; value: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; value: string };

function inlineContent(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="aspira-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function parseBlocks(content: string): MessageBlock[] {
  const lines = content.replace(/\r/g, '').split('\n');
  const blocks: MessageBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language, value: codeLines.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, value: heading[2] });
      index += 1;
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*+]\s+|(\d+)[.)]\s+)(.+)$/);
    if (listItem) {
      const ordered = Boolean(listItem[1]);
      const items = [listItem[2]];
      index += 1;
      while (index < lines.length) {
        const next = lines[index].match(/^\s*(?:[-*+]\s+|(\d+)[.)]\s+)(.+)$/);
        if (!next || Boolean(next[1]) !== ordered) break;
        items.push(next[2]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quoteLines.push(lines[index].trimStart().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', value: quoteLines.join(' ') });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index]) &&
      !/^\s*>/.test(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', value: paragraphLines.join(' ') });
  }

  return blocks;
}

export const MarkdownMessage: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
}) => (
  <div className={`aspira-markdown ${className}`}>
    {parseBlocks(content).map((block, index) => {
      if (block.type === 'code') {
        return (
          <pre key={index} className="aspira-markdown-code">
            {block.language && <span className="aspira-markdown-language">{block.language}</span>}
            <code>{block.value}</code>
          </pre>
        );
      }
      if (block.type === 'heading') {
        const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
        return <Tag key={index}>{inlineContent(block.value)}</Tag>;
      }
      if (block.type === 'list') {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag key={index}>
            {block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineContent(item)}</li>)}
          </Tag>
        );
      }
      if (block.type === 'quote') {
        return <blockquote key={index}>{inlineContent(block.value)}</blockquote>;
      }
      return <p key={index}>{inlineContent(block.value)}</p>;
    })}
  </div>
);
