declare module '@tryghost/config' {
    interface Config {
        get<T = unknown>(key: string): T;
        set(key: string, value: unknown): void;
        has(key: string): boolean;
    }
    
    const config: Config;
    export default config;
}