import { oneRBTC } from '../utils/constants';
import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { Penalizer, Penalizer__factory } from 'typechain-types';
import { RelayHub } from 'typechain-types/contracts/RelayHub';
import {
  ERR_UNKNOWN_RELAY_MANAGER,
  ERR_TXN_IS_EQUAL,
  ERROR_DIFFERENT_SIGNER,
  ERROR_DIFFERENT_NONCE,
  ERROR_TXNS_ALREADY_PENALIZED,
} from '../utils/errorMessages.utils';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Transaction } from 'ethers';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

let relayWorker: SignerWithAddress;
let otherUser1: SignerWithAddress;
let otherUser2: SignerWithAddress;

async function sendTransaction(address: string) {
  const txn = await relayWorker.sendTransaction({
    to: address,
    value: oneRBTC,
    gasPrice: '773912629',
  });

  return decryptTxn(txn);
}

async function decryptTxn(txn: TransactionResponse | Transaction) {
  const { v, s, r, chainId } = txn;

  let v1 = v ?? 0;
  if (v1 > 28) {
    v1 -= chainId * 2 + 8;
  }

  const expandedSignature = { r: r ?? '', s: s ?? '', v: v1 };
  const signature = ethers.utils.joinSignature(expandedSignature);

  const txData = {
    gasPrice: txn.gasPrice,
    gasLimit: txn.gasLimit,
    value: txn.value,
    nonce: txn.nonce,
    data: txn.data,
    chainId: txn.chainId,
    to: txn.to,
  };
  const rsTx = await ethers.utils.resolveProperties(txData);
  const rawTxn = ethers.utils.serializeTransaction(rsTx);

  return { rawTxn, signature, txData };
}

describe('Penalizer Contract', function () {
  let fakeRelayHub: FakeContract<RelayHub>;

  describe('Version Penalizer', function () {
    let penalizer: MockContract<Penalizer>;

    it('Should retrieve the penalizer version', async function () {
      const penalizerFactory: MockContractFactory<Penalizer__factory> =
        await smock.mock<Penalizer__factory>('Penalizer');

      penalizer = await penalizerFactory.deploy();
      expect(
        await penalizer.versionPenalizer(),
        'Contract version is wrong'
      ).to.be.eql('2.0.1+enveloping.penalizer.ipenalizer');
    });
  });

  describe('Penalize Repeated nonce method() tests', function () {
    let penalizer: MockContract<Penalizer>;

    beforeEach(async function () {
      [relayWorker, otherUser1, otherUser2] = (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress,
        SignerWithAddress
      ];

      const penalizerFactory: MockContractFactory<Penalizer__factory> =
        await smock.mock<Penalizer__factory>('Penalizer');

      penalizer = await penalizerFactory.deploy();
      fakeRelayHub = await smock.fake('RelayHub');
    });

    afterEach(function () {
      penalizer = undefined as unknown as MockContract<Penalizer>;
    });

    it('Should fail to penalize two equal txns', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);
      const txn = await sendTransaction(otherUser2.address);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          txn.rawTxn,
          txn.signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(ERR_TXN_IS_EQUAL);
    });

    it('Should fail to penalize when relay manages is not staked', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(false);
      const txn = await sendTransaction(otherUser2.address);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          txn.rawTxn,
          txn.signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERR_UNKNOWN_RELAY_MANAGER
      );
    });

    it('Should fail to penalize when signer is different', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);
      const txn = await sendTransaction(otherUser2.address);
      const txn2 = await otherUser1.sendTransaction({
        to: otherUser2.address,
        value: oneRBTC,
        gasPrice: '773912629',
      });

      const { v, s, r, chainId } = txn2;

      let v1 = v ?? 0;
      if (v1 > 28) {
        v1 -= chainId * 2 + 8;
      }

      const expandedSignature = { r: r ?? '', s: s ?? '', v: v1 };
      const signature = ethers.utils.joinSignature(expandedSignature);

      const txData = {
        gasPrice: txn2.gasPrice,
        gasLimit: txn2.gasLimit,
        value: txn2.value,
        nonce: txn2.nonce,
        data: txn2.data,
        chainId: txn2.chainId,
        to: txn2.to,
      };
      const rsTx = await ethers.utils.resolveProperties(txData);
      const rawTxn = ethers.utils.serializeTransaction(rsTx);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          rawTxn,
          signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERROR_DIFFERENT_SIGNER
      );
    });

    it.skip('Should fail to penalize for ecrecover exception', async function () {
      //TODO - Currently not able to reproduce this exception
    });

    it('Should fail to penalize when txns have the same data but the nonce', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);
      const txn = await sendTransaction(otherUser2.address);
      const txn2 = await sendTransaction(otherUser2.address);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          txn2.rawTxn,
          txn2.signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERROR_DIFFERENT_NONCE
      );
    });

    it('Should fail to penalize when txns have the same data but the gas price', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);
      const txn = await sendTransaction(otherUser2.address);

      const txn2 = await relayWorker.sendTransaction({
        to: otherUser2.address,
        value: oneRBTC,
        gasPrice: txn.txData.gasPrice?.add(1),
      });

      const { v, s, r, chainId } = txn2;

      let v1 = v ?? 0;
      if (v1 > 28) {
        v1 -= chainId * 2 + 8;
      }

      const expandedSignature = { r: r ?? '', s: s ?? '', v: v1 };
      const signature = ethers.utils.joinSignature(expandedSignature);

      const txData = {
        gasPrice: txn2.gasPrice,
        gasLimit: txn2.gasLimit,
        value: txn2.value,
        nonce: txn2.nonce,
        data: txn2.data,
        chainId: txn2.chainId,
        to: txn2.to,
      };
      const rsTx = await ethers.utils.resolveProperties(txData);
      const raw = ethers.utils.serializeTransaction(rsTx);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          raw,
          signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERROR_DIFFERENT_NONCE
      );
    });

    it('Should fail to penalize when txns have the same data but the value', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);
      const txn = await sendTransaction(otherUser2.address);

      const txn2 = await relayWorker.sendTransaction({
        to: otherUser2.address,
        value: oneRBTC.add(oneRBTC),
        gasPrice: '773912629',
      });

      const { v, s, r, chainId } = txn2;

      let v1 = v ?? 0;
      if (v1 > 28) {
        v1 -= chainId * 2 + 8;
      }

      const expandedSignature = { r: r ?? '', s: s ?? '', v: v1 };
      const signature = ethers.utils.joinSignature(expandedSignature);

      const txData = {
        gasPrice: txn2.gasPrice,
        gasLimit: txn2.gasLimit,
        value: txn2.value,
        nonce: txn2.nonce,
        data: txn2.data,
        chainId: txn2.chainId,
        to: txn2.to,
      };
      const rsTx = await ethers.utils.resolveProperties(txData);
      const raw = ethers.utils.serializeTransaction(rsTx);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          txn.rawTxn,
          txn.signature,
          raw,
          signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERROR_DIFFERENT_NONCE
      );
    });

    it('Should penalize txns with the same data', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);

      const relayWorker2 = ethers.Wallet.createRandom();
      const signed = await relayWorker2.signTransaction({
        to: otherUser2.address,
        value: oneRBTC,
      });
      const trx = ethers.utils.parseTransaction(signed);
      const unsignedTxn1 = await decryptTxn(trx);
      const msgHashTxn1 = ethers.utils.keccak256(unsignedTxn1.rawTxn);

      const signed2 = await relayWorker2.signTransaction({
        to: otherUser1.address,
        value: oneRBTC,
      });
      const trx2 = ethers.utils.parseTransaction(signed2);
      const unsignedTxn2 = await decryptTxn(trx2);

      const msgHashTxn2 = ethers.utils.keccak256(unsignedTxn2.rawTxn);

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          unsignedTxn1.rawTxn,
          unsignedTxn1.signature,
          unsignedTxn2.rawTxn,
          unsignedTxn2.signature,
          fakeRelayHub.address
        );
      await expect(promiseOfPenalize).to.be.fulfilled;

      expect(await penalizer.penalizedTransactions(msgHashTxn1)).to.be.true;
      expect(await penalizer.penalizedTransactions(msgHashTxn2)).to.be.true;
    });

    it('Should failt to penalize a txns already penalized', async function () {
      fakeRelayHub.isRelayManagerStaked.returns(true);

      const relayWorker2 = ethers.Wallet.createRandom();
      const signed = await relayWorker2.signTransaction({
        to: otherUser2.address,
        value: oneRBTC,
      });
      const trx = ethers.utils.parseTransaction(signed);
      const unsignedTxn1 = await decryptTxn(trx);
      const msgHashTxn1 = ethers.utils.keccak256(unsignedTxn1.rawTxn);

      const signed2 = await relayWorker2.signTransaction({
        to: otherUser1.address,
        value: oneRBTC,
      });
      const trx2 = ethers.utils.parseTransaction(signed2);
      const unsignedTxn2 = await decryptTxn(trx2);

      const msgHashTxn2 = ethers.utils.keccak256(unsignedTxn2.rawTxn);

      await penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          unsignedTxn1.rawTxn,
          unsignedTxn1.signature,
          unsignedTxn2.rawTxn,
          unsignedTxn2.signature,
          fakeRelayHub.address
        );

      expect(await penalizer.penalizedTransactions(msgHashTxn1)).to.be.true;
      expect(await penalizer.penalizedTransactions(msgHashTxn2)).to.be.true;

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          unsignedTxn1.rawTxn,
          unsignedTxn1.signature,
          unsignedTxn2.rawTxn,
          unsignedTxn2.signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERROR_TXNS_ALREADY_PENALIZED
      );
    });

    it('Should failt to penalize txns from different relays', async function () {
      fakeRelayHub.isRelayManagerStaked.returnsAtCall(0, true);
      fakeRelayHub.isRelayManagerStaked.returnsAtCall(1, false);

      const relayWorker2 = ethers.Wallet.createRandom();
      const signed = await relayWorker2.signTransaction({
        to: otherUser2.address,
        value: oneRBTC,
      });
      const trx = ethers.utils.parseTransaction(signed);
      const unsignedTxn1 = await decryptTxn(trx);
      const msgHashTxn1 = ethers.utils.keccak256(unsignedTxn1.rawTxn);

      const signed2 = await relayWorker2.signTransaction({
        to: otherUser1.address,
        value: oneRBTC,
      });
      const trx2 = ethers.utils.parseTransaction(signed2);
      const unsignedTxn2 = await decryptTxn(trx2);

      const msgHashTxn2 = ethers.utils.keccak256(unsignedTxn2.rawTxn);

      await penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          unsignedTxn1.rawTxn,
          unsignedTxn1.signature,
          unsignedTxn2.rawTxn,
          unsignedTxn2.signature,
          fakeRelayHub.address
        );

      expect(await penalizer.penalizedTransactions(msgHashTxn1)).to.be.true;
      expect(await penalizer.penalizedTransactions(msgHashTxn2)).to.be.true;

      const promiseOfPenalize = penalizer
        .connect(relayWorker)
        .penalizeRepeatedNonce(
          unsignedTxn1.rawTxn,
          unsignedTxn1.signature,
          unsignedTxn2.rawTxn,
          unsignedTxn2.signature,
          fakeRelayHub.address
        );

      await expect(promiseOfPenalize).to.have.revertedWith(
        ERR_UNKNOWN_RELAY_MANAGER
      );
    });
  });
});
