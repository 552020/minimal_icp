#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import readline from "readline/promises";
import { HttpAgent, AnonymousIdentity, Identity } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { createActor } from "../src/declarations/basic_demo_backend";
import canisterIds from "../.dfx/local/canister_ids.json" assert { type: "json" };

// Types
interface Session {
  username: string | null;
  principal: string;
}

interface IdentityFile {
  publicKey: string;
  privateKey: string;
}

// Constants
const IDENTITIES_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "identities");
const CURRENT_PATH = path.join(IDENTITIES_DIR, "current.json");
const CANISTER_ID = canisterIds["basic_demo_backend"].local;
const HOST = "http://127.0.0.1:4943";

const CHOICES = {
  CONTINUE: "c",
  SWITCH: "s",
  DELETE: "d",
  LOGOUT: "l",
} as const;

const DELETE_CONFIRMATION = "DELETE";

// Helpers
function ensureIdentitiesDir(): void {
  if (!fs.existsSync(IDENTITIES_DIR)) {
    fs.mkdirSync(IDENTITIES_DIR, { recursive: true });
  }
}

// The identity path is the path to the identity file
// The identity file is a JSON file that contains the identity of the user
// The identity file is named after the username or the principal, something like:
// alice.json or rdmx6-jaaaa-aaaah-qcaiq-cai.json
// The identity file is stored in the identities directory
// The identity file is a JSON file that contains the identity of the user
// The function returns the path to the identity file, something like:
// /Users/stefano/Documents/Code/vetkeys/vetkeys/lab/vetkey_file_sharing/scripts/identities/alice.json
// or
// /Users/stefano/Documents/Code/vetkeys/vetkeys/lab/vetkey_file_sharing/scripts/identities/rdmx6-jaaaa-aaaah-qcaiq-cai.json

function identityPathFrom(username: string | null, principal: string): string {
  return path.join(IDENTITIES_DIR, `${username || principal}.json`);
}

// The function loads the identity from the identity file
// The function is used to load the identity from the identity file
// The identify file is a JSON with two fields:
// [ .., ...]
// [
// "302a300506032b65700321002e3ade7a379310d3ab77a10305e5e03eb6be73eede9e948e24093daf31e24f7c",
// "494d421ed9f20add7ee5160e3ba0fc388c1628c55f43400da1980b962abd3d8c"
//   ]
// The public_key is the public key of the identity
// The private_key is the private key of the identity
// The function loads the identity from the identity file
// The function is used to save the identity to the identity file
function loadIdentity(identityPath: string): Ed25519KeyIdentity {
  try {
    const raw = fs.readFileSync(identityPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate identity file structure
    if (!Array.isArray(parsed) || parsed.length !== 2) {
      throw new Error("Invalid identity file format");
    }

    return Ed25519KeyIdentity.fromJSON(JSON.stringify(parsed));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load identity from ${identityPath}: ${error.message}`);
    }
    throw new Error(`Failed to load identity from ${identityPath}: Unknown error`);
  }
}

function saveIdentity(identity: Ed25519KeyIdentity, identityPath: string): void {
  try {
    const identityData = identity.toJSON();
    fs.writeFileSync(identityPath, JSON.stringify(identityData, null, 2));
  } catch (error) {
    throw new Error(`Failed to save identity to ${identityPath}: ${error}`);
  }
}

function saveSession(session: Session): void {
  try {
    fs.writeFileSync(CURRENT_PATH, JSON.stringify(session, null, 2));
  } catch (error) {
    throw new Error(`Failed to save session: ${error}`);
  }
}

function loadSession(): Session | null {
  try {
    if (!fs.existsSync(CURRENT_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(CURRENT_PATH, "utf-8");
    const session = JSON.parse(raw);

    // Validate session structure
    if (typeof session !== "object" || session === null) {
      throw new Error("Invalid session format");
    }
    if (typeof session.principal !== "string") {
      throw new Error("Invalid principal in session");
    }
    if (session.username !== null && typeof session.username !== "string") {
      throw new Error("Invalid username in session");
    }

    return session as Session;
  } catch (error) {
    console.warn(`⚠️ Failed to load session: ${error}`);
    return null;
  }
}

async function prompt(question: string, allowEmpty: boolean = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await rl.question(question);
    const trimmed = answer.trim();

    if (!allowEmpty && !trimmed) {
      throw new Error("Input cannot be empty");
    }

    return trimmed;
  } finally {
    rl.close();
  }
}

async function promptChoice(question: string, validChoices: readonly string[]): Promise<string> {
  const choice = await prompt(question);
  if (!validChoices.includes(choice.toLowerCase())) {
    throw new Error(`Invalid choice. Valid options: ${validChoices.join(", ")}`);
  }
  return choice.toLowerCase();
}

// Load or prompt identity
async function selectIdentity(): Promise<Identity> {
  ensureIdentitiesDir();

  let session = null;
  if (fs.existsSync(CURRENT_PATH)) {
    // The current.json file contains the username and principal of the current user
    // {
    // 	"username": "alice",
    // 	"principal": "rdmx6-jaaaa-aaaah-qcaiq-cai"
    // }
    // The username can be null if the user is using the principal to login
    session = JSON.parse(fs.readFileSync(CURRENT_PATH, "utf-8"));
  }

  if (session) {
    const { username, principal } = session;
    const identityFile = identityPathFrom(username, principal);

    if (fs.existsSync(identityFile)) {
      // id is an Ed25519KeyIdentity object, it contains the public and private keys
      const id: Ed25519KeyIdentity = loadIdentity(identityFile);
      const label: string = username || id.getPrincipal().toText();
      console.log(`✅ Logged in as ${label} (${id.getPrincipal().toText()})`);

      try {
        const choice = await promptChoice(
          "\nChoose:\n  [c] Continue as current\n  [s] Switch user\n  [d] Delete identity\n  [l] Logout\n> ",
          Object.values(CHOICES)
        );

        switch (choice) {
          case CHOICES.CONTINUE:
            return id;
          case CHOICES.SWITCH:
            return await switchUser();
          case CHOICES.DELETE:
            return await handleIdentityDeletion(id, identityFile);
          case CHOICES.LOGOUT:
            return await handleLogout();
          default:
            console.log("⚠️ Invalid choice. Using anonymous.");
            return new AnonymousIdentity();
        }
      } catch (error) {
        console.log(`⚠️ Error: ${error instanceof Error ? error.message : "Unknown error"}. Using anonymous.`);
        return new AnonymousIdentity();
      }
    } else {
      console.log("⚠️ Identity file missing. Using anonymous.");
      return new AnonymousIdentity();
    }
  } else {
    return await switchUser();
  }
}

async function handleIdentityDeletion(identity: Ed25519KeyIdentity, identityFile: string): Promise<Identity> {
  console.log(`⚠️ WARNING: This action is irreversible.`);
  console.log(`❌ You will lose all access to data tied to this identity.`);
  console.log(`🆔 Principal: ${identity.getPrincipal().toText()}`);

  try {
    const confirm = await prompt(`Type '${DELETE_CONFIRMATION}' to permanently delete this identity: `);

    if (confirm !== DELETE_CONFIRMATION) {
      console.log("❎ Deletion aborted.");
      return identity;
    }

    fs.unlinkSync(identityFile);
    fs.unlinkSync(CURRENT_PATH);
    console.log("🗑️ Identity permanently deleted.");
    return new AnonymousIdentity();
  } catch (error) {
    console.log(`⚠️ Error during deletion: ${error instanceof Error ? error.message : "Unknown error"}`);
    return identity;
  }
}

async function handleLogout(): Promise<Identity> {
  try {
    fs.unlinkSync(CURRENT_PATH);
    console.log("👋 Logged out.");
    return new AnonymousIdentity();
  } catch (error) {
    console.log(`⚠️ Error during logout: ${error instanceof Error ? error.message : "Unknown error"}`);
    return new AnonymousIdentity();
  }
}

// Create or load identity
async function switchUser(): Promise<Identity> {
  try {
    const name = await prompt("👤 New username (leave blank to use Principal): ", true);
    const username = name || null;

    let identity: Ed25519KeyIdentity;
    let identityPath: string;

    if (username) {
      identityPath = path.join(IDENTITIES_DIR, `${username}.json`);
      if (fs.existsSync(identityPath)) {
        identity = loadIdentity(identityPath);
        console.log(`✅ Loaded identity for '${username}'`);
      } else {
        identity = Ed25519KeyIdentity.generate();
        saveIdentity(identity, identityPath);
        console.log(`✅ Created new identity '${username}'`);
      }
    } else {
      identity = Ed25519KeyIdentity.generate();
      const principal = identity.getPrincipal().toText();
      identityPath = path.join(IDENTITIES_DIR, `${principal}.json`);
      saveIdentity(identity, identityPath);
      console.log(`✅ Created identity with Principal: ${principal}`);
    }

    // Update session
    const session: Session = {
      username,
      principal: identity.getPrincipal().toText(),
    };
    saveSession(session);

    return identity;
  } catch (error) {
    console.log(`⚠️ Error switching user: ${error instanceof Error ? error.message : "Unknown error"}`);
    return new AnonymousIdentity();
  }
}

// === MAIN ===
async function main() {
  try {
    const identity = await selectIdentity();
    const principal = identity.getPrincipal().toText();

    const actor = createActor(CANISTER_ID, {
      agentOptions: { identity, host: HOST },
    });

    const session = loadSession();
    const name = session?.username || principal;
    const response = await actor.greet(name);
    console.log("\n📣 Canister says:", response);
  } catch (error) {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
