// Compatibility entry point: validate intentional vector joins and source
// fidelity instead of mistaking the sharp tips of M/W for skeleton spikes.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync('python3', [fileURLToPath(new URL('./audit_handwriting_paths.py', import.meta.url))], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
