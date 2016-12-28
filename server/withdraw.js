var assert = require('assert');
var bc = require('./bitcoin_client');
var db = require('./database');
var request = require('request');
var config = require('../config/config');

// Doesn't validate
module.exports = function(userId, satoshis, withdrawalAddress, withdrawalId, settings, callback) {
    // var minWithdraw = config.MINING_FEE + 100;
    assert(typeof userId === 'number');
    // assert(satoshis >= minWithdraw);
    assert(typeof withdrawalAddress === 'string');
    assert(typeof callback === 'function');

    db.makeWithdrawal(userId, satoshis, withdrawalAddress, withdrawalId, function (err, fundingId) {
        if (err) {
            if (err.code === '23514')
                callback('NOT_ENOUGH_MONEY');
            else if(err.code === '23505')
                callback('SAME_WITHDRAWAL_ID');
            else
                callback(err);
            return;
        }

        assert(fundingId);

        if (satoshis / 100 > settings.automatic_withdrawal_limit) {
            console.log('Big withdrawal over automatic_withdrawal_limit ', fundingId);
            callback('OVER_LIMIT');
            return;
        }

        var amountToSend = (satoshis - (parseFloat(settings.withdrawal_mining_fee) * 100)) / 1e8;
        bc.sendToAddress(withdrawalAddress, amountToSend, function (err, hash) {
            if (err) {
                if (err.message === 'Insufficient funds')
                    return callback('PENDING');
                return callback('FUNDING_QUEUED');
            }

            db.setFundingsWithdrawalTxid(fundingId, hash, function (err) {
                if (err)
                    return callback(new Error('Could not set fundingId ' + fundingId + ' to ' + hash + ': \n' + err));

                callback(null);
            });
        });
    });
};