/*instrumentation.ts*/
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ConsoleSpanExporter} from '@opentelemetry/sdk-trace-node';
import {
    PeriodicExportingMetricReader,
    ConsoleMetricExporter
} from '@opentelemetry/sdk-metrics';
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions';
import {resourceFromAttributes} from '@opentelemetry/resources';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'analytics-service',
        [ATTR_SERVICE_VERSION]: '1.0'
    }), 
    traceExporter: new ConsoleSpanExporter(),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter()
    })
});

sdk.start();
