/**
 * File system tools for the AI agent.
 */
import { promises as fs } from 'fs';
import path from 'path';

// Ensure that the AI can only access files within the project directory.
const projectRoot = process.cwd();

function resolvePath(filePath) {
  const absolutePath = path.resolve(projectRoot, filePath);
  if (!absolutePath.startsWith(projectRoot)) {
    throw new Error('File path is outside of the project directory.');
  }
  return absolutePath;
}

export async function readFile({ path: filePath }) {
  const absolutePath = resolvePath(filePath);
  return fs.readFile(absolutePath, 'utf-8');
}

export async function writeFile({ path: filePath, content }) {
  const absolutePath = resolvePath(filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return fs.writeFile(absolutePath, content, 'utf-8');
}

