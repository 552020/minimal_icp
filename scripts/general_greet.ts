// The script of the Doc AI

import { HttpAgent, Actor } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
// import { idlFactory, canisterId } from "../declarations/backend"; // Adjust path as neededyyp
// import { idlFactory, canisterId } from "../src/declarations/most_minimal_script_app_backend"; // Adjust path as neededyyp
import { idlFactory } from "../src/declarations/most_minimal_script_app_backend"; // Adjust path as neededyyp

import canisterIds from "../.dfx/local/canister_ids.json" assert { type: "json" };

// Log the imported modules/objects
console.log("HttpAgent:", HttpAgent);
console.log("Actor:", Actor);
console.log("Ed25519KeyIdentity:", Ed25519KeyIdentity);
console.log("idlFactory:", idlFactory);
console.log("canisterIds:", canisterIds);

const canisterId = canisterIds["most_minimal_script_app_backend"].local;

// 1. Generate a new identity (or load from PEM if you want persistence)
const identity = Ed25519KeyIdentity.generate();

// 2. Create an agent with the identity
// const agent = new HttpAgent({ identity });
// const agent = new HttpAgent({ identity, host: "http://127.0.0.1:4943" });

// 2. Create the agent with the identity (modern way)
const agent = await HttpAgent.create({
  identity,
  host: "http://127.0.0.1:4943", // Required for local development
});

// 3. For local development, fetch the root key
await agent.fetchRootKey();

// 4. Create an actor for the backend canister
const backend = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// 5. Call a method (e.g., greet)
const result = await backend.greet("ICP");
console.log(result);
