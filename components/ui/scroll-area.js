'use client';

import React from 'react';

const ScrollArea = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`overflow-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export { ScrollArea };