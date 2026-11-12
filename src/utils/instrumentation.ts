/*instrumentation.ts*/
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {OTLPTraceExporter as OTLPProtoTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import {GoogleAuth} from 'google-auth-library';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {UndiciInstrumentation} from '@opentelemetry/instrumentation-undici';
import {fastifyOtelInstrumentation, IGNORED_PATHS} from './fastify-otel';
import {SpanExporter} from '@opentelemetry/sdk-trace-base';
import {getDefaultServiceName} from './service-name';

const useGcp = process.env.OTEL_TRACE_EXPORTER === 'gcp' || Boolean(process.env.K_SERVICE);
const googleAuth = useGcp ? new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
}) : undefined;

// Determine which trace exporter to use based on environment
function getTraceExporter(): SpanExporter {
    if (googleAuth) {
        const auth = googleAuth;
        return new OTLPProtoTraceExporter({
            url: 'https://telemetry.googleapis.com/v1/traces',
            // Resolve headers for every export so ADC can refresh expired tokens.
            headers: async () => Object.fromEntries((await auth.getRequestHeaders()).entries())
        });
    } else {
        // Use Jaeger for local development
        return new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://jaeger:4318/v1/traces',
            concurrencyLimit: 100
        });
    }
}

// Use K_SERVICE for GCP, or WORKER_MODE for local development
const serviceName = process.env.K_SERVICE || getDefaultServiceName(process.env.WORKER_MODE || '');
const serviceVersion = process.env.K_REVISION || 'unknown';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
        // The SDK waits for asynchronous resource attributes before exporting.
        ...(googleAuth ? {'gcp.project_id': googleAuth.getProjectId()} : {})
    }),
    traceExporter: getTraceExporter(),
    // Only instrumentations that survive the bundled production build: the
    // bundle inlines node_modules, so anything relying on a require hook to
    // patch a package has nothing left to patch. These hook node builtins or
    // diagnostics channels instead. gRPC traffic is covered by the native
    // OpenTelemetry support in the Pub/Sub and Firestore clients.
    instrumentations: [
        new HttpInstrumentation({
            // Drop the health probe spans the Fastify instrumentation already skips
            ignoreIncomingRequestHook: request => IGNORED_PATHS.has((request.url ?? '/').split('?')[0])
        }),
        new UndiciInstrumentation(),
        fastifyOtelInstrumentation
    ]
});

sdk.start();
