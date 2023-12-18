import net from "net";
import mqttPacket, {Parser} from "mqtt-packet";

const defaultOptions = {
    cmd: 'connect',
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    keepalive: 60
};

// TODO: mqttjs don't work with aedes and vite
class MQTTClient {
    private client: net.Socket;
    private options: any;
    private _parser: Parser;
    private connected: boolean;
    private callback: any;
    private _pingInterval: any;
    constructor(host: string, callback: any, clientOptions: any = {}) {
        this.callback = callback;
        this.options = {...defaultOptions, ...clientOptions};
        this.client = new net.Socket();
        this._parser = mqttPacket.parser();

        this._parser.on('packet', (packet) => {
            console.log("Received packet", packet);
        
            switch (packet.cmd) {
                case 'connack':
                    if (packet.returnCode === 0) {
                        console.log("Successfully connected to MQTT broker");
                    } else {
                        console.error("Failed to connect, return code:", packet.returnCode);
                    }
                    break;

                case 'suback':
                    console.log("Successfully subscribed to topic");
                    break;
        
                case 'publish':
                    if (this.callback) {
                        this.callback(packet.topic, packet.payload.toString());
                    }
                    break;
        
                case 'pingresp':
                    console.log("Received PING response from MQTT broker");
                    break;
        
                default:
                    console.log("Received unhandled packet type:", packet.cmd);
            }
        });

        this._parser.on('error', (err) => {
            console.log("parser error", err);
        })

        this.client.on('connect', () => {
            console.log("MQTT client connected");
            this.connected = true;
            // a connect packet is sent automatically
            const packet = mqttPacket.generate(this.options);
            this.client.write(packet);
            this._pingInterval = setInterval(() => {
                const packet = mqttPacket.generate({
                    cmd: 'pingreq'
                });
                this.client.write(packet);
            }, 10000);
        });

        this.client.on('data', (data) => {
            const packet = this._parser.parse(data);
        });
        this.client.on('close', () => {
            console.log("MQTT client disconnected");
            this.connected = false;
            clearInterval(this._pingInterval);
        });
        this.client.on('error', (err) => {
            console.log("MQTT client error", err);
            this.connected = false;
            clearInterval(this._pingInterval);
        });
        this.client.connect(1883, host);
    }

    publish(topic: string, message: string) {
        if (!this.connected) return;
        const packet = mqttPacket.generate({
            cmd: 'publish',
            dup: false,
            topic,
            payload: message,
            qos: 0,
            retain: false
        });
        this.client.write(packet);
    }
}

export default MQTTClient;