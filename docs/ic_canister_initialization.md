# IC Canister Initialization Guide

> **Understanding the `#[init]` attribute and canister lifecycle on the Internet Computer**

## 🎯 **Overview**

Internet Computer (IC) canisters are **long-running WebAssembly programs** that behave fundamentally differently from traditional Rust applications. Unlike a standard Rust program that runs `main()` and exits, canisters are **persistent services** that initialize once and then respond to messages indefinitely.

## 🔄 **Canister Lifecycle vs Standard Rust**

### **Traditional Rust Program**

```rust
fn main() {
    println!("Hello, world!");
    let data = setup_application();
    run_server(data);
    // Program eventually exits
}
```

- **Entry point**: `fn main()`
- **Lifecycle**: Start → Run → Exit
- **State**: Temporary (lost when program ends)

### **IC Canister**

```rust
use ic_cdk::{init, query, update};

#[init]
fn init(config_param: String) {
    // Runs ONCE during deployment
    setup_persistent_state(config_param);
}

#[query]
fn get_data() -> String {
    // Runs on each read request
    "Hello from canister!".to_string()
}

#[update]
fn set_data(value: String) {
    // Runs on each write request
    store_permanently(value);
}
```

- **Entry point**: `#[init]` function
- **Lifecycle**: Initialize → Handle Messages Forever
- **State**: Persistent (survives between calls)

## 🏗️ **The `#[init]` Attribute Explained**

### **What is `#[init]`?**

The `#[init]` attribute is **specific to IC canisters** (not standard Rust). It marks a function that:

1. **Runs exactly once** when the canister is deployed
2. **Sets up initial state** that persists across all future calls
3. **Receives deployment arguments** passed via `dfx deploy`
4. **Cannot be called again** after initialization

### **Basic Syntax**

```rust
use ic_cdk::init;

#[init]
fn init() {
    // Simple initialization without parameters
}

#[init]
fn init(param1: String, param2: u64) {
    // Initialization with parameters from deployment
}
```

### **Is `#[init]` Required?**

**No! The `#[init]` function is completely optional.** Here's what happens in each case:

#### **Without `#[init]` function:**

- Canister deploys successfully
- No initialization code runs during deployment
- Cannot accept deployment arguments
- State starts completely empty/default
- Must initialize state in first function calls

#### **With `#[init]` function:**

- Runs exactly once during deployment
- Can accept deployment arguments
- Can set up initial state
- Can perform setup logic

#### **Example: Minimal canister without init**

```rust
use ic_cdk::query;

#[query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

This deploys perfectly fine with:

```bash
dfx deploy my_canister
# No arguments needed since no init function
```

#### **VetKeys Context**

Most VetKeys examples use `#[init]` because they need to:

1. Accept the `key_name` parameter
2. Set up the VetKD curve (usually `Bls12_381_G2`)
3. Initialize required state

But you could have a VetKeys canister without `#[init]` by:

- Hardcoding the key name
- Setting up VetKD configuration in the first function call
- Using lazy initialization patterns

### **How Parameters Work**

When deploying, you pass arguments through `dfx`:

```bash
# Deploy with arguments
dfx deploy my_canister --argument '("hello", 42)'
```

This calls:

```rust
#[init]
fn init(message: String, number: u64) {
    // message = "hello"
    // number = 42
}
```

## 🚀 **Complete Canister Lifecycle**

```mermaid
graph TD
    A[Developer runs dfx deploy] --> B[Compile Rust to WASM]
    B --> C[Upload WASM to IC]
    C --> D[IC creates canister instance]
    D --> E[IC calls #[init] function]
    E --> F[Canister ready for messages]
    F --> G[Handle #[query] calls]
    F --> H[Handle #[update] calls]
    G --> F
    H --> F
    F --> I[Optional: Upgrade with #[pre_upgrade]]
    I --> J[Deploy new code]
    J --> K[#[post_upgrade] runs]
    K --> F
```

## 📝 **Real Example: VetKeys File Sharing**

Here's how our file sharing canister uses `#[init]`:

```rust
use ic_cdk::{init, query, update};
use ic_cdk::management_canister::{VetKDCurve, VetKDKeyId};
use ic_vetkeys::encrypted_maps::EncryptedMaps;

// Global state that persists between calls
thread_local! {
    static ENCRYPTED_MAPS: RefCell<Option<EncryptedMaps<AccessRights>>> =
        const { RefCell::new(None) };
}

#[init]
fn init(key_name: String) {
    // This runs ONCE when canister is deployed
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,  // Cryptographic curve
        name: key_name,                   // Unique key space identifier
    };

    // Initialize VetKeys encrypted storage
    ENCRYPTED_MAPS.with_borrow_mut(|encrypted_maps| {
        encrypted_maps.replace(EncryptedMaps::init(
            "file_sharing_dapp",  // Application context
            key_id,               // Cryptographic identity
            // Memory managers for persistent storage...
        ))
    });

    // After this function completes, canister is ready!
}

#[update]
fn upload_file(file_data: Vec<u8>) -> Result<String, String> {
    // This runs every time a user uploads a file
    // Can access the ENCRYPTED_MAPS state set up in init()
    Ok("File uploaded successfully".to_string())
}
```

### **Deployment**

```bash
# Deploy with specific key name for cryptographic isolation
dfx deploy encrypted_files_backend --argument '("production_file_sharing_v1")'
```

## 🔧 **IC-Specific Attributes Reference**

| **Attribute**        | **When it Runs**      | **Purpose**                       |
| -------------------- | --------------------- | --------------------------------- |
| `#[init]`            | Once at deployment    | Set up initial state              |
| `#[query]`           | On each read request  | Fast, read-only operations        |
| `#[update]`          | On each write request | State-changing operations         |
| `#[pre_upgrade]`     | Before code upgrade   | Save state for migration          |
| `#[post_upgrade]`    | After code upgrade    | Restore and migrate state         |
| `#[heartbeat]`       | Periodically          | Background processing             |
| `#[inspect_message]` | Before each call      | Filter/validate incoming messages |

## ⚠️ **Critical `#[init]` Considerations**

### **1. Initialization Arguments Are Permanent**

```rust
#[init]
fn init(database_url: String, api_key: String) {
    // These values become part of canister's permanent identity
    // You CANNOT change them without redeploying the entire canister
}
```

**⚠️ Changing init arguments requires full redeployment and data migration!**

### **2. VetKeys Key Names Are Immutable**

```rust
#[init]
fn init(key_name: String) {
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: key_name,  // THIS BECOMES PERMANENT!
    };
    // All encrypted data is tied to this key_name forever
}
```

**⚠️ Different key names = completely separate encryption spaces!**

### **3. State Must Be Thread-Local**

```rust
// ❌ WRONG: Global state doesn't work in WASM
static mut GLOBAL_DATA: Vec<String> = Vec::new();

// ✅ CORRECT: Use thread_local! for canister state
thread_local! {
    static CANISTER_DATA: RefCell<Vec<String>> = RefCell::new(Vec::new());
}

#[init]
fn init() {
    CANISTER_DATA.with(|data| {
        data.borrow_mut().push("Initial value".to_string());
    });
}
```

## 🎯 **Best Practices**

### **1. Environment-Specific Key Names**

```bash
# Development
dfx deploy --argument '("dev_myapp_v1")'

# Testing
dfx deploy --argument '("test_myapp_v1")'

# Production
dfx deploy --argument '("prod_myapp_v1")'
```

### **2. Validation in Init**

```rust
#[init]
fn init(config: String) {
    if config.is_empty() {
        ic_cdk::trap("Configuration cannot be empty");
    }

    if config.len() > 100 {
        ic_cdk::trap("Configuration too long");
    }

    // Setup with validated config...
}
```

### **3. Minimal Init, Lazy Setup**

```rust
#[init]
fn init(key_name: String) {
    // Store parameters, defer heavy initialization
    CONFIG.with(|c| {
        *c.borrow_mut() = Some(Config { key_name });
    });
}

#[update]
fn first_operation() {
    // Initialize heavy resources on first use
    ensure_setup();
    // ... continue with operation
}
```

## 🚨 **Common Pitfalls**

### **1. Forgetting Arguments During Deployment**

```bash
# ❌ WRONG: Missing required arguments
dfx deploy my_canister
# Error: Expected init arguments

# ✅ CORRECT: Provide required arguments
dfx deploy my_canister --argument '("param1", 42)'
```

### **2. Assuming Init Runs Multiple Times**

```rust
#[init]
fn init() {
    // ❌ WRONG: This only runs ONCE, not on every call
    let timestamp = ic_cdk::api::time();
    ic_cdk::println!("Current time: {}", timestamp);
}

// ✅ CORRECT: Time-sensitive logic goes in query/update functions
#[query]
fn get_current_time() -> u64 {
    ic_cdk::api::time()
}
```

### **3. Complex Init with No Error Handling**

```rust
#[init]
fn init(complex_config: String) {
    // ❌ WRONG: If this panics, deployment fails with unclear error
    let parsed = serde_json::from_str(&complex_config).unwrap();
    setup_complex_system(parsed).unwrap();
}

// ✅ CORRECT: Proper error handling
#[init]
fn init(config_json: String) {
    let config = serde_json::from_str(&config_json)
        .map_err(|e| format!("Invalid config JSON: {}", e))
        .unwrap_or_else(|e| ic_cdk::trap(&e));

    setup_system(config)
        .unwrap_or_else(|e| ic_cdk::trap(&format!("Setup failed: {}", e)));
}
```

## 🔗 **Related Topics**

- **[Canister Upgrades](./canister_upgrades.md)** - Managing state during code updates
- **[Stable Memory](./stable_memory.md)** - Persistent storage that survives upgrades
- **[VetKeys Integration](./vetkeys_integration.md)** - Cryptographic key management
- **[Error Handling](./error_handling.md)** - Robust canister development patterns

## 📚 **Further Reading**

- [IC Developer Docs - Canister Lifecycle](https://internetcomputer.org/docs/building-apps/canisters/introduction-to-canisters#lifecycle)
- [IC CDK Rust Documentation](https://docs.rs/ic-cdk/latest/ic_cdk/)
- [WebAssembly on IC](https://internetcomputer.org/docs/building-apps/developing-canisters/overview-of-canisters)

---

> **💡 Key Takeaway**: The `#[init]` function is your canister's **one-time setup opportunity**. Everything you configure here becomes part of your canister's permanent identity and capabilities. Choose your initialization parameters carefully!
