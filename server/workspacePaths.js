import fs from 'node:fs';
import path from 'node:path';

export function isInsideDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function createWorkspaceResolver(rootDir) {
  return function resolveWorkspacePath(input) {
    const relPath = String(input || '').trim();
    if (!relPath || path.isAbsolute(relPath)) throw new Error('Use a relative path inside the Aspira workspace.');
    const fullPath = path.resolve(rootDir, relPath);
    const realRoot = fs.realpathSync(rootDir);
    if (!isInsideDirectory(rootDir, fullPath)) throw new Error('Path traversal outside the workspace is not permitted.');

    let existingAncestor = fullPath;
    while (!fs.existsSync(existingAncestor)) {
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw new Error('Could not resolve a safe workspace path.');
      existingAncestor = parent;
    }
    const realAncestor = fs.realpathSync(existingAncestor);
    if (!isInsideDirectory(realRoot, realAncestor)) throw new Error('Symlink paths outside the workspace are not permitted.');
    const resolvedTarget = fs.existsSync(fullPath)
      ? fs.realpathSync(fullPath)
      : path.resolve(realAncestor, path.relative(existingAncestor, fullPath));
    if (!isInsideDirectory(realRoot, resolvedTarget)) {
      throw new Error('Symlink paths outside the workspace are not permitted.');
    }
    return { fullPath, relPath, safeRelPath: path.relative(realRoot, resolvedTarget) };
  };
}

export const WORKSPACE_IGNORED_NAMES = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.venv', 'venv',
]);
export const WORKSPACE_TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.css', '.html',
  '.py', '.yml', '.yaml', '.toml', '.xml', '.sh', '.sql', '.swift', '.go', '.rs',
]);

export function isSensitiveWorkspacePath(relPath) {
  return /(^|[\\/])(?:\.env(?:\.[^\\/]*)?|\.ssh|\.gnupg|credentials?(?:\.[^\\/]*)?|secrets?(?:\.[^\\/]*)?|id_rsa|id_ed25519)(?:[\\/]|$)|\.(?:pem|p12|pfx|key)$/i.test(relPath);
}

export function assertReadableWorkspacePath(relPath) {
  if (isSensitiveWorkspacePath(relPath)) {
    throw new Error('This path is excluded from agent file access because it may contain credentials.');
  }
  const segments = relPath.split(/[\\/]+/).filter((segment) => segment && segment !== '.');
  if (
    segments.some((segment) => segment.startsWith('.') || WORKSPACE_IGNORED_NAMES.has(segment)) ||
    /^server[\\/]data(?:[\\/]|$)/i.test(relPath)
  ) {
    throw new Error('Hidden, generated, dependency, and private local-data paths are excluded from agent file access.');
  }
}
