import React from 'react';
import { proseClasses } from './shared-styles';

const ElicitationMessageContent = ({ message, md }) => {
  const htmlContent = md.render(message.content);
  return (
    <div
      className={proseClasses}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default ElicitationMessageContent;
