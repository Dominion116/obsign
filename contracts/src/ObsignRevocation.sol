// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IObsignRevocation } from "./interfaces.sol";

/// @title ObsignRevocation
/// @notice Immutable, issuer-scoped revocation registry (FR-2.2). No proxy, no
///         owner, no admin (D11 / FR-2.4). Revocation is scoped to msg.sender so
///         one issuer cannot revoke another issuer's credential (non-griefable);
///         the verifier resolves a credential's revocation via isRevokedBy with
///         the credential's own issuer address.
contract ObsignRevocation is IObsignRevocation {
    /// @dev credentialHash => issuer => revoked-by-that-issuer.
    mapping(bytes32 => mapping(address => bool)) private _revokedBy;
    /// @dev credentialHash => revoked-by-anyone (convenience view).
    mapping(bytes32 => bool) private _revokedAny;

    /// @inheritdoc IObsignRevocation
    function revoke(bytes32 credentialHash) external {
        _revokedBy[credentialHash][msg.sender] = true;
        _revokedAny[credentialHash] = true;
        emit Revoked(credentialHash, msg.sender);
    }

    /// @inheritdoc IObsignRevocation
    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return _revokedAny[credentialHash];
    }

    /// @inheritdoc IObsignRevocation
    function isRevokedBy(bytes32 credentialHash, address issuer) external view returns (bool) {
        return _revokedBy[credentialHash][issuer];
    }
}
