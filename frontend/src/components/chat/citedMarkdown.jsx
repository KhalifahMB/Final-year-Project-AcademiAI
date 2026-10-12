import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeHighlight from 'rehype-highlight';
import { renderCitedText } from './citedText';

/* ---------------- Markdown content w/ citation chips ---------------- */

export default function CitedMarkdown({ content, sources, onSourceClick }) {
  const components = useMemo(() => {
    return {
      p: ({ children }) => (
        <p className="mb-3 last:mb-0 leading-relaxed">
          {typeof children === 'string'
            ? renderCitedText(children, sources, onSourceClick)
            : children}
        </p>
      ),
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      ul: ({ children }) => (
        <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">
          {children}
        </ol>
      ),
      h1: ({ children }) => (
        <h1 className="mb-2 mt-4 text-lg font-semibold">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-2 mt-3 text-base font-semibold">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-1.5 mt-2 text-sm font-semibold">{children}</h3>
      ),
      blockquote: ({ children }) => (
        <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {children}
        </a>
      ),
      code: ({ className, children, ...rest }) => {
        // react-markdown v9 removed the `inline` prop on `code`; a class is
        // present only on block code (rehype-highlight attaches `hljs` +
        // language). Anything else is inline, so give it the pill treatment.
        // `node` is the hast element — never spread it onto the DOM element.
        const { node: _node, ...codeProps } = rest;
        return (
          <code
            className={
              className ??
              'rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px]'
            }
            {...codeProps}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => (
        <pre className="mb-3 overflow-x-auto rounded-lg bg-muted/70 p-3 text-[12.5px] last:mb-0">
          {children}
        </pre>
      ),
      table: ({ children }) => (
        <div className="mb-3 overflow-x-auto last:mb-0">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border-b border-border/50 px-3 py-2">{children}</td>
      ),
      // Replace [n] with chips inside plain-text runs
      span: ({ children }) =>
        typeof children === 'string'
          ? renderCitedText(children, sources, onSourceClick)
          : children,
    };
  }, [sources, onSourceClick]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
