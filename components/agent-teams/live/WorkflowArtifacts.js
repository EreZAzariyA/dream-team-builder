'use client';

import React, { useState } from 'react';
import BmadDocumentManager from '../../workflow/BmadDocumentManager';
import BmadDocumentViewer from '../../workflow/BmadDocumentViewer';
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
  const [viewingDocument, setViewingDocument] = useState(null);
  return (
    <div className="space-y-6">
      {/* BMAD Document Manager */}
      <BmadDocumentManager 
        workflowId={workflowInstanceId}
        artifacts={artifacts}
        loading={loadingArtifacts}
        onRefresh={onRefreshArtifacts}
        onDownload={onDownloadFile}
        onView={(filename, document) => {
          // Open document viewer with the selected document
          setViewingDocument({
            id: filename,
            title: filename,
            content: document?.content || 'Loading...',
            type: document?.type || 'document',
            agent: document?.agent || 'System',
            metadata: document?.metadata || {}
          });
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

      {/* Document Viewer Modal */}
      <BmadDocumentViewer
        document={viewingDocument}
        isOpen={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
        onSave={async (docId, content) => {
          console.log('Save document:', docId, content);
          // TODO: Implement save functionality
        }}
        onValidate={async (docId, content) => {
          console.log('Validate document:', docId, content);
          // TODO: Implement validation
          return { valid: true, errors: [] };
        }}
        onExport={async (docId, format) => {
          console.log('Export document:', docId, format);
          // TODO: Implement export
        }}
      />
    </div>
  );
};

export default WorkflowArtifacts;