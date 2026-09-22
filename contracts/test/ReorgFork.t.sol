// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ObsignAnchor} from "../src/ObsignAnchor.sol";

/// @notice Reorg / pinned-read semantics against a Base Sepolia fork (INV-6).
///         Secret-gated: skips cleanly when BASE_SEPOLIA_RPC_URL is unset (e.g.
///         fork PRs), so it never fails the default secret-free CI job. The
///         end-to-end "anchor → read via SDK → core verify" equivalence and the
///         full reorg assertion live in the JS integration test; this test proves
///         the onchain primitive: a pinned blockNumber's blockHash is stable, and
///         after a reorg (rollFork to an earlier state) the previously observed
///         (blockNumber, blockHash) no longer resolves — the exact condition the
///         core maps to BLOCK_HASH_MISMATCH / EVENT_NOT_FOUND and fails closed.
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
        uint256 pinnedBlock = block.number - 5; // a confirmed, pinned height
        bytes32 pinnedHash = blockhash(pinnedBlock);

        // Deploy + anchor on the fork; the anchor is observable at head.
        ObsignAnchor anchor = new ObsignAnchor();
        bytes32 rid = keccak256("reorg-receipt");
        anchor.anchor(rid, keccak256("reorg-credential"));
        assertTrue(anchor.isAnchored(rid));

        // Pinned reads are stable while the pinned block remains canonical.
        assertEq(blockhash(pinnedBlock), pinnedHash, "pinned hash drifted pre-reorg");

        // Simulate a reorg: roll the fork back below the pinned height. The
        // pinned (blockNumber, blockHash) coordinate no longer resolves at head,
        // which is what the pinned-read verifier detects and fails closed on.
        vm.rollFork(forkId, pinnedBlock - 1);
        assertLt(block.number, pinnedBlock, "rollFork did not move head back");
        // The deployed anchor state does not survive the rolled-back fork state.
        assertFalse(anchor.isAnchored(rid), "anchor unexpectedly survived reorg");
    }
}
