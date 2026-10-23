#!/usr/bin/env node

import arg from "arg";
import { select } from "@inquirer/prompts";

import executeStart from "./commands/start.js";
import executeTest from "./commands/test.js";
import executeCodePush from "./commands/codepush.js";
import executeRunAndroid from "./commands/runAndroid.js";
import executeBuildAndroid from "./commands/buildAndroid.js";
import executeRunIos from "./commands/runIos.js";
import create from "./commands/create.js";
import updateApk from "./commands/updateApk.js";

const defaultHandlers = {
  test: (options) => executeTest(options),
  start: (options) => executeStart(options),
  codepush: (options) => executeCodePush(options),
  "run-android": (options) => executeRunAndroid(options),
  "run-ios": (options) => executeRunIos(options),
  "build-android": (options) => executeBuildAndroid(options),
  create: (options) => create(options),
  "update-apk": (options) => updateApk(options),
  updateapp: (options) => updateApk(options),
};

export function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      "--source": String,
      "-s": "--source",
      "--account": String,
      "-a": "--account",
      "--track": String,
      "-t": "--track",
    },
    {
      argv: rawArgs.slice(2),
    }
  );
  return {
    template: args._[0],
    source: args["--source"] === "root" ? "root" : "theme",
    account: args["--account"],
    track: args["--track"],
  };
}

export async function promptForMissingOptions(options) {
  const defaultTemplate = "start";

  if (options.template) {
    return options;
  }

  if (!process.stdin.isTTY) {
    return { ...options, template: defaultTemplate };
  }

  const template = await select({
    message: "Escolha uma opção de comando para rodar: ",
    choices: [
      { name: "new", value: "new" },
      { name: "start", value: "start" },
      { name: "run-ios", value: "run-ios" },
      { name: "run-android", value: "run-android" },
      { name: "codepush", value: "codepush" },
      { name: "create", value: "create" },
    ],
    default: defaultTemplate,
  });

  return { ...options, template };
}

export async function cli(args, handlers = defaultHandlers) {
  let options = parseArgumentsIntoOptions(args);
  options = await promptForMissingOptions(options);
  const { template } = options;
  const handler = handlers[template];
  if (handler) {
    return handler(options);
  }
}
