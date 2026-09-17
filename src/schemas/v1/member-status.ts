import {z} from 'zod';

// Stored events retain the original contract so queued Pub/Sub messages can drain.
export const StoredMemberStatusSchema = z.string().min(1);

// New HTTP requests must use one of the supported statuses.
// 'undefined' represents an anonymous / logged-out visitor.
// Keep the TypeScript type compatible with processed events assigned to request.body.
export const MemberStatusSchema: z.ZodType<string> = z.enum(['undefined', 'paid', 'free', 'comped', 'gift']);
