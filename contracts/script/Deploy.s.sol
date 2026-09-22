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
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        ObsignAnchor anchor = new ObsignAnchor();
        ObsignRevocation revocation = new ObsignRevocation();
        ObsignIssuerRegistry issuerRegistry = new ObsignIssuerRegistry();
        ObsignPolicyRegistry policyRegistry = new ObsignPolicyRegistry();
        vm.stopBroadcast();

        console2.log("ObsignAnchor:        ", address(anchor));
        console2.log("ObsignRevocation:    ", address(revocation));
        console2.log("ObsignIssuerRegistry:", address(issuerRegistry));
        console2.log("ObsignPolicyRegistry:", address(policyRegistry));

        _writeDeployments(
            deployer,
            address(anchor),
            address(revocation),
            address(issuerRegistry),
            address(policyRegistry)
        );
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
