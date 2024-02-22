import { jdunpack, JDServiceServer, REGISTER_PRE_GET, CHANGE, REGISTER_NODE_NAME, EVENT, identifierToUrlPath} from 'jacdac-ts';
import Imap from 'imap';

const SRV_PC_MONITOR = 0x18627b16;

class EmailClient extends JDServiceServer {
    OPENLISTEN = 0x89;
    CLOSE_LISTEN = 0x90;

    imap:any;
    intervalId:any;
    private emailNumber: number
    emailStatus: number

    constructor() {
        super(SRV_PC_MONITOR);
        this.emailNumber = 0
        this.emailStatus = 0
        this.imap =  null
        this.intervalId = null

        this.addCommand(this.OPENLISTEN,this.handleOpenListen.bind(this))
        this.addCommand(this.CLOSE_LISTEN,this.handleCloseListen.bind(this));
    };
    async handleOpenListen (pkt:any):Promise<any> {
        if(this.imap) return
        const data = JSON.parse(jdunpack(pkt.data, "s") as any)
        var provider = data.email.match(/@(.+?)\./);
        if (!provider || provider.length <= 1) {
            return
        }
        this.imap = new Imap({
            user: data.email,
            password: data.password,
            host:  `imap.${provider[1]}.com`,
            port: 993,
            tls: true, //使用安全传输协议
            tlsOptions: { rejectUnauthorized: false } //禁用对证
        });
        this.imap.once('ready', () => {
            if(this.intervalId) {
                return
            }
            this.intervalId = setInterval(()=>{
                this.imap.openBox('INBOX', true, async (err:any, box:any)=> {
                    if (err) throw err;
                    if(this.emailNumber < box.messages.total * 1 && box.messages.total !==0 && this.emailNumber !== 0){
                        const encoder = new TextEncoder();
                        const uint8Array = encoder.encode('New email received');
                        this.sendEvent(0x81,uint8Array)
                    }
                    this.emailNumber = box.messages.total * 1;
                })
            }, 500)
        });
        this.imap.once('error', function(err:any) {
            clearInterval(this.intervalId);
        });
        this.imap.once('end', function() {
            clearInterval(this.intervalId);
        })
        this.imap.connect()
    }
    handleCloseListen():void {
        if(this.imap){
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.imap.end();
            this.imap = null;
            this.emailNumber = 0;
        }
    };
}

export { EmailClient };