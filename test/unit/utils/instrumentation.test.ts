import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {NodeSDKConfiguration} from '@opentelemetry/sdk-node';

const mocks = vi.hoisted(() => ({
    sdk: vi.fn(),
    start: vi.fn(),
    jsonExporter: vi.fn(),
    protoExporter: vi.fn(),
    googleAuth: vi.fn(),
    getProjectId: vi.fn(),
    getRequestHeaders: vi.fn()
}));

vi.mock('@opentelemetry/sdk-node', () => ({
    NodeSDK: class {
        constructor(options: NodeSDKConfiguration) {
            mocks.sdk(options);
        }

        start = mocks.start;
    }
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
    OTLPTraceExporter: class {
        constructor(options: unknown) {
            mocks.jsonExporter(options);
        }
    }
}));
vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
    OTLPTraceExporter: class {
        constructor(options: unknown) {
            mocks.protoExporter(options);
        }
    }
}));
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        constructor(options: unknown) {
            mocks.googleAuth(options);
        }

        getProjectId = mocks.getProjectId;
        getRequestHeaders = mocks.getRequestHeaders;
    }
}));

describe('instrumentation', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.stubEnv('K_SERVICE', '');
        vi.stubEnv('K_REVISION', '');
        vi.stubEnv('WORKER_MODE', '');
        vi.stubEnv('OTEL_TRACE_EXPORTER', '');
        vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', '');
        mocks.getProjectId.mockResolvedValue('trace-project');
    });

    it('defaults to local Jaeger without looking up Google credentials', async () => {
        await import('../../../src/utils/instrumentation');

        expect(mocks.jsonExporter).toHaveBeenCalledWith({
            url: 'http://jaeger:4318/v1/traces',
            concurrencyLimit: 100
        });
        expect(mocks.googleAuth).not.toHaveBeenCalled();
        expect(mocks.sdk.mock.calls[0][0].resource.attributes).toMatchObject({
            'service.name': 'analytics-service',
            'service.version': 'unknown'
        });
        expect(mocks.start).toHaveBeenCalledOnce();
    });

    it('honors the local exporter endpoint and worker service name', async () => {
        vi.stubEnv('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'http://collector:4318/v1/traces');
        vi.stubEnv('WORKER_MODE', 'true');
        await import('../../../src/utils/instrumentation');

        expect(mocks.jsonExporter).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://collector:4318/v1/traces'
        }));
        expect(mocks.sdk.mock.calls[0][0].resource.attributes['service.name']).toBe('analytics-worker');
    });

    it('automatically exports protobuf to Google on Cloud Run', async () => {
        vi.stubEnv('OTEL_TRACE_EXPORTER', 'jaeger');
        vi.stubEnv('K_SERVICE', 'traffic-analytics');
        vi.stubEnv('K_REVISION', 'revision-1');
        await import('../../../src/utils/instrumentation');

        expect(mocks.protoExporter).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://telemetry.googleapis.com/v1/traces'
        }));
        expect(mocks.jsonExporter).not.toHaveBeenCalled();
        expect(mocks.googleAuth).toHaveBeenCalledWith({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const resource = mocks.sdk.mock.calls[0][0].resource;
        await resource.waitForAsyncAttributes();
        expect(resource.attributes).toMatchObject({
            'gcp.project_id': 'trace-project',
            'service.name': 'traffic-analytics',
            'service.version': 'revision-1'
        });
    });

    it('fetches fresh ADC headers for each export and propagates auth failures', async () => {
        vi.stubEnv('OTEL_TRACE_EXPORTER', 'gcp');
        mocks.getRequestHeaders
            .mockResolvedValueOnce(new Headers({authorization: 'Bearer first'}))
            .mockResolvedValueOnce(new Headers({authorization: 'Bearer refreshed', 'x-goog-user-project': 'quota-project'}))
            .mockRejectedValueOnce(new Error('ADC unavailable'));
        await import('../../../src/utils/instrumentation');
        expect(mocks.protoExporter).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://telemetry.googleapis.com/v1/traces'
        }));
        const {headers} = mocks.protoExporter.mock.calls[0][0];

        expect(await headers()).toEqual({authorization: 'Bearer first'});
        expect(await headers()).toEqual({authorization: 'Bearer refreshed', 'x-goog-user-project': 'quota-project'});
        await expect(headers()).rejects.toThrow('ADC unavailable');
    });
});
