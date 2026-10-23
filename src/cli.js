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
import executeDoctor from "./commands/doctor.js";
import executeSetup from "./commands/setup.js";
import { makeExpoHandlers } from "./arch/expoCommands.js";
import commands from "./commands/registry.js";
import {
  getVersion,
  renderGeneralHelp,
  renderCommandHelp,
  renderUnknownCommand,
  resolveInformational,
} from "./help.js";

const expoOnlyHandlers = makeExpoHandlers();

export const defaultHandlers = {
  test: (options) => executeTest(options),
  start: (options) => executeStart(options),
  codepush: (options) => executeCodePush(options),
  "run-android": (options) => executeRunAndroid(options),
  "run-ios": (options) => executeRunIos(options),
  "build-android": (options) => executeBuildAndroid(options),
  create: (options) => create(options),
  "update-apk": (options) => updateApk(options),
  updateapp: (options) => updateApk(options),
  doctor: (options) => executeDoctor(options),
  setup: (options) => executeSetup(options),
  "build-ios": (options) => expoOnlyHandlers["build-ios"](options),
  web: (options) => expoOnlyHandlers["web"](options),
  "connect-alderaan": (options) => expoOnlyHandlers["connect-alderaan"](options),
};

export function parseArgumentsIntoOptions(rawArgs) {
  let args;
  try {
    args = arg(
      {
        "--source": String,
        "-s": "--source",
        "--account": String,
        "-a": "--account",
        "--track": String,
        "-t": "--track",
        "--arch": String,
        "--project": String,
        "-p": "--project",
        "--yes": Boolean,
        "-y": "--yes",
        "--dry-run": Boolean,
        "--help": Boolean,
        "-h": "--help",
        "--version": Boolean,
        "-v": "--version",
      },
      {
        argv: rawArgs.slice(2),
      }
    );
  } catch (err) {
    const enhanced = new Error(
      `${err.message}\n\nUse "millbody --help" para ver as opções disponíveis.`
    );
    enhanced.cause = err;
    throw enhanced;
  }

  const firstPositional = args._[0];
  const isHelpCommand = firstPositional === "help";
  const helpSubcommand = isHelpCommand ? args._[1] : undefined;
  const hasHelpFlag = args["--help"];
  const hasVersionFlag = args["--version"];

  const helpTarget = hasHelpFlag && !isHelpCommand ? firstPositional : undefined;

  return {
    template: isHelpCommand ? "help" : firstPositional,
    helpSubcommand: helpTarget ?? helpSubcommand,
    source: args["--source"] === "root" ? "root" : "theme",
    account: args["--account"],
    track: args["--track"],
    arch: args["--arch"],
    project: args["--project"],
    yes: args["--yes"],
    dryRun: args["--dry-run"],
    help: hasHelpFlag,
    version: hasVersionFlag,
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

  const interactiveCommands = commands.filter((cmd) => cmd.interactive);
  const template = await select({
    message: "Escolha uma opção de comando para rodar: ",
    choices: interactiveCommands.map((cmd) => ({
      name: cmd.name,
      value: cmd.name,
      description: cmd.summary,
    })),
    default: defaultTemplate,
  });

  return { ...options, template };
}

export async function cli(args, handlers = defaultHandlers) {
  let options = parseArgumentsIntoOptions(args);

  const informational = resolveInformational(options);

  if (informational) {
    if (informational.kind === "version") {
      const version = await getVersion();
      console.log(version);
      return;
    }

    if (informational.kind === "unknown-command") {
      throw new Error(informational.text);
    }

    console.log(informational.text);
    return;
  }

  options = await promptForMissingOptions(options);
  const { template } = options;

  if (!Object.hasOwn(handlers, template)) {
    throw new Error(
      `${renderUnknownCommand(template, commands)}`
    );
  }

  const result = await handlers[template](options);
  if (typeof result === "number") {
    process.exitCode = result;
  }
  return result;
}
