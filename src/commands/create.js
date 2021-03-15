const fs = require("fs");
import {executeCommand, checkFolderBySource} from '../functions';
import {getAppAccount} from '../services/api';


export default async function create(options){
    const source = checkFolderBySource('root');
    
    const {account} = options;
    if(!account) return console.log('Ops! não encontrei o argumento --account')
    process.chdir('./');
    const rootFolder = process.cwd();
    const millbodyJSON = await getAppAccount(options.account)
    if(millbodyJSON.message) return console.log(millbodyJSON.message);
    if(!millbodyJSON.versionLabel) millbodyJSON.versionLabel = "2.9"
    const {themeName} = millbodyJSON;
    const themeFolder = `${rootFolder}/mbContent/themes/${themeName}`
    console.log('Criando o setup millbody na raiz do projeto')
    fs.writeFile(
      `${rootFolder}/millbodyApp.json`, 
      JSON.stringify(millbodyJSON), 
      'utf8', 
      function(err){
        if(err) console.log(err);
      }
    );

    console.log('Criando a variação do tema para account')
    await executeCommand(`cd ${themeFolder} && git checkout master && git checkout -b ${account} && echo "OK" || git checkout ${account}`);
    console.log('Colocando o setup no tema') 
    fs.writeFile(
      `${themeFolder}/millbodyApp.json`, 
      JSON.stringify(millbodyJSON), 
      'utf8', 
      function(err){
        if(err) console.log(err);
      }
    );
    console.log('Executando as configurações do MillbodyApp');
    await executeCommand(`cd ${rootFolder} && node millbodyapp.config.js`);
    console.log('Setup de chave + firebase')
    await executeCommand(`cd ${rootFolder}/android && fastlane default_setapp theme_folder:${themeName} && echo "Hora de criar o commit..." && cd ${themeFolder} && git add --all && git commit -m "launch app" && git push origin ${account} `);
    console.log('Criando os apps nas lojas...')
    console.log('Building iOS...')
    await executeCommand(`cd ${rootFolder}/ios && fastlane ${options.track === 'prod' ? 'deploy' : 'beta'} theme_folder:${themeName} && echo "Building Andoid..." && cd ${rootFolder}/android && fastlane ${options.track === 'prod' ? 'deploy' : 'beta'} theme_folder:${themeName}`);
}