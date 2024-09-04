// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "../utils/BoltzUtils.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract MinimalBoltzSmartWallet {
    bool private _isInitialized = false;

    /**
     * This Proxy will first charge for the deployment and then it will pass the
     * initialization scope to the wallet logic.
     * This function can only be called once, and it is called by the Factory during deployment
     * @param owner - The EOA that will own the smart wallet
     * @param feesReceiver - Recipient of payment
     * @param feesAmount - Amount to pay
     * @param feesGas - Gas limit of payment
     * @param to - Destination contract to execute
     * @param data - Data to be execute by destination contract
     */
    function initialize(
        address owner,
        address feesReceiver,
        uint256 feesAmount,
        uint256 feesGas,
        address to,
        bytes calldata data
    ) external {
        require(!_isInitialized, "Already initialized");

        _isInitialized = true;

        BoltzUtils.validateClaimSignature(data);

        bool success;
        bytes memory ret;
        // Although this check isn't strictly necessary, it's included to improve the transaction estimation
        if (to != address(0)) {
            (success, ret) = to.call(data);
            if (!success) {
                if (ret.length == 0) revert("Unable to execute");
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }

        if (feesAmount > 0) {
            (success, ret) = payable(feesReceiver).call{
                value: feesAmount,
                gas: feesGas
            }("");
            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to pay for deployment"
            );
        }

        //If any balance has been added then trasfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(owner).transfer(address(this).balance);
        }
    }

    /* solhint-disable no-empty-blocks */
    receive() external payable virtual {}
}
