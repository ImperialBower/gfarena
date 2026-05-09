// This crate exists solely to produce a WASM module from gfcore.
// All game logic and WASM exports live in gfcore::wasm_api (re-exported
// via gfcore's pub use wasm_api::* under the wasm feature).
extern crate gfcore;
