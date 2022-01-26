"use strict";
/**
 * @file Hive crypto helpers.
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoUtils = exports.Signature = exports.PrivateKey = exports.PublicKey = exports.NETWORK_ID = void 0;
const assert_1 = __importDefault(require("assert"));
const crypto_1 = require("crypto");
const bs58 = __importStar(require("bs58"));
const bytebuffer_1 = __importDefault(require("bytebuffer"));
const secp256k1_1 = __importDefault(require("secp256k1"));
const verror_1 = require("verror");
const serializer_1 = require("./chain/serializer");
const client_1 = require("./client");
const utils_1 = require("./utils");
/**
 * Network id used in WIF-encoding.
 */
exports.NETWORK_ID = Buffer.from([0x80]);
/**
 * Return ripemd160 hash of input.
 */
function ripemd160(input) {
    return crypto_1.createHash('ripemd160')
        .update(input)
        .digest();
}
/**
 * Return sha256 hash of input.
 */
function sha256(input) {
    return crypto_1.createHash('sha256')
        .update(input)
        .digest();
}
/**
 * Return 2-round sha256 hash of input.
 */
function doubleSha256(input) {
    return sha256(sha256(input));
}
/**
 * Encode public key with bs58+ripemd160-checksum.
 */
function encodePublic(key, prefix) {
    const checksum = ripemd160(key);
    return prefix + bs58.encode(Buffer.concat([key, checksum.slice(0, 4)]));
}
/**
 * Decode bs58+ripemd160-checksum encoded public key.
 */
function decodePublic(encodedKey) {
    const prefix = encodedKey.slice(0, 3);
    assert_1.default.equal(prefix.length, 3, 'public key invalid prefix');
    encodedKey = encodedKey.slice(3);
    const buffer = bs58.decode(encodedKey);
    const checksum = buffer.slice(-4);
    const key = buffer.slice(0, -4);
    const checksumVerify = ripemd160(key).slice(0, 4);
    assert_1.default.deepEqual(checksumVerify, checksum, 'public key checksum mismatch');
    return { key, prefix };
}
/**
 * Encode bs58+doubleSha256-checksum private key.
 */
function encodePrivate(key) {
    assert_1.default.equal(key.readUInt8(0), 0x80, 'private key network id mismatch');
    const checksum = doubleSha256(key);
    return bs58.encode(Buffer.concat([key, checksum.slice(0, 4)]));
}
/**
 * Decode bs58+doubleSha256-checksum encoded private key.
 */
function decodePrivate(encodedKey) {
    const buffer = bs58.decode(encodedKey);
    assert_1.default.deepEqual(buffer.slice(0, 1), exports.NETWORK_ID, 'private key network id mismatch');
    const checksum = buffer.slice(-4);
    const key = buffer.slice(0, -4);
    const checksumVerify = doubleSha256(key).slice(0, 4);
    assert_1.default.deepEqual(checksumVerify, checksum, 'private key checksum mismatch');
    return key;
}
/**
 * Return true if signature is canonical, otherwise false.
 */
function isCanonicalSignature(signature) {
    return (!(signature[0] & 0x80) &&
        !(signature[0] === 0 && !(signature[1] & 0x80)) &&
        !(signature[32] & 0x80) &&
        !(signature[32] === 0 && !(signature[33] & 0x80)));
}
/**
 * Return true if string is wif, otherwise false.
 */
function isWif(privWif) {
    try {
        const bufWif = new Buffer(bs58.decode(privWif));
        const privKey = bufWif.slice(0, -4);
        const checksum = bufWif.slice(-4);
        let newChecksum = sha256(privKey);
        newChecksum = sha256(newChecksum);
        newChecksum = newChecksum.slice(0, 4);
        return checksum.toString() === newChecksum.toString();
    }
    catch (e) {
        return false;
    }
}
/**
 * ECDSA (secp256k1) public key.
 */
class PublicKey {
    constructor(key, prefix = client_1.DEFAULT_ADDRESS_PREFIX) {
        this.key = key;
        this.prefix = prefix;
        assert_1.default(secp256k1_1.default.publicKeyVerify(key), 'invalid public key');
    }
    /**
     * Create a new instance from a WIF-encoded key.
     */
    static fromString(wif) {
        const { key, prefix } = decodePublic(wif);
        return new PublicKey(key, prefix);
    }
    /**
     * Create a new instance.
     */
    static from(value) {
        if (value instanceof PublicKey) {
            return value;
        }
        else {
            return PublicKey.fromString(value);
        }
    }
    /**
     * Verify a 32-byte signature.
     * @param message 32-byte message to verify.
     * @param signature Signature to verify.
     */
    verify(message, signature) {
        return secp256k1_1.default.verify(message, signature.data, this.key);
    }
    /**
     * Return a WIF-encoded representation of the key.
     */
    toString() {
        return encodePublic(this.key, this.prefix);
    }
    /**
     * Return JSON representation of this key, same as toString().
     */
    toJSON() {
        return this.toString();
    }
    /**
     * Used by `utils.inspect` and `console.log` in node.js.
     */
    inspect() {
        return `PublicKey: ${this.toString()}`;
    }
}
exports.PublicKey = PublicKey;
/**
 * ECDSA (secp256k1) private key.
 */
class PrivateKey {
    constructor(key) {
        this.key = key;
        assert_1.default(secp256k1_1.default.privateKeyVerify(key), 'invalid private key');
    }
    /**
     * Convenience to create a new instance from WIF string or buffer.
     */
    static from(value) {
        if (typeof value === 'string') {
            return PrivateKey.fromString(value);
        }
        else {
            return new PrivateKey(value);
        }
    }
    /**
     * Create a new instance from a WIF-encoded key.
     */
    static fromString(wif) {
        return new PrivateKey(decodePrivate(wif).slice(1));
    }
    /**
     * Create a new instance from a seed.
     */
    static fromSeed(seed) {
        return new PrivateKey(sha256(seed));
    }
    /**
     * Create key from username and password.
     */
    static fromLogin(username, password, role = 'active') {
        const seed = username + role + password;
        return PrivateKey.fromSeed(seed);
    }
    /**
     * Sign message.
     * @param message 32-byte message.
     */
    sign(message) {
        let rv;
        let attempts = 0;
        do {
            const options = {
                data: sha256(Buffer.concat([message, Buffer.alloc(1, ++attempts)]))
            };
            rv = secp256k1_1.default.sign(message, this.key, options);
        } while (!isCanonicalSignature(rv.signature));
        return new Signature(rv.signature, rv.recovery);
    }
    /**
     * Derive the public key for this private key.
     */
    createPublic(prefix) {
        return new PublicKey(secp256k1_1.default.publicKeyCreate(this.key), prefix);
    }
    /**
     * Return a WIF-encoded representation of the key.
     */
    toString() {
        return encodePrivate(Buffer.concat([exports.NETWORK_ID, this.key]));
    }
    /**
     * Used by `utils.inspect` and `console.log` in node.js. Does not show the full key
     * to get the full encoded key you need to explicitly call {@link toString}.
     */
    inspect() {
        const key = this.toString();
        return `PrivateKey: ${key.slice(0, 6)}...${key.slice(-6)}`;
    }
}
exports.PrivateKey = PrivateKey;
/**
 * ECDSA (secp256k1) signature.
 */
class Signature {
    constructor(data, recovery) {
        this.data = data;
        this.recovery = recovery;
        assert_1.default.equal(data.length, 64, 'invalid signature');
    }
    static fromBuffer(buffer) {
        assert_1.default.equal(buffer.length, 65, 'invalid signature');
        const recovery = buffer.readUInt8(0) - 31;
        const data = buffer.slice(1);
        return new Signature(data, recovery);
    }
    static fromString(string) {
        return Signature.fromBuffer(Buffer.from(string, 'hex'));
    }
    /**
     * Recover public key from signature by providing original signed message.
     * @param message 32-byte message that was used to create the signature.
     */
    recover(message, prefix) {
        return new PublicKey(secp256k1_1.default.recover(message, this.data, this.recovery), prefix);
    }
    toBuffer() {
        const buffer = Buffer.alloc(65);
        buffer.writeUInt8(this.recovery + 31, 0);
        this.data.copy(buffer, 1);
        return buffer;
    }
    toString() {
        return this.toBuffer().toString('hex');
    }
}
exports.Signature = Signature;
/**
 * Return the sha256 transaction digest.
 * @param chainId The chain id to use when creating the hash.
 */
function transactionDigest(transaction, chainId = client_1.DEFAULT_CHAIN_ID) {
    const buffer = new bytebuffer_1.default(bytebuffer_1.default.DEFAULT_CAPACITY, bytebuffer_1.default.LITTLE_ENDIAN);
    try {
        serializer_1.Types.Transaction(buffer, transaction);
    }
    catch (cause) {
        throw new verror_1.VError({ cause, name: 'SerializationError' }, 'Unable to serialize transaction');
    }
    buffer.flip();
    const transactionData = Buffer.from(buffer.toBuffer());
    const digest = sha256(Buffer.concat([chainId, transactionData]));
    return digest;
}
/**
 * Return copy of transaction with signature appended to signatures array.
 * @param transaction Transaction to sign.
 * @param keys Key(s) to sign transaction with.
 * @param options Chain id and address prefix, compatible with {@link Client}.
 */
function signTransaction(transaction, keys, chainId = client_1.DEFAULT_CHAIN_ID) {
    const digest = transactionDigest(transaction, chainId);
    const signedTransaction = utils_1.copy(transaction);
    if (!signedTransaction.signatures) {
        signedTransaction.signatures = [];
    }
    if (!Array.isArray(keys)) {
        keys = [keys];
    }
    for (const key of keys) {
        const signature = key.sign(digest);
        signedTransaction.signatures.push(signature.toString());
    }
    return signedTransaction;
}
function generateTrxId(transaction) {
    const buffer = new bytebuffer_1.default(bytebuffer_1.default.DEFAULT_CAPACITY, bytebuffer_1.default.LITTLE_ENDIAN);
    try {
        serializer_1.Types.Transaction(buffer, transaction);
    }
    catch (cause) {
        throw new verror_1.VError({ cause, name: 'SerializationError' }, 'Unable to serialize transaction');
    }
    buffer.flip();
    const transactionData = Buffer.from(buffer.toBuffer());
    return exports.cryptoUtils
        .sha256(transactionData)
        .toString('hex')
        .slice(0, 40);
}
/** Misc crypto utility functions. */
exports.cryptoUtils = {
    decodePrivate,
    doubleSha256,
    encodePrivate,
    encodePublic,
    generateTrxId,
    isCanonicalSignature,
    isWif,
    ripemd160,
    sha256,
    signTransaction,
    transactionDigest
};
//# sourceMappingURL=crypto.js.map