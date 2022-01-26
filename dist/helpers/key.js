"use strict";
/**
 * @file Account by key API helpers.
 * @author Bartłomiej (@engrave) Górnicki
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountByKeyAPI = void 0;
class AccountByKeyAPI {
    constructor(client) {
        this.client = client;
    }
    /**
     * Convenience for calling `account_by_key_api`.
     */
    call(method, params) {
        return this.client.call('account_by_key_api', method, params);
    }
    /**
     * Returns all accounts that have the key associated with their owner or active authorities.
     */
    async getKeyReferences(keys) {
        return this.call('get_key_references', { keys: keys.map((key) => key.toString()) });
    }
}
exports.AccountByKeyAPI = AccountByKeyAPI;
//# sourceMappingURL=key.js.map