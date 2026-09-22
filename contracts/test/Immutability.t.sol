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
    /// @dev Scan executable opcodes for SELFDESTRUCT (0xff) / DELEGATECALL (0xf4).
    ///      A naive byte scan false-positives on PUSH immediates and the trailing
    ///      CBOR metadata, so we (1) strip the Solidity metadata using its declared
    ///      length in the last two bytes, and (2) skip PUSH1..PUSH32 immediate data
    ///      while walking, so only real opcodes are inspected.
    function _assertNoUpgradeOpcodes(bytes memory code) internal pure {
        uint256 len = code.length;
        if (len < 2) return;

        // Trailing metadata: last 2 bytes are the big-endian CBOR length.
        uint256 metaLen = (uint256(uint8(code[len - 2])) << 8) | uint256(uint8(code[len - 1]));
        uint256 end = len >= metaLen + 2 ? len - metaLen - 2 : len;

        uint256 i = 0;
        while (i < end) {
            uint8 op = uint8(code[i]);
            assertTrue(op != 0xff, "SELFDESTRUCT present");
            assertTrue(op != 0xf4, "DELEGATECALL present");
            // PUSH1..PUSH32 (0x60..0x7f) carry (op - 0x5f) immediate bytes.
            if (op >= 0x60 && op <= 0x7f) {
                i += (op - 0x5f) + 1;
            } else {
                i += 1;
            }
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
