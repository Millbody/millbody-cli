import fs from "fs";
import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executeRunAndroid(options) {
  const source = checkFolderBySource(options.source);
  const millbodyApp = JSON.parse(fs.readFileSync("millbodyApp.json"));
  const testFileExists = fs.existsSync("index.test.js");
  console.log("Rodando APP " + millbodyApp.account + " no Android");
  if (!testFileExists) {
    console.log(
      "Arquivo index.test.js não existe por favor verifique sua existencia e crie o arquivo semelhante ao readme"
    );
  } else {
    if (source == "theme") {
      executeCommand(
        "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android"
      );
    } else {
      executeCommand(
        "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android"
      );
    }
    console.log("Limpando cache e rodando android...");
  }
}
