const fs = require("fs");
import {executeCommand, checkFolderBySource} from '../functions';
import {getAppAccount} from '../services/api';


export default async function updateApk(options){
    const source = checkFolderBySource('root');
    
    const {account} = options;
    if(!account) return console.log('Ops! não encontrei o argumento --account')
    process.chdir('./');
    const rootFolder = process.cwd();
    const millbodyJSON = await getAppAccount(options.account)
    if(millbodyJSON.message) return console.log(millbodyJSON.message);

    const {themeName} = millbodyJSON;
    const themeFolder = `${rootFolder}/mbContent/themes/${themeName}`

    await executeCommand(`cd ${themeFolder} && (git checkout master && git branch -c ${account} && echo "OK" || git checkout ${account} ) && git merge master`);
    console.log('Enviando para o git as atualizações...');

    console.log('Executando as configurações do MillbodyApp');
    await executeCommand(`cd ${rootFolder} && node millbodyapp.config.js && echo "Enviando para o git as atualizações..." && cd ${themeFolder} && git add --all && git commit -m "update app" && git push origin ${account}`);
    console.log('Building iOS e Android...')
    await executeCommand(`cd ${rootFolder}/ios && fastlane ${options.track === 'prod' ? 'deploy' : 'beta'} theme_folder:${themeName} && echo "Building Andoid..." && cd ${rootFolder}/android && fastlane ${options.track === 'prod' ? 'deploy' : 'beta'} theme_folder:${themeName}`);
}
