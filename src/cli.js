import arg from 'arg';
import inquirer from 'inquirer';

import executeStart from './commands/start';
import executeCodePush from './commands/codepush';
import executeRunAndroid from './commands/runAndroid';

function parseArgumentsIntoOptions(rawArgs){
    const args = arg(
        {
            '--source': String,
            '-s': '--source',
        },
        {
            argv: rawArgs.slice(2)
        }
    );
    return {
        template: args._[0],
        source: args['--source'] == 'root' ? 'root' : 'theme'
    }
}

async function promptForMissingOptions(options){
    const defaultTemplate = 'start';
    if(options.skipPrompts){
        return {
            ...options,
            template: options.template || defaultTemplate
        }
    }

    const questions = [];
    if(!options.template){
        questions.push({
            type: 'list',
            name: 'template',
            message: 'Escolha uma opção de comando para rodar: ',
            choices: ['new', 'start', 'run-ios', 'run-android', 'codepush'],
            default: defaultTemplate,
        })
    }

    const answers = await inquirer.prompt(questions);
    return {
        ...options,
        template: options.template || answers.template,
    }
}

export async function cli(args){
    let options = parseArgumentsIntoOptions(args);
    options = await promptForMissingOptions(options);
    const { template, source } = options;
    switch(template){
        case 'start':
            executeStart(options);
            break;
        case 'codepush':
            executeCodePush(options);
            break;
        case 'run-android':
            executeRunAndroid(options);
            break;
    }
    // console.log(options)
}