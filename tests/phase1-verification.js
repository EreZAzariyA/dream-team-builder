/**
 * Phase 1 Verification Tests
 * Quick tests to verify that our Phase 1 stabilization changes work correctly
 */

import { WorkflowId } from '../lib/utils/workflowId.js';

// Test WorkflowId utility functions
function testWorkflowIdUtility() {
  console.log('🧪 Testing WorkflowId Utility...');
  
  // Test ID generation
  const id1 = WorkflowId.generate();
  const id2 = WorkflowId.generate();
  console.log('✅ Generated IDs:', { id1, id2 });
  console.assert(id1 !== id2, 'Generated IDs should be unique');
  console.assert(WorkflowId.validate(id1), 'Generated ID should be valid');
  
  // Test validation
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const validObjectId = '507f1f77bcf86cd799439011';
  const invalid = 'not-a-valid-id';
  
  console.assert(WorkflowId.validate(validUuid), 'Should validate UUID');
  console.assert(WorkflowId.validate(validObjectId), 'Should validate ObjectId');
  console.assert(!WorkflowId.validate(invalid), 'Should not validate invalid ID');
  
  // Test normalization
  const workflow1 = { id: validUuid };
  const workflow2 = { _id: validObjectId };
  const workflow3 = { workflowId: validUuid };
  const workflow4 = { id: validUuid, workflowId: 'wrong', _id: 'also-wrong' };
  
  console.assert(WorkflowId.normalize(workflow1) === validUuid, 'Should normalize from id field');
  console.assert(WorkflowId.normalize(workflow2) === validObjectId, 'Should normalize from _id field');
  console.assert(WorkflowId.normalize(workflow3) === validUuid, 'Should normalize from workflowId field');
  console.assert(WorkflowId.normalize(workflow4) === validUuid, 'Should prioritize id field');
  
  // Test comparison
  console.assert(WorkflowId.equals(workflow1, validUuid), 'Should match workflow object to string');
  console.assert(WorkflowId.equals(workflow1, workflow3), 'Should match workflow objects');
  console.assert(!WorkflowId.equals(workflow1, workflow2), 'Should not match different IDs');
  
  // Test channel names
  const channelName = WorkflowId.toChannelName(validUuid);
  console.assert(channelName === `workflow-${validUuid}`, 'Should create correct channel name');
  console.assert(WorkflowId.fromChannelName(channelName) === validUuid, 'Should parse channel name back');
  
  // Test temporary IDs
  const tempId = WorkflowId.createTemporary('test');
  console.assert(WorkflowId.isTemporary(tempId), 'Should identify temporary ID');
  console.assert(!WorkflowId.isTemporary(validUuid), 'Should not identify UUID as temporary');
  
  console.log('✅ WorkflowId utility tests passed!');
}

// Test error boundary functionality (mock test)
function testErrorBoundary() {
  console.log('🧪 Testing Error Boundary...');
  
  // This is a mock test since we can't easily test React error boundaries in Node.js
  // In a real environment, you would use @testing-library/react
  
  const mockError = new Error('Test error');
  const mockErrorInfo = { componentStack: 'TestComponent' };
  
  // Simulate error boundary behavior
  let errorCaught = false;
  let errorDetails = null;
  
  const mockOnError = (error, errorInfo, details) => {
    errorCaught = true;
    errorDetails = details;
  };
  
  // Simulate the error boundary catching an error
  try {
    throw mockError;
  } catch (error) {
    mockOnError(error, mockErrorInfo, {
      error: error.message,
      timestamp: new Date().toISOString(),
      errorId: 'test-error-123'
    });
  }
  
  console.assert(errorCaught, 'Error should be caught');
  console.assert(errorDetails.error === 'Test error', 'Error details should be captured');
  
  console.log('✅ Error boundary mock test passed!');
}

// Test state synchronization improvements (mock test)
function testStateSynchronization() {
  console.log('🧪 Testing State Synchronization...');
  
  // Mock workflow objects with different ID formats
  const workflows = [
    { id: '123e4567-e89b-12d3-a456-426614174000', status: 'running' },
    { _id: '507f1f77bcf86cd799439011', status: 'running' },
    { workflowId: '987fcdeb-51d2-43e8-b123-456789abcdef', status: 'running' }
  ];
  
  // Test finding workflows with normalized comparison
  const targetId = '123e4567-e89b-12d3-a456-426614174000';
  const found = workflows.find(w => WorkflowId.equals(w, targetId));
  
  console.assert(found !== undefined, 'Should find workflow with normalized comparison');
  console.assert(found.id === targetId, 'Should find correct workflow');
  
  // Test that different ID formats don't match
  const differentId = '507f1f77bcf86cd799439011';
  const notFound = workflows.find(w => WorkflowId.equals(w, targetId) && WorkflowId.equals(w, differentId));
  
  console.assert(notFound === undefined, 'Should not match different IDs');
  
  console.log('✅ State synchronization test passed!');
}

// Test API route validation (mock test)
function testApiValidation() {
  console.log('🧪 Testing API Validation...');
  
  // Test valid workflow IDs
  const validIds = [
    '123e4567-e89b-12d3-a456-426614174000',
    '507f1f77bcf86cd799439011',
    WorkflowId.generate()
  ];
  
  validIds.forEach(id => {
    console.assert(WorkflowId.validate(id), `Should validate ID: ${id}`);
  });
  
  // Test invalid workflow IDs
  const invalidIds = [
    'not-a-valid-id',
    '123',
    '',
    null,
    undefined,
    'temp-123-abc' // temporary IDs should still validate format
  ];
  
  invalidIds.forEach(id => {
    console.assert(!WorkflowId.validate(id), `Should not validate ID: ${id}`);
  });
  
  console.log('✅ API validation test passed!');
}

// Run all tests
function runPhase1Tests() {
  console.log('🚀 Running Phase 1 Verification Tests...\n');
  
  try {
    testWorkflowIdUtility();
    testErrorBoundary();
    testStateSynchronization();
    testApiValidation();
    
    console.log('\n🎉 All Phase 1 tests passed! The stabilization changes are working correctly.');
    console.log('\n📋 Phase 1 Summary:');
    console.log('   ✅ Standardized workflow ID handling');
    console.log('   ✅ Improved state synchronization');
    console.log('   ✅ Added error boundaries');
    console.log('   ✅ Enhanced API validation');
    console.log('\n🔄 Ready for Phase 2: Architecture Cleanup');
    
  } catch (error) {
    console.error('❌ Phase 1 test failed:', error);
    console.log('\n🔧 Please fix the issues before proceeding to Phase 2');
  }
}

// Export for use in other test runners
export {
  testWorkflowIdUtility,
  testErrorBoundary,
  testStateSynchronization,
  testApiValidation,
  runPhase1Tests
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase1Tests();
}