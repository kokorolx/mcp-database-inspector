import { z } from 'zod';
export declare const inspectTableSchema: z.ZodObject<{
    table: z.ZodString;
}, "strip", z.ZodTypeAny, {
    table: string;
}, {
    table: string;
}>;
export declare const listTablesSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
