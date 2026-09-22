// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ObsignPolicyRegistry} from "../src/ObsignPolicyRegistry.sol";
import {IObsignPolicyRegistry} from "../src/interfaces.sol";

contract ObsignPolicyRegistryTest is Test {
    ObsignPolicyRegistry internal reg;

    address internal registrant = address(0xA11CE);
    address internal other = address(0xB0B);

    bytes32 internal constant PHASH = keccak256("policy-attendance-v1");

    function setUp() public {
        reg = new ObsignPolicyRegistry();
    }

    function test_register_setsStateAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit IObsignPolicyRegistry.PolicyRegistered(PHASH, registrant);

        vm.prank(registrant);
        reg.registerPolicy(PHASH);

        assertTrue(reg.isRegistered(PHASH));
        assertEq(reg.registrantOf(PHASH), registrant);
    }

    function test_unknownPolicy_false() public view {
        assertFalse(reg.isRegistered(PHASH));
        assertEq(reg.registrantOf(PHASH), address(0));
    }

    function test_register_duplicateReverts() public {
        vm.prank(registrant);
        reg.registerPolicy(PHASH);

        vm.expectRevert(
            abi.encodeWithSelector(ObsignPolicyRegistry.AlreadyRegistered.selector, PHASH)
        );
        vm.prank(other);
        reg.registerPolicy(PHASH);

        // First registrant preserved (immutable record).
        assertEq(reg.registrantOf(PHASH), registrant);
    }

    function testFuzz_registerOnce(bytes32 h, address who) public {
        vm.assume(who != address(0));
        vm.prank(who);
        reg.registerPolicy(h);
        assertTrue(reg.isRegistered(h));
        assertEq(reg.registrantOf(h), who);

        vm.expectRevert(
            abi.encodeWithSelector(ObsignPolicyRegistry.AlreadyRegistered.selector, h)
        );
        vm.prank(who);
        reg.registerPolicy(h);
    }
}
