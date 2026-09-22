// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { ObsignRevocation } from "../src/ObsignRevocation.sol";
import { IObsignRevocation } from "../src/interfaces.sol";

contract ObsignRevocationTest is Test {
    ObsignRevocation internal rev;

    address internal issuerA = address(0xA11CE);
    address internal issuerB = address(0xB0B);

    bytes32 internal constant CHASH = keccak256("credential-1");

    function setUp() public {
        rev = new ObsignRevocation();
    }

    function test_revoke_setsScopedAndAnyAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit IObsignRevocation.Revoked(CHASH, issuerA);

        vm.prank(issuerA);
        rev.revoke(CHASH);

        assertTrue(rev.isRevoked(CHASH));
        assertTrue(rev.isRevokedBy(CHASH, issuerA));
        assertFalse(rev.isRevokedBy(CHASH, issuerB));
    }

    function test_unrevoked_isFalse() public view {
        assertFalse(rev.isRevoked(CHASH));
        assertFalse(rev.isRevokedBy(CHASH, issuerA));
    }

    function test_scoping_otherIssuerCannotRevokeYourCredential() public {
        // issuerB "revokes" the hash, but a credential issued by issuerA resolves
        // revocation via isRevokedBy(hash, issuerA), which stays false.
        vm.prank(issuerB);
        rev.revoke(CHASH);

        assertTrue(rev.isRevoked(CHASH)); // revoked-by-anyone (convenience)
        assertTrue(rev.isRevokedBy(CHASH, issuerB));
        assertFalse(rev.isRevokedBy(CHASH, issuerA)); // the credential's real issuer
    }

    function test_revoke_idempotent() public {
        vm.startPrank(issuerA);
        rev.revoke(CHASH);
        rev.revoke(CHASH); // no revert; still revoked
        vm.stopPrank();
        assertTrue(rev.isRevokedBy(CHASH, issuerA));
    }

    function testFuzz_scopedToSender(bytes32 hash, address a, address b) public {
        vm.assume(a != b);
        vm.assume(a != address(0) && b != address(0));

        vm.prank(a);
        rev.revoke(hash);

        assertTrue(rev.isRevokedBy(hash, a));
        assertFalse(rev.isRevokedBy(hash, b));
        assertTrue(rev.isRevoked(hash));
    }

    function testFuzz_distinctHashesIndependent(bytes32 x, bytes32 y) public {
        vm.assume(x != y);
        vm.prank(issuerA);
        rev.revoke(x);
        assertTrue(rev.isRevokedBy(x, issuerA));
        assertFalse(rev.isRevokedBy(y, issuerA));
    }
}
