import React from 'react';
import { proseClasses } from './shared-styles';

const StructuredMessageContent = ({ message, md }) => {
  let contentToRender = '';

  if (message.structured && message.structured.response) {
    const { main_response, key_points, codeModifications } = message.structured.response;
    
    if (main_response) {
      contentToRender += main_response;
    }

    if (key_points && key_points.length > 0) {
      contentToRender += '\n\n**Key Points:**\n';
      key_points.forEach(point => {
        contentToRender += `- ${point}\n`;
      });
    }

    if (codeModifications && codeModifications.length > 0) {
      contentToRender += '\n\n**Code Modifications:**\n```json\n';
      contentToRender += JSON.stringify(codeModifications, null, 2);
      contentToRender += '\n```\n';
    }
  }

  const htmlContent = md.render(contentToRender);
  
  return (
    <div 
      className={proseClasses}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default StructuredMessageContent;
