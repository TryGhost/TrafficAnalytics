import pino, {type Logger, type LoggerOptions} from 'pino';
import {Writable} from 'node:stream';

export type JsonLog = Record<string, unknown>;

export type InMemoryLogCapture = {
    logger: Logger;
    drain: () => Promise<void>;
    getLogs: () => JsonLog[];
    findByEvent: (event: string) => JsonLog | undefined;
    clear: () => void;
    stop: () => Promise<void>;
};

export function createInMemoryLogCapture(options: LoggerOptions = {}): InMemoryLogCapture {
    let lines: string[] = [];
    let buffer = '';

    const stream = new Writable({
        write(chunk, _encoding, callback) {
            buffer += chunk.toString();
            const split = buffer.split('\n');
            buffer = split.pop() ?? '';
            lines.push(...split.filter(Boolean));
            callback();
        }
    });

    const logger = pino({level: 'trace', ...options}, stream);

    const parseLines = (): JsonLog[] => {
        if (buffer.trim().length > 0) {
            throw new Error(`Incomplete non-empty log buffer found: ${buffer}`);
        }

        return lines.map((line) => {
            try {
                return JSON.parse(line) as JsonLog;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Non-JSON log line emitted: ${line}\nParse error: ${message}`);
            }
        });
    };

    return {
        logger,
        async drain() {
            await new Promise<void>((resolve) => {
                setImmediate(resolve);
            });
        },
        getLogs: parseLines,
        findByEvent(event: string) {
            return parseLines().find(log => log.event === event);
        },
        clear() {
            lines = [];
            buffer = '';
        },
        stop() {
            return new Promise<void>((resolve) => {
                stream.end(() => {
                    resolve();
                });
            });
        }
    };
}

export function normalizeLogEntry(log: JsonLog): JsonLog {
    const copy = {...log};
    delete copy.level;
    delete copy.time;
    delete copy.pid;
    delete copy.hostname;
    return copy;
}
