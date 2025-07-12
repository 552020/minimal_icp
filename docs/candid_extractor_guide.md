# Candid Extractor Guide for Rust Canisters

> **Automatically generate accurate .did files from Rust canister code**

## 🎯 **Overview**

Unlike Motoko canisters, **Rust canisters do not automatically generate Candid interface files (.did)**. You have two options:

1. **Manual approach**: Write the .did file yourself (error-prone, gets out of sync)
2. **Automated approach**: Use `candid-extractor` to generate it from compiled Wasm ✅

The candid-extractor tool **extracts the actual Candid interface** from your compiled canister, ensuring 100% accuracy between your Rust code and the .did file.

## 📋 **Requirements**

- **Rust IC CDK versions 0.11.0 and newer**
- **Cargo** (for installation)
- **Compiled Wasm module** of your canister

## 🛠️ **Installation**

Install the candid-extractor tool globally:

```bash
cargo install candid-extractor
```

## 📝 **Step-by-Step Usage**

### **Step 1: Add Export Macro to Your Canister**

Add the `ic_cdk::export_candid!()` macro at the **end of your lib.rs file**:

```rust
use ic_cdk::{query, update};

#[query]
fn hello(name: String) -> String {
    format!("Hello, {}!", name)
}

#[update]
fn world(name: String) -> String {
    format!("World, {}!", name)
}

// Enable Candid export - ADD THIS LINE
ic_cdk::export_candid!();
```

⚠️ **Important**: The macro must be at the **very end** of your lib.rs file!

### **Step 2: Compile Your Canister**

Build the Wasm module for your canister:

```bash
cargo build --release --target wasm32-unknown-unknown --package <CANISTER_NAME>
```

**Example:**

```bash
cargo build --release --target wasm32-unknown-unknown --package encrypted_files_backend
```

The Wasm module will be stored at:

```
target/wasm32-unknown-unknown/release/<CANISTER_NAME>.wasm
```

### **Step 3: Extract the Candid Interface**

Extract the Candid interface and save it to a .did file:

```bash
candid-extractor target/wasm32-unknown-unknown/release/<CANISTER_NAME>.wasm > <CANISTER_NAME>.did
```

**Example:**

```bash
candid-extractor target/wasm32-unknown-unknown/release/encrypted_files_backend.wasm > encrypted_files_backend.did
```

### **Step 4: Move .did File to Correct Location**

Move the generated .did file to your canister's directory:

```bash
mv encrypted_files_backend.did src/encrypted_files_backend/
```

### **Step 5: Regenerate TypeScript Declarations**

Update the TypeScript declarations for your frontend:

```bash
dfx generate encrypted_files_backend
```

## 🔄 **Complete Workflow Example**

Here's a complete example fixing a canister with incorrect .did file:

```bash
# 1. Navigate to your project
cd /path/to/your/canister/project

# 2. Add export_candid!() to lib.rs (if not already added)
echo "ic_cdk::export_candid!();" >> src/encrypted_files_backend/src/lib.rs

# 3. Compile the canister
cargo build --release --target wasm32-unknown-unknown --package encrypted_files_backend

# 4. Extract Candid interface
candid-extractor target/wasm32-unknown-unknown/release/encrypted_files_backend.wasm > encrypted_files_backend.did

# 5. Move to correct location
mv encrypted_files_backend.did src/encrypted_files_backend/

# 6. Regenerate TypeScript declarations
dfx generate encrypted_files_backend
```

## 🎯 **Real-World VetKeys Example**

For a VetKeys file sharing canister, your lib.rs should look like this:

```rust
use ic_cdk::{init, query, update};
use ic_vetkeys::encrypted_maps::EncryptedMaps;
// ... other imports

#[init]
fn init(key_name: String) {
    // Initialize VetKeys
}

#[query]
fn get_accessible_shared_map_names() -> Vec<(Principal, ByteBuf)> {
    // Implementation
}

#[update]
fn insert_encrypted_value_with_metadata(
    map_owner: Principal,
    map_name: ByteBuf,
    map_key: ByteBuf,
    value: EncryptedMapValue,
    tags: Vec<String>,
    url: String,
) -> Result<Option<(EncryptedMapValue, PasswordMetadata)>, String> {
    // Implementation
}

#[update]
async fn get_encrypted_vetkey(
    map_owner: Principal,
    map_name: ByteBuf,
    transport_key: TransportKey,
) -> Result<VetKey, String> {
    // Implementation
}

// ... more functions

// Enable Candid export - CRITICAL!
ic_cdk::export_candid!();
```

This will generate a proper .did file with all your actual functions:

```candid
type AccessRights = variant { ReadWrite; ReadOnly };
type ByteBuf = blob;
type EncryptedMapValue = record {
  ciphertext : blob;
  aes_gcm_nonce : blob;
};
type PasswordMetadata = record {
  creation_date : nat64;
  last_modification_date : nat64;
  number_of_modifications : nat64;
  last_modified_principal : principal;
  tags : vec text;
  url : text;
};
type TransportKey = record { public_key : blob; };
type VetKey = record { encrypted_key : blob; };
type VetKeyVerificationKey = record { public_key : blob; };

service : {
  get_accessible_shared_map_names : () -> (vec record { principal; ByteBuf }) query;
  get_encrypted_values_for_map_with_metadata : (principal, ByteBuf) ->
    (variant { Ok : vec record { ByteBuf; EncryptedMapValue; PasswordMetadata }; Err : text }) query;
  get_encrypted_vetkey : (principal, ByteBuf, TransportKey) ->
    (variant { Ok : VetKey; Err : text });
  get_owned_non_empty_map_names : () -> (vec ByteBuf) query;
  get_shared_user_access_for_map : (principal, ByteBuf) ->
    (variant { Ok : vec record { principal; AccessRights }; Err : text }) query;
  get_user_rights : (principal, ByteBuf, principal) ->
    (variant { Ok : opt AccessRights; Err : text }) query;
  get_vetkey_verification_key : () -> (VetKeyVerificationKey);
  insert_encrypted_value_with_metadata : (principal, ByteBuf, ByteBuf, EncryptedMapValue, vec text, text) ->
    (variant { Ok : opt record { EncryptedMapValue; PasswordMetadata }; Err : text });
  remove_encrypted_value_with_metadata : (principal, ByteBuf, ByteBuf) ->
    (variant { Ok : opt record { EncryptedMapValue; PasswordMetadata }; Err : text });
  remove_user : (principal, ByteBuf, principal) ->
    (variant { Ok : opt AccessRights; Err : text });
  set_user_rights : (principal, ByteBuf, principal, AccessRights) ->
    (variant { Ok : opt AccessRights; Err : text });
}
```

## ⚠️ **Common Issues and Solutions**

### **Issue 1: Missing export_candid!() Macro**

**Problem**: Generated .did file is empty or contains wrong functions

**Solution**: Add `ic_cdk::export_candid!();` at the END of your lib.rs file

### **Issue 2: Compilation Errors**

**Problem**: `cargo build` fails with errors

**Solution**: Fix all compilation errors first. The extractor needs a valid Wasm module.

### **Issue 3: Wrong Package Name**

**Problem**: `cargo build` can't find the package

**Solution**: Use the exact package name from your `Cargo.toml`:

```toml
[package]
name = "encrypted_files_backend"  # Use this exact name
```

### **Issue 4: Outdated IC CDK Version**

**Problem**: export_candid!() macro not available

**Solution**: Update to IC CDK 0.11.0 or newer:

```toml
[dependencies]
ic-cdk = "0.18.5"  # Use latest version
```

### **Issue 5: .did File Not Found by dfx**

**Problem**: dfx can't find the .did file

**Solution**: Ensure .did file is in the correct location matching your dfx.json:

```json
{
  "canisters": {
    "encrypted_files_backend": {
      "type": "rust",
      "package": "encrypted_files_backend",
      "candid": "src/encrypted_files_backend/encrypted_files_backend.did"
    }
  }
}
```

## 🚀 **Best Practices**

### **1. Automated Workflow**

Create a script to automate the process:

```bash
#!/bin/bash
# generate_candid.sh

CANISTER_NAME="encrypted_files_backend"

echo "Building canister..."
cargo build --release --target wasm32-unknown-unknown --package $CANISTER_NAME

echo "Extracting Candid interface..."
candid-extractor target/wasm32-unknown-unknown/release/$CANISTER_NAME.wasm > $CANISTER_NAME.did

echo "Moving .did file..."
mv $CANISTER_NAME.did src/$CANISTER_NAME/

echo "Regenerating TypeScript declarations..."
dfx generate $CANISTER_NAME

echo "Done! ✅"
```

### **2. CI/CD Integration**

Add to your GitHub Actions workflow:

```yaml
- name: Generate Candid Interface
  run: |
    cargo install candid-extractor
    cargo build --release --target wasm32-unknown-unknown --package encrypted_files_backend
    candid-extractor target/wasm32-unknown-unknown/release/encrypted_files_backend.wasm > encrypted_files_backend.did
    mv encrypted_files_backend.did src/encrypted_files_backend/
    dfx generate encrypted_files_backend
```

### **3. Version Control**

**Always commit the generated .did file** to version control:

```bash
git add src/encrypted_files_backend/encrypted_files_backend.did
git add src/declarations/encrypted_files_backend/
git commit -m "Update Candid interface and TypeScript declarations"
```

## 📚 **Related Documentation**

- [IC Developer Docs - Generating Candid Files](https://internetcomputer.org/docs/building-apps/generating-candid/)
- [IC CDK Rust Documentation](https://docs.rs/ic-cdk/)
- [Candid Reference](https://internetcomputer.org/docs/current/references/candid-ref/)

## 🔗 **See Also**

- **[IC Canister Initialization Guide](./ic_canister_initialization.md)** - Understanding canister lifecycle
- **[VetKeys Integration](./vetkeys_integration.md)** - Cryptographic key management
- **[Frontend Integration](./frontend_integration.md)** - Using generated TypeScript declarations

---

> **💡 Key Takeaway**: The candid-extractor tool ensures your .did file is **always accurate** and **never out of sync** with your Rust code. Use it whenever you add, modify, or remove canister functions!
