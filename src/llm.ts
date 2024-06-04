import fs from 'fs-extra'

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
  constructor(public directory: string, public options: any = {}) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
    this.listFiles();
  }

  listFiles() {
    const files = fs.readdirSync(this.directory);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readJSONSync(file);
        this.llms[file] = {
          id: file,
          ...content
        }
      }
    }
    console.log(this.llms);
  }


}

export default LLM;