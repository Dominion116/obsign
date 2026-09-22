// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ObsignAnchor } from "../src/ObsignAnchor.sol";
import { ObsignRevocation } from "../src/ObsignRevocation.sol";
import { ObsignIssuerRegistry } from "../src/ObsignIssuerRegistry.sol";
import { ObsignPolicyRegistry } from "../src/ObsignPolicyRegistry.sol";

/// @notice Immutability guarantees (D11 / FR-2.4): no owner/admin, no proxy, and
///         no self-destruct/delegatecall in the deployed bytecode. A written
///         record can never be altered (covered per-contract elsewhere); here we
///         assert the code itself carries no upgrade/kill path.
contract ImmutabilityTest is Test {
    function _assertNoUpgradeOpcodes(bytes memory code) internal pure {
        // SELFDESTRUCT = 0xff, DELEGATECALL = 0xf4. Neither may appear in the
        // runtime bytecode of an immutable, admin-less contract.
        for (uint256 i = 0; i < code.length; i++) {
            uint8 op = uint8(code[i]);
            assertTrue(op != 0xff, "SELFDESTRUCT present");
            assertTrue(op != 0xf4, "DELEGATECALL present");
        }
    }

    function test_anchor_noUpgradeOpcodes() public {
        _assertNoUpgradeOpcodes(address(new ObsignAnchor()).code);
    }

    function test_revocation_noUpgradeOpcodes() public {
        _assertNoUpgradeOpcodes(address(new ObsignRevocation()).code);
    }

    function test_issuerRegistry_noUpgradeOpcodes() public {
        _assertNoUpgradeOpcodes(address(new ObsignIssuerRegistry()).code);
    }

    function test_policyRegistry_noUpgradeOpcodes() public {
        _assertNoUpgradeOpcodes(address(new ObsignPolicyRegistry()).code);
    }
}
