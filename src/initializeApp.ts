export async function initializeApp({isWorkerMode}: {isWorkerMode: boolean}) {
    const appModulePath = isWorkerMode ? './src/worker-app' : './src/service-app';
    const appModule = await import(appModulePath);
    return appModule.default();
}
