"use strict";
/**
 * @file Hive blockchain helpers.
 * @author Johan Nordberg <code@johan-nordberg.com>
 * @license
 * Copyright (c) 2017 Johan Nordberg. All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *  1. Redistribution of source code must retain the above copyright notice, this
 *     list of conditions and the following disclaimer.
 *
 *  2. Redistribution in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *
 *  3. Neither the name of the copyright holder nor the names of its contributors
 *     may be used to endorse or promote products derived from this software without
 *     specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * You acknowledge that this software is not designed, licensed or intended for use
 * in the design, construction, operation or maintenance of any military facility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blockchain = exports.BlockchainMode = void 0;
const utils_1 = require("./../utils");
var BlockchainMode;
(function (BlockchainMode) {
    /**
     * Only get irreversible blocks.
     */
    BlockchainMode[BlockchainMode["Irreversible"] = 0] = "Irreversible";
    /**
     * Get all blocks.
     */
    BlockchainMode[BlockchainMode["Latest"] = 1] = "Latest";
})(BlockchainMode = exports.BlockchainMode || (exports.BlockchainMode = {}));
class Blockchain {
    constructor(client) {
        this.client = client;
    }
    /**
     * Get latest block number.
     */
    async getCurrentBlockNum(mode = BlockchainMode.Irreversible) {
        const props = await this.client.database.getDynamicGlobalProperties();
        switch (mode) {
            case BlockchainMode.Irreversible:
                return props.last_irreversible_block_num;
            case BlockchainMode.Latest:
                return props.head_block_number;
        }
    }
    /**
     * Get latest block header.
     */
    async getCurrentBlockHeader(mode) {
        return this.client.database.getBlockHeader(await this.getCurrentBlockNum(mode));
    }
    /**
     * Get latest block.
     */
    async getCurrentBlock(mode) {
        return this.client.database.getBlock(await this.getCurrentBlockNum(mode));
    }
    /**
     * Return a asynchronous block number iterator.
     * @param options Feed options, can also be a block number to start from.
     */
    async *getBlockNumbers(options) {
        // const config = await this.client.database.getConfig()
        // const interval = config['BLOCK_INTERVAL'] as number
        const interval = 3;
        if (!options) {
            options = {};
        }
        else if (typeof options === 'number') {
            options = { from: options };
        }
        let current = await this.getCurrentBlockNum(options.mode);
        if (options.from !== undefined && options.from > current) {
            throw new Error(`From can't be larger than current block num (${current})`);
        }
        let seen = options.from !== undefined ? options.from : current;
        while (true) {
            while (current > seen) {
                yield seen++;
                if (options.to !== undefined && seen > options.to) {
                    return;
                }
            }
            await utils_1.sleep(interval * 1000);
            current = await this.getCurrentBlockNum(options.mode);
        }
    }
    /**
     * Return a stream of block numbers, accepts same parameters as {@link getBlockNumbers}.
     */
    getBlockNumberStream(options) {
        return utils_1.iteratorStream(this.getBlockNumbers(options));
    }
    /**
     * Return a asynchronous block iterator, accepts same parameters as {@link getBlockNumbers}.
     */
    async *getBlocks(options) {
        for await (const num of this.getBlockNumbers(options)) {
            yield await this.client.database.getBlock(num);
        }
    }
    /**
     * Return a stream of blocks, accepts same parameters as {@link getBlockNumbers}.
     */
    getBlockStream(options) {
        return utils_1.iteratorStream(this.getBlocks(options));
    }
    /**
     * Return a asynchronous operation iterator, accepts same parameters as {@link getBlockNumbers}.
     */
    async *getOperations(options) {
        for await (const num of this.getBlockNumbers(options)) {
            const operations = await this.client.database.getOperations(num);
            for (const operation of operations) {
                yield operation;
            }
        }
    }
    /**
     * Return a stream of operations, accepts same parameters as {@link getBlockNumbers}.
     */
    getOperationsStream(options) {
        return utils_1.iteratorStream(this.getOperations(options));
    }
}
exports.Blockchain = Blockchain;
//# sourceMappingURL=blockchain.js.map