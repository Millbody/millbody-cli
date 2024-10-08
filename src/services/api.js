import fetch from "node-fetch";
import fs from "fs";

export async function getAppAccount(account) {
  const rootFolder = process.cwd();
  const { constants } = await import(`${rootFolder}/mbCore/Constants`);
  const { uri } = constants;
  const ALDERAAN_API = `${uri}api/alderaan/v1/`;
  const { token } = await import(
    `${rootFolder}/mbCore/fastlane/keys/millbody.json`
  );

  const myHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  console.log(`consultando o setup do app na Millbody para ${account}`);
  const millbodyJSON = await fetch(`${ALDERAAN_API}${account}/app/`, {
    headers: myHeaders,
  }).then((res) => res.json());

  return millbodyJSON;
}
