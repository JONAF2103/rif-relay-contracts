// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IRelayerSmartWalletFactory.sol";
import "./BaseSmartWalletFactory.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract MinimalBoltzSmartWalletFactory is
    BaseSmartWalletFactory,
    IRelayerSmartWalletFactory
{
    /* solhint-disable no-empty-blocks */
    /**
     * @param forwarderTemplate It implements all the payment and execution needs,
     * it pays for the deployment during initialization, and it pays for the transaction
     * execution on each execute() call.
     */
    constructor(
        address forwarderTemplate
    ) public BaseSmartWalletFactory(forwarderTemplate) {}

    function relayedUserSmartWalletCreation(
        IForwarder.DeployRequest memory req,
        bytes32 suffixData,
        address feesReceiver,
        bytes calldata sig
    ) external override {
        require(msg.sender == req.relayHub, "Invalid caller");
        _verifySig(req, suffixData, sig);
        // solhint-disable-next-line not-rely-on-time
        require(
            req.validUntilTime == 0 || req.validUntilTime > block.timestamp,
            "SW: request expired"
        );
        _nonces[req.from]++;

        // 3d326736  => initialize(address owner,address feesReceiver,uint256 tokenAmount,uint256 tokenGas,address to,bytes calldata data)
        _deploy(
            getCreationBytecode(),
            keccak256(
                abi.encodePacked(req.from, req.recoverer, req.index) // salt
            ),
            abi.encodeWithSelector(
                hex"3d326736",
                req.from,
                feesReceiver,
                req.tokenAmount,
                req.tokenGas,
                req.to,
                req.data
            )
        );
    }

    function _deploy(
        bytes memory code,
        bytes32 salt,
        bytes memory initdata
    ) internal returns (address addr) {
        //Deployment of the Smart Wallet
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            addr := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        //Since the init code determines the address of the smart wallet, any initialization
        //required is done via the runtime code, to avoid the parameters impacting on the resulting address
        (bool success, bytes memory ret) = addr.call(initdata);

        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        //No info is returned, an event is emitted to inform the new deployment
        emit Deployed(addr, uint256(salt));
    }
}
