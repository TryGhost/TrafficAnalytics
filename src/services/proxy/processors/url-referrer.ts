import {FastifyRequest} from '../../../types/index.js';

// Define types locally
interface ReferrerData {
    referrerSource: string;
    referrerMedium: string;
    referrerUrl: string;
}

// Will be initialized asynchronously
let referrerParser: any;

(async () => {
    const module = await import('@tryghost/referrer-parser');
    referrerParser = new module.ReferrerParser();
})();

export function parseReferrer(request: FastifyRequest): void {
    if (!referrerParser) {
        return;
    }

    const referrerHeader = request.headers.parsedReferrer;
    if (!referrerHeader || typeof referrerHeader !== 'object') {
        return;
    }

    const referrerData = referrerHeader as unknown as ReferrerData;
    if (!referrerData.referrerSource || !referrerData.referrerUrl) {
        return;
    }

    const parsedReferrer = referrerParser.parse(referrerData.referrerUrl, referrerData.referrerSource, referrerData.referrerMedium);
    request.body.payload.referrerUrl = parsedReferrer.referrerUrl;
    request.body.payload.referrerSource = parsedReferrer.referrerSource;
    request.body.payload.referrerMedium = parsedReferrer.referrerMedium;
}
