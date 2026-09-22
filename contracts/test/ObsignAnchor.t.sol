// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ObsignAnchor } from "../src/ObsignAnchor.sol";
import { IObsignAnchor } from "../src/interfaces.sol";

contract ObsignAnchorTest is Test {
    ObsignAnchor internal anchor;

    address internal issuerA = address(0xA11CE);
    address internal issuerB = address(0xB0B);

    bytes32 internal constant RID = keccak256("receipt-1");
    bytes32 internal constant CHASH = keccak256("credential-1");

    function setUp() public {
        anchor = new ObsignAnchor();
    }

    function test_anchor_setsStateAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit IObsignAnchor.Anchored(RID, CHASH, issuerA);

        vm.prank(issuerA);
        anchor.anchor(RID, CHASH);

        assertTrue(anchor.isAnchored(RID));
        assertEq(anchor.credentialHashOf(RID), CHASH);
    }

    function test_isAnchored_falseForUnknown() public view {
        assertFalse(anchor.isAnchored(keccak256("never")));
        assertEq(anchor.credentialHashOf(keccak256("never")), bytes32(0));
    }

    function test_anchor_zeroCredentialHashStillAnchors() public {
        vm.prank(issuerA);
        anchor.anchor(RID, bytes32(0));
        assertTrue(anchor.isAnchored(RID));
        assertEq(anchor.credentialHashOf(RID), bytes32(0));
    }

    function test_anchor_duplicateReverts() public {
        vm.prank(issuerA);
        anchor.anchor(RID, CHASH);

        vm.expectRevert(abi.encodeWithSelector(ObsignAnchor.AlreadyAnchored.selector, RID));
        vm.prank(issuerA);
        anchor.anchor(RID, CHASH);
    }

    function test_anchor_duplicateFromDifferentIssuerReverts() public {
        vm.prank(issuerA);
        anchor.anchor(RID, CHASH);

        // Immutability: a written anchor cannot be altered by anyone, including
        // with a different credentialHash.
        vm.expectRevert(abi.encodeWithSelector(ObsignAnchor.AlreadyAnchored.selector, RID));
        vm.prank(issuerB);
        anchor.anchor(RID, keccak256("credential-2"));

        // Original record is untouched.
        assertEq(anchor.credentialHashOf(RID), CHASH);
    }

    function testFuzz_anchor_once(bytes32 rid, bytes32 chash, address who) public {
        vm.assume(who != address(0));
        vm.prank(who);
        anchor.anchor(rid, chash);
        assertTrue(anchor.isAnchored(rid));
        assertEq(anchor.credentialHashOf(rid), chash);

        vm.expectRevert(abi.encodeWithSelector(ObsignAnchor.AlreadyAnchored.selector, rid));
        vm.prank(who);
        anchor.anchor(rid, chash);
    }

    function testFuzz_distinctReceiptsIndependent(bytes32 a, bytes32 b) public {
        vm.assume(a != b);
        anchor.anchor(a, keccak256(abi.encode(a)));
        assertTrue(anchor.isAnchored(a));
        assertFalse(anchor.isAnchored(b));
    }
}
