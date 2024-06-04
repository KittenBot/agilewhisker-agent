import fs from 'fs-extra'
import JSON5 from 'json5'
import { Menu } from 'electron';
import crypto from 'crypto';

export interface LLMMsg {
  role: string;
  content: string;
}

export interface LLMConfig {
  id: string; // file name
  title?: string;
  description?: string;
  system?: string; // system prompt
  context: LLMMsg[];
}

export interface LLMHistory {
  id: string;
  llm?: LLMConfig;
  history: LLMMsg[];
}

class LLM {
  llms: Record<string, LLMConfig> = {};
  history: Record<string, string[]> = {};
  constructor(public directory: string, public options: any = {}) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
    this.listFiles();
  }

  listFiles() {
    const files = fs.readdirSync(this.directory);
    for (const file of files) {
      if (file.endsWith('.json5')) {
        // id should be the file name
        const _llmId = file.split('.')[0];
        const _fullPath = this.directory + '/' + file;
        const content = fs.readFileSync(_fullPath, 'utf-8');
        const llm = JSON5.parse(content);
        this.llms[_llmId] = {
          id: _llmId,
          ...llm
        }
        const historyFolder = this.directory + '/' + _llmId;
        if (fs.existsSync(historyFolder)) {
          const historyFiles = fs.readdirSync(historyFolder);
          this.history[_llmId] = [];
          for (const historyFile of historyFiles) {
            const _historyId = historyFile.split('.')[0];
            this.history[_llmId].push(`${_llmId}/${_historyId}`);
          }
        } else {
          this.history[_llmId] = [];
        }
      }// TODO: add js file support
      
    }
    console.log(this.history)
  }

  saveHistory(props: {id: string, history: LLMMsg[]}) {
    const {id, history} = props;
    const _tmp = id.split('/');
    const llmId = _tmp[0];
    const llm = this.llms[llmId];
    const historyId = _tmp[1];
    let historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';

    fs.ensureDirSync(this.directory + '/' + llmId);
    fs.writeFileSync(historyFile, JSON5.stringify(history, null, 2));
    if (!this.history[llmId]) {
      this.history[llmId] = [];
    }
    if (!this.history[llmId].includes(id)) {
      this.history[llmId].push(id);
    }
    return id;
  }

  loadHistory(id: string) {
    const _tmp = id.split('/');
    const llmId = _tmp[0];
    const llm = this.llms[llmId];
    if (llm){
      let historyId = _tmp[1];
      if (historyId === '0'){
        historyId = crypto.randomBytes(8).toString('hex')
      }
      const ret: LLMHistory = {
        id: `${llmId}/${historyId}`,
        history: [{
          role: 'system',
          content: llm.system
        }]
      }
      const historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';
      console.log(historyFile, ret)
      if (fs.existsSync(historyFile)) {
        const content = fs.readFileSync(historyFile, 'utf-8');
        const _json = JSON5.parse(content);
        if (_json.history) {
          ret.history = _json.history;
        }
      } else {
        // create one if use pefered id instead of hash
        this.saveHistory(ret);
      }
      return ret;
    }
  }

  saveLLM(props: {id: string, llm: LLMConfig}) {
    console.log("Saving LLM", props)
    let {id, llm} = props;
    if (!id.endsWith('.json') && !id.endsWith('.json5')) {
      id = id + '.json5';
    }
    if (!llm.context) {
      llm.context = [];
    }
    if (!llm.title){
      llm.title = id.split('.')[0];
    }
    llm.id = id;
    const _str = JSON5.stringify(llm, null, 2);

    fs.writeFileSync(this.directory + '/' + id, _str);
    this.llms[id] = llm;
    return this.getLLM(id);
  }

  getLLM(id: string) {
    const conf = Object.assign({}, this.llms[id]);
    conf.context = [
      {role: 'system', content: conf.system},
      ...conf.context,
    ]
    
    return conf;
  }

  getElectronMenu(){
    const models: any[] = [];
    for (const id in this.llms) {
      const llm = this.llms[id];
      const history = this.history[id].map((hid) => {
        return {
          label: hid,
          click: () => {
            console.log("Clicked", hid);
          }
        }
      });
      models.push({
        label: llm.title,
        click: () => {
          console.log("Clicked", llm.title);
        },
        submenu:[
          {label: 'New Chat', click: () => {

          }},
          ...history
        ]
      })
    }
    return Menu.buildFromTemplate([{
      label: 'File',
      submenu: models
    },{
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'delete'},
      ]
    }]);
  }

}

export default LLM;