import FastifyOtelInstrumentation from '@fastify/otel';

// Health endpoints, polled constantly by Cloud Run. Tracing them would produce a
// request span plus one per lifecycle hook on every probe, and the worker app
// serves almost nothing else, so it would report little but probe noise. Also
// used to filter incoming requests in `instrumentation.ts`.
export const IGNORED_PATHS = new Set(['/', '/health', '/info']);

// Registered explicitly by each app via `.plugin()` rather than through
// `registerOnInitialization`. That option subscribes to the `fastify.initialization`
// diagnostics channel, and since the subscription outlives the module that created
// it, re-evaluating this module (as the tests do via `vi.resetModules()`) leaves
// several live subscribers that all try to decorate the same Fastify instance.
//
// Kept in its own module so the apps can register the plugin without importing
// `instrumentation.ts`, which starts the OpenTelemetry SDK as a side effect.
export const fastifyOtelInstrumentation = new FastifyOtelInstrumentation({
    ignorePaths: routeOptions => IGNORED_PATHS.has(routeOptions.url)
});
