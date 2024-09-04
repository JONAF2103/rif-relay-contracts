import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { removeContracts } from '../../../tasks/destinationContractHandler/removeContracts';
import { stubReadFileSync } from '../utils';
import { AllowedContractsArgs } from 'tasks/destinationContractHandler/allowContracts';

use(chaiAsPromised);

const A_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';
const B_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D8';
const A_VERIFIER_ADDRESS = '0x123abc';
const B_VERIFIER_ADDRESS = '0xabc123';

describe('Remove Contracts Script', function () {
  const expectRemoveContractsNotToBeRejected = async (
    taskArgs: AllowedContractsArgs,
    expectedAcceptedContracts: string[] = []
  ) => {
    const fakeHash =
      '0xb444a8a7b80f6811f253a995df6e8ef094347ee27e9eeb726a735a931dc660ff';

    const stubContract = sinon.createStubInstance(Contract);
    stubContract['removeContract'] = () => fakeHash;
    stubContract['getAcceptedContracts'] = () => {
      return expectedAcceptedContracts;
    };
    sinon.stub(ethers, 'getContractAt').resolves(stubContract);
    await expect(removeContracts(taskArgs, hre)).to.not.be.rejected;
  };

  describe('reading the verifiers from file', function () {
    beforeEach(function () {
      sinon.stub(fs, 'existsSync').returns(true);
      stubReadFileSync();
      hre.network.config.chainId = 33;
    });

    afterEach(function () {
      sinon.restore();
    });

    describe('removeContracts with one contract', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: A_TOKEN_ADDRESS,
      };

      it('should remove the contract', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw error and print it if contract cannot be removed', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });

    describe('removeContracts with multiple contracts', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
      };

      it('should remove the contracts', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw error and print it if contract cannot be removed', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });
  });

  describe('reading the verifiers from args', function () {
    describe('remoteContract using one contract and one verifier', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: A_TOKEN_ADDRESS,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });

    describe('remoteContract using one contract and multiple verifiers', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: A_TOKEN_ADDRESS,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });

    describe('remoteContract using multiple contracts and one verifier', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });

    describe('removeContract using multiple contracts and multiple verifiers', function () {
      const taskArgs: AllowedContractsArgs = {
        contractList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveContractsNotToBeRejected(taskArgs);
      });
    });
  });
});
