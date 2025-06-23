declare module '@tryghost/validator' {
    interface Validator {
        isLength(str: string, options?: {min?: number; max?: number}): boolean;
        isEmpty(str: string): boolean;
        isURL(str: string): boolean;
        isEmail(str: string): boolean;
        isIn(str: string, values: string[]): boolean;
        isUUID(str: string, version?: number): boolean;
        isBoolean(str: string): boolean;
        isInt(str: string, options?: {min?: number; max?: number}): boolean;
        isLowercase(str: string): boolean;
        equals(str: string, comparison: string): boolean;
        matches(str: string, pattern: RegExp | string, modifiers?: string): boolean;
        isTimezone(str: string): boolean;
        isEmptyOrURL(str: string): boolean;
        isSlug(str: string): boolean;
    }
    
    export function validate(schema: Record<string, unknown>, data: Record<string, unknown>): {isValid: boolean; errors: Record<string, unknown>[]};
    
    const validator: Validator;
    export default validator;
}