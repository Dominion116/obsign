// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IObsignIssuerRegistry} from "./interfaces.sol";

/// @title ObsignIssuerRegistry
/// @notice Immutable, permissionless issuer registry (FR-2.3). No proxy, no
///         owner, no admin (D11 / FR-2.4). Registration is permissionless:
///         msg.sender registers itself. Only its metadata hash is committed
///         onchain (FR-2.7); the metadata itself is stored offchain.
contract ObsignIssuerRegistry is IObsignIssuerRegistry {
    /// @dev Status codes returned by statusOf.
    uint8 public constant STATUS_UNKNOWN = 0;
    uint8 public constant STATUS_ACTIVE = 1;

    /// @dev issuer => current status.
    mapping(address => uint8) private _status;
    /// @dev issuer => current metadata hash.
    mapping(address => bytes32) private _metadataHash;

    /// @inheritdoc IObsignIssuerRegistry
    /// @notice First call registers the caller as ACTIVE and emits IssuerRegistered.
    ///         Subsequent calls update the caller's metadata hash and emit
    ///         IssuerUpdated. An issuer only ever mutates its own record.
    function registerIssuer(bytes32 metadataHash) external {
        bool firstTime = _status[msg.sender] == STATUS_UNKNOWN;
        _metadataHash[msg.sender] = metadataHash;
        _status[msg.sender] = STATUS_ACTIVE;
        if (firstTime) {
            emit IssuerRegistered(msg.sender, metadataHash);
        } else {
            emit IssuerUpdated(msg.sender, metadataHash, STATUS_ACTIVE);
        }
    }

    /// @inheritdoc IObsignIssuerRegistry
    function statusOf(address issuer) external view returns (uint8) {
        return _status[issuer];
    }

    /// @notice The current metadata hash committed by `issuer` (zero if unset).
    function metadataHashOf(address issuer) external view returns (bytes32) {
        return _metadataHash[issuer];
    }
}
