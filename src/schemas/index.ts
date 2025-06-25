import {registerFormatValidators} from './format-registry';

// Ensure format validators are registered before any schema usage
registerFormatValidators();

// Export current version (v1)
export * from './v1';

// Version-specific exports for explicit imports
export * as v1 from './v1';