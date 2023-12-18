import net from "net";
import {EventEmitter} from "events";
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
class MQTTClient extends EventEmitter {
    private client: net.Socket;
    private options: any;
    private _parser: Parser;
    private connected: boolean;
    private _pingInterval: any;
    private messageId: number;
    constructor(host: string, clientOptions: any = {}) {
        super();
        this.options = {...defaultOptions, ...clientOptions};
        this.client = new net.Socket();
        this._parser = mqttPacket.parser();
        let port = '1883';
        if (host.startsWith("mqtt://")) {
            host = host.substr(7);
            if (host.includes(":")) {
                [host, port] = host.split(":");
            }
        }

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
                    this.emit('message', packet.topic, packet.payload);
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
            this.emit('connect');
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
        this.client.connect(parseInt(port), host);
    }

    _generateMessageId() {
        if (!this.messageId) {
            this.messageId = 0;
        }
        return ++this.messageId;
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

    subscribe(topic: string) {
        if (!this.connected) return;
        const packet = mqttPacket.generate({
            cmd: 'subscribe',
            messageId: this._generateMessageId(),
            subscriptions: [{
                topic,
                qos: 0
            }]
        });
        this.client.write(packet);
    }
}

export default MQTTClient;