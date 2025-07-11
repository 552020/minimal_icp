# Password Manager Approach: Encrypted Maps Analysis

> Analysis of the official `password_manager` example that uses **Encrypted Maps** - a high-level abstraction over VetKeys that dramatically simplifies implementation.

## 🚀 **High-Level Architecture: Encrypted Maps**

### **Key Innovation: Pre-Built VetKeys Component**

The password manager doesn't implement VetKeys directly. Instead, it uses a **pre-built component**:

```rust
use ic_vetkeys::encrypted_maps::{EncryptedMapData, EncryptedMaps, VetKey, VetKeyVerificationKey};
```

This provides a **turn-key solution** for encrypted storage with minimal code.

---

## 🏗️ **Architecture Overview**

### **Backend: Ultra-Simple Wrapper**

```rust
thread_local! {
    static ENCRYPTED_MAPS: RefCell<Option<EncryptedMaps<AccessRights>>> =
        const { RefCell::new(None) };
}

#[init]
fn init(key_name: String) {
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: key_name,
    };
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.replace(EncryptedMaps::init(
            "encrypted_maps_dapp",  // Context
            key_id,                 // VetKey ID
            id_to_memory(0),        // Storage memory allocation
            id_to_memory(1),
            id_to_memory(2),
            id_to_memory(3),
        ))
    });
}

// All other functions are just thin wrappers around EncryptedMaps methods!
#[update]
fn insert_encrypted_value(
    map_owner: Principal,
    map_name: ByteBuf,
    map_key: ByteBuf,
    value: EncryptedMapValue,
) -> Result<Option<EncryptedMapValue>, String> {
    let map_id = (map_owner, bytebuf_to_blob(map_name)?);
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.as_mut().unwrap().insert_encrypted_value(
            ic_cdk::api::msg_caller(),
            map_id,
            bytebuf_to_blob(map_key)?,
            value,
        )
    })
}
```

### **Frontend: Ultra-Simple Client**

```typescript
import { EncryptedMaps, DefaultEncryptedMapsClient } from "@dfinity/vetkeys/encrypted_maps";

export async function createEncryptedMaps(): Promise<EncryptedMaps> {
  const agent = await HttpAgent.create({
    /* options */
  });

  // That's it! No complex crypto, no VetKey management!
  return new EncryptedMaps(new DefaultEncryptedMapsClient(agent, canister_id));
}
```

---

## 📊 **Data Model: Map-Based Storage**

### **Storage Structure**

```
Map Architecture:
(map_owner: Principal, map_name: string) → {
    access_control: [(user: Principal, rights: AccessRights)],
    data: [(key: string, encrypted_value: EncryptedMapValue)]
}

Example for File Sharing:
(alice_principal, "shared_files") → {
    access_control: [
        (alice, ReadWriteManage),
        (bob, Read),
        (charlie, ReadWrite)
    ],
    data: [
        ("vacation_photo.jpg", <encrypted_file_data>),
        ("document.pdf", <encrypted_file_data>)
    ]
}
```

### **Built-in Access Control**

```rust
#[derive(Clone, Debug, CandidType, Deserialize)]
enum AccessRights {
    Read,           // Can read existing values
    ReadWrite,      // Can read and modify values
    ReadWriteManage // Can read, modify, and manage user access
}

// Built-in permission checking!
#[update]
fn set_user_rights(
    map_owner: Principal,
    map_name: ByteBuf,
    user: Principal,
    access_rights: AccessRights,
) -> Result<Option<AccessRights>, String> {
    // All permission logic handled by EncryptedMaps component!
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.as_mut().unwrap().set_user_rights(
            ic_cdk::api::msg_caller(),
            (map_owner, map_name),
            user,
            access_rights,
        )
    })
}
```

---

## 🔐 **VetKeys Integration: Completely Abstracted**

### **Backend: No Manual VetKey Handling**

```rust
// The EncryptedMaps component handles ALL VetKey operations internally!

#[update]
async fn get_vetkey_verification_key() -> VetKeyVerificationKey {
    // Just delegate to EncryptedMaps
    ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps.as_ref().unwrap().get_vetkey_verification_key()
    }).await
}

#[update]
async fn get_encrypted_vetkey(
    map_owner: Principal,
    map_name: ByteBuf,
    transport_key: TransportKey,
) -> Result<VetKey, String> {
    let map_id = (map_owner, bytebuf_to_blob(map_name)?);

    // EncryptedMaps handles all the complexity:
    // - Authorization checking
    // - VetKey derivation with proper input
    // - Transport key encryption
    // - Error handling
    Ok(ENCRYPTED_MAPS.with_borrow(|encrypted_maps| {
        encrypted_maps.as_ref().unwrap().get_encrypted_vetkey(
            ic_cdk::api::msg_caller(),
            map_id,
            transport_key,
        )
    })?.await)
}
```

### **Frontend: No Crypto Code Required**

```typescript
// No complex crypto operations needed!
// The EncryptedMaps client handles everything automatically

interface VaultModel {
  owner: Principal;
  name: string;
  passwords: Array<[string, PasswordModel]>;
  users: Array<[Principal, AccessRights]>;
}

// Just work with high-level abstractions
function passwordFromContent(
  owner: Principal,
  parentVaultName: string,
  passwordName: string,
  content: string
): PasswordModel {
  return { owner, parentVaultName, passwordName, content };
}
```

---

## ⚡ **API Comparison**

### **Encrypted Maps API (Simple)**

```rust
// High-level operations - just like a regular database!
insert_encrypted_value(owner, map_name, key, value) -> Result<>
get_encrypted_value(owner, map_name, key) -> Result<Option<Value>>
remove_encrypted_value(owner, map_name, key) -> Result<>
set_user_rights(owner, map_name, user, rights) -> Result<>
get_all_accessible_encrypted_maps() -> Vec<MapData>
```

### **Manual VetKeys API (Complex)**

```rust
// Low-level operations - manual crypto management
vetkd_public_key() -> DerivedPublicKey
vetkd_derive_key(input, transport_key) -> EncryptedVetKey
create_note() -> NoteId
update_note(id, encrypted_text) -> Result<>
add_user(note_id, user) -> Result<>
// Plus: Frontend crypto service, AES key caching, IndexedDB, etc.
```

---

## 🎯 **Comparison: Two Approaches**

| **Aspect**           | **Encrypted Maps**      | **Manual VetKeys**          |
| -------------------- | ----------------------- | --------------------------- |
| **Complexity**       | ✅ Ultra-simple         | ❌ Complex implementation   |
| **Code Lines**       | ✅ ~100 lines total     | ❌ ~500+ lines              |
| **Learning Curve**   | ✅ Minimal              | ❌ Steep (crypto knowledge) |
| **Performance**      | ❓ Unknown caching      | ✅ Optimized (AES caching)  |
| **Flexibility**      | ❌ Limited to maps      | ✅ Full control             |
| **Debugging**        | ❌ Black box            | ✅ Full visibility          |
| **Production Ready** | ✅ Battle-tested        | ❓ Need to implement safely |
| **Sharing Model**    | ✅ Built-in permissions | ✅ Custom logic             |
| **Storage Model**    | ❌ Map-only             | ✅ Any structure            |

---

## 🔄 **File Sharing Adaptation: Encrypted Maps**

### **Conceptual Mapping**

```
Password Manager Model → File Sharing Model:

Vault = File Collection/Folder
├── owner: Principal           → owner: Principal
├── name: "work_passwords"     → name: "shared_files"
├── passwords: [(key, value)]  → files: [(filename, file_data)]
└── users: [(user, rights)]    → users: [(user, rights)]

Example:
(alice, "vacation_photos") → {
    access_control: [(alice, ReadWriteManage), (bob, Read)],
    files: [
        ("beach.jpg", <encrypted_file_data>),
        ("sunset.png", <encrypted_file_data>)
    ]
}
```

### **Implementation for File Sharing**

```rust
// Backend: Just adapt the existing pattern!
#[update]
fn upload_file(
    owner: Principal,
    collection_name: String,  // Instead of vault name
    filename: String,         // Instead of password name
    file_data: Vec<u8>,      // Instead of password content
) -> Result<(), String> {
    let map_id = (owner, collection_name.into());
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.as_mut().unwrap().insert_encrypted_value(
            ic_cdk::api::msg_caller(),
            map_id,
            filename.into(),
            file_data,
        )
    }).map(|_| ())
}

#[update]
fn share_collection_with_user(
    owner: Principal,
    collection_name: String,
    user: Principal,
    rights: AccessRights,    // Read, ReadWrite, ReadWriteManage
) -> Result<(), String> {
    let map_id = (owner, collection_name.into());
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.as_mut().unwrap().set_user_rights(
            ic_cdk::api::msg_caller(),
            map_id,
            user,
            rights,
        )
    }).map(|_| ())
}
```

### **Frontend: Ultra-Simple**

```typescript
// No complex crypto service needed!
class FileManager {
  constructor(private encryptedMaps: EncryptedMaps) {}

  async uploadFile(collection: string, filename: string, data: Uint8Array) {
    // EncryptedMaps handles all encryption automatically!
    return this.encryptedMaps.insertValue(collection, filename, data);
  }

  async downloadFile(owner: Principal, collection: string, filename: string) {
    // EncryptedMaps handles all decryption automatically!
    return this.encryptedMaps.getValue(owner, collection, filename);
  }

  async shareCollection(collection: string, user: Principal, rights: AccessRights) {
    return this.encryptedMaps.setUserRights(collection, user, rights);
  }
}
```

---

## 🤔 **Decision Matrix**

### **For Learning/Understanding VetKeys:**

- **Manual VetKeys** ✅ - Deep understanding of cryptographic primitives
- **Encrypted Maps** ❌ - Black box abstraction

### **For Production Application:**

- **Manual VetKeys** ❓ - Need to implement security correctly
- **Encrypted Maps** ✅ - Battle-tested, secure by default

### **For Development Speed:**

- **Manual VetKeys** ❌ - Weeks of implementation
- **Encrypted Maps** ✅ - Days of integration

### **For File Sharing Use Case:**

- **Manual VetKeys** ✅ - Perfect fit (content-specific keys)
- **Encrypted Maps** ❓ - Map model might be limiting

---

## 🎯 **Recommendations**

### **Option 1: Start with Encrypted Maps** ⭐

**Pros:**

- ✅ Rapid prototyping (working app in days)
- ✅ Production-ready security
- ✅ Built-in sharing and permissions
- ✅ Official, supported approach

**Cons:**

- ❌ Less learning about VetKeys internals
- ❌ Potentially limited by map model
- ❌ Less flexibility for custom features

### **Option 2: Implement Manual VetKeys** 🎓

**Pros:**

- ✅ Deep VetKeys understanding
- ✅ Full control and flexibility
- ✅ Optimized performance potential
- ✅ Better for learning/portfolio

**Cons:**

- ❌ Much more complex implementation
- ❌ Higher risk of security bugs
- ❌ Longer development time

### **Option 3: Hybrid Approach** 🔄

1. **Start** with Encrypted Maps for rapid prototyping
2. **Learn** how it works internally
3. **Migrate** to manual VetKeys for optimization/features
4. **Compare** both approaches in practice

---

## 🚀 **My Recommendation**

**Start with Encrypted Maps!** Here's why:

1. **Get working faster** - See results in days, not weeks
2. **Learn the patterns** - Understand VetKeys usage without complexity
3. **Production ready** - Actually usable as a real application
4. **Easy migration** - Can always implement manual VetKeys later
5. **Official approach** - Following DFINITY's recommended path

We can always create a second branch with manual VetKeys implementation for comparison and learning!

---

## 📝 **Next Steps**

If we choose Encrypted Maps:

1. **Update TODO.md** to use Encrypted Maps approach
2. **Add dependency** `ic-vetkeys` to Cargo.toml
3. **Implement file collections** instead of individual files
4. **Use built-in sharing** instead of custom access control
5. **Focus on UX** instead of crypto implementation

**Decision time:** Which approach should we pursue? 🤔
