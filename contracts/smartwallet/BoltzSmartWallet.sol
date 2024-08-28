// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseSmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract BoltzSmartWallet is BaseSmartWallet {
    function execute(
        bytes32 suffixData,
        ForwardRequest memory req,
        address feesReceiver,
        bytes calldata sig
    )
        external
        payable
        virtual
        override
        returns (bool success, bytes memory ret)
    {
        (sig);
        require(msg.sender == req.relayHub, "Invalid caller");

        _verifySig(suffixData, req, sig);
        require(
            req.validUntilTime == 0 || req.validUntilTime > block.timestamp,
            "SW: request expired"
        );
        nonce++;

        (success, ret) = req.to.call{gas: req.gas, value: req.value}(req.data);

        if (req.tokenAmount > 0) {
            bool successPayment;
            bytes memory retPayment;
            if (req.tokenContract == address(0)) {
                (successPayment, retPayment) = payable(feesReceiver).call{
                    value: req.tokenAmount,
                    gas: req.tokenGas
                }("");
            } else {
                (successPayment, retPayment) = req.tokenContract.call{
                    gas: req.tokenGas
                }(
                    abi.encodeWithSelector(
                        hex"a9059cbb", //transfer(address,uint256)
                        feesReceiver,
                        req.tokenAmount
                    )
                );
            }
            require(
                successPayment &&
                    (retPayment.length == 0 || abi.decode(retPayment, (bool))),
                "Unable to pay for relay"
            );
        }

        //If any balance has been added then trasfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(req.from).transfer(address(this).balance);
        }
    }

    /**
     * This Proxy will first charge for the deployment and then it will pass the
     * initialization scope to the wallet logic.
     * This function can only be called once, and it is called by the Factory during deployment
     * @param owner - The EOA that will own the smart wallet
     * @param tokenContract - Token used for payment of the deploy
     * @param feesReceiver - Recipient of payment
     * @param tokenAmount - Amount to pay
     * @param tokenGas - Gas limit of payment
     * @param to - Destination contract to execute
     * @param value - Value to send to destination contract
     * @param data - Data to be execute by destination contract
     */
    function initialize(
        address owner,
        address tokenContract,
        address feesReceiver,
        uint256 tokenAmount,
        uint256 tokenGas,
        address to,
        uint256 value,
        bytes calldata data
    ) external {
        require(getOwner() == bytes32(0), "Already initialized");

        _setOwner(owner);

        bool success;
        bytes memory ret;
        if (to != address(0)) {
            (success, ret) = to.call{value: value}(data);
            if (!success) {
                if (ret.length == 0) revert("Unable to execute");
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }

        if (tokenAmount > 0) {
            if (tokenContract == address(0)) {
                (success, ret) = payable(feesReceiver).call{
                    value: tokenAmount,
                    gas: tokenGas
                }("");
            } else {
                (success, ret) = tokenContract.call{gas: tokenGas}(
                    abi.encodeWithSelector(
                        hex"a9059cbb", // transfer(address,uint256)
                        feesReceiver,
                        tokenAmount
                    )
                );
            }
            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to pay for deployment"
            );
        }

        _buildDomainSeparator();

        //If any balance has been added then trasfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(owner).transfer(address(this).balance);
        }
    }
}
