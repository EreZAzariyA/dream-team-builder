import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import StructuredMessageContent from './StructuredMessageContent';
import UnstructuredMessageContent from './UnstructuredMessageContent';
import ElicitationMessageContent from './ElicitationMessageContent';

const md = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  breaks: true,
  linkify: true,
  typographer: true
});

const MessageRenderer = ({ message, workflowInstance }) => {
  const messageType = useMemo(() => {
    if (message.isElicitation) return 'elicitation';
    if (message.structured?.response) return 'structured';
    return 'unstructured';
  }, [message]);

  switch (messageType) {
    case 'elicitation':
      return <ElicitationMessageContent message={message} md={md} />;
    case 'structured':
      return <StructuredMessageContent message={message} md={md} />;
    default:
      return <UnstructuredMessageContent message={message} md={md} workflowInstance={workflowInstance} />;
  }
};

export default MessageRenderer;