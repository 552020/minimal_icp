# Scripts Documentation

This folder contains TypeScript scripts for interacting with the Internet Computer canisters in the `most_minimal_script_app` project.

## 🚀 Quick Start

All scripts use `tsx` for TypeScript execution with ES module support:

```bash
cd scripts
npx tsx <script-name>.ts
```

**Prerequisites:**
- dfx local replica running (`dfx start`)
- Canisters deployed (`dfx deploy`)
- Node.js dependencies installed (`npm install`)

## 📁 Scripts Overview

### `alice_share_ptk.ts` 
**Purpose**: Alice shares her public transport key with the `share_tpk_backend` canister

**What it does:**
- Generates or loads Alice's Ed25519 identity
- Creates a VetKeys transport secret key
- Extracts the public transport key
- Registers Alice with the canister by sharing her public transport key
- Stores identity persistently for subsequent runs

**Usage:**
```bash
npx tsx alice_share_ptk.ts
```

**First run output:**
```
Generated new identity: cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe
Canister response: User cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe registered successfully.
Alice Principal: cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe
```

**Subsequent runs:**
```
Loaded existing identity: cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe
Canister response: User cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe registered successfully.
Alice Principal: cue54-baqb7-ia2fc-o7pti-jkszj-eb2vw-tul7k-v5yu3-5o6nl-vzimk-zqe
```

**Key Features:**
- 🔐 **Identity Persistence**: Saves Ed25519 identity to `alice_share_ptk_identity.json`
- 🔑 **VetKeys Integration**: Generates transport keys for secure communication
- 💾 **Stable Memory**: Data stored in both memory and stable storage
- 🏗️ **IC Communication**: Uses HTTP agent with proper root key fetching

---

### `general_greet.ts`
**Purpose**: Basic canister interaction demo calling the `greet` method

**What it does:**
- Generates a temporary Ed25519 identity
- Connects to `basic_demo_backend` canister
- Calls the `greet("ICP")` method
- Demonstrates basic IC canister communication

**Usage:**
```bash
npx tsx general_greet.ts
```

**Output:**
```
Hello, ICP!
```

**Key Features:**
- 🌟 **Simple Demo**: Basic canister interaction example
- 🔄 **Temporary Identity**: No persistence, generates new identity each run
- 📝 **Educational**: Shows minimal setup for IC communication

---

### `new.ts`
**Purpose**: [Add description based on file contents]

*Note: This script needs documentation. Please describe its purpose and usage.*

## 🔧 Configuration

### TypeScript Configuration (`tsconfig.json`)

The scripts use ES modules with the following key settings:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "esnext",
    "target": "es2020",
    "moduleResolution": "node"
  },
  "ts-node": {
    "esm": true,
    "experimentalSpecifierResolution": "node"
  }
}
```

### Dependencies

Scripts rely on these key packages:
- `@dfinity/agent` - IC HTTP agent for canister communication
- `@dfinity/identity` - Ed25519 identity management
- `@dfinity/vetkeys` - VetKeys transport key generation
- `tsx` - TypeScript execution with ES module support

## 🗂️ Generated Files

### Identity Files
- `alice_share_ptk_identity.json` - Alice's persistent Ed25519 identity (gitignored)

**⚠️ Security Note**: Identity files contain private keys and are automatically excluded from git via `.gitignore`.

### Canister Declarations
Scripts import from `../src/declarations/` which contains:
- TypeScript type definitions (`.d.ts`)
- Candid interface factories
- Generated from canister `.did` files

## 🐛 Troubleshooting

### Common Issues

**Error**: `Unknown file extension ".ts"`
**Solution**: Use `tsx` instead of `node` for TypeScript execution

**Error**: `Cannot find module '../src/declarations/...'`
**Solution**: Run `dfx generate <canister_name>` to generate TypeScript declarations

**Error**: `actor.<method> is not a function`
**Solution**: 
1. Check if method exists in canister's `.did` file
2. Rebuild canister: `dfx build <canister_name>`
3. Use `candid-extractor` if automatic generation fails
4. Regenerate declarations: `dfx generate <canister_name>`

**Error**: JSON parsing errors with identity files
**Solution**: Delete corrupted identity file and let script regenerate it

### Debug Checklist

1. ✅ dfx replica running (`dfx start`)
2. ✅ Canisters deployed (`dfx deploy`)
3. ✅ Dependencies installed (`npm install`)
4. ✅ TypeScript declarations generated (`dfx generate`)
5. ✅ Using `tsx` for script execution

## 📚 Related Documentation

- [`alice_share_ptk.ts.md`](./alice_share_ptk.ts.md) - Detailed JSON parsing bug analysis
- [`../docs/learnings.md`](../docs/learnings.md) - Complete troubleshooting and learning reference
- [`../src/share_tpk_backend/src/lib.rs.md`](../src/share_tpk_backend/src/lib.rs.md) - Backend implementation details
- [`../../../docs/rust/candid_interface_generation.md`](../../../docs/rust/candid_interface_generation.md) - Candid extraction guide

## 🎯 Script Development Guidelines

### Adding New Scripts

1. **Follow naming convention**: `<actor>_<action>_<target>.ts`
   - Examples: `alice_share_ptk.ts`, `bob_decrypt_message.ts`

2. **Use consistent structure**:
   ```typescript
   // Imports
   import { HttpAgent, Actor } from "@dfinity/agent";
   import { Ed25519KeyIdentity } from "@dfinity/identity";
   
   // Identity management (if needed)
   const identity = Ed25519KeyIdentity.generate();
   
   // Agent setup
   const agent = await HttpAgent.create({
     identity,
     host: "http://127.0.0.1:4943",
   });
   await agent.fetchRootKey();
   
   // Canister interaction
   const actor = Actor.createActor(idlFactory, { agent, canisterId });
   const result = await actor.method_name(params);
   ```

3. **Add documentation**: Create corresponding `.md` file explaining purpose and usage

4. **Handle errors gracefully**: Add try/catch blocks and meaningful error messages

5. **Use environment-appropriate settings**: Local vs production configurations

### Best Practices

- 🔐 **Never commit identity files** - Always add to `.gitignore`
- 📝 **Document thoroughly** - Include purpose, usage, and examples
- 🧪 **Test both paths** - Generation and loading of persistent data
- 🔄 **Handle async properly** - Use await for IC operations
- 🛡️ **Validate inputs** - Check canister responses and parameters

## 🚀 Next Steps

Potential script additions:
- `bob_retrieve_messages.ts` - Bob decrypts messages from Alice
- `alice_encrypt_message.ts` - Alice encrypts a message for Bob
- `admin_view_users.ts` - Admin queries all registered users
- `benchmarks_performance.ts` - Performance testing for methods

Each new script should follow the established patterns and include comprehensive documentation. 