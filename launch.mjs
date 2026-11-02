// Herdr accepts an argv, not a cwd on pane.split. Start Pi in Main's exact directory
// with its Node executable and CLI. No shell, global key presses, or pasted startup prompt.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const path = process.argv[2];
const { launch } = JSON.parse(readFileSync(path, 'utf8'));
process.chdir(launch.cwd);
Object.assign(process.env, launch.env);
const args = [...launch.argv, '--role-link', path];
if (process.platform !== 'win32' && process.execve) process.execve(process.execPath, [process.execPath, ...args], process.env);
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
