import Aedes from 'aedes';
import net from 'net';
import { jdunpack, JDServiceServer, CloudAdapterServer, UPLOAD_JSON, UPLOAD_BIN, jdpack } from 'jacdac-ts';

interface Options {
    host?: string;
    topic?: string;
}

class MQTTServer extends CloudAdapterServer {
    private server: net.Server;
    private topic: string;
    static broker: Aedes;
    // private client: AedesClient;
    constructor(options: Options = {}) {
        let connectionName = "mqtt://localhost:1883";
        if (options.host) {
            connectionName = `mqtt://${options.host}`;
        }
        super({
            connectionName
        });

        this.topic = options.topic || "jacdac";

        if (connectionName === "mqtt://localhost:1883"){
            this.startBroker()
        }
        // this.client = new AedesClient(MQTTServer.broker, {}, {});
        // this.client = mqtt.connect(connectionName);
        // this.client.on('connect', () => {
        //     console.log("MQTT client connected");
        //     this.connected = true;
        //     this.client.subscribe(this.topic);
        // });
        // this.client.on('message', (topic, message) => {
        //     // post EVT_JSON: 0x80 to jacdac
        //     const json = message.toString();
        //     this.sendEvent(0x80, jdpack("z s", [topic, json]));
        // });
        // this.on(UPLOAD_JSON, ({json}) => {
        //     this.client.publish(this.topic, JSON.stringify(json))
        // })
        // this.on(UPLOAD_BIN, ({data}) => {
        //     this.client.publish(this.topic, data)
        // })
    }

    startBroker(): Promise<void> {
        if (MQTTServer.broker) 
            return;
        const broker = new Aedes({
            id: "jd-mqtt-borker",
        });
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