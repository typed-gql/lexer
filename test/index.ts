import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { exit } from "process";
import { lex } from "../src";
import { stringify } from "./stringify";

function test(directory: string) {
  const files = readdirSync(directory);
  const gqlFiles = files.filter((file) => /^\d{2}-.*\.gql$/.test(file)).sort();
  gqlFiles.forEach((gqlFile) => {
    const gqlFilePath = join(directory, gqlFile);
    const jsonFilePath = join(directory, gqlFile.replace(/\.gql$/, ".json"));
    if (!existsSync(jsonFilePath)) {
      console.error(`Missing JSON file for ${gqlFile}`);
      return;
    }

    const gqlContent = readFileSync(gqlFilePath, "utf-8");
    const expectedJson = readFileSync(jsonFilePath, "utf-8");

    const lexResult = lex(gqlContent);

    if (stringify(lexResult) === expectedJson) {
      console.log(`Test passed for ${gqlFile}`);
    } else {
      console.error(`Test failed for ${gqlFile}`);
      console.error(`Expected: ${expectedJson}`);
      console.error(`Got: ${stringify(lexResult)}`);
      exit(1);
    }
  });
}

const testDirectory = "./test/data"; // Replace with the actual directory

test(testDirectory);
