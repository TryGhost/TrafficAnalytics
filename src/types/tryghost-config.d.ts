declare module '@tryghost/config' {
    interface Config {
        get(key: string): unknown;
        set(key: string, value: unknown): void;
        has(key: string): boolean;
    }
    
    const config: Config;
    export default config;
}