// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

/// @notice Reorg / pinned-read semantics against a Base Sepolia fork (INV-6).
///         Secret-gated: skips cleanly when BASE_SEPOLIA_RPC_URL is unset (e.g.
///         fork PRs), so it never fails the default secret-free CI job.
///
///         This proves the onchain primitive the verifier relies on: a pinned
///         blockNumber resolves to a stable blockHash while it is canonical, and
///         once a reorg shortens the chain below that height the pinned coordinate
///         no longer resolves (blockhash → 0). That is exactly the condition the
///         pinned-read core maps to CHAIN_UNAVAILABLE / EVENT_NOT_FOUND and fails
///         closed on. (The full "anchor → read via SDK → core verify" equivalence
///         lives in the JS integration test; contract state deliberately is not
///         asserted here, since forge keeps locally-deployed accounts across
///         rollFork.)
contract ReorgFork is Test {
    function _rpc() internal view returns (string memory url) {
        // env var is optional; empty string means "no RPC configured".
        try vm.envString("BASE_SEPOLIA_RPC_URL") returns (string memory v) {
            url = v;
        } catch {
            url = "";
        }
    }

    function test_pinnedBlockHash_stable_then_reorgInvalidates() public {
        string memory url = _rpc();
        if (bytes(url).length == 0) {
            emit log("BASE_SEPOLIA_RPC_URL unset; skipping fork reorg test");
            return;
        }

        uint256 forkId = vm.createSelectFork(url);
        require(block.number > 10, "fork head too low");
        uint256 pinnedBlock = block.number - 5; // a confirmed, pinned height
        bytes32 pinnedHash = blockhash(pinnedBlock);

        // A canonical pinned block is resolvable and stable.
        assertTrue(pinnedHash != bytes32(0), "pinned block should resolve pre-reorg");
        assertEq(blockhash(pinnedBlock), pinnedHash, "pinned hash drifted pre-reorg");

        // Simulate a reorg: roll the fork back below the pinned height, so the
        // pinned block becomes a "future" block relative to the new head.
        vm.rollFork(forkId, pinnedBlock - 1);
        assertLt(block.number, pinnedBlock, "rollFork did not move head back");

        // The pinned (blockNumber, blockHash) coordinate no longer resolves: a
        // pinned read now returns nothing, which the core fails closed on
        // (CHAIN_UNAVAILABLE / EVENT_NOT_FOUND) rather than trusting `latest`.
        assertEq(blockhash(pinnedBlock), bytes32(0), "pinned block still resolvable after reorg");
    }
}
