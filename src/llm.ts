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
  system: string;
  history: LLMMsg[];
}

class LLM {
  defaultHistoryId: string = '';
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
    let mtime = 0;
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
            // find the latest history file
            const _mtime = fs.statSync(historyFolder + '/' + historyFile).mtimeMs;
            if (_mtime > mtime) {
              mtime = _mtime;
              this.defaultHistoryId = `${_llmId}/${_historyId}`;
            }
          }
        } else {
          this.history[_llmId] = [];
        }
      }// TODO: add js file support
      
    }
    // if no default history, use the first one
    if (!this.defaultHistoryId) {
      this.defaultHistoryId = Object.keys(this.llms)[0] + '/0';
    }
    console.log("LLM loaded", this.llms, this.history, this.defaultHistoryId);
  }

  saveHistory(props: {id: string, history: LLMMsg[]}) {
    const {id, history} = props;
    const _tmp = id.split('/');
    const llmId = _tmp[0];
    const llm = this.llms[llmId];
    const historyId = _tmp[1];
    let historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';
    if (history.length < 2)
      return;

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

  loadHistory(id: string): LLMHistory {
    const _tmp = id.split('/');
    const llmId = _tmp[0];
    const llm = this.llms[llmId];
    if (llm){
      let historyId = _tmp[1];
      if (historyId === '0'){
        let index = 1;
        historyId = llm.title + '_' + index;
        let historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';
        while (fs.existsSync(historyFile)) {
          index++;
          historyId = llm.title + '_' + index;
          historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';
        }
      }
      const ret: LLMHistory = {
        id: `${llmId}/${historyId}`,
        system: llm.system,
        history: []
      }
      const historyFile = this.directory + '/' + llmId + '/' + historyId + '.json5';
      // console.log(historyFile, ret)
      if (fs.existsSync(historyFile)) {
        const content = fs.readFileSync(historyFile, 'utf-8');
        const _json = JSON5.parse(content);
        ret.history = _json;
      } else {
        // create one if use pefered id instead of hash
        this.saveHistory(ret);
      }
      return ret;
    }
  }

  saveLLM(props: {id: string, llm: LLMConfig}) {
    // console.log("Saving LLM", props)
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
    return conf;
  }

  getElectronMenu(callback: (id: string) => void) {
    const models: any[] = [];
    for (const id in this.llms) {
      const llm = this.llms[id];
      const history = this.history[id].map((hid) => {
        return {
          label: hid,
          click: () => {
            callback(hid);
          }
        }
      });
      models.push({
        label: llm.title,
        submenu:[
          {label: 'New Chat', click: () => {
            callback(`${id}/0`);
          }},
          ...history
        ]
      })
    }
    return Menu.buildFromTemplate([{
      label: 'File',
      submenu: models
    }]);
  }

}

export default LLM;