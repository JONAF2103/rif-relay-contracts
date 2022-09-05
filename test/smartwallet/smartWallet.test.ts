import { ethers as hardhat } from 'hardhat';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect} from 'chai';
import { FakeContract, smock } from '@defi-wonderland/smock';
import chaiAsPromised from 'chai-as-promised';
import { TypedDataUtils } from '@metamask/eth-sig-util';
import {
    getLocalEip712Signature,
    TypedRequestData,
    TypedDeployRequestData,
    getLocalEip712DeploySignature} from '../utils/EIP712Utils';
import { SignTypedDataVersion } from '@metamask/eth-sig-util';
import { Wallet } from 'ethers';
import { 
    SmartWallet, 
    SmartWalletFactory,
    ERC20,
    SmartWallet__factory} from 'typechain-types';
import { BaseProvider } from '@ethersproject/providers';
import { EnvelopingTypes, IForwarder } from 'typechain-types/contracts/RelayHub';
import { MockContract } from '@defi-wonderland/smock';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;
const ONE_FIELD_IN_BYTES = 32;
const HARDHAT_CHAIN_ID = 31337;

type ForwardRequest = IForwarder.ForwardRequestStruct;
type RelayData = EnvelopingTypes.RelayDataStruct;
type RelayRequest = EnvelopingTypes.RelayRequestStruct;
type DeployRequest = EnvelopingTypes.DeployRequestStruct;
type DeployRequestInternal = IForwarder.DeployRequestStruct;

describe('SmartWallet contract', function(){
    let smartWalletFactory: SmartWalletFactory;
    let provider: BaseProvider;
    let owner: Wallet;
    let relayHub: SignerWithAddress;
    let fakeToken: FakeContract<ERC20>;

    function createRequest(
        request: Partial<ForwardRequest>,
        relayData?: Partial<RelayData>
    ): RelayRequest {
        const baseRequest: RelayRequest = {
            request:{
                relayHub: ZERO_ADDRESS,
                from: ZERO_ADDRESS,
                to: ZERO_ADDRESS,
                tokenContract: ZERO_ADDRESS,
                value: '0',
                gas: '10000',
                nonce: '0',
                tokenAmount: '0',
                tokenGas: '50000',
                data: '0x'
            },            
            relayData:{
                gasPrice: '1',
                feesReceiver: ZERO_ADDRESS,
                callForwarder: ZERO_ADDRESS,
                callVerifier: ZERO_ADDRESS
            }
        };

        return {
            request: {
                ...baseRequest.request,
                ...request,
            },
            relayData: {
                ...baseRequest.relayData,
                ...relayData,
            }
        };
    }

    function createDeployRequest(
        request: Partial<DeployRequestInternal>,
        relayData?: Partial<RelayData>
    ): DeployRequest {
        const baseRequest = {
            request:{
                relayHub: ZERO_ADDRESS,
                from: ZERO_ADDRESS,
                to: ZERO_ADDRESS,
                tokenContract: ZERO_ADDRESS,
                recoverer: ZERO_ADDRESS,
                value: '0',
                nonce: '0',
                tokenAmount: '0',
                tokenGas: '50000',
                index: '0',
                data: '0x'
            },            
            relayData:{
                gasPrice: '1',
                feesReceiver: ZERO_ADDRESS,
                callForwarder: ZERO_ADDRESS,
                callVerifier: ZERO_ADDRESS
            }
        };
    
        return {
            request: {
                ...baseRequest.request,
                ...request,
            },
            relayData: {
                ...baseRequest.relayData,
                ...relayData,
            }
        };
    }

    function buildDomainSeparator(address: string ){
        const domainSeparator = {
            name: 'RSK Enveloping Transaction',
            version: '2',
            chainId: HARDHAT_CHAIN_ID,
            verifyingContract: address
        };

        return hardhat.utils._TypedDataEncoder.hashDomain(domainSeparator);
    }
    
    function getSuffixData(typedRequestData: TypedRequestData):string{
        const encoded =TypedDataUtils.encodeData(
            typedRequestData.primaryType,
            typedRequestData.message,
            typedRequestData.types,
            SignTypedDataVersion.V4
        );

        const messageSize = Object.keys(typedRequestData.message).length;

        return '0x'+(encoded.slice(messageSize * ONE_FIELD_IN_BYTES)).toString('hex');
    }

    async function createSmartWalletFactory(owner: Wallet){
        const smartWalletTemplateFactory = await hardhat.getContractFactory('SmartWallet');

        const smartWalletTemplate = await smartWalletTemplateFactory.deploy();

        const smartWalletFactoryFactory = await hardhat.getContractFactory('SmartWalletFactory');

        smartWalletFactory = await smartWalletFactoryFactory.connect(owner).deploy(smartWalletTemplate.address);
    }

    //This function is being tested as an integration test because of the lack of tools to unit test it
    describe('Function initialize()', function(){
        function signData(
            dataTypesToSign: Array<string>,
            valuesToSign: Array<string | number>
        ){
            const privateKey =  Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            const toSign = hardhat.utils.solidityKeccak256(
                dataTypesToSign,
                valuesToSign
            );
            const toSignAsBinaryArray = hardhat.utils.arrayify(toSign);
            const signingKey = new hardhat.utils.SigningKey(privateKey);
            const signature = signingKey.signDigest(toSignAsBinaryArray);

            return hardhat.utils.joinSignature(signature);
        }

        async function getAlreadyDeployedSmartWallet(){
            const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
                owner.address,
                ZERO_ADDRESS,
                0,
            );

            return await hardhat.getContractAt('SmartWallet', smartWalletAddress);
        }

        beforeEach(async function(){
            let fundedAccount: SignerWithAddress;
            [relayHub, fundedAccount] = await hardhat.getSigners();

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);
            
            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});
            await createSmartWalletFactory(owner);

            fakeToken = await smock.fake('ERC20');
        });

        describe('', function() {
            let smartWallet: SmartWallet;

            beforeEach(async function() {
                const dataTypesToSign = ['bytes2', 'address', 'address', 'uint256'];
                const valuesToSign = ['0x1910', owner.address, ZERO_ADDRESS, 0 ];

                const signature = signData(dataTypesToSign, valuesToSign);

                await smartWalletFactory.createUserSmartWallet(
                    owner.address,
                    ZERO_ADDRESS,
                    '0',
                    signature
                );

                smartWallet = await getAlreadyDeployedSmartWallet();
            })

            it('Should initialize a SmartWallet', async function(){
                expect(await smartWallet.isInitialized()).to.be.true;
            });

            it('Should fail to initialize a SmartWallet twice', async function(){
                await expect(
                    smartWallet.initialize(owner.address, fakeToken.address, ZERO_ADDRESS, 10, 400000),
                    'Second initialization not rejected'
                ).to.be.revertedWith('already initialized');
            });
    
            it('Should create the domainSeparator', async function () {
    
                expect(await smartWallet.domainSeparator()).to.be.properHex(64);
            });
        })

        it('Should call transfer on not sponsored deployment', async function(){
            const deployRequest = createDeployRequest({
                relayHub: relayHub.address,
                from: owner.address,
                nonce: '0',
                tokenGas: '1',
                tokenAmount: '1',
                tokenContract: fakeToken.address
            });
            
            const typedDeployData = new TypedDeployRequestData(HARDHAT_CHAIN_ID, smartWalletFactory.address, deployRequest);

            const suffixData = getSuffixData(typedDeployData);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            const signature = getLocalEip712DeploySignature(typedDeployData, privateKey);
            
            fakeToken.transfer.returns(true);
            
            await smartWalletFactory.connect(relayHub).relayedUserSmartWalletCreation(
                deployRequest.request,
                suffixData,
                owner.address,
                signature
            );            

            expect(fakeToken.transfer).to.be.called;
        })

        it('Should not call transfer on sponsored deployment', async function(){
            const deployRequest = createDeployRequest({
                relayHub: relayHub.address,
                from: owner.address,
                nonce: '0',
                tokenGas: '0',
                tokenAmount: '0',
                tokenContract: fakeToken.address
            });
            
            const typedDeployData = new TypedDeployRequestData(HARDHAT_CHAIN_ID, smartWalletFactory.address, deployRequest);

            const suffixData = getSuffixData(typedDeployData);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            const signature = getLocalEip712DeploySignature(typedDeployData, privateKey);
            
            fakeToken.transfer.returns(true);
            
            await smartWalletFactory.connect(relayHub).relayedUserSmartWalletCreation(
                deployRequest.request,
                suffixData,
                owner.address,
                signature
            );            

            expect(fakeToken.transfer).not.to.be.called;
        })

        it('Should fail when the token transfer method fails', async function () {
            const deployRequest = createDeployRequest({
                relayHub: relayHub.address,
                from: owner.address,
                nonce: '0',
                tokenGas: '1',
                tokenAmount: '1',
                tokenContract: fakeToken.address
            });
            
            const typedDeployData = new TypedDeployRequestData(HARDHAT_CHAIN_ID, smartWalletFactory.address, deployRequest);

            const suffixData = getSuffixData(typedDeployData);

            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
            const signature = getLocalEip712DeploySignature(typedDeployData, privateKey);
            
            fakeToken.transfer.returns(false);
            
            await expect(
                smartWalletFactory.connect(relayHub).relayedUserSmartWalletCreation(
                    deployRequest.request,
                    suffixData,
                    owner.address,
                    signature
                )
            ).to.be.revertedWith('Unable to initialize SW');
        });
    });

    describe('Function verify()', function(){
        let mockSmartWallet: MockContract<SmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;

        beforeEach(async function(){
            const [, fundedAccount] = await hardhat.getSigners();

            const mockSmartWalletFactory = await smock.mock<SmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});
            mockSmartWallet = await mockSmartWalletFactory.connect(owner).deploy(); 

            const domainSeparator = buildDomainSeparator(mockSmartWallet.address);
            await mockSmartWallet.setVariable('domainSeparator', domainSeparator);
        });

        it('Should verify a transaction', async function(){ 
            const relayRequest = createRequest({
                from: owner.address,
                nonce: '0'
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);
            
            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).not.to.be.rejected;
        });

        it('Should fail when not called by the owner', async function(){
            const notTheOwner =  hardhat.Wallet.createRandom();
            notTheOwner.connect(provider);
            
            const relayRequest = createRequest({
                from: notTheOwner.address
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, notTheOwner.address, relayRequest);
            
            const privateKey = Buffer.from(notTheOwner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('Not the owner of the SmartWallet');
        });

        it('Should fail when the nonce is wrong', async function(){
            const relayRequest = createRequest({
                from: owner.address,
                nonce: '2'
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, owner.address, relayRequest);
            
            const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('nonce mismatch');
        });

        it('Should fail when the signature is wrong', async function(){
            const notTheOwner =  hardhat.Wallet.createRandom();
            notTheOwner.connect(provider);
            
            const relayRequest = createRequest({
                from: owner.address
            });
            
            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, owner.address, relayRequest);
            
            const privateKey = Buffer.from(notTheOwner.privateKey.substring(2, 66), 'hex');

            const suffixData = getSuffixData(typedRequestData);
            const signature = getLocalEip712Signature(typedRequestData, privateKey);
            
            await expect(
                mockSmartWallet.verify(suffixData, relayRequest.request, signature)
            ).to.be.rejectedWith('Signature mismatch');
        });
    });

    describe('Function execute()', function(){
        let mockSmartWallet: MockContract<SmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;
        let recipient: FakeContract;
        let recipientFunction: string;
        let privateKey: Buffer;
        let worker: SignerWithAddress;

        beforeEach(async function(){
            let fundedAccount: SignerWithAddress;
            [relayHub, fundedAccount, worker] = await hardhat.getSigners();

            const mockSmartWalletFactory = await smock.mock<SmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});
            mockSmartWallet = await mockSmartWalletFactory.connect(owner).deploy(); 

            const domainSeparator = buildDomainSeparator(mockSmartWallet.address);
            await mockSmartWallet.setVariable('domainSeparator', domainSeparator);

            recipient = await smock.fake('SmartWallet');
            recipient.isInitialized.returns(true);

            const ABI = ['function isInitialized()'];
            const abiInterface = new hardhat.utils.Interface(ABI);
            recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);

            privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);
        });

        it('Should execute a sponsored transaction', async function(){
            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: mockSmartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                mockSmartWallet.connect(relayHub).execute(suffixData, relayRequest.request, worker.address, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(fakeToken.transfer, 'Token.transfer() was not called').to.be.called;
            expect(recipient.isInitialized, 'Recipient method was not called').to.be.called;
        });

        it('Should execute a not sponsored transaction', async function(){
            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                to: recipient.address,
                tokenAmount: '0',
                tokenGas: '0',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: mockSmartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                mockSmartWallet.connect(relayHub).execute(suffixData, relayRequest.request, worker.address, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(fakeToken.transfer, 'Token.transfer was called').not.to.be.called;
            expect(recipient.isInitialized, 'Recipient method was not called').to.be.called;
        });

        it('Should increment nonce', async function(){
            const initialNonce = 0;

            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction,
                nonce: initialNonce.toString()
            },{
                callForwarder: mockSmartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                mockSmartWallet.connect(relayHub).execute(suffixData, relayRequest.request, worker.address, signature),
                'Execution failed'
            ).not.to.be.rejected;

            expect(await mockSmartWallet.nonce(), 'Nonce was not incremented').to.equal(initialNonce+1);
        });

        it('Should fail if not called by the relayHub', async function(){
            const notTheRelayHub =  hardhat.Wallet.createRandom();
            notTheRelayHub.connect(provider);

            const relayRequest = createRequest({
                relayHub: notTheRelayHub.address,
                from: owner.address,
                to: recipient.address,
                tokenAmount: '10',
                tokenGas: '40000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: mockSmartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                mockSmartWallet.connect(relayHub).execute(suffixData, relayRequest.request, worker.address, signature),
                'The execution did not fail'
            ).to.be.rejectedWith('Invalid caller');
        });

        it('Should fail when gas is not enough', async function(){
            const relayRequest = createRequest({
                relayHub: relayHub.address,
                from: owner.address,
                to: recipient.address,
                tokenAmount: '10',
                gas: '10000000000',
                tokenContract: fakeToken.address,
                data: recipientFunction
            },{
                callForwarder: mockSmartWallet.address
            });

            const typedRequestData = new TypedRequestData(HARDHAT_CHAIN_ID, mockSmartWallet.address, relayRequest);            

            const signature = getLocalEip712Signature(typedRequestData, privateKey);

            const suffixData = getSuffixData(typedRequestData);

            await expect(
                mockSmartWallet.connect(relayHub).execute(suffixData, relayRequest.request, worker.address, signature),
                'Execution should fail'
            ).to.be.rejectedWith('Not enough gas left');
        });
    });

    describe('Function directExecute()', function(){
        let mockSmartWallet: MockContract<SmartWallet>;
        let provider: BaseProvider;
        let owner: Wallet;
        let recipient: FakeContract;
        let recipientFunction: string;
        let utilWallet: SignerWithAddress;

        beforeEach(async function(){
            let fundedAccount: SignerWithAddress;
            [relayHub, fundedAccount, utilWallet] = await hardhat.getSigners();

            const mockSmartWalletFactory = await smock.mock<SmartWallet__factory>('CustomSmartWallet');

            provider = hardhat.provider;
            owner = hardhat.Wallet.createRandom().connect(provider);

            //Fund the owner
            await fundedAccount.sendTransaction({to: owner.address, value: hardhat.utils.parseEther('1')});
            mockSmartWallet = await mockSmartWalletFactory.connect(owner).deploy(); 

            recipient = await smock.fake('SmartWallet');
            recipient.isInitialized.returns(true);

            const ABI = ['function isInitialized()'];
            const abiInterface = new hardhat.utils.Interface(ABI);
            recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);

            fakeToken = await smock.fake('ERC20');
            fakeToken.transfer.returns(true);
        });

        it('Should execute a valid transaction', async function(){
            await expect(
                mockSmartWallet.directExecute(recipient.address, recipientFunction),
                'Execution failed'
            ).not.to.be.rejected;
        });

        it('Should failed when not called by the owner', async function(){
            const notTheOwner = utilWallet;

            await expect(
                mockSmartWallet.connect(notTheOwner).directExecute(recipient.address, recipientFunction),
                'Execution should be rejected'
            ).to.be.rejectedWith('Not the owner of the SmartWallet');
        });

        it('Should send balance back to owner', async function(){
            const amountToTransfer = hardhat.utils.parseEther('1000');

            await utilWallet.sendTransaction({
                to: mockSmartWallet.address,
                value: amountToTransfer
            });
            
            const ownerBalanceBefore = await owner.getBalance();

            await expect(
                mockSmartWallet.directExecute(recipient.address, recipientFunction),
                'Execution failed'
            ).not.to.be.rejected;

            const ownerBalanceAfter = await owner.getBalance();
            const difference = Number(hardhat.utils.formatEther(ownerBalanceAfter.sub(ownerBalanceBefore)));
            const amountToTransferAsNumber = Number(hardhat.utils.formatEther(amountToTransfer));

            expect(difference).approximately(amountToTransferAsNumber, 2);
        });
    });
});
