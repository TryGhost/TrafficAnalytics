/*instrumentation.ts*/
import {NodeSDK} from '@opentelemetry/sdk-node';
import {PeriodicExportingMetricReader} from '@opentelemetry/sdk-metrics';
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {getNodeAutoInstrumentations} from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'analytics-service',
        [ATTR_SERVICE_VERSION]: '1.0'
    }), 
    traceExporter: new OTLPTraceExporter({
        url: 'http://jaeger:4318/v1/traces',
        concurrencyLimit: 100
    }),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: 'http://jaeger:4318/v1/metrics'
        })
    }),
    instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
