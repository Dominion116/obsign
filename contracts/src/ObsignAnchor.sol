// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IObsignAnchor } from "./interfaces.sol";

/// @title ObsignAnchor
/// @notice Immutable, append-only registry committing a receiptId + credentialHash
///         onchain (FR-2.1). No proxy, no owner, no admin (D11 / FR-2.4). A
///         receiptId can be anchored exactly once; re-anchoring reverts so a
///         written anchor can never be altered.
contract ObsignAnchor is IObsignAnchor {
    error AlreadyAnchored(bytes32 receiptId);

    /// @dev receiptId => credentialHash (nonzero once anchored).
    mapping(bytes32 => bytes32) private _credentialHashOf;
    /// @dev receiptId => anchored flag (guards zero-credentialHash edge cases).
    mapping(bytes32 => bool) private _anchored;

    /// @inheritdoc IObsignAnchor
    function anchor(bytes32 receiptId, bytes32 credentialHash) external {
        if (_anchored[receiptId]) revert AlreadyAnchored(receiptId);
        _anchored[receiptId] = true;
        _credentialHashOf[receiptId] = credentialHash;
        emit Anchored(receiptId, credentialHash, msg.sender);
    }

    /// @inheritdoc IObsignAnchor
    function isAnchored(bytes32 receiptId) external view returns (bool) {
        return _anchored[receiptId];
    }

    /// @notice The credentialHash committed alongside `receiptId` (zero if unset).
    function credentialHashOf(bytes32 receiptId) external view returns (bytes32) {
        return _credentialHashOf[receiptId];
    }
}
