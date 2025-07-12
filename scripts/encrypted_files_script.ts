#!/usr/bin/env node

// VetKeys Password Manager - Interactive Script
// This script reproduces the password creation flow from the Svelte frontend
// Demonstrates: Identity management, VetKeys encryption, canister communication

import fs from "fs";
import path from "path";
import readline from "readline";

import { HttpAgent } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { EncryptedMaps, DefaultEncryptedMapsClient } from "@dfinity/vetkeys/dist/types/encrypted_maps";
import { Principal } from "@dfinity/principal";

// Import the encrypted files backend interface
// This is the DFX-generated code for the encrypted files backend, check the docs/canister_import_methods_analysis.md file for more details
import { createActor } from "../src/declarations/encrypted_files_backend";

// Configuration
const IDENTITY_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "script_identity.json");
// The id of the canister is to find in the .dfx/local/canister_ids.json file if the canister is deployed locally, otherwise in .dfx/ic/canister_ids.json

// Dynamic canister ID loading
function getCanisterId(canisterName: string, network: 'local' | 'ic' = 'local'): string {
    const canisterIdsPath = path.join(process.cwd(), '.dfx', network, 'canister_ids.json');
    
    if (!fs.existsSync(canisterIdsPath)) {
        throw new Error(`Canister IDs file not found: ${canisterIdsPath}`);
    }
    
    const canisterIds = JSON.parse(fs.readFileSync(canisterIdsPath, 'utf-8'));
    
    if (!canisterIds[canisterName]) {
        throw new Error(`Canister '${canisterName}' not found in ${canisterIdsPath}`);
    }
    
    if (!canisterIds[canisterName][network]) {
        throw new Error(`Canister '${canisterName}' not deployed on ${network} network`);
    }
    
    return canisterIds[canisterName][network];
}

const CANISTER_ID = getCanisterId('encrypted_files_backend', 'local');
const HOST = "http://127.0.0.1:4943"; // Local development

// Types
interface PasswordData {
    vaultOwner: string;
    vaultName: string;
    passwordName: string;
    password: string;
    url: string;
    tags: string[];
}

// Interactive CLI setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Identity Management
async function setupIdentity(): Promise<Ed25519KeyIdentity> {
    console.log("🔐 Setting up identity...");
    
    let identity: Ed25519KeyIdentity;
    
    if (fs.existsSync(IDENTITY_PATH)) {
        // Load existing identity
        const raw = fs.readFileSync(IDENTITY_PATH, "utf-8");
        identity = Ed25519KeyIdentity.fromJSON(raw);
        console.log("✅ Loaded existing identity:", identity.getPrincipal().toText());
    } else {
        // Generate and save new identity
        identity = Ed25519KeyIdentity.generate();
        fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity.toJSON(), null, 2));
        console.log("✅ Generated new identity:", identity.getPrincipal().toText());
    }
    
    return identity;
}

// Agent and Services Setup
async function setupServices(identity: Ed25519KeyIdentity) {
    console.log("🌐 Setting up IC agent and services...");
    
    // Create HTTP agent
    const agent = await HttpAgent.create({
        identity,
        host: HOST,
    });
    
    // Fetch root key for local development
    await agent.fetchRootKey();
    console.log("✅ Root key fetched");
    
    // Create EncryptedMaps service (equivalent to frontend encryptedMaps)
    const encryptedMaps = new EncryptedMaps(
        new DefaultEncryptedMapsClient(agent, CANISTER_ID)
    );
    console.log("✅ EncryptedMaps service created");
    
    // Create canister actor
    const canisterClient = createActor(CANISTER_ID, { agentOptions: { host: HOST } });
    console.log("✅ Canister client created");
    
    return { agent, encryptedMaps, canisterClient };
}

// VetKeys Password Manager Service (reproduces lib/password_manager.ts)
class VetKeysPasswordManager {
    constructor(
        private readonly canisterClient: any,
        public readonly encryptedMaps: EncryptedMaps
    ) {}
    
    async setPassword(
        owner: Principal,
        vault: string,
        passwordName: string,
        password: Uint8Array,
        tags: string[],
        url: string,
    ): Promise<{ Ok: null } | { Err: string }> {
        console.log("🔐 Encrypting password...");
        
        // Step 1: Encrypt the password using VetKeys (reproduces frontend encryption)
        const encryptedPassword = await this.encryptedMaps.encryptFor(
            owner,                                  // Target user Principal
            new TextEncoder().encode(vault),        // Vault name as bytes
            new TextEncoder().encode(passwordName), // Password name as bytes
            password                                // Password content as bytes
        );
        
        console.log("✅ Password encrypted successfully");
        
        // Step 2: Store encrypted data with metadata (reproduces frontend canister call)
        console.log("🌐 Storing encrypted password...");
        const result = await this.canisterClient.insert_encrypted_value_with_metadata(
            owner,
            { inner: new TextEncoder().encode(vault) },      // Vault name as ByteBuf
            { inner: new TextEncoder().encode(passwordName) }, // Password name as ByteBuf
            { inner: encryptedPassword },                    // Encrypted password
            tags,                                            // Unencrypted metadata
            url                                              // Unencrypted metadata
        );
        
        console.log("✅ Password stored successfully");
        return result;
    }
    
    async getDecryptedVaults(owner: Principal): Promise<void> {
        console.log("📂 Fetching vaults...");
        
        try {
            // Get accessible vaults
            const vaultsSharedWithMe = await this.encryptedMaps.getAccessibleSharedMapNames();
            const vaultsOwnedByMe = await this.encryptedMaps.getOwnedNonEmptyMapNames();
            
            console.log(`Found ${vaultsOwnedByMe.length} owned vaults and ${vaultsSharedWithMe.length} shared vaults`);
            
            // Process owned vaults
            for (const vaultName of vaultsOwnedByMe) {
                const result = await this.canisterClient.get_encrypted_values_for_map_with_metadata(
                    owner,
                    { inner: vaultName }
                );
                
                if ("Ok" in result) {
                    const vaultNameString = new TextDecoder().decode(vaultName);
                    console.log(`📁 Vault: ${vaultNameString} (${result.Ok.length} passwords)`);
                    
                    // Decrypt passwords
                    for (const [passwordNameBytes, encryptedData, metadata] of result.Ok) {
                        const passwordNameString = new TextDecoder().decode(Uint8Array.from(passwordNameBytes.inner));
                        
                        try {
                            const decryptedData = await this.encryptedMaps.decryptFor(
                                owner,
                                vaultName,
                                Uint8Array.from(passwordNameBytes.inner),
                                Uint8Array.from(encryptedData.inner)
                            );
                            
                            const passwordContent = new TextDecoder().decode(decryptedData);
                            console.log(`  🔑 ${passwordNameString}: ${passwordContent.substring(0, 20)}...`);
                            console.log(`     URL: ${metadata.url || 'N/A'}`);
                            console.log(`     Tags: ${metadata.tags.join(', ') || 'N/A'}`);
                        } catch (e) {
                            console.log(`  ❌ ${passwordNameString}: Decryption failed`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.log("❌ Error fetching vaults:", error);
        }
    }
    
    async registerUser(publicKey: Uint8Array): Promise<void> {
        console.log("👤 Registering user with canister...");
        
        try {
            const result = await this.canisterClient.register_user(Array.from(publicKey));
            console.log("✅ User registered successfully:", result);
        } catch (error) {
            console.log("❌ Error registering user:", error);
        }
    }
}

// Interactive Password Creation (reproduces NewPassword.svelte flow)
async function createPassword(passwordManager: VetKeysPasswordManager, owner: Principal): Promise<void> {
    console.log("\n📝 Creating new password...");
    
    // Collect password data (reproduces form inputs)
    const vaultOwner = await question("Vault Owner (Principal): ");
    const vaultName = await question("Vault Name: ");
    const passwordName = await question("Password Name: ");
    const password = await question("Password Content: ");
    const url = await question("URL (optional): ");
    const tagsInput = await question("Tags (comma-separated, optional): ");
    
    // Process tags (reproduces frontend tag handling)
    const tags = tagsInput
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag !== "");
    
    console.log("\n🔐 Processing password creation...");
    
    try {
        // Step 1: Text encoding (reproduces frontend TextEncoder)
        const encodedPassword = new TextEncoder().encode(password);
        console.log("✅ Password encoded to bytes");
        
        // Step 2: Call password manager (reproduces setPassword flow)
        const result = await passwordManager.setPassword(
            Principal.fromText(vaultOwner),
            vaultName,
            passwordName,
            encodedPassword,
            tags,
            url
        );
        
        if ("Ok" in result) {
            console.log("✅ Password created successfully!");
            
            // Show success notification (reproduces frontend notification)
            console.log("🎉 Password added successfully");
            
            // Refresh vaults (reproduces frontend refreshVaults)
            console.log("🔄 Refreshing vaults...");
            await passwordManager.getDecryptedVaults(owner);
            
        } else {
            console.log("❌ Error creating password:", result.Err);
        }
        
    } catch (error) {
        console.log("❌ Error:", error);
    }
}

// Main interactive menu
async function showMenu(passwordManager: VetKeysPasswordManager, owner: Principal): Promise<void> {
    while (true) {
        console.log("\n" + "=".repeat(50));
        console.log("🔐 VetKeys Password Manager - Interactive Script");
        console.log("=".repeat(50));
        console.log("1. Create new password");
        console.log("2. List accessible vaults");
        console.log("3. Register user with canister");
        console.log("4. Exit");
        console.log("=".repeat(50));
        
        const choice = await question("Choose an option (1-4): ");
        
        switch (choice) {
            case "1":
                await createPassword(passwordManager, owner);
                break;
            case "2":
                await passwordManager.getDecryptedVaults(owner);
                break;
            case "3":
                const publicKey = new Uint8Array(32); // Demo public key
                await passwordManager.registerUser(publicKey);
                break;
            case "4":
                console.log("👋 Goodbye!");
                rl.close();
                return;
            default:
                console.log("❌ Invalid option. Please try again.");
        }
    }
}

// Main execution
async function main() {
    try {
        console.log("🚀 Starting VetKeys Password Manager Script");
        console.log("This script reproduces the Svelte frontend password creation flow");
        console.log("=".repeat(60));
        
        // Step 1: Setup identity (reproduces auth.ts identity management)
        const identity = await setupIdentity();
        const owner = identity.getPrincipal();
        
        // Step 2: Setup services (reproduces encrypted_maps.ts and password_manager.ts)
        const { agent, encryptedMaps, canisterClient } = await setupServices(identity);
        
        // Step 3: Create password manager service (reproduces PasswordManager class)
        const passwordManager = new VetKeysPasswordManager(canisterClient, encryptedMaps);
        
        // Step 4: Show interactive menu
        await showMenu(passwordManager, owner);
        
    } catch (error) {
        console.error("❌ Script failed:", error);
        rl.close();
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
