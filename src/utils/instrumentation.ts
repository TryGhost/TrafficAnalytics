/*instrumentation.ts*/
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {TraceExporter as GCPTraceExporter} from '@google-cloud/opentelemetry-cloud-trace-exporter';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';
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
const serviceName = process.env.K_SERVICE || process.env.WORKER_MODE ? 'analytics-worker' : 'analytics-service';
const serviceVersion = process.env.K_REVISION || 'unknown';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion
    }), 
    traceExporter: getTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
