import path from 'path';
import { randomUUID } from 'crypto';
import {
  closeSync, fsyncSync, mkdirSync, openSync, realpathSync, renameSync, statSync, unlinkSync, writeSync,
} from 'fs';

// Social Tech Design §7.4: the private root must be absolute, an existing writable
// directory, and must not resolve (after realpath) inside any public static root.
// The same containment applies to its working directories `tmp/` and `media/`:
// each must resolve (after realpath, so through any symlink) to a directory inside the
// private root and outside every public static root.

/** realpath of the path, or of its nearest existing ancestor joined with the rest. */
export function resolveReal(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    const parent = path.dirname(target);
    if (parent === target) return target;
    return path.join(resolveReal(parent), path.basename(target));
  }
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Validated real locations of the private root and its working directories. */
export interface PrivateUploadsLayout {
  readonly root: string;
  readonly tmp: string;
  readonly media: string;
}

export type LayoutCheck = { layout: PrivateUploadsLayout; problems: [] } | { layout: null; problems: string[] };

function checkRoot(root: string | undefined, publicRoots: readonly string[]): { real: string } | { problems: string[] } {
  if (!root || root.trim() === '') return { problems: ['PRIVATE_UPLOADS_DIR is required'] };
  if (!path.isAbsolute(root)) return { problems: ['PRIVATE_UPLOADS_DIR must be an absolute path'] };
  let real: string;
  try {
    real = realpathSync(root);
    if (!statSync(real).isDirectory()) return { problems: ['PRIVATE_UPLOADS_DIR must be a directory'] };
  } catch {
    return { problems: ['PRIVATE_UPLOADS_DIR must be an existing directory'] };
  }
  for (const publicRoot of publicRoots) {
    if (isInside(real, resolveReal(publicRoot))) {
      return { problems: ['PRIVATE_UPLOADS_DIR must not be inside a public static root'] };
    }
  }
  return { real };
}

function checkSubdirectory(realRoot: string, name: 'tmp' | 'media', publicRoots: readonly string[]): { real: string } | { problem: string } {
  let real: string;
  try {
    real = realpathSync(path.join(realRoot, name));
    if (!statSync(real).isDirectory()) return { problem: `PRIVATE_UPLOADS_DIR/${name} must be a directory` };
  } catch {
    return { problem: `PRIVATE_UPLOADS_DIR/${name} must be an existing directory` };
  }
  if (real === realRoot || !isInside(real, realRoot)) {
    return { problem: `PRIVATE_UPLOADS_DIR/${name} must resolve inside PRIVATE_UPLOADS_DIR` };
  }
  for (const publicRoot of publicRoots) {
    if (isInside(real, resolveReal(publicRoot))) {
      return { problem: `PRIVATE_UPLOADS_DIR/${name} must not be inside a public static root` };
    }
  }
  return { real };
}

/**
 * Read-only containment check of an existing layout (no directory is created).
 * Used at startup after preparation and by the runtime storage before it is used.
 */
export function checkPrivateUploadsLayout(root: string | undefined, publicRoots: readonly string[]): LayoutCheck {
  const base = checkRoot(root, publicRoots);
  if ('problems' in base) return { layout: null, problems: base.problems };
  const tmp = checkSubdirectory(base.real, 'tmp', publicRoots);
  const media = checkSubdirectory(base.real, 'media', publicRoots);
  const problems = [tmp, media].flatMap(result => ('problem' in result ? [result.problem] : []));
  if (problems.length > 0 || !('real' in tmp) || !('real' in media)) return { layout: null, problems };
  // tmp/ is swept wholesale by the cleanup job; it must never alias media/.
  if (isInside(tmp.real, media.real) || isInside(media.real, tmp.real)) {
    return { layout: null, problems: ['PRIVATE_UPLOADS_DIR/tmp and PRIVATE_UPLOADS_DIR/media must be separate directories'] };
  }
  return { layout: { root: base.real, tmp: tmp.real, media: media.real }, problems: [] };
}

/** Returns a list of problems; empty when the root is valid. Creates `tmp/` and `media/`. */
export function validatePrivateUploadsRoot(root: string | undefined, publicRoots: readonly string[]): string[] {
  const base = checkRoot(root, publicRoots);
  if ('problems' in base) return base.problems;
  try {
    // An existing entry (including a symlink) is left as is and checked below.
    mkdirSync(path.join(base.real, 'tmp'), { recursive: true, mode: 0o700 });
    mkdirSync(path.join(base.real, 'media'), { recursive: true, mode: 0o700 });
  } catch {
    // Fall through: the containment check reports the precise problem.
  }
  const { layout, problems } = checkPrivateUploadsLayout(root, publicRoots);
  if (!layout) return problems;
  try {
    const probe = path.join(layout.tmp, `.probe-${randomUUID()}`);
    const fd = openSync(probe, 'wx', 0o600);
    try {
      writeSync(fd, 'probe');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const renamed = `${probe}.renamed`;
    renameSync(probe, renamed);
    unlinkSync(renamed);
  } catch {
    return ['PRIVATE_UPLOADS_DIR must allow write, rename and delete'];
  }
  return [];
}
