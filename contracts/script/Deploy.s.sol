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
///         init code, using Foundry's internal CREATE2 factory (forge-std/Base.sol).
///         Re-running the deploy computes the same addresses and skips any contract
///         that already has code onchain, so repeated runs spend no gas and never
///         orphan a set. This makes deployments/84532.json stable across runs.
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
    /// @dev Fixed salt → deterministic, stable addresses across every run. Because
    ///      foundry.toml sets bytecode_hash = "none", each contract's init code is
    ///      reproducible, so the CREATE2 address changes only if the salt, the
    ///      source, or the compiler settings (solc version, optimizer, evm_version)
    ///      change. Bump SALT only to intentionally deploy a fresh set at new
    ///      addresses.
    bytes32 internal constant SALT = keccak256("obsign.contracts.v1");

    function run() external {
        uint256 pk = _loadDeployerKey();
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        address anchor = _deploy("ObsignAnchor", type(ObsignAnchor).creationCode);
        address revocation = _deploy("ObsignRevocation", type(ObsignRevocation).creationCode);
        address issuerRegistry =
            _deploy("ObsignIssuerRegistry", type(ObsignIssuerRegistry).creationCode);
        address policyRegistry =
            _deploy("ObsignPolicyRegistry", type(ObsignPolicyRegistry).creationCode);
        vm.stopBroadcast();

        _writeDeployments(deployer, anchor, revocation, issuerRegistry, policyRegistry);
    }

    /// @dev Idempotently deploys `initCode` at its deterministic CREATE2 address.
    ///      Skips (no tx, no gas) when code already exists there, so re-runs
    ///      converge on the same set.
    ///
    ///      We deploy by calling CREATE2_FACTORY directly with `salt ++ initCode`
    ///      rather than `new C{salt: ...}()`. Foundry only reroutes a salted `new`
    ///      through the factory when broadcasting; in a dry run it CREATE2s from the
    ///      script contract's own address, so the simulated address would not match
    ///      the prediction. Calling the factory explicitly is identical in both
    ///      dry-run and broadcast, keeping addresses stable and verifiable.
    function _deploy(string memory label, bytes memory initCode) internal returns (address addr) {
        addr = _computeAddress(initCode);
        if (addr.code.length != 0) {
            console2.log(string.concat(label, " exists:   "), addr);
            return addr;
        }
        (bool ok,) = CREATE2_FACTORY.call(bytes.concat(SALT, initCode));
        require(ok, string.concat(label, ": CREATE2 factory call failed"));
        require(addr.code.length != 0, string.concat(label, ": no code at CREATE2 address"));
        console2.log(string.concat(label, " deployed: "), addr);
    }

    /// @dev CREATE2 address for `initCode` under the canonical factory and SALT:
    ///      keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]. With no
    ///      constructor args, `initCode` is exactly the contract's creation code.
    ///      CREATE2_FACTORY is inherited from forge-std/Base.sol (internal constant).
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
