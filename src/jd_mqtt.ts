import Aedes from 'aedes';
import mqtt from 'mqtt';
import net from 'net';
import { jdunpack, JDServiceServer, CloudAdapterServer } from 'jacdac-ts';

interface Options {
    connectionName?: string;
}

class MQTTServer extends CloudAdapterServer {
    private server: net.Server;
    static broker: Aedes;
    constructor(options: Options = {}) {
        super({
            connectionName: "mqtt://localhost:1883",
        });
        this.startBroker();
    }

    async startBroker(): Promise<void> {
        if (MQTTServer.broker) 
            return;
        const broker = new Aedes();
        broker.on('clientReady', (client: any) => {
            console.log("client ready", client.id);
        });
        broker.on('clientDisconnect', (client: any) => {
            console.log("client disconnect", client.id);
        });

        this.server = net.createServer(broker.handle);
        this.server.listen(1883);
        console.log("MQTT server started");
        this.connected = true;

        MQTTServer.broker = broker;
    }
}

export { MQTTServer };