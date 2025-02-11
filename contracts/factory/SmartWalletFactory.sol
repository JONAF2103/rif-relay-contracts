// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/ICreateSmartWalletFactory.sol";
import "../interfaces/IRelayerSmartWalletFactory.sol";
import "./BaseSmartWalletFactory.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWalletFactory is
    BaseSmartWalletFactory,
    ICreateSmartWalletFactory,
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

    function createUserSmartWallet(
        address owner,
        address recoverer,
        uint256 index,
        bytes calldata sig
    ) external override {
        bytes32 _hash = keccak256(
            abi.encodePacked(address(this), owner, recoverer, index)
        );
        (sig);
        bytes32 message = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
        );
        require(
            RSKAddrValidator.safeEquals(message.recover(sig), owner),
            "Invalid signature"
        );

        //a6b63eb8  =>  initialize(address owner,address tokenAddr,address tokenRecipient,uint256 tokenAmount,uint256 tokenGas)
        bytes memory initData = abi.encodeWithSelector(
            hex"a6b63eb8",
            owner,
            address(0), // This "gas-funded" call does not pay with tokens
            address(0),
            0,
            0 //No token transfer
        );

        _deploy(
            getCreationBytecode(),
            keccak256(
                abi.encodePacked(owner, recoverer, index) // salt
            ),
            initData
        );
    }

    function relayedUserSmartWalletCreation(
        IForwarder.DeployRequest memory req,
        bytes32 suffixData,
        address feesReceiver,
        bytes calldata sig
    ) external virtual override {
        require(msg.sender == req.relayHub, "Invalid caller");
        _verifySig(req, suffixData, sig);
        // solhint-disable-next-line not-rely-on-time
        require(
            req.validUntilTime == 0 || req.validUntilTime > block.timestamp,
            "SW: request expired"
        );
        _nonces[req.from]++;

        //a6b63eb8  =>  initialize(address owner,address tokenAddr,address tokenRecipient,uint256 tokenAmount,uint256 tokenGas)
        _deploy(
            getCreationBytecode(),
            keccak256(
                abi.encodePacked(req.from, req.recoverer, req.index) // salt
            ),
            abi.encodeWithSelector(
                hex"a6b63eb8",
                req.from,
                req.tokenContract,
                feesReceiver,
                req.tokenAmount,
                req.tokenGas
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

        /* solhint-disable-next-line avoid-low-level-calls */
        (bool success, ) = addr.call(initdata);

        /* solhint-disable-next-line reason-string */
        require(success, "Unable to initialize SW");

        //No info is returned, an event is emitted to inform the new deployment
        emit Deployed(addr, uint256(salt));
    }
}
