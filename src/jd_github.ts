import { jdunpack, JDServiceServer, REGISTER_PRE_GET, CHANGE, REGISTER_NODE_NAME, EVENT, identifierToUrlPath} from 'jacdac-ts';

const SRV_PC_MONITOR = 0x113d0988;

class GithubClient extends JDServiceServer {
    STATUS_INFO = 0x88;
    REG_GET_STATUS = 0x196;
    constructor() {
        super(SRV_PC_MONITOR);
        this.addCommand(this.STATUS_INFO,this.handleRequestStatus.bind(this))
    }

    async handleRequestStatus (pkt:any):Promise<any> {
        const [data] = jdunpack(pkt.data, "s");
        const {owner, repo, commitId,token} = JSON.parse(data)
        const fetchNode = require('node-fetch')
        const encoder = new TextEncoder();
        fetchNode(`https://api.github.com/repos/${owner}/${repo}/commits/${commitId}/status`,
        {
            method: 'GET',
            headers:{
                Authorization: token ? `Bearer ${token}` : '',
                'Cache-Control': 'no-store'
            }
        })
        .then(async (res:any)=>{
            if (res.status === 200) {
                const json = await res.json()
                const state = json.state
                const uint8Array = encoder.encode(state);
                this.sendEvent(0x81,uint8Array)
            }else{
                const uint8Array = encoder.encode('failure');
                this.sendEvent(0x81,uint8Array)
            }
        }).catch((error:any)=>{
            const encoder = new TextEncoder();
            const uint8Array = encoder.encode('failure');
            this.sendEvent(0x81,uint8Array)
        })
    }

}
export { GithubClient }