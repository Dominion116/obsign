// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Obsign onchain interfaces (PRD §9.3).
/// @notice All Obsign contracts are immutable: no proxy, no owner, no admin
///         (D11 / FR-2.4). These interfaces pin the external surface consumed by
///         the SDK ChainReader and the verifier.

interface IObsignAnchor {
    event Anchored(
        bytes32 indexed receiptId, bytes32 indexed credentialHash, address indexed issuer
    );

    function anchor(bytes32 receiptId, bytes32 credentialHash) external;

    function isAnchored(bytes32 receiptId) external view returns (bool);
}

interface IObsignRevocation {
    event Revoked(bytes32 indexed credentialHash, address indexed issuer);

    function revoke(bytes32 credentialHash) external;

    /// @notice True when `credentialHash` has been revoked by anyone.
    function isRevoked(bytes32 credentialHash) external view returns (bool);

    /// @notice True when `credentialHash` was revoked specifically by `issuer`.
    ///         The SDK resolves revocation for a credential by calling this with
    ///         the credential's own issuer address (issuer-scoped, non-griefable).
    function isRevokedBy(bytes32 credentialHash, address issuer) external view returns (bool);
}

interface IObsignIssuerRegistry {
    event IssuerRegistered(address indexed issuer, bytes32 metadataHash);
    event IssuerUpdated(address indexed issuer, bytes32 metadataHash, uint8 status);

    function registerIssuer(bytes32 metadataHash) external;

    function statusOf(address issuer) external view returns (uint8);
}

interface IObsignPolicyRegistry {
    event PolicyRegistered(bytes32 indexed policyHash, address indexed registrant);

    function registerPolicy(bytes32 policyHash) external;

    function isRegistered(bytes32 policyHash) external view returns (bool);

    function registrantOf(bytes32 policyHash) external view returns (address);
}
