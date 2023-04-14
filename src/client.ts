// Adapted from: https://github.com/wong2/chat-gpt-google-extension/blob/main/background/index.mjs

import { createParser } from 'eventsource-parser';
import { v4 as uuidv4 } from 'uuid';
import ExpiryMap from 'expiry-map';
import fetch, { Response } from 'node-fetch';
import { z } from 'zod';
import { OpenAIApi, Configuration } from 'openai';
export const ClientConfigSchema = z.object({
  APIKey: z.string().optional(),
});
export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export const testAuth = async (APIKey: string) => {
  console.log('Testing auth...');
  const configuration = new Configuration({
    apiKey: APIKey,
  });
  const openai = new OpenAIApi(configuration);
  await openai.retrieveModel('gpt-3.5-turbo');
};

export class ChatGPTClient {
  constructor(
    public config: ClientConfig,
    public conversationId: string = uuidv4(),
  ) {}
  async authorize() {
    await testAuth(this.config.APIKey);
  }
  async getAnswer(question: string): Promise<string> {
    const APIKey = this.config.APIKey;
    const configuration = new Configuration({
      apiKey: APIKey,
    });
    const openai = new OpenAIApi(configuration);

    const res = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          content: question,
          role: 'user',
        },
      ],
    });
    return res.data.choices[0].message.content;
  }
}
