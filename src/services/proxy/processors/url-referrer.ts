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

    const parsedReferrer = referrerParser.parse(referrerData.url, referrerData.source ?? undefined, referrerData.medium ?? undefined);
    delete request.body.payload.parsedReferrer;
    request.body.payload.meta = request.body.payload.meta || {};
    request.body.payload.meta.referrerUrl = parsedReferrer.referrerUrl || undefined;
    request.body.payload.meta.referrerSource = parsedReferrer.referrerSource || undefined;
    request.body.payload.meta.referrerMedium = parsedReferrer.referrerMedium || undefined;
}
