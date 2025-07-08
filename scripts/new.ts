// Save this file in your `scripts/` folder

import { HttpAgent, Actor } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { idlFactory } from "../src/declarations/most_minimal_script_app_backend";
import canisterIds from "../.dfx/local/canister_ids.json" assert { type: "json" };
import * as fs from "fs";
import * as path from "path";

const canisterId = canisterIds["most_minimal_script_app_backend"].local;
const IDENTITY_PATH = path.resolve("scripts/.alice_identity.json");

// Load or create identity
let aliceIdentity: Ed25519KeyIdentity;
if (fs.existsSync(IDENTITY_PATH)) {
  const json = fs.readFileSync(IDENTITY_PATH, "utf-8");
  aliceIdentity = Ed25519KeyIdentity.fromJSON(JSON.parse(json));
  console.log("🔐 Loaded Alice's identity from disk");
} else {
  aliceIdentity = Ed25519KeyIdentity.generate();
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(aliceIdentity.toJSON()));
  console.log("🆕 Generated and saved new identity for Alice");
}

// Create agent
const agent = new HttpAgent({
  identity: aliceIdentity,
  host: "http://127.0.0.1:4943",
});
await agent.fetchRootKey();

// Create actor
const actor = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// Log principal
console.log("🪪 Alice Principal:", aliceIdentity.getPrincipal().toText());

// Optional: call backend methods
// await actor.register_user();
