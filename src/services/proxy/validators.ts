import errors from '@tryghost/errors';
import {FastifyRequest} from '../../types';

// A validator is a function that accepts a request object and throws an error if the request is invalid
// If an error is thrown, the request is rejected
// If no error is thrown, the request continues to the next step

export function validateQueryParams(request: FastifyRequest): void {
    const token = request.query.token;
    const name = request.query.name;

    if (!token || token.trim() === '' || !name || name.trim() === '') {
        throw new errors.BadRequestError({
            message: 'Token and name query parameters are required'
        });
    }
}

export function validateRequestBody(request: FastifyRequest): void {
    // Validate the request body
    if (!request.body || Object.keys(request.body).length === 0 || !request.body.payload) {
        // TODO: This should throw an error, not return a reply
        throw new errors.BadRequestError({
            message: 'Request body is required'
        });
    }
}
