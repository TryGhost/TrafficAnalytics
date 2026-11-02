import {randomUUID} from 'node:crypto';
import {monitorEventLoopDelay, performance, PerformanceObserver} from 'node:perf_hooks';
import type {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';
import {ActiveOperations, activePublishes} from '../utils/active-operations';

const INTERVAL_MS = 10_000;
const processStartId = randomUUID();

async function diagnosticSnapshots(fastify: FastifyInstance) {
    const requests = new ActiveOperations();
    fastify.addHook('onRequest', async (request, reply) => {
        const finish = requests.start();
        // close also covers disconnected clients; remove both listeners on completion.
        const complete = () => {
            finish();
            reply.raw.off('finish', complete);
            reply.raw.off('close', complete);
        };
        reply.raw.once('finish', complete);
        reply.raw.once('close', complete);
    });

    let stop: (() => void) | undefined;
    fastify.addHook('onReady', async () => {
        const delay = monitorEventLoopDelay({resolution: 20});
        delay.enable();
        let gcCount = 0;
        let gcTotalMs = 0;
        let gcMaxMs = 0;
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                gcCount += 1;
                gcTotalMs += entry.duration;
                gcMaxMs = Math.max(gcMaxMs, entry.duration);
            }
        });
        observer.observe({entryTypes: ['gc']});
        let previousTime = performance.now();
        let previousCpu = process.cpuUsage();
        let previousUtilization = performance.eventLoopUtilization();
        const timer = setInterval(() => {
            const now = performance.now();
            const intervalMs = now - previousTime;
            const cpu = process.cpuUsage();
            const utilization = performance.eventLoopUtilization();
            const delta = performance.eventLoopUtilization(utilization, previousUtilization);
            const memory = process.memoryUsage();
            fastify.log.info({
                event: 'DiagnosticSnapshot',
                processStartId,
                revision: process.env.K_REVISION ?? 'unknown',
                uptimeSeconds: process.uptime(),
                intervalMs,
                missedIntervals: Math.max(0, Math.floor(intervalMs / INTERVAL_MS) - 1),
                eventLoop: {
                    utilization: delta.utilization,
                    delayP99Ms: delay.count ? delay.percentile(99) / 1e6 : 0,
                    delayMaxMs: delay.count ? delay.max / 1e6 : 0
                },
                cpu: {
                    userMs: (cpu.user - previousCpu.user) / 1000,
                    systemMs: (cpu.system - previousCpu.system) / 1000
                },
                memoryBytes: memory,
                gc: {count: gcCount, totalMs: gcTotalMs, maxMs: gcMaxMs},
                requests: requests.snapshot(),
                publishes: activePublishes.snapshot()
            });
            previousTime = now;
            previousCpu = cpu;
            previousUtilization = utilization;
            delay.reset();
            gcCount = gcTotalMs = gcMaxMs = 0;
        }, INTERVAL_MS);
        timer.unref();
        stop = () => {
            clearInterval(timer);
            delay.disable();
            observer.disconnect();
        };
    });
    fastify.addHook('onClose', async () => {
        stop?.();
    });
}

export default fp(diagnosticSnapshots);
