// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IObsignPolicyRegistry} from "./interfaces.sol";

/// @title ObsignPolicyRegistry
/// @notice Immutable, append-only registry anchoring a policy hash onchain (A4).
///         No proxy, no owner, no admin (D11 / FR-2.4). A policy hash is the
///         keccak256 of the canonicalized policy JSON; anchoring it lets the
///         Sentinel agent cite an on-chain, tamper-evident rule version. A hash
///         can be registered exactly once; re-registration reverts.
contract ObsignPolicyRegistry is IObsignPolicyRegistry {
    error AlreadyRegistered(bytes32 policyHash);

    /// @dev policyHash => registrant (nonzero once registered).
    mapping(bytes32 => address) private _registrantOf;

    /// @inheritdoc IObsignPolicyRegistry
    function registerPolicy(bytes32 policyHash) external {
        if (_registrantOf[policyHash] != address(0)) revert AlreadyRegistered(policyHash);
        _registrantOf[policyHash] = msg.sender;
        emit PolicyRegistered(policyHash, msg.sender);
    }

    /// @inheritdoc IObsignPolicyRegistry
    function isRegistered(bytes32 policyHash) external view returns (bool) {
        return _registrantOf[policyHash] != address(0);
    }

    /// @inheritdoc IObsignPolicyRegistry
    function registrantOf(bytes32 policyHash) external view returns (address) {
        return _registrantOf[policyHash];
    }
}
