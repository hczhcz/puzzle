'use strict';

var levels = [];

var load_puzzle = function (index, key) {
    try {
        eval(
            CryptoJS
                .AES
                .decrypt(levels[index], key)
                .toString(CryptoJS.enc.Utf8)
        );
    } catch (e) {
        // ignore
    }
};

$('#go').click(function () {
    for (var index in levels) {
        load_puzzle(index, $('#key').val());
    }
});
