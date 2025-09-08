import {FastifyRequest} from '../../../types/index.js';
import {ReferrerParser} from '@tryghost/referrer-parser';

const referrerParser = new ReferrerParser();

type ReferrerData = {
    url: string;
    source: string;
    medium: string;
    utmSource?: string;
    utmMedium?: string;
    utmTerm?: string;
    utmCampaign?: string;
    utmContent?: string;
}

export function parseReferrer(request: FastifyRequest): void {
    if (!referrerParser) {
        return;
    }

    const referrerHeader = request.body.payload.parsedReferrer;
    if (!referrerHeader || typeof referrerHeader !== 'object') {
        return;
    }

    const referrerData = referrerHeader as unknown as ReferrerData;
    if (!referrerData.url) {
        return;
    }

    const parsedReferrer = referrerParser.parse(referrerData.url, referrerData.source ?? undefined, referrerData.medium ?? undefined);
    request.body.payload.referrerSource = parsedReferrer.referrerSource || null;
    request.body.payload.referrerUrl = parsedReferrer.referrerUrl || null;
    request.body.payload.referrerMedium = parsedReferrer.referrerMedium || null;
    
    // Extract UTM parameters from the parsedReferrer object
    request.body.payload.utmSource = referrerData.utmSource || null;
    request.body.payload.utmMedium = referrerData.utmMedium || null;
    request.body.payload.utmTerm = referrerData.utmTerm || null;
    request.body.payload.utmCampaign = referrerData.utmCampaign || null;
    request.body.payload.utmContent = referrerData.utmContent || null;
}
