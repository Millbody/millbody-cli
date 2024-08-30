import fs from "fs";

import { executeCommand, checkFolderBySource } from "../functions.js";
import { getAppAccount } from "../services/api.js";

export default async function create(options) {
  const source = checkFolderBySource("root");

  const { account } = options;
  if (!account) return console.log("Ops! não encontrei o argumento --account");
  process.chdir("./");
  const rootFolder = process.cwd();
  const millbodyJSON = await getAppAccount(options.account);
  if (millbodyJSON.message) return console.log(millbodyJSON.message);
  if (!millbodyJSON.versionLabel) millbodyJSON.versionLabel = "3.0";
  const { themeName } = millbodyJSON;
  const themeFolder = `${rootFolder}/mbContent/themes/${themeName}`;
  console.log("Criando o setup millbody na raiz do projeto");
  fs.writeFile(
    `${rootFolder}/millbodyApp.json`,
    JSON.stringify(millbodyJSON),
    "utf8",
    function (err) {
      if (err) console.log(err);
    }
  );

  console.log("Criando a variação do tema para account");
  await executeCommand(
    `cd ${themeFolder} && git checkout master && git checkout -b ${account} && echo "OK" || git checkout ${account}`
  );
  console.log("Colocando o setup no tema");
  fs.writeFile(
    `${themeFolder}/millbodyApp.json`,
    JSON.stringify(millbodyJSON),
    "utf8",
    function (err) {
      if (err) console.log(err);
    }
  );
  console.log("desligando qualquer react native server");
  executeCommand(`kill -9 'lsof -t -i:8081'`);
  console.log("Executando as configurações do MillbodyApp");
  await executeCommand(`cd ${rootFolder} && node millbodyapp.config.js`);
  console.log("Fechando o Xcode...");
  executeCommand(`killall Xcode`);
  console.log("Setup de chave + firebase");
  await executeCommand(
    `cd ${rootFolder}/android && fastlane default_setapp theme_folder:${themeName} && echo "Hora de criar o commit..." && cd ${themeFolder} && git add --all && git commit -m "launch app" && git push origin ${account} `
  );
  console.log("Ligando o react Native");
  await executeCommand(
    `ttab "cd ${rootFolder}/mbContent/themes/${themeName}; millbody start"`
  );
  console.log("Reabrindo xcode...");
  await executeCommand(`cd ${rootFolder}/ios && xed .`);
  console.log("Criando os apps nas lojas...");
  console.log("Building Android...");
  await executeCommand(
    `cd ${rootFolder}/android && ./gradlew bundleRelease && echo "Building Andoid..." && cd ${rootFolder}/ios && fastlane ${
      options.track === "prod" ? "deploy" : "create_app"
    } theme_folder:${themeName}`
  );
}
