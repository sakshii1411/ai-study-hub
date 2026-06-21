import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props { content: string; className?: string; }

export const MarkdownRenderer: React.FC<Props> = ({ content, className = "" }) => (
  <div className={`markdown-body ${className}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-gray-700">{children}</h1>,
      h2: ({ children }) => <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mt-5 mb-2.5">{children}</h2>,
      h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2">{children}</h3>,
      h4: ({ children }) => <h4 className="text-base font-semibold text-slate-600 dark:text-slate-300 mt-3 mb-1.5">{children}</h4>,
      p:  ({ children }) => <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3 text-sm">{children}</p>,
      ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
      strong: ({ children }) => <strong className="font-bold text-slate-800 dark:text-slate-100">{children}</strong>,
      em: ({ children }) => <em className="italic text-slate-600 dark:text-slate-400">{children}</em>,
      code: ({ children, className: codeClass }) => {
        const isBlock = codeClass?.includes("language-");
        return isBlock
          ? <pre className="bg-slate-900 dark:bg-gray-950 text-slate-100 rounded-lg p-4 my-3 overflow-x-auto text-xs leading-relaxed border dark:border-gray-800"><code>{children}</code></pre>
          : <code className="bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>;
      },
      blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 my-3 italic text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-950/40 py-2 pr-3 rounded-r-lg text-sm">{children}</blockquote>,
      table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full border border-slate-200 dark:border-gray-700 rounded-lg text-sm">{children}</table></div>,
      thead: ({ children }) => <thead className="bg-slate-100 dark:bg-gray-800">{children}</thead>,
      tbody: ({ children }) => <tbody className="divide-y divide-slate-100 dark:divide-gray-700">{children}</tbody>,
      tr:   ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-gray-800/50">{children}</tr>,
      th:   ({ children }) => <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-gray-700">{children}</th>,
      td:   ({ children }) => <td className="px-3 py-2 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-gray-700">{children}</td>,
      hr:   () => <hr className="my-4 border-slate-200 dark:border-gray-700" />,
      a:    ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition">{children}</a>,
    }}>
      {content}
    </ReactMarkdown>
  </div>
);

export default MarkdownRenderer;
