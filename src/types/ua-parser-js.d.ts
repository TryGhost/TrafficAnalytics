declare module 'ua-parser-js' {
    export interface UAOSResult {
        name?: string;
        version?: string;
    }

    export interface UABrowserResult {
        name?: string;
        version?: string;
    }

    export interface UADeviceResult {
        model?: string;
        type?: string;
        vendor?: string;
    }

    export interface UACPUResult {
        architecture?: string;
    }

    export interface UAEngineResult {
        name?: string;
        version?: string;
    }

    export default class UAParser {
        constructor(uastring?: string, extensions?: any);

        getResult(): {
            ua: string;
            browser: UABrowserResult;
            device: UADeviceResult;
            engine: UAEngineResult;
            os: UAOSResult;
            cpu: UACPUResult;
        };

        getUA(): string;
        setUA(ua: string): UAParser;

        getBrowser(): UABrowserResult;
        getDevice(): UADeviceResult;
        getEngine(): UAEngineResult;
        getOS(): UAOSResult;
        getCPU(): UACPUResult;
    }
}
