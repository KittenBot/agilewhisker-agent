import fs from 'fs-extra'
import JSON5 from 'json5'
import { Menu } from 'electron';

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
        const _fullPath = this.directory + '/' + file;
        const content = fs.readFileSync(_fullPath, 'utf-8');
        const llm = JSON5.parse(content);
        this.llms[file] = {
          id: file,
          ...llm
        }
        const historyFolder = this.directory + '/' + file.split('.')[0];
        if (fs.existsSync(historyFolder)) {
          const historyFiles = fs.readdirSync(historyFolder);
          for (const historyFile of historyFiles) {
            const _fullPath = historyFolder + '/' + historyFile;
            const content = fs.readFileSync(_fullPath, 'utf-8');
            const history = JSON5.parse(content);
            this.history[file] = history;
          }
        } else {
          this.history[file] = [];
        }
      }// TODO: add js file support
      
    }
  }

  saveHistory(props: {id?: string, llm: LLMConfig, history: LLMMsg[]}){
    let {id, llm, history} = props;
    let historyFile = this.directory + '/' + llm.id.split('.')[0] + '/' + id + '.json5';
    if (!id || !fs.pathExistsSync(historyFile)) {
      if (!id)
        id = Date.now().toString();
      historyFile = this.directory + '/' + llm.id.split('.')[0] + '/' + id + '.json5';
    }
    fs.ensureDirSync(llm.id.split('.')[0]);
    fs.writeFileSync(historyFile, JSON5.stringify(history, null, 2));
    if (!this.history[llm.id]) {
      this.history[llm.id] = [];
    }
    if (!this.history[llm.id].includes(id)) {
      this.history[llm.id].push(id);
    }
    return id;
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
      const history = this.history[llm.id].map((hid) => {
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
      label: 'LLM',
      submenu: models
    }]);
  }

}

export default LLM;