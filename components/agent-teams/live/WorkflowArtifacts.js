'use client';

import React from 'react';
import BmadDocumentManager from '../../workflow/BmadDocumentManager';
import GeneratedFiles from '../../workflow/GeneratedFiles';

const WorkflowArtifacts = ({ 
  workflowInstanceId,
  artifacts,
  loadingArtifacts,
  onRefreshArtifacts,
  onDownloadFile,
  onDownloadAll,
  formatTimestamp,
  formatFileSize 
}) => {
  return (
    <div className="space-y-6">
      {/* BMAD Document Manager */}
      <BmadDocumentManager 
        workflowId={workflowInstanceId}
        artifacts={artifacts}
        loading={loadingArtifacts}
        onRefresh={onRefreshArtifacts}
        onDownload={onDownloadFile}
        onView={(filename) => {
          // TODO: Implement document viewer
          console.log('View document:', filename);
        }}
      />

      {/* Generated Files Section */}
      <GeneratedFiles 
        artifacts={artifacts}
        loading={loadingArtifacts}
        workflowInstanceId={workflowInstanceId}
        onDownloadFile={onDownloadFile}
        onDownloadAll={onDownloadAll}
        formatTimestamp={formatTimestamp}
        formatFileSize={formatFileSize}
      />
    </div>
  );
};

export default WorkflowArtifacts;