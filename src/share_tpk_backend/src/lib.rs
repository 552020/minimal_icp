// === Imports ===

use candid::CandidType;
use ic_cdk::api::caller;
use ic_cdk_macros::export_candid;
use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::cell::RefCell;
use std::rc::Rc;
use ic_stable_structures::StableBTreeMap;
use ic_stable_structures::memory_manager::{MemoryManager, VirtualMemory};
use ic_stable_structures::DefaultMemoryImpl;
use once_cell::sync::Lazy;
use std::sync::Mutex;

// === Data Structures ===

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub principal: Principal,
    pub registered_at: u64,
    pub public_key: Vec<u8>,
}

// === In-memory Users Map ===

thread_local! {
    static USERS: RefCell<HashMap<Principal, User>> = RefCell::new(HashMap::new());
}

// === Stable Memory Users Map ===

type Memory = VirtualMemory<DefaultMemoryImpl>;

static MEMORY_MANAGER: Lazy<Mutex<MemoryManager<DefaultMemoryImpl>>> = Lazy::new(|| {
    Mutex::new(MemoryManager::init(DefaultMemoryImpl::default()))
});

thread_local! {
    static STABLE_USERS: RefCell<StableBTreeMap<Principal, User, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.lock().unwrap().get(0)
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
        users.entry(caller_principal).or_insert_with(|| user.clone());
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
