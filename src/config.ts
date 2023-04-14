import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import enquirer from 'enquirer';
import { z } from 'zod';
import { ClientConfig, ClientConfigSchema, testAuth } from './client.js';

const CONFIG_FILE_NAME = `${homedir()}/.commit-gpt.json`;

export async function ensureSessionToken(clean?: boolean): Promise<string> {
  let config: ClientConfig = {};

  if (existsSync(CONFIG_FILE_NAME) && !clean) {
    config = ClientConfigSchema.parse(
      JSON.parse(readFileSync(CONFIG_FILE_NAME, 'utf-8')),
    );
  }

  if (!config.APIKey) {
    config.APIKey = await promptToken();
  }

  while (true) {
    try {
      await testAuth(config.APIKey);
      writeFileSync(CONFIG_FILE_NAME, JSON.stringify(config, null, 2));
      return config.APIKey;
    } catch (e) {
      console.log(e.message);
      console.log('Invalid token. Please try again.');
      config.APIKey = await promptToken();
    }
  }
}

async function promptToken() {
  try {
    console.log(
      'Follow instructions here to get your x OpenAI API key token: https://github.com/RomanHotsiy/commitgpt#get-your-session-token',
    );

    const answer = await enquirer.prompt<{ APIKey: string }>({
      type: 'password',
      name: 'API Key',
      message: 'Paste your API key here:',
    });

    return answer.APIKey;
  } catch (e) {
    console.log('Aborted.');
    process.exit(1);
  }
}
