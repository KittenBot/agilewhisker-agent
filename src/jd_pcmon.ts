import { jdunpack, JDServiceServer, REGISTER_PRE_GET, CHANGE, REGISTER_NODE_NAME, EVENT} from 'jacdac-ts';
import * as si from 'systeminformation';

const SRV_PC_MONITOR = 0x18627b15;
const UPDATE_INTERVAL = 10000;

class PCMonitor extends JDServiceServer {
    REG_CPU_USAGE = 0x190;
    REG_CPU_TEMP = 0x191;
    REG_MEMORY_USAGE = 0x192;
    REG_GET_STATUS = 0x196;
    REG_GPU_INFO = 0x193;
    REG_NETWORK_INFO = 0x195;

    cpu_usage: any;
    cpu_temp: any;
    memory_usage: any;
    gpu_info: any;
    network_info: any;

    constructor() {
        super(SRV_PC_MONITOR, {
            // streamingInterval: 10000,
        });

        this.cpu_usage = this.addRegister(this.REG_CPU_USAGE, [0]); // u8 percent
        this.cpu_usage.on(REGISTER_PRE_GET, () => {
            si.currentLoad().then(data => {
                const load = Math.round(data.currentLoad);
                this.cpu_usage.setValues([load]);
            }).catch(error => console.error(error));
        });

        this.cpu_temp = this.addRegister(this.REG_CPU_TEMP, [-1]); // u8 celsius
        this.cpu_temp.on(REGISTER_PRE_GET, () => {
            si.cpuTemperature().then(data => {
                const temp = Math.round(data.main);
                this.cpu_temp.setValues([temp]);
            }).catch(error => console.error(error));
        });

        this.memory_usage = this.addRegister(this.REG_MEMORY_USAGE, [0]); // u8 percent
        this.memory_usage.on(REGISTER_PRE_GET, () => {
            si.mem().then(data => {
                const usage = Math.round(100 * (data.used / data.total));
                this.memory_usage.setValues([usage]);
            }).catch(error => console.error(error));
        });

        this.gpu_info = this.addRegister(this.REG_GPU_INFO, [-1, -1]); // u8, u8, gpu load, gpu temp

        this.network_info = this.addRegister(this.REG_NETWORK_INFO, [0, 0]); // u16, u16, tx, rx speed in kbps
        this.network_info.on(REGISTER_PRE_GET, () => {
            si.networkStats('default').then((data:any) => {
                const tx = Math.round(data.tx_sec / 1024);
                const rx = Math.round(data.rx_sec / 1024);
                this.network_info.setValues([tx, rx]);
            }).catch(error => console.error(error));
        });
    }
    delay(ms: number): any {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleRefresh(): void {
        const t = new Date();
        console.log("refresh at", t.toLocaleTimeString());
    }
}

export { PCMonitor };