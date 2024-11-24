// src/components/FormattedAnalysis.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface FormattedAnalysisProps {
  content: string;
}

const FormattedAnalysis: React.FC<FormattedAnalysisProps> = ({ content }) => {
  return (
    <div className="prose max-w-none bg-white rounded-lg p-6 shadow-sm">
      <ReactMarkdown
        components={{
          // Root wrapper to add spacing
          div: ({ children }) => (
            <div className="space-y-6">{children}</div>
          ),
          p: ({ children }) => (
            <p className="text-gray-600 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-3 my-6">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-3">
              <span className="text-primary mt-1.5">•</span>
              <span className="text-gray-600 leading-relaxed">{children}</span>
            </li>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold text-gray-900 mb-6">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-medium text-gray-900 mt-8 mb-4">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-gray-900 mt-6 mb-3">{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedAnalysis;