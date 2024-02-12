// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./IWalletFactory.sol";

interface ICustomSmartWalletCreator is IWalletFactory {
    function createUserSmartWallet(
        address owner,
        address recoverer,
        address logic,
        uint256 index,
        bytes calldata initParams,
        bytes calldata sig
    ) external;
}
