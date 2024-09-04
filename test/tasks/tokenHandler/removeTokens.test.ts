import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { removeTokens } from '../../../tasks/tokenHandler/removeTokens';
import { stubReadFileSync } from '../utils';
import { AllowedTokensArgs } from 'tasks/tokenHandler/allowTokens';

use(chaiAsPromised);

const A_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';
const B_TOKEN_ADDRESS = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D8';
const A_VERIFIER_ADDRESS = '0x123abc';
const B_VERIFIER_ADDRESS = '0xabc123';

describe('Remove Tokens Script', function () {
  const expectRemoveTokensNotToBeRejected = async (
    taskArgs: AllowedTokensArgs,
    expectedAcceptedTokens: string[] = []
  ) => {
    const fakeHash =
      '0xb444a8a7b80f6811f253a995df6e8ef094347ee27e9eeb726a735a931dc660ff';

    const stubContract = sinon.createStubInstance(Contract);
    stubContract['removeToken'] = () => fakeHash;
    stubContract['getAcceptedTokens'] = () => {
      return expectedAcceptedTokens;
    };
    sinon.stub(ethers, 'getContractAt').resolves(stubContract);
    await expect(removeTokens(taskArgs, hre)).to.not.be.rejected;
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

    describe('removeTokens with one token', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
      };

      it('should remove the token', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw error and print it if token cannot be removed', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });

    describe('removeTokens with multiple tokens', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
      };

      it('should remove the tokens', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw error and print it if token cannot be removed', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });
  });

  describe('reading the verifiers from args', function () {
    describe('remoteToken using one token and one verifier', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });

    describe('remoteToken using one token and multiple verifiers', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: A_TOKEN_ADDRESS,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });

    describe('remoteToken using multiple tokens and one verifier', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: A_VERIFIER_ADDRESS,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });

    describe('removeToken using multiple tokens and multiple verifiers', function () {
      const taskArgs: AllowedTokensArgs = {
        tokenList: `${A_TOKEN_ADDRESS},${B_TOKEN_ADDRESS}`,
        verifierList: `${A_VERIFIER_ADDRESS},${B_VERIFIER_ADDRESS}`,
      };

      beforeEach(function () {
        hre.network.config.chainId = 33;
      });

      afterEach(function () {
        sinon.restore();
      });

      it('should not be rejected', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs, [
          A_TOKEN_ADDRESS,
          B_TOKEN_ADDRESS,
        ]);
      });

      it('should throw an error', async function () {
        await expectRemoveTokensNotToBeRejected(taskArgs);
      });
    });
  });
});
