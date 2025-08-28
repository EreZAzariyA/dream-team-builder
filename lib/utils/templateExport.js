import yaml from 'js-yaml';

/**
 * Export workflow template to YAML format
 * Converts database template to BMAD-core compatible YAML structure
 */
export function exportTemplateToYAML(template) {
  // Convert database template to BMAD-core workflow format
  const workflowData = {
    workflow: {
      id: template.id || template._id,
      name: template.name,
      description: template.description || '',
      type: template.type || 'general',
      project_types: template.project_types || [],
      sequence: template.sequence || [],
      decision_guidance: {
        when_to_use: template.decision_guidance?.when_to_use || [],
        ...(template.decision_guidance || {})
      },
      handoff_prompts: template.handoff_prompts || {},
      // Add metadata
      metadata: {
        created_by: 'Admin',
        created_at: template.createdAt || new Date().toISOString(),
        updated_at: template.updatedAt || new Date().toISOString(),
        agents: template.agents || [],
        step_count: template.stepCount || template.sequence?.length || 0,
        complexity: template.complexity || 'Simple',
        estimated_time: template.estimatedTime || '15-30 minutes'
      }
    }
  };

  // Convert to YAML string
  return yaml.dump(workflowData, {
    lineWidth: 80,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
    condenseFlow: false,
    indent: 2
  });
}

/**
 * Export multiple templates as a single YAML file
 */
export function exportMultipleTemplatesToYAML(templates) {
  const workflowsData = {
    workflows: templates.map(template => ({
      id: template.id || template._id,
      name: template.name,
      description: template.description || '',
      type: template.type || 'general',
      project_types: template.project_types || [],
      sequence: template.sequence || [],
      decision_guidance: {
        when_to_use: template.decision_guidance?.when_to_use || [],
        ...(template.decision_guidance || {})
      },
      handoff_prompts: template.handoff_prompts || {},
      metadata: {
        created_by: 'Admin',
        created_at: template.createdAt || new Date().toISOString(),
        updated_at: template.updatedAt || new Date().toISOString(),
        agents: template.agents || [],
        step_count: template.stepCount || template.sequence?.length || 0,
        complexity: template.complexity || 'Simple',
        estimated_time: template.estimatedTime || '15-30 minutes'
      }
    })),
    export_info: {
      exported_at: new Date().toISOString(),
      total_templates: templates.length,
      export_format: 'BMAD Workflow Templates v1.0'
    }
  };

  return yaml.dump(workflowsData, {
    lineWidth: 80,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
    condenseFlow: false,
    indent: 2
  });
}

/**
 * Download YAML content as file
 */
export function downloadYAMLFile(yamlContent, filename = 'workflow-template.yaml') {
  const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
  const link = document.createElement('a');
  
  // Create download URL
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for template export
 */
export function generateExportFilename(template, suffix = '') {
  const name = (template.name || 'template')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 50); // Limit length
  
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `${name}${suffix ? '-' + suffix : ''}-${timestamp}.yaml`;
}

/**
 * Validate YAML content
 */
export function validateYAML(yamlContent) {
  try {
    yaml.load(yamlContent);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}