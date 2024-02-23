import Aedes from 'aedes';
import net from 'net';
import MQTTClient from './mqtt_client';
import { jdunpack, JDServiceServer, CloudAdapterServer, UPLOAD_JSON, UPLOAD_BIN, jdpack } from 'jacdac-ts';

interface Options {
    host?: string;
    topic?: string;
}
const SRV_PC_MONITOR = 0x113d0988;
class MQTTServer extends JDServiceServer {
    private server: net.Server;
    private topic: string;
    static broker: Aedes;
    private client: MQTTClient;
    connected: boolean;
    constructor(options: Options = {}) {
        let connectionName = "mqtt://localhost:1883";
        if (options.host) {
            connectionName = `mqtt://${options.host}`;
        }
        super(SRV_PC_MONITOR);

        this.topic = options.topic || "jacdac";

        if (connectionName === "mqtt://localhost:1883"){
            this.startBroker()
        }
        this.client = new MQTTClient(connectionName, (topic: string, message: string) => {
            const json = message.toString();
            this.sendEvent(0x80, jdpack("z s", [topic, json]));
        })
        this.client.on('connect', () => {
            console.log("MQTT client connected");
            this.connected = true;
            this.client.subscribe(this.topic);
        });
        this.client.on('message', (topic, message) => {
            const json = message.toString();
            this.sendEvent(0x80, jdpack("z s", [topic, json]));
        });
        this.addCommand(0x80,(packet)=>{
            if(!this.connected) return
            const [topic,message] = jdunpack(packet.data, "z s");
            this.topic = topic;
            this.client.subscribe(topic);
            this.client.publish(topic, message);
        })
        this.addCommand(0x81,(packet)=>{
            if(!this.connected) return
            const [topic,message] = jdunpack(packet.data, "z s");
            this.topic = topic;
            this.client.publish(topic, message)
        })
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