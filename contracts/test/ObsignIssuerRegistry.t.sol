// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ObsignIssuerRegistry} from "../src/ObsignIssuerRegistry.sol";
import {IObsignIssuerRegistry} from "../src/interfaces.sol";

contract ObsignIssuerRegistryTest is Test {
    ObsignIssuerRegistry internal reg;

    address internal issuerA = address(0xA11CE);
    address internal issuerB = address(0xB0B);

    bytes32 internal constant META1 = keccak256("meta-1");
    bytes32 internal constant META2 = keccak256("meta-2");

    function setUp() public {
        reg = new ObsignIssuerRegistry();
    }

    function test_register_setsActiveAndEmitsRegistered() public {
        vm.expectEmit(true, false, false, true);
        emit IObsignIssuerRegistry.IssuerRegistered(issuerA, META1);

        vm.prank(issuerA);
        reg.registerIssuer(META1);

        assertEq(reg.statusOf(issuerA), reg.STATUS_ACTIVE());
        assertEq(reg.metadataHashOf(issuerA), META1);
    }

    function test_unknownIssuer_statusZero() public view {
        assertEq(reg.statusOf(issuerB), reg.STATUS_UNKNOWN());
        assertEq(reg.metadataHashOf(issuerB), bytes32(0));
    }

    function test_reregister_updatesMetadataAndEmitsUpdated() public {
        vm.prank(issuerA);
        reg.registerIssuer(META1);

        vm.expectEmit(true, false, false, true);
        emit IObsignIssuerRegistry.IssuerUpdated(issuerA, META2, reg.STATUS_ACTIVE());

        vm.prank(issuerA);
        reg.registerIssuer(META2);

        assertEq(reg.metadataHashOf(issuerA), META2);
        assertEq(reg.statusOf(issuerA), reg.STATUS_ACTIVE());
    }

    function test_register_isSelfScoped() public {
        vm.prank(issuerA);
        reg.registerIssuer(META1);

        // issuerA registering does not affect issuerB.
        assertEq(reg.statusOf(issuerB), reg.STATUS_UNKNOWN());
    }

    function testFuzz_registerSelf(address who, bytes32 meta) public {
        vm.assume(who != address(0));
        vm.prank(who);
        reg.registerIssuer(meta);
        assertEq(reg.statusOf(who), reg.STATUS_ACTIVE());
        assertEq(reg.metadataHashOf(who), meta);
    }
}
