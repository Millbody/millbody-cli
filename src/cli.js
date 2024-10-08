#!/usr/bin/env node

import arg from "arg";
import inquirer from "inquirer";

import executeStart from "./commands/start.js";
import executeTest from "./commands/test.js";
import executeCodePush from "./commands/codepush.js";
import executeRunAndroid from "./commands/runAndroid.js";
import executeBuildAndroid from "./commands/buildAndroid.js";
import executeRunIos from "./commands/runIos.js";
import create from "./commands/create.js";
import updateApk from "./commands/updateApk.js";

function parseArgumentsIntoOptions(rawArgs) {
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
    source: args["--source"] == "root" ? "root" : "theme",
    account: args["--account"],
    track: args["--track"],
  };
}

async function promptForMissingOptions(options) {
  const defaultTemplate = "start";
  if (options.skipPrompts) {
    return {
      ...options,
      template: options.template || defaultTemplate,
    };
  }

  const questions = [];
  if (!options.template) {
    questions.push({
      type: "list",
      name: "template",
      message: "Escolha uma opção de comando para rodar: ",
      choices: ["new", "start", "run-ios", "run-android", "codepush", "create"],
      default: defaultTemplate,
    });
  }

  const answers = await inquirer.prompt(questions);
  return {
    ...options,
    template: options.template || answers.template,
  };
}

export async function cli(args) {
  let options = parseArgumentsIntoOptions(args);
  options = await promptForMissingOptions(options);
  const { template, source } = options;
  switch (template) {
    case "test":
      executeTest(options);
      break;
    case "start":
      executeStart(options);
      break;
    case "codepush":
      executeCodePush(options);
      break;
    case "run-android":
      executeRunAndroid(options);
      break;
    case "run-ios":
      executeRunIos(options);
      break;
    case "build-android":
      executeBuildAndroid(options);
      break;
    case "create":
      return create(options);
    case "update-apk":
    case "updateapp":
      return updateApk(options);
  }
}
