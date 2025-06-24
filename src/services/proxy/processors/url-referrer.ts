import {FastifyRequest} from '../../../types/index.js';
import {ReferrerParser} from '@tryghost/referrer-parser';

const referrerParser = new ReferrerParser();

type ReferrerData = {
    url: string;
    source: string;
    medium: string;
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

    // Parse the richer referrer data from the client and only return the processed source (this does grouping by domain for us)
    const parsedReferrer = referrerParser.parse(referrerData.url, referrerData.source ?? undefined, referrerData.medium ?? undefined);
    delete request.body.payload.parsedReferrer;
    request.body.payload.referrer = parsedReferrer.referrerSource || null;
}
