/*instrumentation.ts*/
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {TraceExporter as GCPTraceExporter} from '@google-cloud/opentelemetry-cloud-trace-exporter';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {UndiciInstrumentation} from '@opentelemetry/instrumentation-undici';
import {fastifyOtelInstrumentation, IGNORED_PATHS} from './fastify-otel';
import {SpanExporter} from '@opentelemetry/sdk-trace-base';

// Determine which trace exporter to use based on environment
function getTraceExporter(): SpanExporter {
    const traceExporterType = process.env.OTEL_TRACE_EXPORTER || 'jaeger';
    
    if (traceExporterType === 'gcp' || process.env.K_SERVICE) {
        // Use Google Cloud Trace for GCP environments
        // K_SERVICE is automatically set by Cloud Run
        return new GCPTraceExporter();
    } else {
        // Use Jaeger for local development
        return new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://jaeger:4318/v1/traces',
            concurrencyLimit: 100
        });
    }
}

// Use K_SERVICE for GCP, or WORKER_MODE for local development
// TODO: `||` binds tighter than `?:`, so this reads as
// `(K_SERVICE || WORKER_MODE) ? ... : ...`. K_SERVICE is always set on Cloud Run,
// so both the ingest and worker services report as 'analytics-worker' in
// production. Likely intended: `K_SERVICE || (WORKER_MODE ? ... : ...)`.
// Fixing it renames a service in Cloud Trace, so check dashboards/alerts first.
const serviceName = process.env.K_SERVICE || process.env.WORKER_MODE ? 'analytics-worker' : 'analytics-service';
const serviceVersion = process.env.K_REVISION || 'unknown';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion
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
