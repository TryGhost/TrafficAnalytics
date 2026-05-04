import {FormatRegistry} from '@sinclair/typebox';
import validator from '@tryghost/validator';

/**
 * Registers all format validators used by schemas.
 * This should be called once at application startup to ensure
 * format validators are available before any schema usage.
 */
export function registerFormatValidators(): void {
    FormatRegistry.Set('uuid', (value) => {
        // We only require UUID-shaped values here; they do not need to be fully RFC compliant.
        return validator.isUUID(value, 'loose');
    });

    // URI format validator using @tryghost/validator
    FormatRegistry.Set('uri', (value) => {
        return validator.isURL(value);
    });

    // ISO8601 date-time format validator
    FormatRegistry.Set('date-time', (value) => {
        // Use native Date parsing which handles ISO8601 formats properly
        const date = new Date(value);
        return !isNaN(date.getTime()) && date.toISOString() === value;
    });
}
