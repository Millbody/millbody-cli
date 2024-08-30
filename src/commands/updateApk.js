import fs from "fs";

import { executeCommand, checkFolderBySource } from "../functions.js";
import { getAppAccount } from "../services/api.js";

export default async function updateApk(options) {
  const source = checkFolderBySource("root");

  const { account } = options;
  if (!account) return console.log("Ops! não encontrei o argumento --account");
  process.chdir("./");
  const rootFolder = process.cwd();
  const millbodyJSON = await getAppAccount(options.account);
  if (millbodyJSON.message) return console.log(millbodyJSON.message);

  const { themeName } = millbodyJSON;
  const themeFolder = `${rootFolder}/mbContent/themes/${themeName}`;

  await executeCommand(
    `cd ${themeFolder} && (git checkout master && git branch -c ${account} && echo "OK" || git checkout ${account} ) && git merge master`
  );
  console.log("Enviando para o git as atualizações...");

  console.log("desligando qualquer react native server");
  executeCommand(`kill -9 'lsof -t -i:8081'`);

  console.log("Fechando o Xcode...");
  executeCommand(`killall Xcode`);

  console.log("Ligando o react Native");
  await executeCommand(
    `ttab "cd ${rootFolder}/mbContent/themes/${themeName}; millbody start"`
  );

  console.log("Reabrindo xcode...");
  await executeCommand(`cd ${rootFolder}/ios && xed .`);

  console.log("Executando as configurações do MillbodyApp");
  await executeCommand(
    `cd ${rootFolder} && node millbodyapp.config.js && echo "Enviando para o git as atualizações..." && cd ${themeFolder} && git add --all && git commit -m "update app" && git push origin ${account}`
  );
  console.log("Building iOS e Android...");
  await executeCommand(
    `cd ${rootFolder}/ios && fastlane ${
      options.track === "prod" ? "deploy" : "beta"
    } theme_folder:${themeName} update_config:true && echo "Building Andoid..." && cd ${rootFolder}/android && fastlane ${
      options.track === "prod" ? "deploy" : "beta"
    } theme_folder:${themeName} update_config:true`
  );
}
