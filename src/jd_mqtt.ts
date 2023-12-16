import aedes from 'aedes';
import net from 'net';
import { jdunpack, JDServiceServer, CloudAdapterServer } from 'jacdac-ts';

interface Options {
    connectionName?: string;
}

class MQTTServer extends CloudAdapterServer {
    private server: net.Server;
    constructor(options: Options = {}) {
        super({
            connectionName: "mqtt://localhost:1883",
        });
        this.start();
    }

    async start(): Promise<void> {
        aedes().on('clientReady', (client: any) => {
            console.log("client ready", client.id);
        });
        aedes().on('clientDisconnect', (client: any) => {
            console.log("client disconnect", client.id);
        });

        this.server = net.createServer(aedes().handle);
        this.server.listen(1883);
        console.log("MQTT server started");
        this.connected = true;
    }
}

export { MQTTServer };