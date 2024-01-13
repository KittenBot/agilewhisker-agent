import { jdunpack, JDServiceServer } from 'jacdac-ts';
import robot from '@jitsi/robotjs';
import { exec } from 'child_process';

const SRV_PC_EVENT = 0x113d0987;
const CMD_OPEN_URL = 0x80;
const CMD_OPEN_APP = 0x81;
const CMD_SEND_TXT = 0x82;
const CMD_RUN_SCRIPT = 0x83;
const CMD_MOVE_MOUSE = 0x84;
const CMD_CLICK_MOUSE = 0x85;

class PCEvent extends JDServiceServer {
    constructor() {
        super(SRV_PC_EVENT, {});

        this.addCommand(CMD_OPEN_URL, this.handleOpenUrl.bind(this));
        this.addCommand(CMD_OPEN_APP, this.handleOpenApp.bind(this));
        this.addCommand(CMD_SEND_TXT, this.handleSendText.bind(this));
        this.addCommand(CMD_RUN_SCRIPT, this.handleRunScript.bind(this));
        this.addCommand(CMD_MOVE_MOUSE, this.handleAccelMoveMouse.bind(this));
        this.addCommand(CMD_CLICK_MOUSE, this.handleClickMouse.bind(this));
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

    handleAccelMoveMouse(pkt: any): void {
        //加速度计控制鼠标移动
        robot.setMouseDelay(0.1)
        const [position] = jdunpack(pkt.data, "s")
        const posArr = position.split(',')
        const moveX = parseFloat(posArr[0])
        const moveY = parseFloat(posArr[1])
        const screen = robot.getScreenSize()
        const targetX = Math.floor((moveX + 65535) / 131070 * screen.width);
        const targetY = Math.floor((moveY + 65535) / 131070 * screen.height);
        robot.moveMouseSmooth(targetX,targetY,0.001)
    }

    handleClickMouse(pkt: any): void {
        const [position] = jdunpack(pkt.data, "s");
        if(position==='down'){
            robot.mouseToggle("down")
        }else{
            robot.mouseToggle("up")
        }
    }
}

export { PCEvent };