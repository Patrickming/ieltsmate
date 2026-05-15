import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents, 'utf8');
  await chmod(filePath, 0o755);
}

describe('db-backup.sh', () => {
  let sandboxRoot: string | null = null;

  afterEach(async () => {
    if (sandboxRoot) {
      await rm(sandboxRoot, { recursive: true, force: true });
      sandboxRoot = null;
    }
  });

  it('backs up and restores note user images alongside the database dump', async () => {
    sandboxRoot = await mkdtemp(path.join(tmpdir(), 'db-backup-script-'));

    const repoScriptPath = path.resolve(__dirname, '../../db-backup.sh');
    const sandboxScriptPath = path.join(sandboxRoot, 'db-backup.sh');
    const backendDir = path.join(sandboxRoot, 'backend');
    const backupsDir = path.join(backendDir, 'backups');
    const backupFolderName = '2026-05-16_04-16-00';
    const backupDir = path.join(backupsDir, backupFolderName);
    const imageDir = path.join(backendDir, 'uploads', 'note-user-images', '2026', '05');
    const imageFile = path.join(imageDir, 'sample.png');
    const fakeBinDir = path.join(sandboxRoot, 'fake-bin');
    const pgRestoreArgsFile = path.join(sandboxRoot, 'pg-restore-args.txt');

    await mkdir(backupsDir, { recursive: true });
    await mkdir(imageDir, { recursive: true });
    await mkdir(fakeBinDir, { recursive: true });

    await writeFile(path.join(backendDir, '.env'), 'DATABASE_URL=postgresql://user:pass@localhost:5432/ieltsmate?schema=public\n');
    await writeFile(imageFile, 'fake image bytes', 'utf8');
    await writeFile(sandboxScriptPath, await readFile(repoScriptPath, 'utf8'), 'utf8');
    await chmod(sandboxScriptPath, 0o755);

    await writeExecutable(
      path.join(fakeBinDir, 'pg_dump'),
      `#!/usr/bin/env bash
set -euo pipefail

out_file=""
for arg in "$@"; do
  case "$arg" in
    --file=*)
      out_file="\${arg#--file=}"
      ;;
  esac
done

if [ -z "$out_file" ]; then
  echo "missing --file argument" >&2
  exit 1
fi

printf 'fake dump' > "$out_file"
`,
    );

    await writeExecutable(
      path.join(fakeBinDir, 'pg_restore'),
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > "${pgRestoreArgsFile}"
`,
    );

    await writeExecutable(
      path.join(fakeBinDir, 'sleep'),
      `#!/usr/bin/env bash
exit 0
`,
    );

    await writeExecutable(
      path.join(fakeBinDir, 'date'),
      `#!/usr/bin/env bash
set -euo pipefail

printf '${backupFolderName}\n'
`,
    );

    const env = {
      ...process.env,
      PATH: `${fakeBinDir}:${process.env.PATH ?? ''}`,
    };

    await execFileAsync('bash', [sandboxScriptPath, 'backup'], {
      cwd: sandboxRoot,
      env,
    });

    const dumpFile = path.join(backupDir, 'database.dump');
    const imageArchive = path.join(backupDir, 'note-user-images.tar.gz');

    await expect(stat(backupDir)).resolves.toBeDefined();
    await expect(stat(dumpFile)).resolves.toBeDefined();
    await expect(stat(imageArchive)).resolves.toBeDefined();

    await rm(path.join(backendDir, 'uploads', 'note-user-images'), {
      recursive: true,
      force: true,
    });

    await execFileAsync('bash', [sandboxScriptPath, 'restore', backupFolderName], {
      cwd: sandboxRoot,
      env,
    });

    await expect(readFile(imageFile, 'utf8')).resolves.toBe('fake image bytes');
    await expect(readFile(pgRestoreArgsFile, 'utf8')).resolves.toContain('database.dump');
  });
});
