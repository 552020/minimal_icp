# Basic IBE Approach - Simple Identity-Based Encryption

> **Simplest VetKeys implementation** for learning IBE fundamentals with direct Principal-based encryption.

## 📍 **Location & Overview**

**Path**: `vetkeys/examples/basic_ibe/rust/backend/src/lib.rs`  
**Lines**: ~100  
**Complexity**: 🟢 Simple  
**Pattern**: User Principal

## 🎯 **Core Concept**

Basic IBE demonstrates the **fundamental VetKeys pattern**: encrypt data directly to a user's IC Principal as the IBE identity. No sharing, no complex data structures - just pure IBE messaging.

```rust
// Core pattern: Principal = IBE Identity
let caller = ic_cdk::api::msg_caller();
let identity = caller.as_ref().to_vec();  // Principal bytes as IBE identity
```

## 🏗️ **Architecture Analysis**

### **Data Storage Pattern**

```rust
static INBOXES: RefCell<StableBTreeMap<Principal, Inbox, Memory>> =
    RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))));

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Inbox {
    pub messages: Vec<Message>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Message {
    pub sender: Principal,
    pub encrypted_message: Vec<u8>,  // Pre-encrypted on frontend
    pub timestamp: u64,
}
```

**Key Characteristics**:

- ✅ **Direct mapping**: `Principal → Inbox`
- ✅ **Simple structure**: Each user has one inbox with message list
- ✅ **Pre-encrypted data**: Backend stores already-encrypted content
- ❌ **No sharing**: Messages encrypted to one recipient only

### **VetKeys Integration**

```rust
#[update]
async fn get_ibe_public_key() -> VetKeyPublicKey {
    let request = VetKDPublicKeyArgs {
        canister_id: None,
        context: "basic_ibe_example_dapp".as_bytes().to_vec(),
        key_id: key_id(),
    };
    let result = ic_cdk::management_canister::vetkd_public_key(&request).await;
    VetKeyPublicKey::from(result.public_key)
}

#[update]
async fn get_my_encrypted_ibe_key(transport_key: TransportPublicKey) -> EncryptedVetKey {
    let caller = ic_cdk::api::msg_caller();
    let request = VetKDDeriveKeyArgs {
        input: caller.as_ref().to_vec(),  // User's Principal as IBE identity!
        context: "basic_ibe_example_dapp".as_bytes().to_vec(),
        key_id: key_id(),
        transport_public_key: transport_key.into_vec(),
    };
    let result = ic_cdk::management_canister::vetkd_derive_key(&request).await;
    EncryptedVetKey::from(result.encrypted_key)
}
```

**Key Insights**:

- ✅ **Manual VetKeys**: Directly calls management canister APIs
- ✅ **Principal as identity**: `caller.as_ref().to_vec()` is the IBE identity
- ✅ **Transport key pattern**: Frontend generates transport key for secure key derivation
- ✅ **Context-specific**: Uses app-specific context string

## 🔄 **Message Flow**

### **1. Encryption (Frontend)**

```typescript
// 1. Get master public key
const publicKey = await backend.get_ibe_public_key();

// 2. Encrypt message for recipient's Principal
const recipientIdentity = Principal.fromText(recipientPrincipal).toUint8Array();
const encryptedMessage = IBECiphertext.encrypt(
  publicKey,
  recipientIdentity, // Recipient's Principal as IBE identity
  messageBytes,
  seed
);

// 3. Send to backend
await backend.send_message({
  receiver: Principal.fromText(recipientPrincipal),
  encrypted_message: encryptedMessage.serialize(),
});
```

### **2. Storage (Backend)**

```rust
#[update]
fn send_message(request: SendMessageRequest) -> Result<(), String> {
    let sender = ic_cdk::api::msg_caller();
    let message = Message {
        sender,
        encrypted_message: request.encrypted_message,  // Already encrypted!
        timestamp: ic_cdk::api::time(),
    };

    INBOXES.with_borrow_mut(|inboxes| {
        let mut inbox = inboxes.get(&request.receiver).unwrap_or_default();
        inbox.messages.push(message);
        inboxes.insert(request.receiver, inbox);
        Ok(())
    })
}
```

### **3. Decryption (Frontend)**

```typescript
// 1. Generate transport key pair
const transportKeyPair = TransportSecretKey.generate();

// 2. Get user's encrypted VetKey
const encryptedVetKey = await backend.get_my_encrypted_ibe_key(transportKeyPair.public_key());

// 3. Decrypt VetKey
const userVetKey = encryptedVetKey.decrypt(transportKeyPair);

// 4. Decrypt messages
messages.forEach((msg) => {
  const ciphertext = IBECiphertext.deserialize(msg.encrypted_message);
  const decryptedMessage = ciphertext.decrypt(userVetKey);
});
```

## ✅ **Strengths**

1. **🎓 Educational Value**
   - Perfect for learning VetKeys fundamentals
   - Shows direct IBE usage without abstractions
   - Clear separation of encryption (frontend) vs storage (backend)

2. **🔧 Simplicity**
   - Minimal code (~100 lines)
   - No complex data structures
   - Easy to understand and modify

3. **🏗️ Foundation Pattern**
   - Demonstrates core IBE concepts
   - Shows transport key security model
   - Base for building more complex systems

## ❌ **Limitations**

1. **🚫 No Sharing**
   - Messages encrypted to one recipient only
   - No group messaging or collaboration
   - Limited to 1:1 communication

2. **📋 No Metadata**
   - No searchable message properties
   - No message organization or tagging
   - No message threading or categorization

3. **⚡ No Performance Optimization**
   - No key caching
   - New VetKey derivation per decryption
   - No batch operations

4. **🔄 No Advanced Features**
   - No message editing or deletion
   - No read receipts or status tracking
   - No file attachments or media

## 🎯 **Best Use Cases**

### **✅ Perfect For:**

- **Learning VetKeys basics** - Understand IBE fundamentals
- **Prototyping** - Quick proof of concept for encrypted messaging
- **Foundation building** - Base for more complex applications
- **Security research** - Study VetKeys security model

### **❌ Not Suitable For:**

- **Production applications** - Too limited for real use
- **File sharing** - No sharing capabilities
- **Team collaboration** - No group features
- **Complex workflows** - No metadata or organization

## 🚀 **Adaptation for File Sharing**

If adapting for files, would need significant extensions:

```rust
// Would need to add sharing capabilities
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct FileMessage {
    pub sender: Principal,
    pub encrypted_file_data: Vec<u8>,
    pub filename: String,           // Metadata
    pub content_type: String,       // Metadata
    pub recipients: Vec<Principal>, // Sharing - MAJOR ADDITION
    pub timestamp: u64,
}

// Would need recipient indexing
static FILE_SHARES: RefCell<StableBTreeMap<Principal, Vec<FileId>, Memory>>;
```

## 🎓 **Learning Path**

### **Week 1: Study Basic IBE**

1. **Read** the ~100 lines of backend code
2. **Understand** the Principal → IBE identity mapping
3. **Study** frontend encryption/decryption flow
4. **Experiment** with sending messages between test principals

### **Week 2: Extend the Pattern**

1. **Add** message metadata (timestamps, subjects)
2. **Implement** message search and filtering
3. **Study** how to extend to file sharing
4. **Compare** with more complex VetKeys patterns

## 🔗 **Relationship to Other Approaches**

- **→ Encrypted Notes**: Adds content-specific keys and sharing
- **→ Password Manager**: Adds hierarchical storage and built-in sharing
- **→ VetKeys Showcase**: Shows this pattern alongside others
- **→ ETH Demo**: Similar simplicity but with Ethereum addresses as identities

## 💡 **Key Takeaways**

1. **IBE Fundamentals**: Shows pure IBE without abstractions
2. **Principal as Identity**: Core pattern for IC-native VetKeys apps
3. **Transport Key Security**: Demonstrates secure key derivation
4. **Foundation Pattern**: Building block for more complex applications
5. **Learning Tool**: Perfect starting point for VetKeys development

**Basic IBE is the "Hello World" of VetKeys** - essential for understanding but requiring significant extension for production use! 🚀
