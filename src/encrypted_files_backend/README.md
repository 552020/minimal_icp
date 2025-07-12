# Encrypted Files Backend Canister

> **VetKeys-powered encrypted password manager (current) with potential file sharing adaptation**

## 🎯 **Overview**

The `encrypted_files_backend` canister **currently implements a password manager** using VetKeys IBE (Identity-Based Encryption). It provides secure encrypted password storage and sharing capabilities with granular access control. The architecture is based on the Enhanced Password Manager pattern.

## 🚀 **Deployment**

```bash
# Deploy with a unique key name for cryptographic isolation
dfx deploy encrypted_files_backend --argument '("production_file_sharing_v1")'
```

The `key_name` parameter creates a unique VetKeys namespace - different key names create completely separate encryption spaces.

## 🏗️ **Fundamental Concepts**

### **What is a "Map" vs "Vault"?**

**"Map" and "Vault" mean the same thing** - they're just different terminology for the same concept:

- **Function names use "map"**: `get_encrypted_values_for_map_with_metadata`
- **Documentation uses "vault"**: "password vault", "vault_name"
- **Both refer to**: A collection of related passwords with shared access control

### **Hierarchical Structure**

The canister organizes data in a **3-level hierarchy**:

```
Canister
├── Vault/Map: "work_passwords" (owned by Alice)
│   ├── Password: "gmail_login" + metadata
│   ├── Password: "slack_login" + metadata
│   └── Password: "github_login" + metadata
├── Vault/Map: "personal_passwords" (owned by Alice)
│   ├── Password: "bank_login" + metadata
│   └── Password: "netflix_login" + metadata
└── Vault/Map: "team_shared" (owned by Bob, shared with Alice)
    ├── Password: "server_admin" + metadata
    └── Password: "database_admin" + metadata
```

### **Can a Canister Have Multiple Vaults?**

**Yes!** A single canister can handle:

- ✅ **Multiple users** (each with their own Principal)
- ✅ **Multiple vaults per user** ("work_passwords", "personal_passwords", etc.)
- ✅ **Multiple passwords per vault** (individual password entries)
- ✅ **Cross-user vault sharing** (Alice can share her "work_passwords" vault with Bob)

### **Vault Names (Map Names)**

**Vault names are user-defined identifiers** for organizing passwords:

```typescript
// Alice creates different vaults for different purposes
"work_passwords"; // All work-related passwords
"personal_passwords"; // Personal account passwords
"family_shared"; // Passwords shared with family
"crypto_wallets"; // Cryptocurrency wallet seeds
```

**Key points:**

- **User chooses names**: You decide what to call your vaults
- **Globally unique per owner**: Alice can have "work_passwords", Bob can also have "work_passwords" (they're separate)
- **Used in all API calls**: Every function requires `(owner_principal, vault_name)` to identify which vault

### **Complete Example**

```typescript
// Alice's data structure in the canister:
Principal: alice_principal_id
├── Vault: "work_passwords"
│   ├── "gmail_login" → encrypted_password + metadata
│   └── "slack_login" → encrypted_password + metadata
└── Vault: "personal_passwords"
    └── "bank_login" → encrypted_password + metadata

// Bob's data structure in the same canister:
Principal: bob_principal_id
└── Vault: "team_shared" (shared with Alice)
    └── "server_admin" → encrypted_password + metadata
```

### **API Call Examples**

```typescript
// Get Alice's work passwords
await canister.get_encrypted_values_for_map_with_metadata(
  alice_principal, // owner
  "work_passwords" // vault/map name
);

// Share Bob's team vault with Alice
await canister.set_user_rights(
  bob_principal, // vault owner
  "team_shared", // vault/map name
  alice_principal, // user to share with
  { Read: null } // access level
);
```

Now the function names make sense:

- `get_encrypted_values_for_map_with_metadata` = "get all passwords from this vault with their metadata"
- `get_shared_user_access_for_map` = "see who has access to this vault"

## 🔍 **Canister API Reference**

### **Initialization**

```candid
service : (text) -> { ... }
```

- **Init parameter**: `key_name` (text) - Sets the VetKeys encryption key namespace

### **Core Data Types**

```candid
type AccessRights = variant { Read; ReadWrite; ReadWriteManage };
type ByteBuf = record { inner : blob };
type PasswordMetadata = record {
  url : text;
  number_of_modifications : nat64;
  tags : vec text;
  last_modification_date : nat64;
  last_modified_principal : principal;
  creation_date : nat64;
};
```

#### **Type Explanations**

##### **`AccessRights` (Variant)**

```candid
type AccessRights = variant { Read; ReadWrite; ReadWriteManage };
```

Defines permission levels for password vault access:

- **`Read`**: Can call these functions for the vault:
  - `get_encrypted_values_for_map_with_metadata(owner, vault_name)` - retrieve encrypted content + metadata
  - `get_shared_user_access_for_map(owner, vault_name)` - see who has access
  - `get_user_rights(owner, vault_name, user)` - check specific user permissions
  - `get_encrypted_vetkey(owner, vault_name, transport_key)` - get decryption key

- **`ReadWrite`**: All Read functions plus:
  - `insert_encrypted_value_with_metadata(owner, vault_name, key, data, tags, url)` - add/modify passwords
  - `remove_encrypted_value_with_metadata(owner, vault_name, key)` - delete passwords

- **`ReadWriteManage`**: All ReadWrite functions plus:
  - `set_user_rights(owner, vault_name, user, access_rights)` - grant/modify user access
  - `remove_user(owner, vault_name, user)` - revoke user access

**Usage Example**:

```typescript
// Grant read-only access
{
  Read: null;
}

// Grant read-write access
{
  ReadWrite: null;
}

// Grant full management access
{
  ReadWriteManage: null;
}
```

##### **`ByteBuf` (Record)**

```candid
type ByteBuf = record { inner : blob };
```

A wrapper around binary data (blob):

- **`inner`**: The actual binary data as a blob
- **Purpose**: Provides a consistent way to handle binary data across the API
- **Contains**: Vault names, password keys, encrypted content, etc.

**Usage Example**:

```typescript
// Creating a ByteBuf
const vaultName: ByteBuf = { inner: new Uint8Array([...]) };

// Accessing the data
const binaryData = byteBuf.inner;
```

##### **`PasswordMetadata` (Record)**

```candid
type PasswordMetadata = record {
  url : text;
  number_of_modifications : nat64;
  tags : vec text;
  last_modification_date : nat64;
  last_modified_principal : principal;
  creation_date : nat64;
};
```

Rich metadata stored alongside encrypted password content:

- **`url: text`**: Website URL associated with the password
  - _Example_: `"https://gmail.com"`, `"https://github.com"`
- **`number_of_modifications: nat64`**: Count of how many times the password was updated
  - _Example_: `0` (newly created), `3` (updated 3 times)
- **`tags: vec text`**: Array of tags for organization and search
  - _Example_: `["work", "email"]`, `["personal", "banking"]`
- **`last_modification_date: nat64`**: Timestamp of last update (nanoseconds since Unix epoch)
  - _Example_: `1704067200000000000` (January 1, 2024)
- **`last_modified_principal: principal`**: IC Principal who last modified the password
  - _Example_: `Principal.fromText("rdmx6-jaaaa-aaaah-qcaiq-cai")`
- **`creation_date: nat64`**: Timestamp when password was first created (nanoseconds since Unix epoch)
  - _Example_: `1703980800000000000` (December 31, 2023)

**Real-World Example**:

```typescript
const passwordMetadata = {
  url: "https://gmail.com",
  number_of_modifications: 2,
  tags: ["work", "email", "google"],
  last_modification_date: 1704153600000000000n, // Jan 2, 2024
  last_modified_principal: Principal.fromText("alice-principal-id"),
  creation_date: 1704067200000000000n, // Jan 1, 2024
};
```

#### **Additional Result Types**

The API also uses several `Result` variant types for error handling:

```candid
type Result = variant { Ok : vec record { ByteBuf; ByteBuf; PasswordMetadata }; Err : text };
type Result_1 = variant { Ok : ByteBuf; Err : text };
type Result_2 = variant { Ok : vec record { principal; AccessRights }; Err : text };
type Result_3 = variant { Ok : opt AccessRights; Err : text };
type Result_4 = variant { Ok : opt record { ByteBuf; PasswordMetadata }; Err : text };
```

These follow the standard Rust `Result<T, E>` pattern:

- **`Ok`**: Successful operation with returned data
- **`Err`**: Failed operation with error message

**Example**:

```typescript
const result = await canister.get_user_rights(owner, vault, user);
if ("Ok" in result) {
  const accessRights = result.Ok; // Some AccessRights or null
} else {
  const errorMessage = result.Err; // Error string
}
```

### **📚 API Functions**

#### **🔍 Query Functions** (Read-only, fast)

##### **1. `get_accessible_shared_map_names()`**

```candid
get_accessible_shared_map_names : () -> (vec record { principal; ByteBuf }) query;
```

- **Purpose**: Lists all password vaults shared with the current user
- **Returns**: Array of `(owner_principal, vault_name)` pairs
- **Use case**: "Show me all password vaults others have shared with me"

##### **2. `get_owned_non_empty_map_names()`**

```candid
get_owned_non_empty_map_names : () -> (vec ByteBuf) query;
```

- **Purpose**: Lists all password vaults owned by the current user
- **Returns**: Array of `vault_name` identifiers
- **Use case**: "Show me all my password vaults"

##### **3. `get_encrypted_values_for_map_with_metadata()`**

```candid
get_encrypted_values_for_map_with_metadata : (principal, ByteBuf) -> (Result) query;
```

- **Purpose**: Gets all encrypted passwords + metadata for a specific vault
- **Parameters**: `(owner_principal, vault_name)`
- **Returns**: `Vec<(password_key, encrypted_password, metadata)>` or error
- **Use case**: "Download all passwords from this vault"

##### **4. `get_shared_user_access_for_map()`**

```candid
get_shared_user_access_for_map : (principal, ByteBuf) -> (Result_2) query;
```

- **Purpose**: Lists all users who have access to a specific password vault
- **Parameters**: `(owner_principal, vault_name)`
- **Returns**: `Vec<(user_principal, access_rights)>` or error
- **Use case**: "Who can access this password vault and what permissions do they have?"

##### **5. `get_user_rights()`**

```candid
get_user_rights : (principal, ByteBuf, principal) -> (Result_3) query;
```

- **Purpose**: Check specific user's access rights for a password vault
- **Parameters**: `(owner_principal, vault_name, user_principal)`
- **Returns**: `Optional<AccessRights>` or error
- **Use case**: "Can Alice read/write this password vault?"

#### **🔄 Update Functions** (State-changing)

##### **6. `insert_encrypted_value_with_metadata()`**

```candid
insert_encrypted_value_with_metadata : (principal, ByteBuf, ByteBuf, ByteBuf, vec text, text) -> (Result_4);
```

- **Purpose**: Store encrypted password with metadata
- **Parameters**: `(owner_principal, vault_name, password_key, encrypted_password, tags, url)`
- **Returns**: `Optional<(previous_password, previous_metadata)>` or error
- **Use case**: "Save this encrypted password with metadata (URL, tags)"

##### **7. `remove_encrypted_value_with_metadata()`**

```candid
remove_encrypted_value_with_metadata : (principal, ByteBuf, ByteBuf) -> (Result_4);
```

- **Purpose**: Delete encrypted password and its metadata
- **Parameters**: `(owner_principal, vault_name, password_key)`
- **Returns**: `Optional<(deleted_password, deleted_metadata)>` or error
- **Use case**: "Delete this password permanently"

##### **8. `set_user_rights()`**

```candid
set_user_rights : (principal, ByteBuf, principal, AccessRights) -> (Result_3);
```

- **Purpose**: Grant or modify user access permissions to password vault
- **Parameters**: `(owner_principal, vault_name, user_principal, access_rights)`
- **Returns**: `Optional<previous_rights>` or error
- **Use case**: "Share this password vault with Bob (ReadWrite access)"

##### **9. `remove_user()`**

```candid
remove_user : (principal, ByteBuf, principal) -> (Result_3);
```

- **Purpose**: Revoke user access to a password vault
- **Parameters**: `(owner_principal, vault_name, user_principal)`
- **Returns**: `Optional<removed_rights>` or error
- **Use case**: "Stop sharing this password vault with Alice"

#### **🔐 VetKeys Functions**

##### **10. `get_vetkey_verification_key()`**

```candid
get_vetkey_verification_key : () -> (ByteBuf);
```

- **Purpose**: Get the public verification key for VetKeys
- **Returns**: Public key bytes
- **Use case**: Frontend needs this to verify VetKeys signatures

##### **11. `get_encrypted_vetkey()`**

```candid
get_encrypted_vetkey : (principal, ByteBuf, ByteBuf) -> (Result_1);
```

- **Purpose**: Get encrypted VetKey for decryption
- **Parameters**: `(owner_principal, vault_name, transport_key)`
- **Returns**: Encrypted VetKey or error
- **Use case**: "Get the key to decrypt this shared password vault"

## 🎯 **Typical User Workflows (Current: Password Management)**

### **Store Password Workflow**

```typescript
// 1. Encrypt password content client-side
const encryptedPassword = await encryptPassword(passwordData);

// 2. Store to canister
await canister.insert_encrypted_value_with_metadata(
  principalId,
  "work_passwords", // vault name
  "gmail_login", // password key
  encryptedPassword, // encrypted password data
  ["work", "email"], // tags
  "https://gmail.com" // URL
);

// 3. Optionally share vault with others
await canister.set_user_rights(principalId, "work_passwords", bobPrincipal, { ReadWrite: null });
```

### **Retrieve Password Workflow**

```typescript
// 1. List accessible password vaults
const myVaults = await canister.get_owned_non_empty_map_names();
const sharedVaults = await canister.get_accessible_shared_map_names();

// 2. Get encrypted passwords
const result = await canister.get_encrypted_values_for_map_with_metadata(ownerPrincipal, "work_passwords");

// 3. Get decryption key
const vetkey = await canister.get_encrypted_vetkey(ownerPrincipal, "work_passwords", transportKey);

// 4. Decrypt passwords client-side
const decryptedPasswords = await decryptPasswords(encryptedPasswords, vetkey);
```

### **Sharing Workflow**

```typescript
// 1. Grant access to password vault
await canister.set_user_rights(myPrincipal, "work_passwords", alicePrincipal, { Read: null });

// 2. Verify sharing worked
const accessList = await canister.get_shared_user_access_for_map(myPrincipal, "work_passwords");
```

### **Management Workflow**

```typescript
// 1. Check permissions
const rights = await canister.get_user_rights(ownerPrincipal, "work_passwords", userPrincipal);

// 2. Revoke access
await canister.remove_user(ownerPrincipal, "work_passwords", userPrincipal);

// 3. Delete passwords
await canister.remove_encrypted_value_with_metadata(ownerPrincipal, "work_passwords", "gmail_login");
```

## 🔧 **Key Concepts (Current: Password Management)**

### **Map Structure**

Passwords are organized as: `(owner_principal, vault_name, password_key)`

- **owner_principal**: Who owns the password vault
- **vault_name**: Password vault identifier (e.g., "work_passwords", "personal_passwords")
- **password_key**: Individual password identifier (e.g., "gmail_login", "slack_login")

### **Access Rights**

- **Read**: Can view and retrieve passwords
- **ReadWrite**: Can modify and store passwords
- **ReadWriteManage**: Can manage user access rights

### **VetKeys Integration**

- **Automatic encryption**: VetKeys handles IBE encryption/decryption
- **Transport keys**: Used for secure key exchange
- **Verification keys**: Ensure cryptographic integrity

### **Metadata (PasswordMetadata)**

Rich information stored separately from encrypted password content:

- Creation and modification dates
- Tags for organization (e.g., "work", "personal")
- URLs for website references
- Modification history

## 🔄 **Future File Sharing Adaptation**

### **Will We Change the API?**

**Current State**: The canister is a fully functional **password manager** with VetKeys encryption.

**Adaptation Options**:

#### **Option A: Keep Current Structure** ✅ _Recommended_

- **No API changes needed** - the underlying VetKeys EncryptedMaps pattern works identically for files
- **Only documentation changes** - refer to "vaults" as "collections" and "passwords" as "files"
- **Benefit**: Files are just encrypted data blobs like passwords, so the crypto/sharing logic is identical

#### **Option B: Gradual Code Adaptation**

- **Change terminology** in Rust code:
  - `PasswordMetadata` → `FileMetadata`
  - `"password_manager_dapp"` → `"file_sharing_dapp"`
  - Function names for clarity
- **Add file-specific metadata**:
  - `filename: String`
  - `content_type: String` (MIME type)
  - `file_size: u64`
  - Replace `url: String` with `description: String`

#### **File Sharing Usage (Current API)**

Even with the current password manager API, file sharing works perfectly:

```typescript
// "Password vault" = File collection
// "Password entry" = Individual file
// "Password data" = Encrypted file content

// Upload file to "documents" collection
await canister.insert_encrypted_value_with_metadata(
  myPrincipal,
  "documents", // "vault" = collection name
  "project_proposal.pdf", // "password key" = file identifier
  encryptedFileData, // "password" = encrypted file content
  ["work", "proposal"], // tags
  "Project proposal document" // "url" = file description
);

// Share "documents" collection with Alice
await canister.set_user_rights(myPrincipal, "documents", alicePrincipal, { Read: null });
```

### **Decision**

**We will likely keep the current API structure** because:

- ✅ **Proven architecture** - Enhanced Password Manager pattern is battle-tested
- ✅ **Identical security model** - Files need same encryption/sharing as passwords
- ✅ **No development overhead** - Focus on frontend integration instead of backend changes
- ✅ **Flexibility** - Current API handles any encrypted data (passwords, files, notes, etc.)

The VetKeys EncryptedMaps pattern is **data-agnostic** - it securely handles any encrypted content with metadata and sharing capabilities.

## 🛠️ **Development**

### **Building**

```bash
cargo build --release --target wasm32-unknown-unknown --package encrypted_files_backend
```

### **Generating .did File**

```bash
# Extract Candid interface from compiled Wasm
candid-extractor target/wasm32-unknown-unknown/release/encrypted_files_backend.wasm > encrypted_files_backend.did

# Move to correct location
mv encrypted_files_backend.did src/encrypted_files_backend/

# Regenerate TypeScript declarations
dfx generate encrypted_files_backend
```

### **Testing**

```bash
# Deploy locally
dfx start --background
dfx deploy encrypted_files_backend --argument '("test_key_v1")'

# Test via Candid UI
open http://127.0.0.1:4943/?canisterId=YOUR_CANDID_UI_ID&id=YOUR_CANISTER_ID
```

## 🔐 **Security Considerations**

- **Key Names**: Different key names create separate encryption spaces
- **Client-side Encryption**: Files are encrypted before upload
- **Access Control**: Granular permissions via VetKeys
- **Principal Identity**: IC Principal serves as cryptographic identity

## 📚 **Related Documentation**

- **[VetKeys Documentation](https://internetcomputer.org/docs/current/developer-docs/integrations/vetkeys/)**
- **[IC CDK Rust](https://docs.rs/ic-cdk/)**
- **[Candid Reference](https://internetcomputer.org/docs/current/references/candid-ref/)**

---

> **💡 Note**: This canister currently implements the Enhanced Password Manager pattern using VetKeys EncryptedMaps. The same architecture can be used for secure file storage and sharing without API changes, as the underlying cryptographic and sharing patterns are identical.
