import pino from 'pino';
import {getLoggerConfig} from './logger-config';

// Create the default logger instance
const logger = pino(getLoggerConfig());

export default logger;
