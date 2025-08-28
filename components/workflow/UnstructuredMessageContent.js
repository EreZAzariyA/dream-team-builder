import React from 'react';
import { proseClasses } from './shared-styles';

const UnstructuredMessageContent = ({ message, md, workflowInstance }) => {
  let content = message.content || message.summary || '';
  
  // If message has metadata (new format), use the content directly and optionally show metadata
  if (message.metadata && message.metadata.executionTime) {
    // Use the main content (which should be the agent response) and optionally add metadata
    content = message.content || 'Agent completed execution';
    
    // Only show metadata if content is just a status message (not actual agent response)
    if (typeof content === 'string' && (content.includes('completed') || content.includes('failed')) && content.length < 50) {
      const time = Math.round(message.metadata.executionTime / 1000);
      content = `✅ **Agent Execution Complete**\n\n⏱️ **Execution Time:** ${time}s\n📄 **Artifacts:** ${message.metadata.artifacts || 0}`;
    }
  }
  else if (typeof content === 'object') {
    if (content.userPrompt) {
      const currentStep = workflowInstance?.progress?.currentStep ?? content.context?.step ?? '?';
      const totalSteps = workflowInstance?.progress?.totalSteps ?? content.context?.totalSteps ?? '?';
      content = `🎯 **User Request:** ${content.userPrompt}\n\n📋 **Instructions:** ${content.instructions}\n\n📊 **Progress:** Step ${currentStep} of ${totalSteps}`;
    } 
    else if (content.summary && content.executionTime) {
      const time = Math.round(content.executionTime / 1000);
      content = `✅ **${content.summary}**\n\n⏱️ **Execution Time:** ${time}s\n📄 **Artifacts:** ${content.artifacts || 'None'}`;
    } else {
      // Check for agent response field first, then other message formats
      content = content?.response || content?.content || content?.message || JSON.stringify(content, null, 2);
    }
  }
  const contentToRender = String(content);

  const htmlContent = md.render(contentToRender);
  
  return (
    <div 
      className={proseClasses}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default UnstructuredMessageContent;
