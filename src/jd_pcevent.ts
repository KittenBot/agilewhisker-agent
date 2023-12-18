import { jdunpack, JDServiceServer } from 'jacdac-ts';
import robot from '@jitsi/robotjs';
import { exec } from 'child_process';

const SRV_PC_EVENT = 0x113d0987;
const CMD_OPEN_URL = 0x80;
const CMD_OPEN_APP = 0x81;
const CMD_SEND_TXT = 0x82;
const CMD_RUN_SCRIPT = 0x83;

class PCEvent extends JDServiceServer {
    constructor() {
        super(SRV_PC_EVENT, {});

        this.addCommand(CMD_OPEN_URL, this.handleOpenUrl.bind(this));
        this.addCommand(CMD_OPEN_APP, this.handleOpenApp.bind(this));
        this.addCommand(CMD_SEND_TXT, this.handleSendText.bind(this));
        this.addCommand(CMD_RUN_SCRIPT, this.handleRunScript.bind(this));
    }

    handleOpenUrl(pkt: any): void {
        const [url] = jdunpack(pkt.data, "s");
        console.log("open url", url);
        const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
        exec(`${start} ${url}`);
    }

    handleOpenApp(pkt: any): void {
        const [app, args] = jdunpack(pkt.data, "z s");
        console.log("open app", app);
        const open = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
        exec(`${open} ${app} ${args}`);
    }

    handleSendText(pkt: any): void {
        const [text] = jdunpack(pkt.data, "s");
        console.log("send text", text);
        robot.typeString(text)
    }

    handleRunScript(pkt: any): void {
        const [script] = jdunpack(pkt.data, "s");
        console.log("run script", script);
    }
}

export { PCEvent };