const errors = require('@tryghost/errors');

// A validator is a function that accepts a request object and throws an error if the request is invalid
// If an error is thrown, the request is rejected
// If no error is thrown, the request continues to the next step

function validateQueryParams(request) {
    const token = request.query.token;
    const name = request.query.name;

    if (!token || token.trim() === '' || !name || name.trim() === '') {
        throw new errors.BadRequestError({
            message: 'Token and name query parameters are required'
        });
    }
}

function validateRequestBody(request) {
    // Validate the request body
    if (!request.body || Object.keys(request.body).length === 0 || !request.body.payload) {
        // TODO: This should throw an error, not return a reply
        throw new errors.BadRequestError({
            message: 'Request body is required'
        });
    }
}

module.exports = {
    validateQueryParams,
    validateRequestBody
};
