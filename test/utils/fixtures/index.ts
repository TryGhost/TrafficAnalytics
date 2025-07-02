// Lazy load the fixtures to avoid loading all of them into memory at once
// Each fixture will be cached after first access using Node's require cache
const fixtures = {
    get defaultValidRequestHeaders() {
        return require('./defaultValidRequestHeaders.json');
    },
    get defaultValidRequestBody() {
        return require('./defaultValidRequestBody.json');
    },
    get defaultValidRequestQuery() {
        return require('./defaultValidRequestQuery.json');
    },
    get headersWithoutSiteUuid() {
        return require('./headersWithoutSiteUuid.json');
    },
    get headersWithoutUserAgent() {
        return require('./headersWithoutUserAgent.json');
    },
    get headersWithInvalidContentType() {
        return require('./headersWithInvalidContentType.json');
    }
} as const;

export type FixtureName = keyof typeof fixtures;

export default fixtures;