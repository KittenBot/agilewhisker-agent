import fs from 'fs-extra'
import JSON5 from 'json5'

export interface LLMMsg {
  role: string;
  content: string;
}

export interface LLMConfig {
  id: string; // file name
  title: string;
  description?: string;
  system?: string; // system prompt
  context: LLMMsg[];
}

class LLM {
  llms: Record<string, LLMConfig> = {};
  history: Record<string, LLMMsg[]> = {};
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
        const _fullPath = this.directory + '/' + file;
        const content = fs.readFileSync(_fullPath, 'utf-8');
        const llm = JSON5.parse(content);
        this.llms[file] = {
          id: file,
          ...llm
        }
      }// TODO: add js file support
      
    }
  }

  saveLLM(props: any) {
    console.log("Saving LLM", props)
    let {id, llm} = props;
    if (!id.endsWith('.json') && !id.endsWith('.json5')) {
      id = id + '.json5';
    }
    if (!llm.context) {
      llm.context = [];
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
    if (this.history[id]) {
      conf.context = {...conf.context, ...this.history[id]};
    }
    return conf;
  }

}

export default LLM;