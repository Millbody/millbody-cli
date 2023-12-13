const { exec } = require('child_process');
const fs = require("fs");

// var access = fs.createWriteStream('./millbody.access.log', { flags: 'a' }), 
//     error = fs.createWriteStream('./millbody.error.log', { flags: 'a' });

async function executeCommand(command) {
    return new Promise(async function (resolve, reject) {
        const process = await exec(command);

        process.stdout.on('data', (data) => {
            console.log(data.toString())
            // access.write(data.toString());
        })

        process.stderr.on('data', (data) => {
            console.log(data.toString())
            // error.write(data.toString());
        })

        process.on('exit', (code) => {
            console.log(code?.toString())
            // access.write(code.toString());
            resolve(code)
        })
    })
}

function checkFolderBySource(source) {
    if (source == 'theme') {
        if (fs.existsSync('./screens') && fs.existsSync('./millbodyApp.json')) {
            return 'theme'
        }
        else {
            console.error('A pasta não corresponde a um TEMA MILLBODY para executar esse comando no source THEME');
            process.exit();
        }
    } else {
        if (fs.existsSync('./mbCore') && fs.existsSync('./millbodyApp.json')) {
            return 'root'
        } else {
            console.error('Esse projeto não corresponde ao framework MILLBODY APP.');
            process.exit()
        }
    }

}

module.exports = {
    executeCommand,
    checkFolderBySource,
}