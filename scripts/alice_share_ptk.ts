// Made by ChatGPT
import fs from "fs"; // Filesystem utilities (used to read/write Alice's identity)
import path from "path"; // To resolve the path to the identity file

import { HttpAgent, Actor } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { TransportSecretKey } from "@dfinity/vetkeys";

const transportKey = TransportSecretKey.random();
const transportPublicKey = transportKey.publicKeyBytes(); // Uint8Array

// import { idlFactory, canisterId } from "../src/declarations/share_tpk_backend";
import { idlFactory } from "../src/declarations/share_tpk_backend"; // Adjust path as neededyyp

import canisterIds from "../.dfx/local/canister_ids.json" assert { type: "json" };

const canisterId = canisterIds["share_tpk_backend"].local;

const IDENTITY_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "alice_share_ptk_identity.json");
// Simulate Alice's identity
// const aliceIdentity = Ed25519KeyIdentity.generate();
let aliceIdentity: Ed25519KeyIdentity;

if (fs.existsSync(IDENTITY_PATH)) {
  // Load existing identity
  const raw = fs.readFileSync(IDENTITY_PATH, "utf-8");
  aliceIdentity = Ed25519KeyIdentity.fromJSON(raw);
  console.log("Loaded existing identity:", aliceIdentity.getPrincipal().toText());
} else {
  // Generate and save new identity
  aliceIdentity = Ed25519KeyIdentity.generate();
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(aliceIdentity.toJSON(), null, 2));
  console.log("Generated new identity:", aliceIdentity.getPrincipal().toText());
}
// const agent = new HttpAgent({ identity: aliceIdentity });
const agent = await HttpAgent.create({
  identity: aliceIdentity,
  host: "http://127.0.0.1:4943", // Required for local development
});

await agent.fetchRootKey(); // needed for local dev

const actor = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// Register Alice with the canister

// await actor.register_user(Array.from(transportPublicKey));
const response = await actor.register_user(Array.from(transportPublicKey));
console.log("Canister response:", response);

// Now Alice is "logged in" — her Principal is known to the canister
console.log("Alice Principal:", aliceIdentity.getPrincipal().toText());
