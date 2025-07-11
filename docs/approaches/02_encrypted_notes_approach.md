# Official VetKeys Approach: Encrypted Notes Dapp Analysis

> Analysis of the official `encrypted_notes_dapp_vetkd` example from the VetKeys repository to understand the proven architecture for content encryption with VetKeys.

## 🏗️ **High-Level Architecture**

### **Key Innovation: Content-Specific Keys**

Instead of user-specific keys, they use **content-specific keys** that enable sharing:

```
VetKey Input = content_id + owner_principal
```

This means:
- ✅ **Same file** → **Same VetKey** → **Same AES key** (for all authorized users)
- ✅ **Sharing works** without key redistribution 
- ✅ **Performance** through key caching
- ✅ **Security** through access control in backend

---

## 🔄 **Two-Layer Encryption Architecture**

### **Layer 1: VetKey → AES Key (Cached)**
```typescript
// Get VetKey from IC management canister
const vetKey = encryptedVetKey.decryptAndVerify(tsk, dpk, input);

// Derive AES key and cache in IndexedDB
const aesKey = await vetKey.asDerivedKeyMaterial().deriveAesGcmCryptoKey("note-key");
await indexedDB.set([note_id.toString(), owner], aesKey); // Cache for reuse
```

### **Layer 2: AES Key → Content Encryption (Fast)**
```typescript
// Encrypt content with cached AES key (fast, local operation)
const iv = crypto.getRandomValues(new Uint8Array(12));
const encryptedContent = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  cachedAesKey,
  contentBuffer
);
```

### **Why Two Layers?**

| **Direct VetKey Encryption** | **Two-Layer Approach** |
|------------------------------|-------------------------|
| ❌ Slow (IC call every time) | ✅ Fast (cached AES keys) |
| ❌ No caching possible | ✅ Non-extractable keys in IndexedDB |
| ❌ Complex sharing | ✅ Natural sharing support |
| ❌ Large encrypted payloads | ✅ Efficient AES-GCM encryption |

---

## 🔐 **VetKeys Integration Details**

### **Backend: VetKey Endpoints**

```rust
// Context for key derivation
const CONTEXT: &[u8] = b"note_symmetric_key";

// Get DerivedPublicKey for verification
#[update]
async fn symmetric_key_verification_key_for_note() -> String {
    let request = VetKDPublicKeyArgs {
        canister_id: None,
        context: CONTEXT.to_vec(),
        key_id: bls12_381_g2_test_key_1(),
    };
    let response = ic_cdk::management_canister::vetkd_public_key(&request).await;
    hex::encode(response.public_key)
}

// Get encrypted VetKey for specific content
#[update]
async fn encrypted_symmetric_key_for_note(
    note_id: NoteId,
    transport_public_key: Vec<u8>,
) -> String {
    // Authorization check
    if !note.is_authorized(&caller_str) {
        ic_cdk::trap("unauthorized key request");
    }
    
    let request = VetKDDeriveKeyArgs {
        input: {
            let mut buf = vec![];
            buf.extend_from_slice(&note_id.to_be_bytes()); // Content ID
            buf.extend_from_slice(note.owner.as_bytes());  // Owner ID
            buf // This makes keys content-specific, not user-specific!
        },
        context: CONTEXT.to_vec(),
        key_id: bls12_381_g2_test_key_1(),
        transport_public_key,
    };
    
    let response = ic_cdk::management_canister::vetkd_derive_key(&request).await;
    hex::encode(response.encrypted_key)
}
```

### **Frontend: VetKey Processing**

```typescript
class CryptoService {
  // Lazy-load and cache AES keys
  private async fetch_note_key_if_needed(note_id: bigint, owner: string): Promise<void> {
    if (!await get([note_id.toString(), owner])) { // Check IndexedDB cache
      
      // 1. Generate ephemeral transport key
      const tsk = vetkd.TransportSecretKey.random();
      
      // 2. Get encrypted VetKey from backend
      const ek_bytes_hex = await this.actor.encrypted_symmetric_key_for_note(
        note_id, 
        tsk.publicKeyBytes()
      );
      const encryptedVetKey = vetkd.EncryptedVetKey.deserialize(hex_decode(ek_bytes_hex));
      
      // 3. Get DerivedPublicKey for verification
      const pk_bytes_hex = await this.actor.symmetric_key_verification_key_for_note();
      const dpk = vetkd.DerivedPublicKey.deserialize(hex_decode(pk_bytes_hex));
      
      // 4. Prepare input (same as backend)
      const note_id_bytes = bigintTo128BitBigEndianUint8Array(note_id);
      const owner_utf8 = new TextEncoder().encode(owner);
      let input = new Uint8Array(note_id_bytes.length + owner_utf8.length);
      input.set(note_id_bytes);
      input.set(owner_utf8, note_id_bytes.length);
      
      // 5. Decrypt VetKey
      const vetKey = encryptedVetKey.decryptAndVerify(tsk, dpk, input);
      
      // 6. Derive AES key and cache it (non-extractable!)
      const aesKey = await (await vetKey.asDerivedKeyMaterial()).deriveAesGcmCryptoKey("note-key");
      await set([note_id.toString(), owner], aesKey) // Cache in IndexedDB
    }
  }
  
  // Fast encryption using cached AES key
  public async encryptWithNoteKey(note_id: bigint, owner: string, data: string): Promise<string> {
    await this.fetch_note_key_if_needed(note_id, owner);
    const note_key: CryptoKey = await get([note_id.toString(), owner]);
    
    const data_encoded = new TextEncoder().encode(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Never reuse IV!
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      note_key,
      data_encoded
    );
    
    return iv_as_string + ciphertext_as_string; // Prepend IV to ciphertext
  }
}
```

---

## 🤝 **Sharing Mechanism**

### **Backend: Authorization Logic**

```rust
#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct EncryptedNote {
    id: NoteId,
    encrypted_text: String,
    owner: PrincipalName,           // Content owner
    users: Vec<PrincipalName>,      // Shared with these users
}

impl EncryptedNote {
    pub fn is_authorized(&self, user: &PrincipalName) -> bool {
        user == &self.owner || self.users.contains(user)
    }
}

// Share content with another user
#[update]
fn add_user(note_id: NoteId, user: PrincipalName) {
    let caller_str = caller().to_string();
    if let Some(mut note) = notes.get(&note_id) {
        // Only owner can share
        if note.owner != caller_str {
            ic_cdk::trap("only the owner can share the note");
        }
        
        // Add user to sharing list
        if !note.users.contains(&user) {
            note.users.push(user.clone());
            notes.insert(note_id, note);
        }
        
        // Update user's shared content index
        update_user_shared_index(user, note_id);
    }
}
```

### **Why This Sharing Works**

1. **Same VetKey Input**: `content_id + owner` is same for all users
2. **Same AES Key**: All authorized users derive identical AES key
3. **Access Control**: Backend checks authorization before providing VetKey
4. **Performance**: Each user caches the same AES key locally

---

## 📊 **Data Storage Structure**

### **Backend Storage Maps**

```rust
// Content storage
NOTES: StableBTreeMap<NoteId, EncryptedNote>

// Ownership indexes (for efficient queries)
NOTE_OWNERS: StableBTreeMap<PrincipalName, NoteIds>  // User → [owned_content_ids]
NOTE_SHARES: StableBTreeMap<PrincipalName, NoteIds>  // User → [shared_content_ids]
```

### **Frontend Storage**

```typescript
// IndexedDB: [content_id, owner] → CryptoKey (non-extractable AES key)
const cacheKey = [note_id.toString(), owner];
const aesKey = await indexedDB.get(cacheKey);
```

---

## 🚀 **Performance Optimizations**

### **1. Key Caching Strategy**
- **AES keys cached** in IndexedDB (persistent, non-extractable)
- **VetKey fetched once** per content item, not per operation
- **Local encryption** with cached AES keys (extremely fast)

### **2. Efficient Queries**
- **No query methods** (all updates for consistency)
- **Indexed storage** for user content lookup
- **Batch operations** where possible

### **3. Memory Management**
```rust
// Limits to prevent resource exhaustion
static MAX_USERS: u64 = 1_000;
static MAX_NOTES_PER_USER: usize = 500;
static MAX_NOTE_CHARS: usize = 1000;
static MAX_SHARES_PER_NOTE: usize = 50;
```

---

## 🔒 **Security Model**

### **1. Authentication**
```rust
fn caller() -> Principal {
    let caller = msg_caller();
    if caller == Principal::anonymous() {
        panic!("Anonymous principal not allowed");
    }
    caller
}
```

### **2. Authorization**
- **Owner-only operations**: create, delete, share
- **Authorized-user operations**: read, update (if shared)
- **VetKey access control**: backend verifies before providing keys

### **3. Key Security**
- **Non-extractable AES keys** in IndexedDB
- **Ephemeral transport keys** (not stored)
- **Input validation** on all operations

---

## 📈 **Scalability Considerations**

### **1. Storage Limits**
- Stable memory usage for persistence
- Per-user content limits
- Maximum sharing restrictions

### **2. Upgrade Safety**
- No `await` calls across state modifications
- Stable memory for upgrade resilience
- Deterministic serialization

---

## 🎯 **Key Takeaways for File Sharing**

### **✅ Advantages of This Approach:**
1. **Natural sharing** without key redistribution
2. **High performance** through caching
3. **Battle-tested** architecture
4. **Scalable** access control
5. **Secure** key handling

### **🔄 Adaptations for File Sharing:**
1. **Content type**: Files instead of notes
2. **Larger payloads**: Efficient binary handling  
3. **File metadata**: MIME types, sizes, timestamps
4. **Context string**: `"file_symmetric_key"` instead of `"note_symmetric_key"`

### **📝 Implementation Priority:**
1. Follow their VetKey integration exactly
2. Adapt data structures for files
3. Implement sharing logic
4. Add file-specific features (upload, download)

---

## 🤔 **Decision Point**

**Should we abandon our current approach and adopt this proven architecture?**

**Pros:**
- ✅ Official, battle-tested approach
- ✅ Superior performance and sharing capabilities  
- ✅ Professional implementation patterns
- ✅ Security best practices included

**Cons:**
- ❌ More complex than our original plan
- ❌ Requires learning new concepts
- ❌ More frontend JavaScript complexity

**Recommendation:** **YES** - Adopt this approach for a production-quality implementation. 