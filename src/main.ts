import { 
  app,
  ipcMain,
  nativeImage,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  desktopCapturer,
  screen,
  globalShortcut,
  Display,
  clipboard,
 } from 'electron';

 import robot from '@jitsi/robotjs';
import path from 'path';
import fs from 'fs-extra'
import http from 'http';
import net from 'net';
import WebSocket from 'faye-websocket';
import { MQTTServer } from './jd_mqtt';
import { PCEvent } from './jd_pcevent';
import { PCMonitor } from './jd_pcmon';

import {
  // events
  DEVICE_CHANGE,
  CONNECTION_STATE,
  FRAME_PROCESS,
  FRAME_PROCESS_LARGE,
  // transport
  JDBus,
  createNodeWebSerialTransport,
  createNodeSocketTransport,
  // services
  addServer,
  addServiceProvider,
  JDServerServiceProvider,
  ControlReg,
} from 'jacdac-ts';

import { SerialPort } from 'serialport';

import extraServices from './services.json'; // copy from dev-keyboard/.devicscript/services.json

import icon_img from './images/icon.png';
import { EmailClient } from './jd_email';
import { GithubClient } from './jd_github';

const JACDAC_PORT = 8081;
const SETTING_PATH = path.join(app.getPath('userData'), 'settings.json');

type AgentSettings = {
  mqttbroker: string,
  mqtttopic: string
}


let appShouldQuit = false;
let tray = null;

let mainwin: BrowserWindow = null;
let ocrwin: BrowserWindow = null;
let overlayWin: BrowserWindow = null;

let dashboardwin: BrowserWindow = null;
let server: http.Server = null;
let jdbus: JDBus = null;
let hostdevice: JDServerServiceProvider = null;
let hostServices: Record<string, any> = {};
let wsClients: Record<string, WebSocket> = {};
let hasHttpServer = false;
let textSelInterval: NodeJS.Timeout = null;

let ocr_display: Display = null;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hideApp() {
  mainwin.hide();
  if (process.platform === "darwin") {
    app.dock.hide();
  }
}

function loadSettings(): AgentSettings{
  if (!fs.existsSync(SETTING_PATH)) {
    fs.writeJSONSync(SETTING_PATH, {
      "mqttbroker": "iot.kittenbot.cn",
      "mqtttopic": "/jacdac123"
    });
  }
  return fs.readJSONSync(SETTING_PATH);
}

const jdproxy = '<html lang="en"><title>Jacdac DevTools</title><meta name="viewport"content="width=device-width,initial-scale=1"><link rel="icon"href="https://microsoft.github.io/jacdac-docs/favicon.svg"type="image/x-icon"><style>iframe{position:absolute;left:0;top:0;height:100%;width:100%;border:none}</style><iframe id="frame"alt="Jacdac Dashboard"allow="usb;serial;bluetooth;vr;clipboard-write;"allowfullscreen sandbox="allow-scripts allow-downloads allow-same-origin"></iframe><script>!function(){function e(){var n;o||(n=!1,(o=new WebSocket(a)).binaryType="arraybuffer",console.debug("devtools: connecting ".concat(a,"...")),o.addEventListener("open",function(){console.debug("devtools: connected ".concat(o.url)),n=!0,d.contentWindow.postMessage({type:"devtoolsconnected",sender:s},"*")}),o.addEventListener("message",function(e){"string"==typeof e.data?d.contentWindow.postMessage(e.data,"*"):(e=new Uint8Array(e.data),d.contentWindow.postMessage({type:"messagepacket",channel:"jacdac",data:e,sender:s},"*"))}),o.addEventListener("close",function(){console.debug("devtools: connection closed"),o=void 0}),o.addEventListener("error",function(e){n&&console.debug("devtools: error",e),null!=o&&o.close()}))}var o,n=window.location,t="https:"===n.protocol,n=n.hostname,c=t?443:8081,a="".concat(t?"wss:":"ws:","//").concat(n,":").concat(c,"/"),d=document.getElementById("frame"),t=window.location.search||"",s=(t+=(0<t.length?"&":"?")+"devtools="+encodeURIComponent(a),Math.random()+""),n="https://microsoft.github.io/jacdac-docs/dashboard/"+t+"#"+s;window.addEventListener("message",function(e){e=e.data;e&&("messagepacket"===e.type&&"jacdac"===e.channel||"devicescript"===e.channel)&&(null==o?void 0:o.readyState)===WebSocket.OPEN&&o.send(e.data)});setInterval(e,5e3),e(),d.src=n}()</script>';

async function startJacdacBus() {
  const transports = [
  ]
  // if we start as server, make serial connection available
  // if not, the vscode devicescript should handle it, make a tcp connection to it
  if (hasHttpServer) {
    // add serial transport
    transports.push(createNodeWebSerialTransport(SerialPort));
  } else {
    // add socket transport
    transports.push(createNodeSocketTransport());
  }
  const settings = await loadSettings();
  const bus = new JDBus(transports, {
    client: false,
    disableRoleManager: true,
    proxy: true,
    services: extraServices as any,
  })

  bus.passive = false;
  bus.on('error', error => {
    console.error("JDBUS", error);
  })

  bus.on(DEVICE_CHANGE, async () => {
    const devices = bus.devices();
    console.log("update devices", devices.length)
    for (const device of devices) {
      console.log("device", device.shortId)
    }
  })

  bus.on(CONNECTION_STATE, async (transport) => {
    console.log("connection state", transport.type, transport.connectionState)
    // console.log("connection state", transport)
  })

  bus.on(FRAME_PROCESS, async (frame) => {
    for (const client_id in wsClients) {
      // A null sender means it's from the server
      if (client_id === frame._jacdac_sender){
        continue;
      }
      const client = wsClients[client_id];
      if (client) {
        client.send(Buffer.from(frame));
      }
    }
  })

  bus.on(FRAME_PROCESS_LARGE, async (frame) => {
    for (const client_id in wsClients) {
      if (client_id === frame._jacdac_sender){
        continue;
      }
      const client = wsClients[client_id];
      if (client) {
        client.send(Buffer.from(frame));
      }
    }
  })

  bus.autoConnect = true;
  bus.start()
  await bus.connect(true)
  
  jdbus = bus;
}

async function refreshDevice() {
  jdbus.removeServiceProvider(hostdevice);
  hostdevice = null;

  const _services = []
  for (const name in hostServices) {
    _services.push(hostServices[name]);
  }

  if (_services.length === 0) {
    return;
  }
  // this will start a new device with new device id which will cause devicescript to reboud services
  hostdevice = new JDServerServiceProvider('AW Agent', _services, {
    deviceDescription: "AW Agent",
  });
  hostdevice.controlService.register(ControlReg.ProductIdentifier).setValues([0x3CD1D821]);

  jdbus.addServiceProvider(hostdevice);
  hostdevice.bus = jdbus;
  
  new Notification({
    title: "Jacdac",
    body: `Device ${hostdevice.shortId} started`,
  }).show();
}

function startHttpServer(){
  if (server) {
    server.close();
  }
  try {
    const http_server = http.createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Content-Type', 'text/html');
      res.end(jdproxy);
    });

    http_server.once('error', (err) => {
      if (/EADDRINUSE/.test(err.message)){
        console.log("Port in use, closing server");
        setTimeout(() => {
          http_server.close();
        }, 1000); 
        startJacdacBus();
      } else {
        console.error(err);
      }
    })

    http_server.on('upgrade', (req, socket, body) => {
      if (WebSocket.isWebSocket(req)) {
        const remoteAddress = (socket as net.Socket).remoteAddress

        const client = new WebSocket(req, socket, body)
        const client_id = Math.random().toString(36).substring(2, 15)
        wsClients[client_id] = client;
        console.log("Websocket connection", req.url, remoteAddress, client_id)

        client.on('message', (event: any) => {
          const { data } = event;
          if (typeof data === 'string') {
            console.log("Websocket message", data)
          } else {
            // forward to jacdac
            const buffer = new Uint8Array(data);
            (buffer as any)._jacdac_sender = client_id;
            jdbus?.sendFrameAsync(buffer);
          }
        })

        client.on('close', () => {
          console.log("Websocket close", req.url, remoteAddress, client_id)
          delete wsClients[client_id];
        })
      }
    })

    http_server.listen(JACDAC_PORT, '127.0.0.1')
    http_server.once('listening', () => {
      console.log("Server listening on port", JACDAC_PORT);
      hasHttpServer = true;
      startJacdacBus();
    })

    server = http_server;
  } catch (e) {
    console.error(e);
  }
}


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const icon = nativeImage.createFromDataURL(icon_img)
  const sys_icon = icon.resize({ width: 16, height: 16 })

  // Create the browser window.
  mainwin = new BrowserWindow({
    icon,
    width: 800,
    height: 600,
    show:false,
    fullscreenable: false,
    useContentSize: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainwin.setMenu(null);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainwin.loadURL('http://localhost:3000/hostapp');
    mainwin.webContents.openDevTools();
  } else {
    mainwin.loadURL('https://w.kittenbot.net/hostapp');
  }

  // tray
  const tray = new Tray(sys_icon);

  // tray menu
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => mainwin.show() },
    { label: 'OCR', click: () => createOcrWindow() },
    { type: 'separator' },
    { label: 'Debug', click: () => createDashboard() },
    { label: 'Exit', click: () => {
      appShouldQuit = true;
      app.quit() 
    }}
  ]);


  tray.on("right-click", () => {
    tray.popUpContextMenu(contextMenu);
  });

  tray.on("click", () => {
    mainwin.show();
  });
    
  mainwin.on("close", (event) => {
    if (!appShouldQuit) {
      event.preventDefault();
      hideApp();
    } else {
      server.close();
    }
  });

  hideApp();

  startHttpServer();

  // alt+d to ocr
  globalShortcut.register('Alt+D', () => {
    createOcrWindow();
  });

};

const createOcrWindow = () => {
  const {x, y} = screen.getCursorScreenPoint();
  ocr_display = screen.getDisplayNearestPoint({x, y});
  ocrwin = new BrowserWindow({
    width: 800,
    height: 600,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  ocrwin.loadFile('ocr.html');
  ocrwin.setAlwaysOnTop(true, 'screen-saver');
  ocrwin.maximize();

  // ocrwin.webContents.openDevTools();

}

const createOverlay = () => {
  overlayWin = new BrowserWindow({
    width: 24,
    height: 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });
  overlayWin.loadFile('overlay.html');
  overlayWin.hide();

}

const createDashboard = () => {
  dashboardwin = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: false,
      
    },
  });

  dashboardwin.loadURL('http://localhost:8081');
  dashboardwin.maximize();

  dashboardwin.webContents.openDevTools();
}

function startTextSelectListener() {
  let lastText = "";
  textSelInterval = setInterval(async () => {
    const text = clipboard.readText();
    if (text && text !== lastText) {
      lastText = text;
      const mouse = robot.getMousePos();
      overlayWin.setPosition(mouse.x + 12, mouse.y + 6);
      overlayWin.show();
    }
  }, 1000);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  createOverlay();
  startTextSelectListener();
});

app.on('before-quit', (event) => {
  app.exit();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// app.on('activate', () => {
//   // On OS X it's common to re-create a window in the app when the
//   // dock icon is clicked and there are no other windows open.
//   if (BrowserWindow.getAllWindows().length === 0) {
//     createWindow();
//   }
// });


app.on("window-all-closed", () => {
  app.quit();
});

function getServices(){
  return [
    {
      name: "Ambient",
      status: Object.keys(hostServices).includes("Ambient"),
      icon: 'img/ambient.png',
      disabled: true
    },
    {
        name: "Cloud",
        status: Object.keys(hostServices).includes("Cloud"),
        icon: 'img/cloud.png'
    },
    {
        name: "Event",
        status: Object.keys(hostServices).includes("Event"),
        icon: 'img/event.png'
    },
    {
        name: "Monitor",
        status: Object.keys(hostServices).includes("Monitor"),
        icon: 'img/monitor.png'
    },
    {
      name: "Email",
      status: Object.keys(hostServices).includes("Email"),
      icon: 'img/monitor.png'
    },
    {
      name: 'Github',
      status: Object.keys(hostServices).includes("Github"),
      icon: 'img/monitor.png'
    }
  ]
}

ipcMain.handle('get-services', async (event, args) => {
  return getServices() 
})

ipcMain.handle('start-service', async (event, name) => {
  console.log("start service", name);
  switch (name) {
    case 'Ambient':
      break;
    case 'Cloud':
      const mqtt = new MQTTServer({"host": "iot.kittenbot.cn",  "topic": "Lite_Temp"});
      hostServices[name] = mqtt;
      break;
    case 'Event':
      const event = new PCEvent();
      hostServices[name] = event;
      break;
    case 'Monitor':
      const monitor = new PCMonitor();
      hostServices[name] = monitor;
      break;
    case 'Email':
      const email = new EmailClient();
      hostServices[name] = email;
      break;
    case "Github":
      const github = new GithubClient();
      hostServices[name] = github;
      break;
    default:
      console.warn("Unknown service", name);
      break;
  }
  
  refreshDevice();
  return getServices();
})

ipcMain.handle('stop-service', async (event, name) => {
  console.log("stop service", name);
  switch (name) {
    case 'Ambient':
      break;
    case 'Cloud':
      delete hostServices[name]
      break;
    case 'Event':
      delete hostServices[name]
      break;
    case 'Monitor':
      delete hostServices[name]
      break;
    case 'Email':
      if(hostServices[name].imap){
        hostServices[name].handleCloseListen()
      }
      delete hostServices[name]
      break;
    case "Github":
      delete hostServices[name]
      break;
    default:
      console.warn("Unknown service", name);
      break;
  }

  refreshDevice();
  return getServices();
})

ipcMain.handle('selection-done', async (event, selection) => {
  console.log("selection done", selection);
  const { x, y, width, height } = selection;
  // capture screen
  try {
    // TODO: maybe let app to select screen??
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: ocr_display.size.width, height: ocr_display.size.height }
    });
  
    const screenSource = sources.find(source => source.display_id.toString() === ocr_display.id.toString());

    return screenSource.thumbnail.crop({ x, y, width, height }).toDataURL();
  } catch (e) {
    console.error(e);
    ocrwin.close();
  }
})

ipcMain.handle('ocr-result', async (event, result) => {
  ocrwin.close();
  console.log("OCR result", result);
})

ipcMain.handle('get-settings', async (event, args) => {
  return loadSettings();
})

ipcMain.handle('set-settings', async (event, settings) => {
  try {
    await fs.writeJSON(SETTING_PATH, settings);
  } catch (e) {
    console.error(e);
  }
})

