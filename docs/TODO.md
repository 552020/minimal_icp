# VetKeys File Sharing Implementation

## Overview

Building a secure file sharing application using VetKeys for identity-based encryption. Files are encrypted for specific recipients and can only be decrypted by the intended users.

## Implementation Phases

### Phase 1: Core File Sharing with IC Principals

Basic file sharing functionality using IC Principal identities.

### Phase 2: Ethereum Address Support

Extend the system to support Ethereum addresses as file recipients.

### Phase 3: Payment Integration

Add payment functionality using USDC on Base L2 with automatic canister funding.

## Architecture

### File Sharing Flow

```
Sender                     Backend Canister            VetKeys System            Recipient
  │                             │                          │                        │
  ├─► Authenticate ─────────────► │ (verify identity)        │                        │
  │                             │                          │                        │
  ├─► Get encryption key ───────► │ ─────────────────────── ► │                        │
  │                             │                          │                        │
  ├─► Encrypt file ─────────────► │                          │                        │
  │   (for recipient identity)   │                          │                        │
  │                             │                          │                        │
  ├─► Upload encrypted file ────► │                          │                        │
  │                             │                          │                        │
  │                             │                          │ ◄─ Recipient requests ─┤
  │                             │                          │                        │
  │                             │                          ├─► Generate VetKey ────► │
  │                             │                          │                        │
  │                             │ ◄─ Request file ─────────┼─────────────────────── │
  │                             │                          │                        │
  │                             ├─► Return encrypted file ─┼───────────────────────► │
  │                             │                          │                        │
  │                             │                          │                        ├─► Decrypt file
```

## Implementation Tasks

### Phase 1: IC Principal File Sharing

#### Backend Implementation

**File:** `src/lib.rs`

Data structures:

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub file_id: String,
    pub filename: String,
    pub content_type: String,
    pub file_size: u64,
    pub uploaded_at: u64,
    pub uploaded_by: Principal,
    pub recipient: Principal,
    pub encrypted_data: Vec<u8>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FileCollection {
    pub collection_id: String,
    pub owner: Principal,
    pub files: Vec<FileEntry>,
    pub created_at: u64,
}
```

Core functions:

- [ ] `vetkd_public_key()` - Get encryption key
- [ ] `vetkd_derive_key()` - Get decryption key
- [ ] `upload_file()` - Store encrypted file
- [ ] `download_file()` - Retrieve encrypted file
- [ ] `list_files()` - List accessible files

#### Frontend Scripts

**File:** `scripts/upload_file.ts`

- [ ] Connect to canister
- [ ] Get encryption key from VetKeys
- [ ] Encrypt file for recipient
- [ ] Upload to backend

**File:** `scripts/download_file.ts`

- [ ] Authenticate with canister
- [ ] Generate transport key
- [ ] Get VetKey for decryption
- [ ] Download and decrypt file

#### Testing

- [ ] Multiple user scenarios
- [ ] Different file types and sizes
- [ ] Error handling and validation

### Phase 2: Ethereum Address Support

#### Backend Extensions

**File:** `src/lib.rs`

```rust
pub enum UserIdentity {
    ICPrincipal(Principal),
    EthereumAddress(String),
}

// Extended FileEntry to support ETH addresses
pub struct FileEntry {
    // ... existing fields
    pub recipient_type: UserIdentity,
}
```

- [ ] Add ETH address validation
- [ ] Support dual identity types
- [ ] Update encryption/decryption flows

#### Frontend Integration

**File:** `scripts/upload_file_eth.ts`

- [ ] SIWE authentication
- [ ] ETH address as recipient identity
- [ ] Web3 wallet integration

### Phase 3: Payment Integration

#### Payment Smart Contract (Base L2)

**File:** `contracts/FileSharePayment.sol`

```solidity
contract FileSharePayment {
    IERC20 public immutable USDC;

    event PaymentMade(
        address indexed user,
        uint256 amount,
        bytes32 indexed fileId
    );

    function payForFileShare(bytes32 fileId) external {
        // Handle USDC payment
        // Emit event for IC detection
    }
}
```

#### Backend Payment Integration

**File:** `src/payment.rs`

```rust
#[derive(CandidType, Deserialize)]
pub struct PaymentOrder {
    pub user_address: String,
    pub amount_usdc: u64,
    pub base_tx_hash: String,
    pub verified: bool,
    pub expires_at: u64,
}

// Payment verification using Chain Key
async fn verify_base_payment(tx_hash: String) -> Result<bool, String>

// Payment-gated file upload
async fn upload_file_with_payment(
    payment_id: String,
    recipient: String,
    file_data: Vec<u8>
) -> Result<String, String>
```

#### Chain Key Integration

- [ ] Base RPC calls for transaction verification
- [ ] Automatic cycle funding from payments
- [ ] Payment status management

#### Frontend Payment Flow

**File:** `scripts/pay_and_upload.ts`

```typescript
async function payAndUploadFile(recipient: string, file: File) {
  // 1. Connect Base wallet
  // 2. Pay USDC to contract
  // 3. Wait for confirmation
  // 4. Upload file with payment proof
}
```

## Current Implementation

### Completed

- Basic project structure
- User discovery endpoints
- Initial backend file storage design

### In Progress

- Study password_manager_with_metadata implementation
- Understand VetKeys Encrypted Maps patterns

### Next Steps

1. Implement core VetKeys integration
2. Build file encryption/decryption flow
3. Create upload/download scripts
4. Add comprehensive testing

## Technical Notes

### VetKeys Integration

- Uses identity-based encryption (IBE)
- Recipients identified by IC Principal or ETH address
- Transport keys for secure private key transfer
- Encrypted Maps for scalable storage

### Cross-Chain Payments

- USDC payments on Base L2 (low fees)
- Chain Key cryptography for transaction verification
- Automatic canister funding from verified payments
- No bridges required

---

## Status

- **Current Phase**: Phase 1 - IC Principal file sharing
- **Focus**: VetKeys integration and core file operations
- **Next Milestone**: Working file upload/download with encryption
