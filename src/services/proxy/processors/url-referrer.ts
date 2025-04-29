import {FastifyRequest} from '../../../types/index.js';
import {ReferrerParser} from '@tryghost/referrer-parser';
import type {ReferrerData} from '@tryghost/referrer-parser';


const referrerParser = new ReferrerParser();

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

    const parsedReferrer = referrerParser.parse(referrerData.referrerUrl, referrerData.referrerSource, referrerData.referrerMedium ?? undefined);
    request.body.payload.meta = request.body.payload.meta || {};
    request.body.payload.meta.referrerUrl = parsedReferrer.referrerUrl;
    request.body.payload.meta.referrerSource = parsedReferrer.referrerSource;
    request.body.payload.meta.referrerMedium = parsedReferrer.referrerMedium;
}
