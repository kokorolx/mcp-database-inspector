import { DatabaseManager } from './database/manager.js';
export declare class MySQLInspectorServer {
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
export default MySQLInspectorServer;
//# sourceMappingURL=server.d.ts.map