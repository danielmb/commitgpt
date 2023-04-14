#!/usr/bin/env node
import { execSync, spawn } from 'child_process';

import enquirer from 'enquirer';
import ora from 'ora';
import parseArgs from 'yargs-parser';

import { z } from 'zod';

import { ChatGPTClient } from './client.js';
import { ensureSessionToken } from './config.js';

const CUSTOM_MESSAGE_OPTION = '[write own message]...';
const MORE_OPTION = '[ask for more ideas]...';
const spinner = ora();

const argv = parseArgs(process.argv.slice(2));

const conventionalCommit = argv.conventional || argv.c;
const CONVENTIONAL_REQUEST = conventionalCommit
  ? `Use following conventional commit (<type>: <subject>).\n`
  : '';

const exec = async (command: string, args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
};
const style = argv.style || argv.s;
let CUSTOM_STYLE: string = '';
if (style) {
  try {
    let parsed = z.string().optional().parse(style);
    if (parsed) {
      CUSTOM_STYLE = `in the style of ${parsed}`;
    }
  } catch (e) {
    console.log('Invalid prompt: ' + e.message);
    process.exit(1);
  }
}
let CUSTOM_PROMPT: string = '';
if (argv.prompt || argv.p) {
  try {
    CUSTOM_PROMPT = z.string().parse(argv.prompt || argv.p);
  } catch (e) {
    console.log('Invalid prompt: ' + e.message);
    process.exit(1);
  }
}

let diff = '';
try {
  diff = execSync('git diff --cached').toString();
  if (!diff) {
    console.log('No changes to commit.');
    process.exit(0);
  }
} catch (e) {
  console.log('Failed to run git diff --cached');
  process.exit(1);
}

run(diff)
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.log('Error: ' + e.message);
    if ((e as any).details) {
      console.log((e as any).details);
    }
    process.exit(1);
  });

async function run(diff: string) {
  const api = new ChatGPTClient({
    APIKey: await ensureSessionToken(),
  });

  spinner.start('Authorizing with OpenAI...');
  spinner.stop();

  const firstRequest =
    (CUSTOM_PROMPT
      ? CUSTOM_PROMPT
      : `Suggest me a few good commit messages for my commit ${CUSTOM_STYLE}.\n`) +
    CONVENTIONAL_REQUEST +
    '```\n' +
    diff +
    '\n' +
    '```\n\n' +
    `Output results as a list, not more than 6 items.`;
  let firstRequestSent = false;

  while (true) {
    const choices = await getMessages(
      api,
      firstRequestSent
        ? `Suggest a few more commit messages for my changes (without explanations)\n${CONVENTIONAL_REQUEST}`
        : firstRequest,
    );

    try {
      const answer = await enquirer.prompt<{ message: string }>({
        type: 'select',
        name: 'message',
        message: 'Pick a message',
        choices,
      });

      firstRequestSent = true;

      if (answer.message === CUSTOM_MESSAGE_OPTION) {
        execSync('git commit', { stdio: 'inherit' });
        return;
      } else if (answer.message === MORE_OPTION) {
        continue;
      } else {
        await exec('git', [
          'commit',
          '-m',
          escapeCommitMessage(answer.message),
        ]);
        return;
      }
    } catch (e) {
      console.log('Aborted.');
      console.log(e);
      process.exit(1);
    }
  }
}

async function getMessages(api: ChatGPTClient, request: string) {
  spinner.start('Asking ChatGPT 🤖 for commit messages...');

  // send a message and wait for the response
  try {
    const response = await api.getAnswer(request);
    const messages = response
      .split('\n')
      .filter((line) => line.match(/^(\d+\.|-|\*)\s+/))
      .map(normalizeMessage);
    spinner.stop();

    messages.push(CUSTOM_MESSAGE_OPTION, MORE_OPTION);
    return messages;
  } catch (e) {
    spinner.stop();
    if (e.message === 'Unauthorized') {
      console.log('Looks like your session token has expired');
      await ensureSessionToken(true);
      // retry
      return getMessages(api, request);
    } else {
      throw e;
    }
  }
}

function normalizeMessage(line: string) {
  return line
    .replace(/^(\d+\.|-|\*)\s+/, '')
    .replace(/^[`"']/, '')
    .replace(/[`"']$/, '')
    .replace(/[`"']:/, ':') // sometimes it formats messages like this: `feat`: message
    .replace(/:[`"']/, ':') // sometimes it formats messages like this: `feat:` message
    .replace(/\\n/g, '');
}

function escapeCommitMessage(message: string) {
  return message.replace(/'/, `''`);
}
