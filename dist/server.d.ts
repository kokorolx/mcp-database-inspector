import { DatabaseManager } from './database/manager.js';
export declare class DatabaseInspectorServer {
    private server;
    private dbManager;
    constructor();
    private setupHandlers;
    initialize(connectionUrls: string[]): Promise<void>;
    run(): Promise<void>;
    shutdown(): Promise<void>;
    getDatabaseManager(): DatabaseManager;
    getServerInfo(): Promise<any>;
}
export default DatabaseInspectorServer;
//# sourceMappingURL=server.d.ts.map