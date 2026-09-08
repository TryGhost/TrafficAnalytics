export function getDefaultServiceName(workerMode: string): string {
    if (workerMode === 'true') {
        return 'analytics-worker';
    }

    if (workerMode === 'tinybird-sync') {
        return 'analytics-tinybird-sync-worker';
    }

    return 'analytics-service';
}
