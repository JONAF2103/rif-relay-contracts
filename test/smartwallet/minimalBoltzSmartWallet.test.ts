import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { BaseProvider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Wallet } from 'ethers';
import { ethers as hardhat } from 'hardhat';
import {
  ERC20,
  MinimalBoltzSmartWallet,
  MinimalBoltzSmartWalletFactory,
  MinimalBoltzSmartWallet__factory,
} from 'typechain-types';
import { createValidPersonalSignSignature } from '../utils/createValidPersonalSignSignature';
import {
  getLocalEip712DeploySignature,
  getLocalEip712Signature,
  TypedDeployRequestData,
  TypedRequestData,
} from '../utils/EIP712Utils';
import {
  buildDomainSeparator,
  createDeployRequest,
  createRelayRequest,
  getSuffixData,
  HARDHAT_CHAIN_ID,
} from './utils';
import { deployContract } from '../../utils/deployment/deployment.utils';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

const ZERO_ADDRESS = hardhat.constants.AddressZero;

describe('MinimalBoltzSmartWallet contract', function () {
  let smartWalletFactory: MinimalBoltzSmartWalletFactory;
  let provider: BaseProvider;
  let owner: Wallet;
  let relayHub: SignerWithAddress;
  let fakeToken: FakeContract<ERC20>;

  async function createSmartWalletFactory(owner: Wallet) {
    const smartWalletTemplateFactory = await hardhat.getContractFactory(
      'MinimalBoltzSmartWallet'
    );

    const smartWalletTemplate = await smartWalletTemplateFactory.deploy();

    const smartWalletFactoryFactory = await hardhat.getContractFactory(
      'MinimalBoltzSmartWalletFactory'
    );

    smartWalletFactory = await smartWalletFactoryFactory
      .connect(owner)
      .deploy(smartWalletTemplate.address);
  }

  //This function is being tested as an integration test because of the lack of tools to unit test it
  describe('Function initialize()', function () {
    let worker: Wallet;

    async function getAlreadyDeployedSmartWallet() {
      const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
        owner.address,
        ZERO_ADDRESS,
        0
      );

      return await hardhat.getContractAt(
        'MinimalBoltzSmartWallet',
        smartWalletAddress
      );
    }

    beforeEach(async function () {
      let fundedAccount: SignerWithAddress;
      [relayHub, fundedAccount] = (await hardhat.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress
      ];

      provider = hardhat.provider;
      owner = hardhat.Wallet.createRandom().connect(provider);
      worker = hardhat.Wallet.createRandom().connect(provider);

      //Fund the owner
      await fundedAccount.sendTransaction({
        to: owner.address,
        value: hardhat.utils.parseEther('1'),
      });
      await createSmartWalletFactory(owner);

      fakeToken = await smock.fake('ERC20');
    });

    describe('', function () {
      let smartWallet: MinimalBoltzSmartWallet;

      beforeEach(async function () {
        const dataTypesToSign = ['address', 'address', 'address', 'uint256'];
        const valuesToSign = [
          smartWalletFactory.address,
          owner.address,
          ZERO_ADDRESS,
          0,
        ];
        const toSign = hardhat.utils.solidityKeccak256(
          dataTypesToSign,
          valuesToSign
        );

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = createValidPersonalSignSignature(privateKey, toSign);

        await smartWalletFactory.createUserSmartWallet(
          owner.address,
          ZERO_ADDRESS,
          '0',
          signature
        );

        smartWallet = await getAlreadyDeployedSmartWallet();
      });

      it('Should initialize a SmartWallet', async function () {
        expect(await smartWallet.isInitialized()).to.be.true;
      });

      it('Should fail to initialize a SmartWallet twice', async function () {
        await expect(
          smartWallet.initialize(
            owner.address,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            10,
            400000,
            ZERO_ADDRESS,
            0,
            '0x00'
          ),
          'Second initialization not rejected'
        ).to.be.revertedWith('Already initialized');
      });

      it('Should create the domainSeparator', async function () {
        expect(await smartWallet.domainSeparator()).to.be.properHex(64);
      });
    });

    describe('with contract execution', function () {
      let recipient: FakeContract<MinimalBoltzSmartWallet>;
      let recipientFunction: string;

      beforeEach(async function () {
        recipient = await smock.fake('MinimalBoltzSmartWallet');
        recipient.isInitialized.returns(true);

        recipientFunction = recipient.interface.encodeFunctionData(
          'isInitialized',
          []
        );
      });

      it('Should pay for deployment using native', async function () {
        const amountToBePaid = hardhat.utils.parseEther('0.01');
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '5000',
          tokenAmount: amountToBePaid.toString(),
          tokenContract: ZERO_ADDRESS,
          gas: '4000',
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        const smartWalletAddress =
          await smartWalletFactory.getSmartWalletAddress(
            owner.address,
            ZERO_ADDRESS,
            0
          );
        await owner.sendTransaction({
          to: smartWalletAddress,
          value: amountToBePaid,
        });

        const balanceBefore = await provider.getBalance(worker.address);

        await smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const balanceAfter = await provider.getBalance(worker.address);

        expect(balanceAfter).to.be.equal(balanceBefore.add(amountToBePaid));
        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should not pay on sponsored deployment', async function () {
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          gas: '4000',
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        const workerBalanceBefore = await provider.getBalance(worker.address);

        await smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          );

        const workerBalanceAfter = await provider.getBalance(worker.address);

        expect(workerBalanceBefore).to.be.equal(workerBalanceAfter);
        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should fail if contract execution fail', async function () {
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          gas: '4000',
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        recipient.isInitialized.reverts();

        await expect(
          smartWalletFactory
            .connect(relayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Unable to execute');

        expect(recipient.isInitialized, 'Recipient method was not called').to.be
          .called;
      });

      it('Should fail if payment is not with native', async function () {
        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '1000',
          tokenAmount: '10000',
          tokenContract: fakeToken.address,
          gas: '4000',
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(relayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('RBTC necessary for payment');
      });

      it('Should pass the revert message from destination contract if fails', async function () {
        const { contract: recipient } = await deployContract<
          MinimalBoltzSmartWallet,
          []
        >({
          contractName: 'MinimalBoltzSmartWallet',
          constructorArgs: [],
        });
        const recipientFunction = recipient.interface.encodeFunctionData(
          'directExecute',
          [recipient.address, '0x00']
        );

        const deployRequest = createDeployRequest({
          relayHub: relayHub.address,
          from: owner.address,
          nonce: '0',
          tokenGas: '0',
          tokenAmount: '0',
          tokenContract: fakeToken.address,
          gas: '4000',
          to: recipient.address,
          data: recipientFunction,
        });

        const typedDeployData = new TypedDeployRequestData(
          HARDHAT_CHAIN_ID,
          smartWalletFactory.address,
          deployRequest
        );

        const suffixData = getSuffixData(typedDeployData);

        const privateKey = Buffer.from(
          owner.privateKey.substring(2, 66),
          'hex'
        );
        const signature = getLocalEip712DeploySignature(
          typedDeployData,
          privateKey
        );

        await expect(
          smartWalletFactory
            .connect(relayHub)
            .relayedUserSmartWalletCreation(
              deployRequest.request,
              suffixData,
              worker.address,
              signature
            )
        ).to.be.rejectedWith('Not the owner of the SmartWallet');
      });
    });

    it('Should pay for deployment using native', async function () {
      const amountToBePaid = hardhat.utils.parseEther('0.01');
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '5000',
        tokenAmount: amountToBePaid.toString(),
        tokenContract: ZERO_ADDRESS,
      });

      const typedDeployData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWalletFactory.address,
        deployRequest
      );

      const suffixData = getSuffixData(typedDeployData);

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
      const signature = getLocalEip712DeploySignature(
        typedDeployData,
        privateKey
      );

      const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
        owner.address,
        ZERO_ADDRESS,
        0
      );
      await owner.sendTransaction({
        to: smartWalletAddress,
        value: amountToBePaid,
      });

      const initialSwBalance = await provider.getBalance(smartWalletAddress);
      const initialOwnerBalance = await owner.getBalance();
      const initialWorkerBalance = await worker.getBalance();

      await smartWalletFactory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          worker.address,
          signature
        );

      const finalSwBalance = await provider.getBalance(smartWalletAddress);
      const finalOwnerBalance = await owner.getBalance();
      const finalWorkerBalance = await worker.getBalance();

      expect(finalSwBalance).to.be.equal(0);
      expect(finalOwnerBalance).to.be.equal(
        initialOwnerBalance.add(initialSwBalance).sub(amountToBePaid)
      );
      expect(finalWorkerBalance).to.be.equal(
        initialWorkerBalance.add(amountToBePaid)
      );
    });

    it('Should not pay on sponsored deployment', async function () {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '0',
        tokenAmount: '0',
        tokenContract: fakeToken.address,
      });

      const typedDeployData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWalletFactory.address,
        deployRequest
      );

      const suffixData = getSuffixData(typedDeployData);

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
      const signature = getLocalEip712DeploySignature(
        typedDeployData,
        privateKey
      );

      const ownerBalanceBefore = await provider.getBalance(owner.address);

      await smartWalletFactory
        .connect(relayHub)
        .relayedUserSmartWalletCreation(
          deployRequest.request,
          suffixData,
          worker.address,
          signature
        );

      const ownerBalanceAfter = await provider.getBalance(owner.address);

      expect(ownerBalanceBefore).to.be.equal(ownerBalanceAfter);
    });

    it('Should fail when the call method fails on native payment', async function () {
      const deployRequest = createDeployRequest({
        relayHub: relayHub.address,
        from: owner.address,
        nonce: '0',
        tokenGas: '1',
        tokenAmount: '1',
        tokenContract: ZERO_ADDRESS,
      });

      const typedDeployData = new TypedDeployRequestData(
        HARDHAT_CHAIN_ID,
        smartWalletFactory.address,
        deployRequest
      );

      const suffixData = getSuffixData(typedDeployData);

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');
      const signature = getLocalEip712DeploySignature(
        typedDeployData,
        privateKey
      );

      await expect(
        smartWalletFactory
          .connect(relayHub)
          .relayedUserSmartWalletCreation(
            deployRequest.request,
            suffixData,
            worker.address,
            signature
          )
      ).to.be.revertedWith('Unable to pay for deployment');
    });
  });

  describe('Function execute()', function () {
    let mockSmartWallet: MockContract<MinimalBoltzSmartWallet>;
    let provider: BaseProvider;
    let owner: Wallet;
    let recipient: FakeContract<MinimalBoltzSmartWallet>;
    let recipientFunction: string;
    let privateKey: Buffer;
    let worker: SignerWithAddress;

    beforeEach(async function () {
      let fundedAccount: SignerWithAddress;
      [relayHub, fundedAccount, worker] = (await hardhat.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];

      const mockSmartWalletFactory =
        await smock.mock<MinimalBoltzSmartWallet__factory>(
          'MinimalBoltzSmartWallet'
        );

      provider = hardhat.provider;
      owner = hardhat.Wallet.createRandom().connect(provider);

      //Fund the owner
      await fundedAccount.sendTransaction({
        to: owner.address,
        value: hardhat.utils.parseEther('1'),
      });
      mockSmartWallet = await mockSmartWalletFactory.connect(owner).deploy();

      const domainSeparator = buildDomainSeparator(mockSmartWallet.address);
      await mockSmartWallet.setVariable('domainSeparator', domainSeparator);

      await fundedAccount.sendTransaction({
        to: mockSmartWallet.address,
        value: hardhat.utils.parseEther('1'),
      });

      recipient = await smock.fake('MinimalBoltzSmartWallet');
      recipient.isInitialized.returns(true);

      const ABI = ['function isInitialized()'];
      const abiInterface = new hardhat.utils.Interface(ABI);
      recipientFunction = abiInterface.encodeFunctionData('isInitialized', []);

      privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

      fakeToken = await smock.fake('ERC20');
    });

    it('Should not pay for relay', async function () {
      const relayRequest = createRelayRequest(
        {
          relayHub: relayHub.address,
          from: owner.address,
          to: recipient.address,
          tokenAmount: '0',
          tokenGas: '0',
          tokenContract: fakeToken.address,
          data: recipientFunction,
        },
        {
          callForwarder: mockSmartWallet.address,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      const suffixData = getSuffixData(typedRequestData);

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, worker.address, signature),
        'Execution failed'
      ).not.to.be.rejected;

      expect(recipient.isInitialized, 'Recipient method was not called').to.be
        .called;
    });

    it('Should pay for relay using native', async function () {
      const amountToBePaid = hardhat.utils.parseEther('0.1');
      const relayRequest = createRelayRequest(
        {
          relayHub: relayHub.address,
          from: owner.address,
          to: recipient.address,
          tokenAmount: amountToBePaid.toString(),
          tokenGas: '4000',
          tokenContract: ZERO_ADDRESS,
          data: recipientFunction,
        },
        {
          callForwarder: mockSmartWallet.address,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      const suffixData = getSuffixData(typedRequestData);

      const initialSwBalance = await provider.getBalance(
        mockSmartWallet.address
      );
      const initialOwnerBalance = await owner.getBalance();
      const initialWorkerBalance = await worker.getBalance();

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, worker.address, signature),
        'Execution failed'
      ).not.to.be.rejected;

      const finalSwBalance = await provider.getBalance(mockSmartWallet.address);
      const finalOwnerBalance = await owner.getBalance();
      const finalWorkerBalance = await worker.getBalance();

      expect(finalSwBalance).to.be.equal(0);
      expect(finalOwnerBalance).to.be.equal(
        initialOwnerBalance.add(initialSwBalance).sub(amountToBePaid)
      );
      expect(finalWorkerBalance).to.be.equal(
        initialWorkerBalance.add(amountToBePaid)
      );
      expect(recipient.isInitialized, 'Recipient method was not called').to.be
        .called;
    });

    it('Should increment nonce', async function () {
      const initialNonce = 0;

      const relayRequest = createRelayRequest(
        {
          relayHub: relayHub.address,
          from: owner.address,
          to: recipient.address,
          tokenAmount: '10',
          tokenGas: '40000',
          tokenContract: fakeToken.address,
          data: recipientFunction,
          nonce: initialNonce.toString(),
        },
        {
          callForwarder: mockSmartWallet.address,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      const suffixData = getSuffixData(typedRequestData);

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, worker.address, signature),
        'Execution failed'
      ).not.to.be.rejected;

      expect(
        await mockSmartWallet.nonce(),
        'Nonce was not incremented'
      ).to.equal(initialNonce + 1);
    });

    it('Should fail if not called by the relayHub', async function () {
      const notTheRelayHub = hardhat.Wallet.createRandom();
      notTheRelayHub.connect(provider);

      const relayRequest = createRelayRequest(
        {
          relayHub: notTheRelayHub.address,
          from: owner.address,
          to: recipient.address,
          tokenAmount: '10',
          tokenGas: '40000',
          tokenContract: fakeToken.address,
          data: recipientFunction,
        },
        {
          callForwarder: mockSmartWallet.address,
        }
      );

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      const suffixData = getSuffixData(typedRequestData);

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, worker.address, signature),
        'The execution did not fail'
      ).to.be.rejectedWith('Invalid caller');
    });

    it('Should fail when request is expired', async function () {
      const relayRequest = createRelayRequest({
        relayHub: relayHub.address,
        from: owner.address,
        validUntilTime: 1669903306, //Thursday, December 1, 2022 2:01:46 PM
      });

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

      const suffixData = getSuffixData(typedRequestData);
      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, owner.address, signature)
      ).to.be.rejectedWith('SW: request expired');
    });

    it('Should transfer when request is not expired', async function () {
      const date = new Date();
      const expirationInSeconds = Math.floor(date.getTime() / 1000) + 86400;

      const relayRequest = createRelayRequest({
        relayHub: relayHub.address,
        from: owner.address,
        validUntilTime: expirationInSeconds, //Always 1 day (86400 sec) ahead
      });

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        mockSmartWallet.address,
        relayRequest
      );

      const privateKey = Buffer.from(owner.privateKey.substring(2, 66), 'hex');

      const suffixData = getSuffixData(typedRequestData);
      const signature = getLocalEip712Signature(typedRequestData, privateKey);

      await expect(
        mockSmartWallet
          .connect(relayHub)
          .execute(suffixData, relayRequest.request, owner.address, signature),
        'The transaction was reverted'
      ).not.to.be.rejected;
    });
  });
});
