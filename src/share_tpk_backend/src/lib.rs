// === Imports ===

use candid::{CandidType, Principal};
use ic_cdk::api::caller;
use ic_cdk_macros::export_candid;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::StableBTreeMap;
use ic_stable_structures::{storable::Bound, DefaultMemoryImpl, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;

// === Data Structures ===

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub principal: Principal,
    pub registered_at: u64,
    pub public_key: Vec<u8>,
}

impl Storable for User {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).expect("failed to serialize"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("failed to deserialize")
    }

    const BOUND: Bound = Bound::Unbounded;
}

// === Memory Management ===

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<HashMap<Principal, User>> = RefCell::new(HashMap::new());

    static STABLE_USERS: RefCell<StableBTreeMap<Principal, User, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(0)))
        )
    );
}

// === Canister Methods ===

#[ic_cdk::update]
fn register_user(public_key: Vec<u8>) -> String {
    let caller_principal = caller();
    let timestamp = ic_cdk::api::time();

    let user = User {
        principal: caller_principal,
        registered_at: timestamp,
        public_key,
    };

    // Insert into in-memory map
    USERS.with(|users| {
        let mut users = users.borrow_mut();
        users
            .entry(caller_principal)
            .or_insert_with(|| user.clone());
    });

    // Insert into stable memory map
    STABLE_USERS.with(|map| {
        let mut map = map.borrow_mut();
        map.insert(caller_principal, user);
    });

    format!("User {} registered successfully.", caller_principal)
}

#[ic_cdk::query]
fn get_user() -> Option<User> {
    let caller_principal = caller();

    USERS.with(|users| {
        let users = users.borrow();
        users.get(&caller_principal).cloned()
    })
}

#[ic_cdk::query]
fn get_user_stable() -> Option<User> {
    let caller_principal = caller();

    STABLE_USERS.with(|map| {
        let map = map.borrow();
        map.get(&caller_principal)
    })
}

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

export_candid!();
