import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {spawn, ChildProcess} from 'child_process';
import {join} from 'path';

describe('Worker Process', () => {
    let workerProcess: ChildProcess;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(async () => {
        if (workerProcess && !workerProcess.killed) {
            workerProcess.kill('SIGTERM');
            // Wait a bit for graceful shutdown
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
        }
    });

    it('should start successfully', async () => {
        const projectRoot = join(__dirname, '../..');
        workerProcess = spawn('npx', ['tsx', 'worker.ts'], {
            cwd: projectRoot,
            env: {
                ...process.env,
                NODE_ENV: 'development', // Use development to get logs
                LOG_LEVEL: 'info'
            }
        });

        // Wait for worker to start
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });

        // Check that process is running and hasn't exited with error
        expect(workerProcess.killed).toBe(false);
        expect(workerProcess.exitCode).toBeNull();
    }, 10000);

    it('should exit cleanly when terminated', async () => {
        const projectRoot = join(__dirname, '../..');
        workerProcess = spawn('npx', ['tsx', 'worker.ts'], {
            cwd: projectRoot,
            env: {
                ...process.env,
                NODE_ENV: 'development',
                LOG_LEVEL: 'info'
            }
        });

        // Wait for worker to start
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });

        // Send SIGTERM
        workerProcess.kill('SIGTERM');

        // Wait for shutdown and check exit code
        const exitCode = await new Promise((resolve) => {
            workerProcess.on('exit', resolve);
        });

        expect(exitCode).toBe(0);
    }, 10000);
});