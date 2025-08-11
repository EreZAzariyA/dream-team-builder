const path = require('path');

const projectRoot = process.cwd();

/**
 * Validates a file path to ensure it is absolute, canonical, and within the project root.
 * Prevents path traversal attacks.
 * @param {string} filePath - The file path to validate.
 * @returns {boolean} True if the path is valid and safe, false otherwise.
 */
const validateFilePath = (filePath) => {
  if (!path.isAbsolute(filePath)) {
    console.error(`[FileValidator] Path is not absolute: ${filePath}`);
    return false;
  }

  const relativePath = path.relative(projectRoot, filePath);

  // Check if the path goes outside the project root
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    console.error(`[FileValidator] Path attempts to access outside project root: ${filePath}`);
    return false;
  }

  // Check for null bytes or other malicious characters (basic check)
  if (filePath.includes('\0')) {
    console.error(`[FileValidator] Path contains null byte: ${filePath}`);
    return false;
  }

  // Additional checks can be added here, e.g., whitelisting allowed directories

  return true;
};

module.exports = { validateFilePath };
