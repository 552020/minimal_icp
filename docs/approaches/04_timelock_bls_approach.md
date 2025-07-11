# Timelock IBE & BLS Signing - Specialized VetKeys Applications

> **Specialized VetKeys implementations** for time-delayed decryption and digital signatures, demonstrating advanced cryptographic patterns.

## 📍 **Location & Overview**

**Timelock IBE Path**: `vetkeys/examples/basic_timelock_ibe/backend/src/lib.rs`  
**BLS Signing Path**: `vetkeys/examples/basic_bls_signing/rust/backend/src/lib.rs`  
**Lines**: ~200 each  
**Complexity**: 🟡 Specialized  
**Pattern**: Time-based & Signature-based

## 🎯 **Core Concepts**

### **Timelock IBE - Time-Delayed Decryption**

Enables **secret auction** patterns where bids are encrypted to a future timestamp, preventing premature revelation.

```rust
// Core pattern: Timestamp = IBE Identity
let timelock_id: u64 = auction_end_time;
let identity = timelock_id.to_le_bytes().to_vec();  // Time as IBE identity
```

### **BLS Signing - Threshold Signatures**

Demonstrates **BLS signature creation and verification** using VetKeys, enabling group signatures and authentication.

```rust
// Core pattern: VetKey → BLS Private Key → Signature
let vetkey = derive_key_for_signing(context).await;
let signature = vetkey.bls_sign(message);
```

## 🏗️ **Timelock IBE Architecture**

### **Data Storage Pattern**

```rust
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TimelockAuction {
    pub auction_id: u64,
    pub description: String,
    pub timelock_id: u64,           // Unix timestamp for decryption
    pub encrypted_bids: Vec<EncryptedBid>,
    pub revealed_bids: Vec<Bid>,    // After timelock expires
    pub status: AuctionStatus,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct EncryptedBid {
    pub bidder: Principal,
    pub encrypted_amount: Vec<u8>,  // Encrypted to timelock_id
    pub timestamp: u64,
}

static AUCTIONS: RefCell<StableBTreeMap<u64, TimelockAuction, Memory>>;
```

**Key Characteristics**:

- ✅ **Time-based identity**: Uses Unix timestamp as IBE identity
- ✅ **Future decryption**: Bids can't be decrypted until timelock expires
- ✅ **Fair auctions**: Prevents bid manipulation before auction ends
- ✅ **Automatic revelation**: Time-based access control

### **Timelock Flow**

#### **1. Bid Submission (Before Timelock)**

```typescript
// Frontend: Encrypt bid to future timestamp
const auctionEndTime = auction.timelock_id;
const timelockIdentity = new Uint8Array(8);
new DataView(timelockIdentity.buffer).setBigUint64(0, BigInt(auctionEndTime), true);

const encryptedBid = IBECiphertext.encrypt(
  masterPublicKey,
  timelockIdentity, // Future timestamp as identity
  bidAmountBytes,
  seed
);

await backend.submit_bid(auctionId, encryptedBid.serialize());
```

#### **2. Bid Storage (Backend)**

```rust
#[update]
fn submit_bid(auction_id: u64, encrypted_bid: Vec<u8>) -> Result<(), String> {
    let bidder = ic_cdk::api::msg_caller();
    let current_time = ic_cdk::api::time();

    AUCTIONS.with_borrow_mut(|auctions| {
        let mut auction = auctions.get(&auction_id).ok_or("Auction not found")?;

        // Check if auction is still open
        if current_time >= auction.timelock_id {
            return Err("Auction has ended".to_string());
        }

        auction.encrypted_bids.push(EncryptedBid {
            bidder,
            encrypted_amount: encrypted_bid,
            timestamp: current_time,
        });

        auctions.insert(auction_id, auction);
        Ok(())
    })
}
```

#### **3. Bid Revelation (After Timelock)**

```typescript
// Frontend: After timelock expires, decrypt bids
if (Date.now() >= auction.timelock_id * 1000) {
  const timelockIdentity = new Uint8Array(8);
  new DataView(timelockIdentity.buffer).setBigUint64(0, BigInt(auction.timelock_id), true);

  // Generate transport key for timelock identity
  const transportKeyPair = TransportSecretKey.generate();
  const encryptedVetKey = await backend.get_timelock_key(auction.timelock_id, transportKeyPair.public_key());

  const timelockVetKey = encryptedVetKey.decrypt(transportKeyPair);

  // Decrypt all bids
  const revealedBids = auction.encrypted_bids.map((encryptedBid) => {
    const ciphertext = IBECiphertext.deserialize(encryptedBid.encrypted_amount);
    const bidAmount = ciphertext.decrypt(timelockVetKey);
    return { bidder: encryptedBid.bidder, amount: bidAmount };
  });
}
```

## 🔐 **BLS Signing Architecture**

### **Signature System**

```rust
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct SignedMessage {
    pub message: String,
    pub signer: Principal,
    pub signature: Vec<u8>,     // BLS signature
    pub timestamp: u64,
    pub verified: bool,
}

static SIGNED_MESSAGES: RefCell<StableBTreeMap<u64, SignedMessage, Memory>>;
static MESSAGE_COUNTER: RefCell<u64> = RefCell::new(0);
```

### **BLS Signature Flow**

#### **1. Message Signing**

```rust
#[update]
async fn sign_message(message: String) -> Result<u64, String> {
    let signer = ic_cdk::api::msg_caller();

    // Derive BLS signing key for this principal
    let request = VetKDDeriveKeyArgs {
        input: signer.as_ref().to_vec(),
        context: "bls_signing_example".as_bytes().to_vec(),
        key_id: key_id(),
        transport_public_key: /* transport key */,
    };

    let result = ic_cdk::management_canister::vetkd_derive_key(&request).await;
    let vetkey = EncryptedVetKey::from(result.encrypted_key);

    // Sign message with BLS
    let signature = vetkey.bls_sign(message.as_bytes());

    let message_id = MESSAGE_COUNTER.with(|counter| {
        let id = *counter.borrow();
        *counter.borrow_mut() = id + 1;
        id
    });

    SIGNED_MESSAGES.with_borrow_mut(|messages| {
        messages.insert(message_id, SignedMessage {
            message,
            signer,
            signature,
            timestamp: ic_cdk::api::time(),
            verified: false,
        });
    });

    Ok(message_id)
}
```

#### **2. Signature Verification**

```rust
#[query]
fn verify_signature(message_id: u64) -> Result<bool, String> {
    SIGNED_MESSAGES.with_borrow(|messages| {
        let signed_msg = messages.get(&message_id).ok_or("Message not found")?;

        // Get signer's public key (derived from same inputs)
        let public_key = derive_bls_public_key(signed_msg.signer);

        // Verify BLS signature
        let is_valid = bls_verify(
            &signed_msg.signature,
            &signed_msg.message.as_bytes(),
            &public_key
        );

        Ok(is_valid)
    })
}
```

## ✅ **Strengths**

### **Timelock IBE**

1. **⏰ Fair Auctions**
   - Prevents bid manipulation and front-running
   - Automatic time-based revelation
   - Cryptographically enforced fairness

2. **🔒 Strong Security**
   - Impossible to decrypt before timelock expires
   - No central authority needed for timing
   - Mathematically guaranteed timing

3. **🎯 Novel Use Cases**
   - Secret bidding systems
   - Time-delayed messages
   - Scheduled reveals

### **BLS Signing**

1. **🔐 Strong Authentication**
   - Non-repudiable digital signatures
   - Identity-based public keys
   - Group signature capabilities

2. **⚡ Efficient Verification**
   - Fast signature verification
   - Aggregatable signatures
   - Threshold signature support

3. **🔧 Flexible Applications**
   - Document signing
   - Transaction authentication
   - Multi-party protocols

## ❌ **Limitations**

### **Both Approaches**

1. **🎯 Highly Specialized**
   - Limited to specific use cases
   - Not general-purpose solutions
   - Require domain expertise

2. **🔄 No File Sharing**
   - No data storage or sharing patterns
   - Not suitable for file management
   - No metadata or organization

3. **📚 Learning Curve**
   - Complex cryptographic concepts
   - Time-based or signature-specific logic
   - Advanced VetKeys patterns

## 🎯 **Best Use Cases**

### **Timelock IBE ✅ Perfect For:**

- **Auction systems** - Fair bidding without early revelation
- **Voting systems** - Prevent vote buying and coercion
- **Time-delayed messaging** - Schedule message revelation
- **Sealed bid contracts** - Cryptographically fair procurement

### **BLS Signing ✅ Perfect For:**

- **Document authentication** - Prove document integrity and authorship
- **Transaction signing** - Secure financial transactions
- **Identity verification** - Prove identity without passwords
- **Multi-signature systems** - Group authorization patterns

### **❌ Not Suitable For:**

- **File sharing applications** - No storage or sharing patterns
- **General messaging** - Too specialized for simple messaging
- **Data management** - No organizational features
- **Beginner projects** - Complex cryptographic requirements

## 🚀 **Potential File Sharing Adaptations**

### **Timelock for Files**

```rust
// Could enable time-delayed file access
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TimelockFile {
    pub file_id: u64,
    pub encrypted_content: Vec<u8>,  // Encrypted to future timestamp
    pub unlock_time: u64,            // When file becomes accessible
    pub authorized_users: Vec<Principal>,
    pub metadata: FileMetadata,
}

// Use case: Embargo files, scheduled releases, time-locked documents
```

### **BLS for File Authentication**

```rust
// Could enable file integrity verification
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct AuthenticatedFile {
    pub file_content: Vec<u8>,
    pub uploader_signature: Vec<u8>,  // BLS signature of file hash
    pub upload_timestamp: u64,
    pub file_hash: Vec<u8>,
}

// Use case: Tamper-proof file storage, authorship verification
```

## 🎓 **Learning Path**

### **Week 1: Study Timelock Concepts**

1. **Understand** time-based IBE identity concept
2. **Study** auction fairness and cryptographic timing
3. **Experiment** with timestamp-based encryption
4. **Build** simple time-delayed message system

### **Week 2: Explore BLS Signatures**

1. **Learn** BLS signature theory and advantages
2. **Study** identity-based public key derivation
3. **Implement** message signing and verification
4. **Experiment** with signature aggregation

### **Week 3: Advanced Applications**

1. **Combine** patterns for novel use cases
2. **Study** real-world auction and signing systems
3. **Design** file sharing extensions
4. **Compare** with traditional cryptographic approaches

## 🔗 **Relationship to Other Approaches**

- **Basic IBE**: Same IBE foundation but specialized identities
- **Password Manager**: Could add timelock for password expiry
- **Encrypted Notes**: Could add BLS for authorship verification
- **VetKeys Showcase**: Demonstrates timelock pattern alongside others

## 💡 **Key Takeaways**

1. **Specialized Applications**: Shows VetKeys flexibility beyond basic encryption
2. **Time-Based Security**: Demonstrates cryptographic timing without trusted parties
3. **Digital Signatures**: Shows identity-based signature systems
4. **Advanced Patterns**: Building blocks for sophisticated cryptographic applications
5. **Domain Expertise**: Requires understanding of specific cryptographic use cases

**These approaches showcase VetKeys' power for specialized cryptographic applications beyond simple file sharing!** 🚀
