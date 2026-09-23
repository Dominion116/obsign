// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ObsignAnchor } from "../src/ObsignAnchor.sol";
import { ObsignRevocation } from "../src/ObsignRevocation.sol";
import { ObsignIssuerRegistry } from "../src/ObsignIssuerRegistry.sol";
import { ObsignPolicyRegistry } from "../src/ObsignPolicyRegistry.sol";

/// @notice Deploys the four immutable Obsign contracts and writes their addresses
///         to contracts/deployments/84532.json.
///
///         Deployment is idempotent via CREATE2 (D11 / FR-2.4): each contract is
///         deployed at a deterministic address derived from a fixed SALT and its
///         init code, using the canonical CREATE2 factory. Re-running the deploy
///         computes the same addresses and skips any contract that already has
///         code onchain, so repeated runs spend no gas and never orphan a set.
///         This makes deployments/84532.json stable across runs.
///
///         RULE-1: this runs in CI (the deploy-testnet workflow) or by a human —
///         never as a local build step. A dry run (no --broadcast) simulates and
///         prints addresses + gas without sending any transaction (FR-2.8);
///         adding --broadcast --verify performs the real Base Sepolia deploy and
///         BaseScan verification.
///
///         Usage (CI/human only):
///           forge script script/Deploy.s.sol:Deploy \
///             --rpc-url base_sepolia --broadcast --verify
///
///         Requires env: DEPLOYER_PRIVATE_KEY (funded testnet key),
///         BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY.
contract Deploy is Script {
    /// @dev Canonical deterministic CREATE2 factory ("Nick's method"), which
    ///      Foundry routes salted `new C{salt: ...}()` creations through. It is
    ///      present at this address on Base Sepolia and virtually every EVM chain,
    ///      so the computed addresses match what the broadcast actually deploys.
    address internal constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev Fixed salt → deterministic, stable addresses across every run. Because
    ///      foundry.toml sets bytecode_hash = "none", each contract's init code is
    ///      reproducible, so the CREATE2 address changes only if the salt, the
    ///      source, or the compiler settings (solc version, optimizer, evm_version)
    ///      change. Bump this constant only to intentionally deploy a fresh set at
    ///      new addresses.
    bytes32 internal constant SALT = keccak256("obsign.contracts.v1");

    function run() external {
        uint256 pk = _loadDeployerKey();
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        address anchor = _deployAnchor();
        address revocation = _deployRevocation();
        address issuerRegistry = _deployIssuerRegistry();
        address policyRegistry = _deployPolicyRegistry();
        vm.stopBroadcast();

        _writeDeployments(deployer, anchor, revocation, issuerRegistry, policyRegistry);
    }

    // Per-contract deployers. Each computes its deterministic CREATE2 address from
    // the contract's init code, then deploys with `new C{salt: SALT}()` only when no
    // code exists there yet. Foundry rewrites the salted `new` to go through
    // CREATE2_FACTORY, so the deployed address matches `_computeAddress` exactly.

    function _deployAnchor() internal returns (address addr) {
        addr = _computeAddress(type(ObsignAnchor).creationCode);
        if (_needsDeploy("ObsignAnchor", addr)) {
            require(
                address(new ObsignAnchor{ salt: SALT }()) == addr, "ObsignAnchor: addr mismatch"
            );
        }
    }

    function _deployRevocation() internal returns (address addr) {
        addr = _computeAddress(type(ObsignRevocation).creationCode);
        if (_needsDeploy("ObsignRevocation", addr)) {
            require(
                address(new ObsignRevocation{ salt: SALT }()) == addr,
                "ObsignRevocation: addr mismatch"
            );
        }
    }

    function _deployIssuerRegistry() internal returns (address addr) {
        addr = _computeAddress(type(ObsignIssuerRegistry).creationCode);
        if (_needsDeploy("ObsignIssuerRegistry", addr)) {
            require(
                address(new ObsignIssuerRegistry{ salt: SALT }()) == addr,
                "ObsignIssuerRegistry: addr mismatch"
            );
        }
    }

    function _deployPolicyRegistry() internal returns (address addr) {
        addr = _computeAddress(type(ObsignPolicyRegistry).creationCode);
        if (_needsDeploy("ObsignPolicyRegistry", addr)) {
            require(
                address(new ObsignPolicyRegistry{ salt: SALT }()) == addr,
                "ObsignPolicyRegistry: addr mismatch"
            );
        }
    }

    /// @dev Logs whether `addr` will be deployed or reused, and returns true when a
    ///      deploy is needed (no code present). This is the idempotency gate: an
    ///      already-deployed contract is skipped, spending no gas.
    function _needsDeploy(string memory label, address addr) internal view returns (bool) {
        if (addr.code.length == 0) {
            console2.log(string.concat(label, " deploying:"), addr);
            return true;
        }
        console2.log(string.concat(label, " exists:   "), addr);
        return false;
    }

    /// @dev CREATE2 address for `initCode` under the canonical factory and SALT:
    ///      keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]. With no
    ///      constructor args, `initCode` is exactly the contract's creation code.
    function _computeAddress(bytes memory initCode) internal pure returns (address) {
        bytes32 hash =
            keccak256(abi.encodePacked(bytes1(0xff), CREATE2_FACTORY, SALT, keccak256(initCode)));
        return address(uint160(uint256(hash)));
    }

    /// @dev Load DEPLOYER_PRIVATE_KEY tolerant of a missing "0x" prefix. A 32-byte
    ///      key is parsed as bytes32 (so both "0x…" and bare-hex secrets work).
    function _loadDeployerKey() internal view returns (uint256) {
        string memory raw = vm.envString("DEPLOYER_PRIVATE_KEY");
        bytes memory b = bytes(raw);
        bool has0x =
            b.length >= 2 && b[0] == bytes1("0") && (b[1] == bytes1("x") || b[1] == bytes1("X"));
        string memory hexStr = has0x ? raw : string.concat("0x", raw);
        return uint256(vm.parseBytes32(hexStr));
    }

    /// @dev Writes deployments/84532.json. Uses vm.serialize/vm.writeJson so the
    ///      committed artifact is the source of truth for SDK/env addresses.
    function _writeDeployments(
        address deployer,
        address anchor,
        address revocation,
        address issuerRegistry,
        address policyRegistry
    ) internal {
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", uint256(84532));
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "anchor", anchor);
        vm.serializeAddress(obj, "revocation", revocation);
        vm.serializeAddress(obj, "issuerRegistry", issuerRegistry);
        string memory json = vm.serializeAddress(obj, "policyRegistry", policyRegistry);

        string memory path = "deployments/84532.json";
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
