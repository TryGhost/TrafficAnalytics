import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import request from 'supertest';
import {FastifyInstance} from 'fastify';

describe('Server Conditional Loading', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) {
            await app.close();
        }
        // Clean up environment
        delete process.env.WORKER_MODE;
        vi.resetModules();
        // Note: Global setup handles resource cleanup
    });

    describe('Main App Loading (WORKER_MODE=false)', () => {
        beforeEach(async () => {
            process.env.WORKER_MODE = 'false';
            vi.resetModules();
            
            // Import server module which should load main app
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
        });

        it('should load main app when WORKER_MODE=false', async () => {
            const response = await request(app.server)
                .get('/')
                .expect(200);

            // Main app returns different response than worker
            expect(response.text).toBe('Hello World - Github Actions Deployment Test');
        });

        it('should have proxy routes available in main app', async () => {
            // Main app should have the proxy routes
            const response = await request(app.server)
                .post('/tb/web_analytics?token=test&name=test')
                .send({payload: {site_uuid: 'test'}})
                .set('x-site-uuid', 'test-site');

            // Should not be 404 (route exists, even if it might fail for other reasons)
            expect(response.status).not.toBe(404);
        });
    });

    describe('Main App Loading (WORKER_MODE unset)', () => {
        beforeEach(async () => {
            // Ensure WORKER_MODE is not set
            delete process.env.WORKER_MODE;
            vi.resetModules();
            
            // Import server module which should load main app by default
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
        });

        it('should load main app when WORKER_MODE is unset', async () => {
            const response = await request(app.server)
                .get('/')
                .expect(200);

            // Main app returns different response than worker
            expect(response.text).toBe('Hello World - Github Actions Deployment Test');
        });
    });

    describe('Worker App Loading (WORKER_MODE=true)', () => {
        beforeEach(async () => {
            process.env.WORKER_MODE = 'true';
            vi.resetModules();
            
            // Import server module which should load worker app
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();
        });

        it('should load worker app when WORKER_MODE=true', async () => {
            const response = await request(app.server)
                .get('/')
                .expect(200);

            // Worker app returns JSON response
            expect(response.body).toEqual({
                status: 'worker-healthy'
            });
        });

        it('should have worker health endpoint available', async () => {
            const response = await request(app.server)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'worker-healthy'
            });
        });

        it('should not have proxy routes in worker app', async () => {
            // Worker app should not have proxy routes
            const response = await request(app.server)
                .post('/tb/web_analytics?token=test&name=test')
                .send({payload: {site_uuid: 'test'}})
                .set('x-site-uuid', 'test-site');

            // Should be 404 since worker doesn't have proxy routes
            expect(response.status).toBe(404);
        });

        it('should have logging capability in worker mode', async () => {
            // Test that worker app has logging functionality
            expect(app.log).toBeDefined();
            expect(typeof app.log.info).toBe('function');
            
            // Test that we can log without errors
            expect(() => app.log.info('test heartbeat message')).not.toThrow();
        });
    });

    describe('Environment Variable Handling', () => {
        it('should handle WORKER_MODE with different casing', async () => {
            process.env.WORKER_MODE = 'TRUE';
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();

            const response = await request(app.server)
                .get('/')
                .expect(200);

            // Should still load main app since we check for exact 'true'
            expect(response.text).toBe('Hello World - Github Actions Deployment Test');
        });

        it('should handle WORKER_MODE with random values', async () => {
            process.env.WORKER_MODE = 'maybe';
            vi.resetModules();
            
            const serverModule = await import('../../server');
            app = serverModule.default;
            await app.ready();

            const response = await request(app.server)
                .get('/')
                .expect(200);

            // Should load main app for any value other than 'true'
            expect(response.text).toBe('Hello World - Github Actions Deployment Test');
        });
    });
});